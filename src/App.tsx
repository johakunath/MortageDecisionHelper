import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ApartmentSwitcher, { ApartmentFacts } from "./components/ApartmentSwitcher";
import CompromiseFinder from "./components/CompromiseFinder";
import ExecutiveSummary from "./components/ExecutiveSummary";
import InputsPanel from "./components/InputsPanel";
import RightPanel from "./components/RightPanel";
import SondertilgungPanel from "./components/SondertilgungPanel";
import TradeoffMatrix from "./components/TradeoffMatrix";
import TradeoffStatement from "./components/TradeoffStatement";
import WaitPanel from "./components/WaitPanel";
import { InputField, Section } from "./components/ui";
import {
  averageAnnualSpecialRepayment,
  buildApartmentInputs,
  buildScenarios,
  buildWaitScenarios,
  compareApartmentCases,
  compareEkScenarios,
  evaluateDecision,
  interestForPlan,
  requiredSpecialToMatch,
  type ApartmentCase,
  type InterestRates,
  type MortgageInputs,
  type ScenarioId,
} from "./lib/calculations";
import {
  DEFAULT_APARTMENT_CASES,
  DEFAULT_INPUTS,
  DEFAULT_RATES,
  EK_SCENARIOS,
  SECTIONS,
  type InputGroupId,
  type SectionId,
} from "./lib/defaults";
import { formatEur } from "./lib/format";

type NumericInputKey = Exclude<keyof MortgageInputs, "annualSpecialRepayments">;
type ApartmentNumericKey = "purchasePrice" | "renovation" | "monthlyOwnershipCosts";

function cloneDefaultApartmentCases(): ApartmentCase[] {
  return DEFAULT_APARTMENT_CASES.map((apartment) => ({
    ...apartment,
    annualSpecialRepayments: [...apartment.annualSpecialRepayments],
  }));
}

export default function App() {
  const [inputs, setInputs] = useState<MortgageInputs>({ ...DEFAULT_INPUTS });
  const [rates, setRates] = useState<InterestRates>({ ...DEFAULT_RATES });
  const [apartmentCases, setApartmentCases] = useState<ApartmentCase[]>(cloneDefaultApartmentCases);
  const [activeApartmentId, setActiveApartmentId] = useState<string>(DEFAULT_APARTMENT_CASES[0].id);
  const [selectedId, setSelectedId] = useState<ScenarioId>("ek10");
  const [inputGroup, setInputGroup] = useState<InputGroupId>("household");
  const [activeSection, setActiveSection] = useState<SectionId>("decision");

  // The apartment owns purchasePrice/renovation/ownership costs/Sondertilgung, and
  // this is the ONLY place they become a usable MortgageInputs. Everything downstream
  // reads activeInputs, never `inputs` directly — which is what makes it structurally
  // impossible to show one apartment's numbers beside another's. See D3.
  const activeApartment = useMemo(
    () => apartmentCases.find((apartment) => apartment.id === activeApartmentId) ?? apartmentCases[0],
    [apartmentCases, activeApartmentId],
  );
  const activeInputs = useMemo(
    () => buildApartmentInputs(inputs, activeApartment),
    [inputs, activeApartment],
  );

  const scenarios = useMemo(
    () => buildScenarios(EK_SCENARIOS, activeInputs, rates),
    [activeInputs, rates],
  );
  const selected = scenarios.find((scenario) => scenario.id === selectedId) ?? scenarios[1];
  const decision = useMemo(() => evaluateDecision(scenarios), [scenarios]);

  const apartmentResults = useMemo(
    () => compareApartmentCases(apartmentCases, EK_SCENARIOS, inputs, rates),
    [apartmentCases, inputs, rates],
  );

  // Break-even target: 15% EK making NO special repayments (docs/DECISIONS.md D1).
  const ek15BaselineInterest = useMemo(
    () => interestForPlan(EK_SCENARIOS[2], activeInputs, rates, { kind: "none" }),
    [activeInputs, rates],
  );
  const special5 = useMemo(
    () => requiredSpecialToMatch(EK_SCENARIOS[0], ek15BaselineInterest, activeInputs, rates),
    [ek15BaselineInterest, activeInputs, rates],
  );
  const special10 = useMemo(
    () => requiredSpecialToMatch(EK_SCENARIOS[1], ek15BaselineInterest, activeInputs, rates),
    [ek15BaselineInterest, activeInputs, rates],
  );

  const waitScenarios = useMemo(
    () => buildWaitScenarios(selected, selected, activeInputs, rates, [0, 12, 24]),
    [selected, activeInputs, rates],
  );

  // Headline trade-off: maximum contrast, 5% vs 15% EK, over one shared horizon.
  const headlineTradeoff = useMemo(
    () => compareEkScenarios(scenarios[0], scenarios[2], activeInputs),
    [scenarios, activeInputs],
  );

  function updateInput(key: NumericInputKey, value: number) {
    setInputs((current) => ({ ...current, [key]: value }));
  }

  function updateRate(key: ScenarioId, value: number) {
    setRates((current) => ({ ...current, [key]: value }));
  }

  function updateApartmentCase(apartmentId: string, patch: Partial<Pick<ApartmentCase, ApartmentNumericKey>>) {
    setApartmentCases((current) =>
      current.map((apartment) => (apartment.id === apartmentId ? { ...apartment, ...patch } : apartment)),
    );
  }

  function updateApartmentSpecialRepayment(apartmentId: string, yearIndex: number, value: number) {
    setApartmentCases((current) =>
      current.map((apartment) => {
        if (apartment.id !== apartmentId) return apartment;

        const fallback = averageAnnualSpecialRepayment(apartment.annualSpecialRepayments, 0);
        const next = [...apartment.annualSpecialRepayments];
        while (next.length <= yearIndex) next.push(fallback);
        next[yearIndex] = value;

        return { ...apartment, annualSpecialRepayments: next.map((amount) => (Number.isFinite(amount) ? amount : 0)) };
      }),
    );
  }

  function addApartment() {
    const id = `flat-${Date.now()}`;
    setApartmentCases((current) => [
      ...current,
      {
        id,
        label: `Wohnung ${String.fromCharCode(65 + current.length)}`,
        purchasePrice: DEFAULT_APARTMENT_CASES[0].purchasePrice,
        renovation: 0,
        monthlyOwnershipCosts: DEFAULT_APARTMENT_CASES[0].monthlyOwnershipCosts,
        selectedScenarioId: "ek10",
        annualSpecialRepayments: [...DEFAULT_INPUTS.annualSpecialRepayments],
      },
    ]);
    setActiveApartmentId(id);
  }

  function applyPreset(preset: "reset" | "safety" | "special") {
    if (preset === "reset") {
      setInputs({ ...DEFAULT_INPUTS });
      setRates({ ...DEFAULT_RATES });
      setApartmentCases(cloneDefaultApartmentCases());
      setActiveApartmentId(DEFAULT_APARTMENT_CASES[0].id);
      setSelectedId("ek10");
      setInputGroup("household");
      return;
    }

    const yearlyAmount = preset === "safety" ? 3000 : 12000;
    setInputs((current) => ({
      ...current,
      ...(preset === "safety" ? { reserveTarget: 35000, repaymentRate: 2.2 } : { repaymentRate: 2.8 }),
    }));
    setApartmentCases((current) =>
      current.map((apartment) =>
        apartment.id === activeApartmentId
          ? { ...apartment, annualSpecialRepayments: apartment.annualSpecialRepayments.map(() => yearlyAmount) }
          : apartment,
      ),
    );
    setSelectedId(preset === "safety" ? "ek5" : "ek10");
  }

  // Drives the step rail. The page is one scroll surface so two people reading
  // together share a referent they can point at (docs/DECISIONS.md D2).
  const sectionRefs = useRef<Partial<Record<SectionId, HTMLElement | null>>>({});
  const registerSection = useCallback(
    (id: SectionId) => (el: HTMLElement | null) => {
      sectionRefs.current[id] = el;
    },
    [],
  );

  useEffect(() => {
    const elements = Object.entries(sectionRefs.current) as [SectionId, HTMLElement | null][];
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        const topEntry = visible[0];
        if (topEntry) {
          const id = elements.find(([, el]) => el === topEntry.target)?.[0];
          if (id) setActiveSection(id);
        }
      },
      { rootMargin: "-15% 0px -70% 0px", threshold: [0, 0.25, 0.5, 0.75, 1] },
    );

    elements.forEach(([, el]) => {
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  function scrollToSection(id: SectionId) {
    sectionRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="app-shell">
      {/*
        Topbar and apartment switcher share ONE sticky container. They used to be two
        stacked sticky elements with a hardcoded offset between them, which left a
        sliver of scrolling content visible in the seam whenever the offset and the
        real header height disagreed.
      */}
      <header className="app-header">
        <div className="topbar">
          <div className="brand-row">
            <span className="brand-dot" />
            <span className="brand-text">haus · ein ruhiger rechner</span>
          </div>
        </div>
        <ApartmentSwitcher
          results={apartmentResults}
          activeApartmentId={activeApartmentId}
          onSelect={setActiveApartmentId}
          onAdd={addApartment}
        />
      </header>

      <div className="app-grid">
        <nav className="step-rail" aria-label="Abschnitte">
          {SECTIONS.map((section) => (
            <button
              key={section.id}
              type="button"
              className={`step-rail-item ${activeSection === section.id ? "is-active" : ""}`}
              onClick={() => scrollToSection(section.id)}
              aria-current={activeSection === section.id}
            >
              <span className="step-rail-number">{section.number}</span>
              <span className="step-rail-label">{section.label}</span>
            </button>
          ))}
        </nav>

        <main>
          <section id="section-decision" ref={registerSection("decision")} className="page-section">
            <ApartmentFacts
              apartment={activeApartment}
              onChange={(patch) => updateApartmentCase(activeApartmentId, patch)}
            />
            <ExecutiveSummary decision={decision} inputs={activeInputs} selected={selected} />
            <TradeoffStatement
              tradeoff={headlineTradeoff}
              etfReturnRate={inputs.etfReturnRate}
              onEtfReturnChange={(value) => updateInput("etfReturnRate", value)}
            />
            <CompromiseFinder
              scenarios={scenarios}
              decision={decision}
              selected={selected}
              onSelectScenario={setSelectedId}
            />
          </section>

          <section id="section-assumptions" ref={registerSection("assumptions")} className="page-section">
            <div className="section-kicker">2 · Annahmen</div>
            <InputsPanel
              inputs={activeInputs}
              rates={rates}
              activeGroup={inputGroup}
              onGroupChange={setInputGroup}
              onInputChange={updateInput}
              onRateChange={updateRate}
              onReset={() => applyPreset("reset")}
              onSafetyFocus={() => applyPreset("safety")}
              onMoreSpecial={() => applyPreset("special")}
            />
          </section>

          <section id="section-tradeoff" ref={registerSection("tradeoff")} className="page-section">
            <div className="section-kicker">3 · Was kostet EK?</div>
            <Section
              title="EK Trade-off Matrix"
              subtitle="Was kaufen wir uns durch mehr Eigenkapital, und welchen Puffer geben wir dafür auf?"
              right={<span className="muted">Kaufnebenkosten: {formatEur(selected.closingCosts)}</span>}
            >
              <TradeoffMatrix scenarios={scenarios} />
            </Section>
          </section>

          <section id="section-special" ref={registerSection("special")} className="page-section">
            <div className="section-kicker">4 · Sondertilgung</div>
            <SondertilgungPanel
              inputs={activeInputs}
              selected={selected}
              special5={special5}
              special10={special10}
              onSpecialRepaymentChange={(yearIndex, value) =>
                updateApartmentSpecialRepayment(activeApartmentId, yearIndex, value)
              }
            />
          </section>

          <section id="section-wait" ref={registerSection("wait")} className="page-section">
            <div className="section-kicker">5 · Warten</div>
            <details className="wait-details">
              <summary>Lohnt es sich zu warten?</summary>
              <Section
                title="Warten: Annahmen"
                subtitle="Eine andere Frage als die EK-Wahl — wann kaufen, nicht wie viel Eigenkapital."
              >
                <div className="input-grid">
                  <InputField
                    label="Wartezeit"
                    value={inputs.waitMonths}
                    suffix="Monate"
                    step={1}
                    min={0}
                    onChange={(value) => updateInput("waitMonths", value)}
                    highlight
                  />
                  <InputField
                    label="Netto-Sparrate"
                    value={inputs.waitSavingsMonthly}
                    onChange={(value) => updateInput("waitSavingsMonthly", value)}
                    hint="Nach Miete — Miete wird separat gezeigt, nicht nochmal abgezogen"
                  />
                  <InputField
                    label="Kaufpreiswachstum"
                    value={inputs.waitPropertyGrowthRate}
                    suffix="% p.a."
                    step={0.1}
                    onChange={(value) => updateInput("waitPropertyGrowthRate", value)}
                  />
                  <InputField
                    label="Zinsänderung"
                    value={inputs.waitRateShift}
                    suffix="%-Pkt."
                    step={0.1}
                    onChange={(value) => updateInput("waitRateShift", value)}
                  />
                </div>
              </Section>
              <WaitPanel scenarios={waitScenarios} />
            </details>
          </section>
        </main>

        <RightPanel selected={selected} inputs={activeInputs} decision={decision} />
      </div>
    </div>
  );
}
