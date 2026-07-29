import type { InterestRates, MortgageInputs, ScenarioId } from "../lib/calculations";
import { INPUT_GROUPS, type InputGroupId } from "../lib/defaults";
import { formatEur } from "../lib/format";
import { Button, InputField, Readout, Section, SegmentedChoice } from "./ui";

type NumericInputKey = Exclude<keyof MortgageInputs, "annualSpecialRepayments">;

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
          />
          <InputField
            label="Sicherheitsreserve"
            value={inputs.reserveTarget}
            onChange={(value) => onInputChange("reserveTarget", value)}
          />
          <InputField
            label="Kaufnebenkosten"
            value={inputs.closingCostRate}
            suffix="%"
            step={0.1}
            min={0}
            onChange={(value) => onInputChange("closingCostRate", value)}
          />
          <SegmentedChoice
            label="KNK Schnellwahl"
            value={inputs.closingCostRate}
            options={[8, 9, 11.57]}
            onChange={(value) => onInputChange("closingCostRate", value)}
          />
          <InputField
            label="Wertsteigerung"
            value={inputs.propertyGrowthRate}
            suffix="% p.a."
            step={0.1}
            onChange={(value) => onInputChange("propertyGrowthRate", value)}
          />
          <InputField
            label="Inflation"
            value={inputs.inflationRate}
            suffix="% p.a."
            step={0.1}
            onChange={(value) => onInputChange("inflationRate", value)}
            hint={`Realrendite: ${(inputs.propertyGrowthRate - inputs.inflationRate).toLocaleString("de-DE", {
              maximumFractionDigits: 1,
            })}% p.a.`}
          />
          <InputField
            label="Umzug / Möbel"
            value={inputs.moving}
            onChange={(value) => onInputChange("moving", value)}
          />
          <InputField
            label="Warmmiete heute"
            value={inputs.currentWarmRent}
            onChange={(value) => onInputChange("currentWarmRent", value)}
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
          />
          <InputField
            label="Anfangstilgung"
            value={inputs.repaymentRate}
            suffix="%"
            step={0.1}
            min={0}
            onChange={(value) => onInputChange("repaymentRate", value)}
          />
          <InputField
            label="Zinsbindung"
            value={inputs.fixedRateYears}
            suffix="Jahre"
            step={1}
            min={1}
            onChange={(value) => onInputChange("fixedRateYears", value)}
          />
          <Readout
            label="Sondertilgung p.a."
            value={formatEur(inputs.annualSpecialRepayment)}
            sub="Ø aus dem Jahresplan der aktiven Wohnung — hier nicht editierbar"
          />
          <InputField
            label="Zins 5% EK"
            value={rates.ek5}
            suffix="%"
            step={0.05}
            min={0}
            onChange={(value) => onRateChange("ek5", value)}
          />
          <InputField
            label="Zins 10% EK"
            value={rates.ek10}
            suffix="%"
            step={0.05}
            min={0}
            onChange={(value) => onRateChange("ek10", value)}
          />
          <InputField
            label="Zins 15% EK"
            value={rates.ek15}
            suffix="%"
            step={0.05}
            min={0}
            onChange={(value) => onRateChange("ek15", value)}
          />
          <InputField
            label="Sondertilgung Cap"
            value={inputs.specialRepaymentLimitRate}
            suffix="%"
            step={0.5}
            min={0}
            onChange={(value) => onInputChange("specialRepaymentLimitRate", value)}
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
          />
          <InputField
            label="Max. Haushaltsbelastung"
            value={inputs.maxBurdenRate}
            suffix="%"
            step={1}
            min={1}
            onChange={(value) => onInputChange("maxBurdenRate", value)}
            hint="Persönliche Schwelle, keine Bankregel"
          />
        </div>
      ) : null}
    </Section>
  );
}
