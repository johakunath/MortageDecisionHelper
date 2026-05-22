import { useMemo, useState } from "react";
import CompromiseFinder from "./components/CompromiseFinder";
import InputsPanel from "./components/InputsPanel";
import QASection from "./components/QASection";
import RightPanel from "./components/RightPanel";
import ScenarioCard from "./components/ScenarioCard";
import SondertilgungPanel from "./components/SondertilgungPanel";
import TradeoffMatrix from "./components/TradeoffMatrix";
import WaitPanel from "./components/WaitPanel";
import { MetricBar, Readout, Section } from "./components/ui";
import {
  buildScenarios,
  buildWaitScenario,
  evaluateDecision,
  opportunityCost,
  requiredSpecialToMatch,
  type InterestRates,
  type MortgageInputs,
  type ScenarioId,
} from "./lib/calculations";
import {
  CASE_PRESETS,
  DEFAULT_INPUTS,
  DEFAULT_RATES,
  EK_SCENARIOS,
  MAIN_TABS,
  type InputGroupId,
  type MainTabId,
  type PresetId,
} from "./lib/defaults";
import { formatEur, formatPct, formatYears } from "./lib/format";

type NumericInputKey = Exclude<keyof MortgageInputs, "annualSpecialRepayments">;

export default function App() {
  const [inputs, setInputs] = useState<MortgageInputs>({ ...DEFAULT_INPUTS });
  const [rates, setRates] = useState<InterestRates>({ ...DEFAULT_RATES });
  const [selectedId, setSelectedId] = useState<ScenarioId>("ek10");
  const [activeTab, setActiveTab] = useState<MainTabId>("decision");
  const [inputGroup, setInputGroup] = useState<InputGroupId>("purchase");

  const scenarios = useMemo(
    () => buildScenarios(EK_SCENARIOS, inputs, rates),
    [inputs, rates],
  );
  const selected = scenarios.find((scenario) => scenario.id === selectedId) ?? scenarios[1];
  const decision = useMemo(() => evaluateDecision(scenarios), [scenarios]);
  const ek15 = scenarios.find((scenario) => scenario.id === "ek15") ?? scenarios[2];
  const special5 = useMemo(
    () => requiredSpecialToMatch(EK_SCENARIOS[0], ek15.mortgage.interestTotal, inputs, rates),
    [ek15.mortgage.interestTotal, inputs, rates],
  );
  const special10 = useMemo(
    () => requiredSpecialToMatch(EK_SCENARIOS[1], ek15.mortgage.interestTotal, inputs, rates),
    [ek15.mortgage.interestTotal, inputs, rates],
  );
  const wait = useMemo(
    () => buildWaitScenario(selected, selected, inputs, rates),
    [selected, inputs, rates],
  );

  const maxInterest = Math.max(1, ...scenarios.map((scenario) => scenario.mortgage.interestTotal));
  const maxCash = Math.max(1, ...scenarios.map((scenario) => Math.abs(scenario.cashLeft)));
  const etfOpportunity15vs10 = opportunityCost(
    Math.max(0, scenarios[2].downPayment - scenarios[1].downPayment),
    inputs.etfReturnRate,
    inputs.fixedRateYears,
  );
  const modelName = `${Math.round(inputs.purchasePrice / 1000)}k Modell`;
  const selectedReserveCopy = selected.reserveGap < 0
    ? `das Reserve-Ziel von ${formatEur(inputs.reserveTarget)} ist verletzt.`
    : `innerhalb deines Reserve-Ziels von ${formatEur(inputs.reserveTarget)}.`;

  function updateInput(key: NumericInputKey, value: number) {
    setInputs((current) => ({ ...current, [key]: value }));
  }

  function updateSpecialRepayment(yearIndex: number, value: number) {
    setInputs((current) => {
      const next = [...current.annualSpecialRepayments];
      while (next.length <= yearIndex) {
        next.push(current.annualSpecialRepayment);
      }
      next[yearIndex] = value;
      const filled = next.map((amount) => Number.isFinite(amount) ? amount : 0);
      return {
        ...current,
        annualSpecialRepayments: filled,
        annualSpecialRepayment:
          filled.length > 0 ? filled.reduce((sum, amount) => sum + amount, 0) / filled.length : 0,
      };
    });
  }

  function updateRate(key: ScenarioId, value: number) {
    setRates((current) => ({ ...current, [key]: value }));
  }

  function applyPreset(preset: PresetId | "reset" | "safety" | "special") {
    if (preset === "reset") {
      setInputs({ ...DEFAULT_INPUTS });
      setRates({ ...DEFAULT_RATES });
      setSelectedId("ek10");
      setInputGroup("purchase");
      return;
    }

    if (preset === "safety") {
      setInputs((current) => ({
        ...current,
        reserveTarget: 35000,
        annualSpecialRepayment: 3000,
        annualSpecialRepayments: current.annualSpecialRepayments.map(() => 3000),
        repaymentRate: 2.2,
      }));
      setSelectedId("ek5");
      return;
    }

    if (preset === "special") {
      setInputs((current) => ({
        ...current,
        annualSpecialRepayment: 12000,
        annualSpecialRepayments: current.annualSpecialRepayments.map(() => 12000),
        repaymentRate: 2.8,
      }));
      setSelectedId("ek10");
      return;
    }

    const selectedPreset = CASE_PRESETS[preset];
    setInputs({ ...selectedPreset.inputs });
    setRates({ ...selectedPreset.rates });
    setSelectedId(selectedPreset.selectedId);
    setActiveTab("decision");
    setInputGroup("purchase");
  }

  const scenarioChooser = (
    <Section
      title="Szenario wählen"
      subtitle="Klicke 5%, 10% oder 15%. Die Auswahl aktualisiert Ergebnisbox und Trade-offs."
      right={<span className="muted">Kaufnebenkosten: {formatEur(selected.closingCosts)}</span>}
    >
      <div className="scenario-stack">
        {scenarios.map((scenario) => (
          <ScenarioCard
            key={scenario.id}
            scenario={scenario}
            selected={selectedId === scenario.id}
            onSelect={() => setSelectedId(scenario.id)}
          />
        ))}
      </div>
    </Section>
  );

  const decisionContent = (
    <div className="content-stack">
      <div className="selection-zone">
        <CompromiseFinder
          scenarios={scenarios}
          decision={decision}
          selected={selected}
          onSelectScenario={setSelectedId}
        />
      </div>
      <div className="zone-label">Was das bedeutet</div>
      <section className="story-section">
        <div className="story-kicker">Was {selected.ekRate}% bedeutet</div>
        <p>
          Du bringst <span>{formatEur(selected.downPayment)}</span> Eigenkapital mit und nimmst{" "}
          <span>{formatEur(selected.loan)}</span> als Darlehen auf. Die Bank verlangt{" "}
          <span>{formatPct(selected.interestRate)}</span> Zins. Daraus wird eine monatliche Rate von{" "}
          <span>{formatEur(selected.mortgage.regularMonthlyPayment)}</span>; mit Eigentumskosten
          landest du bei <span>{formatEur(selected.allInMonthly)}</span> all-in.
        </p>
        <p>
          Nach dem Kauf bleiben dir{" "}
          <span className={selected.cashLeft < 0 ? "negative" : "positive"}>
            {formatEur(selected.cashLeft)}
          </span>{" "}
          in der Reserve, {selectedReserveCopy} Über die volle Laufzeit zahlst du{" "}
          <span>{formatEur(selected.mortgage.interestTotal)}</span> Zinsen.
        </p>
      </section>
      <section className="quiet-metrics">
        <div>
          <strong>{formatEur(selected.mortgage.regularMonthlyPayment)}</strong>
          <span>Monatsrate</span>
          <small>{formatPct(selected.interestRate)} Zins · {formatPct(inputs.repaymentRate)} Tilgung</small>
        </div>
        <div>
          <strong>{formatEur(selected.allInMonthly)}</strong>
          <span>All-in monatlich</span>
          <small>Delta zur Warmmiete: {formatEur(selected.rentDelta)}</small>
        </div>
        <div>
          <strong className={selected.cashLeft < 0 ? "negative" : "positive"}>
            {formatEur(selected.cashLeft)}
          </strong>
          <span>Cash nach Kauf</span>
          <small>Reserve-Gap: {formatEur(selected.reserveGap)}</small>
        </div>
        <div>
          <strong>{formatYears(selected.mortgage.runtimeYears)}</strong>
          <span>Laufzeit</span>
          <small>Restschuld nach {inputs.fixedRateYears} J.: {formatEur(selected.mortgage.remainingAfterFixed)}</small>
        </div>
      </section>
      <Section
        title="EK Trade-off Matrix"
        subtitle="Der Kern der Entscheidung: Was kaufen wir uns durch mehr Eigenkapital, und welchen Puffer geben wir dafür auf?"
      >
        <TradeoffMatrix scenarios={scenarios} />
      </Section>
    </div>
  );

  const compareContent = (
    <div className="content-stack">
      {scenarioChooser}
      <Section
        title="Vergleich als Balken"
        subtitle="Zinskosten und Cash-Puffer nebeneinander. So bleibt der Zielkonflikt sichtbar."
      >
        <div className="bar-grid">
          <div className="bar-stack">
            {scenarios.map((scenario) => (
              <MetricBar
                key={scenario.id}
                label={`${scenario.label} · Zinsen gesamt`}
                value={scenario.mortgage.interestTotal}
                max={maxInterest}
                tone="blue"
              />
            ))}
          </div>
          <div className="bar-stack">
            {scenarios.map((scenario) => (
              <MetricBar
                key={scenario.id}
                label={`${scenario.label} · Cash übrig`}
                value={scenario.cashLeft}
                max={maxCash}
                tone={scenario.cashLeft < 0 ? "red" : "green"}
              />
            ))}
          </div>
        </div>
      </Section>
      <Section
        title="ETF-Kontext"
        subtitle="Keine Empfehlung zum Verkauf, nur ein sichtbarer Opportunitätsrahmen für mehr eingebrachtes EK."
      >
        <Readout
          label="15% statt 10% EK gebunden"
          value={formatEur(scenarios[2].downPayment - scenarios[1].downPayment)}
          sub={`Möglicher ETF-Ertrag über ${inputs.fixedRateYears} Jahre: ${formatEur(etfOpportunity15vs10)}`}
          tone="amber"
        />
      </Section>
    </div>
  );

  return (
    <div className="app-shell">
      <div className="topbar">
        <div className="brand-row">
          <span className="brand-dot" />
          <span className="brand-text">haus · ein ruhiger rechner</span>
        </div>

        <nav className="main-tabs" aria-label="Bereiche">
          {MAIN_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`top-nav-item ${activeTab === tab.id ? "is-active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      <header className={`hero ${activeTab === "decision" ? "" : "hero-compact"}`}>
        <div className="hero-kicker">Heute · {modelName}</div>
        <h1>
          Mehr Eigenkapital macht das Darlehen leichter.
          <span> Es macht das Polster dünner.</span>
        </h1>
        <p>
          Wir schauen drei Wege an: <em>fünf, zehn, fünfzehn Prozent</em>. Was bleibt
          danach im Konto, was zahlst du jeden Monat, und was kostet dich das Ganze
          über die Jahre. Keine Empfehlung, eine ruhige Auswertung.
        </p>
        <div className={`hero-status ${decision.noSafeScenario ? "danger" : "ok"}`}>
          {decision.noSafeScenario ? "Kein sauberes Szenario" : `${decision.recommendation?.label} als Kompromiss`}
        </div>
      </header>

      <div className="app-grid">
        <main>
          {activeTab === "decision" ? decisionContent : null}
          {activeTab === "inputs" ? (
            <InputsPanel
              inputs={inputs}
              rates={rates}
              activeGroup={inputGroup}
              onGroupChange={setInputGroup}
              onInputChange={updateInput}
              onRateChange={updateRate}
              onPreset={applyPreset}
            />
          ) : null}
          {activeTab === "compare" ? compareContent : null}
          {activeTab === "sonder" ? (
            <SondertilgungPanel
              inputs={inputs}
              selected={selected}
              special5={special5}
              special10={special10}
              onSpecialRepaymentChange={updateSpecialRepayment}
            />
          ) : null}
          {activeTab === "wait" ? (
            <div className="content-stack">
              <InputsPanel
                inputs={inputs}
                rates={rates}
                activeGroup={inputGroup}
                onGroupChange={setInputGroup}
                onInputChange={updateInput}
                onRateChange={updateRate}
                onPreset={applyPreset}
                forceGroup="wait"
              />
              <WaitPanel wait={wait} waitMonths={inputs.waitMonths} />
            </div>
          ) : null}
          {activeTab === "qa" ? <QASection /> : null}
        </main>

        <RightPanel
          selected={selected}
          inputs={inputs}
          decision={decision}
          special5={special5}
          special10={special10}
        />
      </div>
    </div>
  );
}
