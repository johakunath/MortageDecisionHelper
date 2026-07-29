import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ApartmentSwitcher, { ApartmentFacts } from "./components/ApartmentSwitcher";
import CashBlock from "./components/CashBlock";
import CompromiseFinder from "./components/CompromiseFinder";
import ExecutiveSummary from "./components/ExecutiveSummary";
import InputsPanel from "./components/InputsPanel";
import ProgressSection from "./components/ProgressSection";
import RightPanel from "./components/RightPanel";
import SavePanel from "./components/SavePanel";
import SondertilgungPanel from "./components/SondertilgungPanel";
import TradeoffMatrix from "./components/TradeoffMatrix";
import TradeoffStatement from "./components/TradeoffStatement";
import WaitPanel from "./components/WaitPanel";
import { InputField, Section } from "./components/ui";
import {
  buildApartmentInputs,
  buildScenario,
  buildScenarios,
  buildWaitScenarios,
  compareApartmentCases,
  compareEkScenarios,
  compareSpecialScenarios,
  evaluateDecision,
  type ApartmentCase,
  type InterestRates,
  type MortgageInputs,
  type ScenarioId,
  type SpecialPlanMode,
} from "./lib/calculations";
import {
  DEFAULT_APARTMENT_CASES,
  DEFAULT_INPUTS,
  EK_SCENARIOS,
  SECTIONS,
  type InputGroupId,
  type SectionId,
} from "./lib/defaults";
import { formatEur } from "./lib/format";
import {
  defaultState,
  deleteNamed,
  listSaves,
  loadAutosave,
  loadNamed,
  saveNamed,
  storageAvailable,
  writeAutosave,
  type PersistedState,
} from "./lib/storage";

type NumericInputKey = Exclude<keyof MortgageInputs, "annualSpecialRepayments">;
type ApartmentNumericKey = "purchasePrice" | "renovation" | "monthlyOwnershipCosts";

/**
 * Restored synchronously during the first render, not in an effect: loading in an
 * effect would paint the defaults first and then visibly replace every number on the
 * screen a frame later.
 */
const INITIAL_STATE: PersistedState = loadAutosave() ?? defaultState();

export default function App() {
  const [inputs, setInputs] = useState<MortgageInputs>(INITIAL_STATE.inputs);
  const [rates, setRates] = useState<InterestRates>(INITIAL_STATE.rates);
  const [apartmentCases, setApartmentCases] = useState<ApartmentCase[]>(INITIAL_STATE.apartmentCases);
  const [activeApartmentId, setActiveApartmentId] = useState<string>(INITIAL_STATE.activeApartmentId);
  const [selectedId, setSelectedId] = useState<ScenarioId>(INITIAL_STATE.selectedId);
  const [inputGroup, setInputGroup] = useState<InputGroupId>("household");
  const [activeSection, setActiveSection] = useState<SectionId>("decision");
  const [baselineId, setBaselineId] = useState<ScenarioId>("ek10");
  const [baselineMode, setBaselineMode] = useState<SpecialPlanMode>("none");
  const [saves, setSaves] = useState<string[]>(() => listSaves());
  const storageWorks = useMemo(() => storageAvailable(), []);

  const snapshot = useMemo<PersistedState>(
    () => ({ version: 1, inputs, rates, apartmentCases, activeApartmentId, selectedId }),
    [inputs, rates, apartmentCases, activeApartmentId, selectedId],
  );

  // Autosave, so an accidental reload never costs a session's worth of assumptions.
  useEffect(() => {
    writeAutosave(snapshot);
  }, [snapshot]);

  function applyState(state: PersistedState) {
    setInputs(state.inputs);
    setRates(state.rates);
    setApartmentCases(state.apartmentCases);
    setActiveApartmentId(state.activeApartmentId);
    setSelectedId(state.selectedId);
  }

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

  // Sondertilgung comparison against a freely chosen baseline (docs/DECISIONS.md D10).
  // Default is 10% EK + Nebenkosten without Sondertilgung — the standard German
  // financing case, and the one the couple actually starts from.
  const specialComparison = useMemo(
    () => compareSpecialScenarios(EK_SCENARIOS, baselineId, baselineMode, activeInputs, rates),
    [baselineId, baselineMode, activeInputs, rates],
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

  // The selected scenario run with no Sondertilgung — the dashed comparison line that
  // shows what the extra repayments actually buy.
  const selectedWithoutSpecial = useMemo(() => {
    const base = EK_SCENARIOS.find((entry) => entry.id === selected.id) ?? EK_SCENARIOS[1];
    return buildScenario(base, activeInputs, rates, { kind: "none" });
  }, [selected.id, activeInputs, rates]);

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

        // Pad with zeros, never with the average: adding a one-off in year 14 must not
        // silently invent payments in years 11–13 the user never asked for.
        const next = [...apartment.annualSpecialRepayments];
        while (next.length <= yearIndex) next.push(0);
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
      applyState(defaultState());
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
            <CashBlock selected={selected} inputs={activeInputs} />
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
            <SavePanel
              saves={saves}
              storageWorks={storageWorks}
              onSave={(name) => {
                if (saveNamed(name, snapshot)) setSaves(listSaves());
              }}
              onLoad={(name) => {
                const loaded = loadNamed(name);
                if (loaded) applyState(loaded);
              }}
              onDelete={(name) => {
                deleteNamed(name);
                setSaves(listSaves());
              }}
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

          <section id="section-progress" ref={registerSection("progress")} className="page-section">
            <div className="section-kicker">4 · Verlauf</div>
            <ProgressSection
              scenarios={scenarios}
              selected={selected}
              selectedWithoutSpecial={selectedWithoutSpecial}
              inputs={activeInputs}
            />
          </section>

          <section id="section-special" ref={registerSection("special")} className="page-section">
            <div className="section-kicker">5 · Sondertilgung</div>
            <SondertilgungPanel
              inputs={activeInputs}
              selected={selected}
              bases={EK_SCENARIOS}
              comparison={specialComparison}
              baselineId={baselineId}
              baselineMode={baselineMode}
              onBaselineChange={setBaselineId}
              onBaselineModeChange={setBaselineMode}
              onSpecialRepaymentChange={(yearIndex, value) =>
                updateApartmentSpecialRepayment(activeApartmentId, yearIndex, value)
              }
            />
          </section>

          <section id="section-wait" ref={registerSection("wait")} className="page-section">
            <div className="section-kicker">6 · Warten</div>
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
