import { useState, type ReactNode } from "react";
import {
  monthlyAnnuity,
  normaliseFixedPeriod,
  rateFor,
  repaymentRateFromMonthlyPayment,
  repaymentRateFromRuntimeYears,
  runtimeYearsFromRepaymentRate,
  FIXED_PERIODS,
  type InterestRates,
  type MortgageInputs,
  type ScenarioBase,
  type ScenarioId,
} from "../lib/calculations";
import { INPUT_BOXES } from "../lib/defaults";
import { GLOSSARY } from "../lib/glossary";
import { formatEur, formatPct, formatYears } from "../lib/format";
import { Button, InputField, Readout, Section, SegmentedChoice, type SegmentedOption } from "./ui";

/** The two real German cases: with and without Makler. Nothing in between is common. */
const KNK_OPTIONS: SegmentedOption[] = [
  { value: 8, label: "8% ohne Makler" },
  { value: 11.57, label: "11,57% mit Makler" },
];

/** Only the bindings the bank quoted — a third option would have no rate behind it. */
const FIXED_RATE_OPTIONS: SegmentedOption[] = FIXED_PERIODS.map((years) => ({
  value: years,
  label: `${years} J.`,
}));

/** Three ways to express the same contract; the user enters whichever they know. */
type RateMode = "payment" | "repayment" | "runtime";

const RATE_MODES: { id: RateMode; label: string }[] = [
  { id: "payment", label: "Monatsrate" },
  { id: "repayment", label: "Tilgungssatz" },
  { id: "runtime", label: "Laufzeit" },
];

type NumericInputKey = Exclude<keyof MortgageInputs, "annualSpecialRepayments">;

function InputBox({ id, children }: { id: (typeof INPUT_BOXES)[number]["id"]; children: ReactNode }) {
  const box = INPUT_BOXES.find((entry) => entry.id === id)!;
  return (
    <div className="input-box">
      <h3>{box.label}</h3>
      {children}
    </div>
  );
}

/**
 * Monatsrate, Anfangstilgung and Laufzeit are one contract seen three ways. The stored
 * value is the **monthly payment**, because that is the one the bank holds constant
 * across its offers and the one the couple's budget actually fixes — the Tilgungssatz
 * then follows per EK level rather than being imposed on all of them.
 *
 * The derived views use the selected scenario's loan, which is safe precisely because
 * the stored value no longer depends on which door is open.
 */
function PaymentField({
  inputs,
  rates,
  scenarios,
  selectedId,
  onInputChange,
}: {
  inputs: MortgageInputs;
  rates: InterestRates;
  scenarios: ScenarioBase[];
  selectedId: ScenarioId;
  onInputChange: (key: NumericInputKey, value: number) => void;
}) {
  const [mode, setMode] = useState<RateMode>("payment");
  const selected = scenarios.find((entry) => entry.id === selectedId) ?? scenarios[0];
  const ekRate = selected.ekRate;
  const referenceLoan = inputs.purchasePrice * (1 - ekRate / 100);
  const referenceRate = rateFor(rates, inputs.fixedRateYears, selectedId);
  const repaymentRate = repaymentRateFromMonthlyPayment(
    referenceLoan,
    referenceRate,
    inputs.monthlyPayment,
  );
  const runtime = runtimeYearsFromRepaymentRate(referenceRate, repaymentRate);
  const runtimeText = Number.isFinite(runtime) ? formatYears(Math.round(runtime)) : "läuft nie ab";
  const repaymentText = `${formatPct(repaymentRate, 2)} Tilgung`;

  return (
    <div className="tilgung-field">
      <div className="tilgung-modes">
        {RATE_MODES.map((entry) => (
          <Button key={entry.id} active={mode === entry.id} onClick={() => setMode(entry.id)}>
            {entry.label}
          </Button>
        ))}
      </div>

      {mode === "payment" ? (
        <InputField
          label="Monatsrate"
          value={Math.round(inputs.monthlyPayment)}
          suffix="€/Monat"
          step={50}
          min={1}
          highlight
          onChange={(value) => onInputChange("monthlyPayment", Math.max(1, value))}
          info={GLOSSARY.monthlyPayment}
          hint={`bei ${ekRate}% EK: ${repaymentText} · ${runtimeText}`}
        />
      ) : null}

      {mode === "repayment" ? (
        <InputField
          label={`Anfangstilgung bei ${ekRate}% EK`}
          value={Number(repaymentRate.toFixed(2))}
          suffix="%"
          step={0.1}
          min={0.1}
          onChange={(value) =>
            onInputChange(
              "monthlyPayment",
              Math.round(monthlyAnnuity(referenceLoan, referenceRate, Math.max(0.1, value))),
            )
          }
          info={GLOSSARY.repaymentRate}
          hint={`= ${formatEur(inputs.monthlyPayment)}/Monat · ${runtimeText}`}
        />
      ) : null}

      {mode === "runtime" ? (
        <InputField
          label={`Laufzeit bei ${ekRate}% EK (ohne Sondertilgung)`}
          value={Number.isFinite(runtime) ? Number(runtime.toFixed(0)) : 0}
          suffix="Jahre"
          step={1}
          min={1}
          onChange={(value) => {
            if (value < 1 || value > 60) return;
            const derived = repaymentRateFromRuntimeYears(referenceRate, value);
            onInputChange(
              "monthlyPayment",
              Math.round(monthlyAnnuity(referenceLoan, referenceRate, derived)),
            );
          }}
          hint={`= ${formatEur(inputs.monthlyPayment)}/Monat · ${repaymentText}`}
        />
      ) : null}
    </div>
  );
}

/**
 * Kaufnebenkosten as ONE control: the two real German cases as presets, and the same
 * value editable directly underneath.
 *
 * It used to be a SegmentedChoice and a separate "Kaufnebenkosten frei" field sitting
 * next to each other, both writing `closingCostRate` — move one and the other jumped.
 * Two controls for one number is the accretion pattern D6 exists to prevent. The free
 * entry stays because Grunderwerbsteuer really does vary by Bundesland (3,5%-6,5%);
 * it is the *second control* that goes, not the capability.
 */
function ClosingCostField({
  inputs,
  onInputChange,
}: {
  inputs: MortgageInputs;
  onInputChange: (key: NumericInputKey, value: number) => void;
}) {
  return (
    <div className="tilgung-field">
      <div className="tilgung-modes">
        {KNK_OPTIONS.map((option) => (
          <Button
            key={option.value}
            active={Math.abs(inputs.closingCostRate - option.value) < 0.001}
            onClick={() => onInputChange("closingCostRate", option.value)}
          >
            {option.label}
          </Button>
        ))}
      </div>
      <InputField
        label="Kaufnebenkosten"
        value={inputs.closingCostRate}
        suffix="%"
        step={0.01}
        min={0}
        onChange={(value) => onInputChange("closingCostRate", value)}
        info={GLOSSARY.closingCostRate}
        hint={`= ${formatEur((inputs.purchasePrice * inputs.closingCostRate) / 100)} bei diesem Kaufpreis · andere Bundesländer weichen ab`}
      />
    </div>
  );
}

/**
 * The Sollzins grid: one row per EK level, one column per Sollzinsbindung. Both
 * columns are always visible and independently editable, and the active one is marked
 * — so it is never a mystery which three of the six numbers are doing the work.
 */
function RateMatrix({
  rates,
  scenarios,
  activeFixedYears,
  onRateChange,
}: {
  rates: InterestRates;
  scenarios: ScenarioBase[];
  activeFixedYears: number;
  onRateChange: (period: number, id: ScenarioId, value: number) => void;
}) {
  const activePeriod = normaliseFixedPeriod(activeFixedYears);

  return (
    <table className="rate-matrix">
      <thead>
        <tr>
          <th scope="col">Sollzins</th>
          {FIXED_PERIODS.map((period) => (
            <th key={period} scope="col" className={period === activePeriod ? "is-active-col" : ""}>
              {period} Jahre
              {period === activePeriod ? <small>gilt gerade</small> : null}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {scenarios.map((scenario) => (
          <tr key={scenario.id}>
            <th scope="row">{scenario.label}</th>
            {FIXED_PERIODS.map((period) => (
              <td key={period} className={period === activePeriod ? "is-active-col" : ""}>
                <InputField
                  label={`${scenario.label} · ${period} Jahre`}
                  labelHidden
                  value={rates[period][scenario.id]}
                  suffix="%"
                  step={0.05}
                  min={0}
                  onChange={(value) => onRateChange(period, scenario.id, value)}
                />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

type InputsPanelProps = {
  inputs: MortgageInputs;
  rates: InterestRates;
  scenarios: ScenarioBase[];
  selectedId: ScenarioId;
  onInputChange: (key: NumericInputKey, value: number) => void;
  onRateChange: (period: number, id: ScenarioId, value: number) => void;
  onReset: () => void;
  onSafetyFocus: () => void;
  onMoreSpecial: () => void;
};

/**
 * Couple-level assumptions only, all on one page. Purchase price, renovation and
 * monthly ownership costs live on the active apartment (docs/DECISIONS.md D3); the
 * wait-related fields live inline in the Warten section, not here.
 */
export default function InputsPanel({
  inputs,
  rates,
  scenarios,
  selectedId,
  onInputChange,
  onRateChange,
  onReset,
  onSafetyFocus,
  onMoreSpecial,
}: InputsPanelProps) {
  return (
    <Section
      title="Annahmen"
      subtitle="Alles auf einer Seite — nichts liegt hinter einem Reiter, den man erst aufmachen muss. Ergebnisse bleiben getrennt."
      right={
        <div className="button-row">
          <Button variant="action" onClick={onReset}>Reset</Button>
          <Button variant="action" onClick={onSafetyFocus}>Sicherheitsfokus</Button>
          <Button variant="action" onClick={onMoreSpecial}>Mehr Sondertilgung</Button>
        </div>
      }
    >
      <div className="input-boxes">
        <InputBox id="capital">
          <div className="input-grid">
            <InputField
              label="EK verfügbar"
              value={inputs.availableCapital}
              onChange={(value) => onInputChange("availableCapital", value)}
              highlight
              info={GLOSSARY.availableCapital}
            />
            <InputField
              label="Sicherheitsreserve"
              value={inputs.reserveTarget}
              onChange={(value) => onInputChange("reserveTarget", value)}
              info={GLOSSARY.reserveTarget}
            />
            <ClosingCostField inputs={inputs} onInputChange={onInputChange} />
            <InputField
              label="Umzug / Möbel"
              value={inputs.moving}
              onChange={(value) => onInputChange("moving", value)}
              info={GLOSSARY.moving}
            />
          </div>
        </InputBox>

        <InputBox id="household">
          <div className="input-grid">
            <InputField
              label="Haushaltsnetto"
              value={inputs.householdNetIncome}
              onChange={(value) => onInputChange("householdNetIncome", value)}
              highlight
              info={GLOSSARY.householdNetIncome}
            />
            <InputField
              label="Warmmiete heute"
              value={inputs.currentWarmRent}
              onChange={(value) => onInputChange("currentWarmRent", value)}
              info={GLOSSARY.currentWarmRent}
            />
            <InputField
              label="Max. Haushaltsbelastung"
              value={inputs.maxBurdenRate}
              suffix="%"
              step={1}
              min={1}
              onChange={(value) => onInputChange("maxBurdenRate", value)}
              info={GLOSSARY.maxBurdenRate}
              hint="Persönliche Schwelle, keine Bankregel"
            />
          </div>
        </InputBox>

        <InputBox id="loan">
          <div className="input-grid">
            <SegmentedChoice
              label="Zinsbindung"
              value={inputs.fixedRateYears}
              options={FIXED_RATE_OPTIONS}
              onChange={(value) => onInputChange("fixedRateYears", value)}
              info={GLOSSARY.fixedRateYears}
            />
            <PaymentField
              inputs={inputs}
              rates={rates}
              scenarios={scenarios}
              selectedId={selectedId}
              onInputChange={onInputChange}
            />
            <InputField
              label="Sondertilgung Cap"
              value={inputs.specialRepaymentLimitRate}
              suffix="%"
              step={0.5}
              min={0}
              onChange={(value) => onInputChange("specialRepaymentLimitRate", value)}
              info={GLOSSARY.specialRepaymentLimitRate}
            />
            <Readout
              label="Sondertilgung p.a."
              value={formatEur(inputs.annualSpecialRepayment)}
              sub="Ø aus dem Jahresplan der aktiven Wohnung — dort editierbar"
              info={GLOSSARY.annualSpecialRepayment}
            />
          </div>
        </InputBox>

        <InputBox id="rates">
          <RateMatrix
            rates={rates}
            scenarios={scenarios}
            activeFixedYears={inputs.fixedRateYears}
            onRateChange={onRateChange}
          />
          <p className="input-box-note">
            Aus dem Finanzierungsangebot. Mehr Eigenkapital senkt den Zins nicht
            gleichmäßig — bei 15 Jahren Bindung kosten 10% und 15% EK dasselbe.
          </p>
        </InputBox>

        <InputBox id="market">
          <div className="input-grid">
            <InputField
              label="Wertsteigerung"
              value={inputs.propertyGrowthRate}
              suffix="% p.a."
              step={0.1}
              onChange={(value) => onInputChange("propertyGrowthRate", value)}
              info={GLOSSARY.propertyGrowthRate}
            />
            <InputField
              label="Inflation"
              value={inputs.inflationRate}
              suffix="% p.a."
              step={0.1}
              onChange={(value) => onInputChange("inflationRate", value)}
              info={GLOSSARY.inflationRate}
              hint={`Realrendite: ${formatPct(inputs.propertyGrowthRate - inputs.inflationRate)} p.a.`}
            />
            <InputField
              label="ETF-Rendite Annahme"
              value={inputs.etfReturnRate}
              suffix="% p.a."
              step={0.5}
              min={0}
              onChange={(value) => onInputChange("etfReturnRate", value)}
              info={GLOSSARY.etfReturnRate}
            />
          </div>
        </InputBox>
      </div>
    </Section>
  );
}
