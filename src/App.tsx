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
  normaliseFixedPeriod,
  waitPeriodsFor,
  type ApartmentCase,
  type InterestRates,
  type MortgageInputs,
  type ScenarioId,
} from "./lib/calculations";
import {
  DEFAULT_APARTMENT_CASES,
  DEFAULT_INPUTS,
  EK_SCENARIOS,
  SECTIONS,
  type SectionId,
} from "./lib/defaults";
import { formatEur } from "./lib/format";
import {
  defaultState,
  deleteNamed,
  listSaves,
  loadAutosave,
  loadNamed,
  saveExists,
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
  const [activeSection, setActiveSection] = useState<SectionId>("decision");
  const [saves, setSaves] = useState<string[]>(() => listSaves());
  // Which named save the screen currently shows, so it can be updated in place
  // rather than only ever re-saved under a new name.
  const [activeSaveName, setActiveSaveName] = useState<string | null>(null);
  const storageWorks = useMemo(() => storageAvailable(), []);

  const snapshot = useMemo<PersistedState>(
    () => ({ version: 2, inputs, rates, apartmentCases, activeApartmentId, selectedId }),
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

  // Sondertilgung is always measured against the EK level chosen above, running its
  // current yearly plan (docs/DECISIONS.md D17). Nothing is picked twice.
  const specialComparison = useMemo(
    () => compareSpecialScenarios(EK_SCENARIOS, selected.id, activeInputs, rates),
    [selected.id, activeInputs, rates],
  );

  const waitPeriods = useMemo(
    () => waitPeriodsFor(activeInputs.waitMonths),
    [activeInputs.waitMonths],
  );

  const waitScenarios = useMemo(
    () => buildWaitScenarios(selected, selected, activeInputs, rates, waitPeriods),
    [selected, activeInputs, rates, waitPeriods],
  );

  // Headline trade-off: maximum contrast — least against most Eigenkapital, over one
  // shared horizon. Derived from the ends of the list, not from hardcoded ids.
  const headlineTradeoff = useMemo(
    () => compareEkScenarios(scenarios[0], scenarios[scenarios.length - 1], activeInputs),
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

  // Both Zinsbindung columns are editable independently, so the period is part of the
  // address of a rate — not implied by whatever binding happens to be active.
  function updateRate(period: number, key: ScenarioId, value: number) {
    const column = normaliseFixedPeriod(period);
    setRates((current) => ({ ...current, [column]: { ...current[column], [key]: value } }));
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

  /** Levels every year that already has an amount. Years at zero stay at zero. */
  function levelApartmentSpecialRepayments(apartmentId: string, value: number) {
    setApartmentCases((current) =>
      current.map((apartment) =>
        apartment.id === apartmentId
          ? {
              ...apartment,
              annualSpecialRepayments: apartment.annualSpecialRepayments.map((amount) =>
                amount > 0 ? value : 0,
              ),
            }
          : apartment,
      ),
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
      setActiveSaveName(null);
      return;
    }

    const yearlyAmount = preset === "safety" ? 3000 : 12000;
    setInputs((current) => ({
      ...current,
      ...(preset === "safety"
        ? { reserveTarget: 35000, monthlyPayment: 1700 }
        : { monthlyPayment: 2100 }),
    }));
    setApartmentCases((current) =>
      current.map((apartment) =>
        apartment.id === activeApartmentId
          ? { ...apartment, annualSpecialRepayments: apartment.annualSpecialRepayments.map(() => yearlyAmount) }
          : apartment,
      ),
    );
    // Both presets land on the lowest EK level: Sicherheitsfokus because it keeps the
    // most cash back, Mehr Sondertilgung because that is the side of the argument
    // Sondertilgung is meant to answer. The ternary that used to stand here chose
    // between two spellings of the same id.
    setSelectedId(EK_SCENARIOS[0].id);
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
      {/*
        Brand plus the active apartment as TEXT, not as a control. The switcher itself
        moved into the page body: it is used once at the start of a session, so it does
        not earn permanent screen space (docs/DECISIONS.md D21). What does earn it is
        knowing which flat and which price every number below refers to — that context
        is exactly what must never be ambiguous (D3).
      */}
      <header className="app-header">
        <div className="topbar">
          <div className="brand-row">
            <span className="brand-dot" />
            <span className="brand-text">haus · ein ruhiger rechner</span>
          </div>
          <div className="topbar-context">
            <span className="topbar-context-label">{activeApartment.label}</span>
            <i />
            <span>{formatEur(activeApartment.purchasePrice)}</span>
            <i />
            <span>+ {formatEur(selected.closingCosts)} Nebenkosten</span>
          </div>
        </div>
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
            <ApartmentSwitcher
              results={apartmentResults}
              activeApartmentId={activeApartmentId}
              onSelect={setActiveApartmentId}
              onAdd={addApartment}
            />
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
              scenarios={EK_SCENARIOS}
              selectedId={selected.id}
              onInputChange={updateInput}
              onRateChange={updateRate}
              onReset={() => applyPreset("reset")}
              onSafetyFocus={() => applyPreset("safety")}
              onMoreSpecial={() => applyPreset("special")}
            />
            <SavePanel
              saves={saves}
              storageWorks={storageWorks}
              activeSaveName={activeSaveName}
              nameExists={saveExists}
              onSave={(name) => {
                if (saveNamed(name, snapshot)) {
                  setSaves(listSaves());
                  setActiveSaveName(name.trim());
                }
              }}
              onLoad={(name) => {
                const loaded = loadNamed(name);
                if (loaded) {
                  applyState(loaded);
                  setActiveSaveName(name);
                }
              }}
              onDelete={(name) => {
                deleteNamed(name);
                setSaves(listSaves());
                if (activeSaveName === name) setActiveSaveName(null);
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
              comparison={specialComparison}
              onSpecialRepaymentChange={(yearIndex, value) =>
                updateApartmentSpecialRepayment(activeApartmentId, yearIndex, value)
              }
              onLevelSpecialRepayments={(value) =>
                levelApartmentSpecialRepayments(activeApartmentId, value)
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
                    hint="Bekommt unten eine eigene Spalte neben 12 und 24 Monaten"
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
