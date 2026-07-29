import { useState } from "react";
import {
  monthlyAnnuity,
  repaymentRateFromMonthlyPayment,
  repaymentRateFromRuntimeYears,
  runtimeYearsFromRepaymentRate,
  type InterestRates,
  type MortgageInputs,
  type ScenarioId,
} from "../lib/calculations";
import { INPUT_GROUPS, type InputGroupId } from "../lib/defaults";
import { GLOSSARY } from "../lib/glossary";
import { formatEur } from "../lib/format";
import { Button, InputField, Readout, Section, SegmentedChoice, type SegmentedOption } from "./ui";

/** The two real German cases: with and without Makler. Nothing in between is common. */
const KNK_OPTIONS: SegmentedOption[] = [
  { value: 8, label: "8% ohne Makler" },
  { value: 11.57, label: "11,57% mit Makler" },
];

const FIXED_RATE_OPTIONS: SegmentedOption[] = [
  { value: 10, label: "10 J." },
  { value: 15, label: "15 J." },
  { value: 20, label: "20 J." },
];

/** Three ways to express the same contract; the user enters whichever they know. */
type TilgungMode = "rate" | "runtime" | "payment";

const TILGUNG_MODES: { id: TilgungMode; label: string }[] = [
  { id: "rate", label: "Tilgungssatz" },
  { id: "runtime", label: "Laufzeit" },
  { id: "payment", label: "Monatsrate" },
];

type NumericInputKey = Exclude<keyof MortgageInputs, "annualSpecialRepayments">;

/**
 * Anfangstilgung, Laufzeit and Monatsrate are one value seen three ways. Whichever
 * the user edits, `repaymentRate` is what gets stored — so the model keeps exactly
 * one source of truth and the other two are always derived, never able to drift.
 *
 * Reference loan is 10% EK on the active apartment: the rate is a property of the
 * contract, so it must not silently change when a different EK door is selected.
 */
function TilgungField({
  inputs,
  rates,
  onInputChange,
}: {
  inputs: MortgageInputs;
  rates: InterestRates;
  onInputChange: (key: NumericInputKey, value: number) => void;
}) {
  const [mode, setMode] = useState<TilgungMode>("rate");
  const referenceLoan = inputs.purchasePrice * 0.9;
  const referenceRate = rates.ek10;
  const runtime = runtimeYearsFromRepaymentRate(referenceRate, inputs.repaymentRate);
  const payment = monthlyAnnuity(referenceLoan, referenceRate, inputs.repaymentRate);

  return (
    <div className="tilgung-field">
      <div className="tilgung-modes">
        {TILGUNG_MODES.map((entry) => (
          <Button key={entry.id} active={mode === entry.id} onClick={() => setMode(entry.id)}>
            {entry.label}
          </Button>
        ))}
      </div>

      {mode === "rate" ? (
        <InputField
          label="Anfangstilgung"
          value={Number(inputs.repaymentRate.toFixed(2))}
          suffix="%"
          step={0.1}
          min={0.1}
          onChange={(value) => onInputChange("repaymentRate", Math.max(0.1, value))}
          hint={`≈ ${Number.isFinite(runtime) ? `${runtime.toFixed(0)} Jahre` : "läuft nie ab"} · ${formatEur(payment)}/Monat`}
        />
      ) : null}

      {mode === "runtime" ? (
        <InputField
          label="Laufzeit (ohne Sondertilgung)"
          value={Number.isFinite(runtime) ? Number(runtime.toFixed(0)) : 0}
          suffix="Jahre"
          step={1}
          min={1}
          onChange={(value) => {
            if (value < 1 || value > 60) return;
            onInputChange("repaymentRate", Number(repaymentRateFromRuntimeYears(referenceRate, value).toFixed(3)));
          }}
          hint={`ergibt ${inputs.repaymentRate.toFixed(2)}% Tilgung · ${formatEur(payment)}/Monat`}
        />
      ) : null}

      {mode === "payment" ? (
        <InputField
          label="Monatsrate bei 10% EK"
          value={Math.round(payment)}
          suffix="€/Monat"
          step={50}
          min={1}
          onChange={(value) =>
            onInputChange(
              "repaymentRate",
              Number(repaymentRateFromMonthlyPayment(referenceLoan, referenceRate, value).toFixed(3)),
            )
          }
          hint={`ergibt ${inputs.repaymentRate.toFixed(2)}% Tilgung · ${Number.isFinite(runtime) ? `${runtime.toFixed(0)} Jahre` : "läuft nie ab"}`}
        />
      ) : null}
    </div>
  );
}

type InputsPanelProps = {
  inputs: MortgageInputs;
  rates: InterestRates;
  activeGroup: InputGroupId;
  onGroupChange: (group: InputGroupId) => void;
  onInputChange: (key: NumericInputKey, value: number) => void;
  onRateChange: (key: ScenarioId, value: number) => void;
  onReset: () => void;
  onSafetyFocus: () => void;
  onMoreSpecial: () => void;
};

/**
 * Couple-level assumptions only. Purchase price, renovation and monthly ownership
 * costs live on the active apartment (ApartmentSwitcher) — see docs/DECISIONS.md D3.
 * Wait-related fields live inline in the Warten section (§6), not here, since that
 * group was previously duplicated as both a tab and an input group.
 */
export default function InputsPanel({
  inputs,
  rates,
  activeGroup,
  onGroupChange,
  onInputChange,
  onRateChange,
  onReset,
  onSafetyFocus,
  onMoreSpecial,
}: InputsPanelProps) {
  return (
    <Section
      title="Annahmen"
      subtitle="Kompakte Annahmen wie in einem Finanzrechner. Alles hier ist editierbar; Ergebnisse bleiben getrennt."
      right={
        <div className="button-row">
          {INPUT_GROUPS.map((group) => (
            <Button key={group.id} active={activeGroup === group.id} onClick={() => onGroupChange(group.id)}>
              {group.label}
            </Button>
          ))}
        </div>
      }
    >
      <div className="preset-row">
        <div className="button-row">
          <Button variant="action" onClick={onReset}>Reset</Button>
          <Button variant="action" onClick={onSafetyFocus}>Sicherheitsfokus</Button>
          <Button variant="action" onClick={onMoreSpecial}>Mehr Sondertilgung</Button>
        </div>
      </div>

      {activeGroup === "household" ? (
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
          <SegmentedChoice
            label="Kaufnebenkosten"
            value={inputs.closingCostRate}
            options={KNK_OPTIONS}
            onChange={(value) => onInputChange("closingCostRate", value)}
            info={GLOSSARY.closingCostRate}
          />
          <InputField
            label="Kaufnebenkosten frei"
            value={inputs.closingCostRate}
            suffix="%"
            step={0.01}
            min={0}
            onChange={(value) => onInputChange("closingCostRate", value)}
            hint={`= ${formatEur((inputs.purchasePrice * inputs.closingCostRate) / 100)} bei diesem Kaufpreis`}
          />
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
            hint={`Realrendite: ${(inputs.propertyGrowthRate - inputs.inflationRate).toLocaleString("de-DE", {
              maximumFractionDigits: 1,
            })}% p.a.`}
          />
          <InputField
            label="Umzug / Möbel"
            value={inputs.moving}
            onChange={(value) => onInputChange("moving", value)}
            info={GLOSSARY.moving}
          />
          <InputField
            label="Warmmiete heute"
            value={inputs.currentWarmRent}
            onChange={(value) => onInputChange("currentWarmRent", value)}
            info={GLOSSARY.currentWarmRent}
          />
        </div>
      ) : null}

      {activeGroup === "finance" ? (
        <div className="input-grid">
          <InputField
            label="Haushaltsnetto"
            value={inputs.householdNetIncome}
            onChange={(value) => onInputChange("householdNetIncome", value)}
            highlight
            info={GLOSSARY.householdNetIncome}
          />
          <TilgungField inputs={inputs} rates={rates} onInputChange={onInputChange} />
          <SegmentedChoice
            label="Zinsbindung"
            value={inputs.fixedRateYears}
            options={FIXED_RATE_OPTIONS}
            onChange={(value) => onInputChange("fixedRateYears", value)}
            info={GLOSSARY.fixedRateYears}
          />
          <InputField
            label="Zinsbindung frei"
            value={inputs.fixedRateYears}
            suffix="Jahre"
            step={1}
            min={1}
            onChange={(value) => onInputChange("fixedRateYears", value)}
            hint="Längere Bindung = mehr Sicherheit, meist höherer Zins. Zinssätze unten anpassen."
          />
          <Readout
            label="Sondertilgung p.a."
            value={formatEur(inputs.annualSpecialRepayment)}
            sub="Ø aus dem Jahresplan der aktiven Wohnung — hier nicht editierbar"
            info={GLOSSARY.annualSpecialRepayment}
          />
          <InputField
            label={`Zins 5% EK · ${inputs.fixedRateYears} J.`}
            value={rates.ek5}
            suffix="%"
            step={0.05}
            min={0}
            onChange={(value) => onRateChange("ek5", value)}
            info={GLOSSARY.interestRate}
          />
          <InputField
            label={`Zins 10% EK · ${inputs.fixedRateYears} J.`}
            value={rates.ek10}
            suffix="%"
            step={0.05}
            min={0}
            onChange={(value) => onRateChange("ek10", value)}
            info={GLOSSARY.interestRate}
          />
          <InputField
            label={`Zins 15% EK · ${inputs.fixedRateYears} J.`}
            value={rates.ek15}
            suffix="%"
            step={0.05}
            min={0}
            onChange={(value) => onRateChange("ek15", value)}
            info={GLOSSARY.interestRate}
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
        </div>
      ) : null}

      {activeGroup === "advanced" ? (
        <div className="input-grid">
          <InputField
            label="ETF-Rendite Annahme"
            value={inputs.etfReturnRate}
            suffix="% p.a."
            step={0.5}
            min={0}
            onChange={(value) => onInputChange("etfReturnRate", value)}
            info={GLOSSARY.etfReturnRate}
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
      ) : null}
    </Section>
  );
}
