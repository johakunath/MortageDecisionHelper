import type { InterestRates, MortgageInputs, ScenarioId } from "../lib/calculations";
import {
  CASE_PRESETS,
  INPUT_GROUPS,
  type InputGroupId,
  type PresetId,
} from "../lib/defaults";
import { Button, InputField, Section, SegmentedChoice } from "./ui";

type NumericInputKey = Exclude<keyof MortgageInputs, "annualSpecialRepayments">;

type InputsPanelProps = {
  inputs: MortgageInputs;
  rates: InterestRates;
  activeGroup: InputGroupId;
  onGroupChange: (group: InputGroupId) => void;
  onInputChange: (key: NumericInputKey, value: number) => void;
  onRateChange: (key: ScenarioId, value: number) => void;
  onPreset: (preset: PresetId | "reset" | "safety" | "special") => void;
  forceGroup?: InputGroupId;
};

export default function InputsPanel({
  inputs,
  rates,
  activeGroup,
  onGroupChange,
  onInputChange,
  onRateChange,
  onPreset,
  forceGroup,
}: InputsPanelProps) {
  const visibleGroup = forceGroup ?? activeGroup;

  return (
    <Section
      title="Eingaben"
      subtitle="Kompakte Annahmen wie in einem Finanzrechner. Alles hier ist editierbar; Ergebnisse bleiben getrennt."
      right={
        forceGroup ? null : (
          <div className="button-row">
            {INPUT_GROUPS.map((group) => (
              <Button
                key={group.id}
                active={visibleGroup === group.id}
                onClick={() => onGroupChange(group.id)}
              >
                {group.label}
              </Button>
            ))}
          </div>
        )
      }
    >
      <div className="preset-row">
        <div className="button-row">
          {(Object.keys(CASE_PRESETS) as PresetId[]).map((presetId) => (
            <Button key={presetId} onClick={() => onPreset(presetId)}>
              {CASE_PRESETS[presetId].label}
            </Button>
          ))}
        </div>
        <div className="button-row">
          <Button onClick={() => onPreset("reset")}>Reset</Button>
          <Button onClick={() => onPreset("safety")}>Sicherheitsfokus</Button>
          <Button onClick={() => onPreset("special")}>Mehr Sondertilgung</Button>
        </div>
      </div>

      {visibleGroup === "purchase" ? (
        <div className="input-grid">
          <InputField
            label="Kaufpreis"
            value={inputs.purchasePrice}
            onChange={(value) => onInputChange("purchasePrice", value)}
            highlight
          />
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
            label="Renovierung"
            value={inputs.renovation}
            onChange={(value) => onInputChange("renovation", value)}
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
          <InputField
            label="Eigentumskosten mtl."
            value={inputs.monthlyOwnershipCosts}
            onChange={(value) => onInputChange("monthlyOwnershipCosts", value)}
          />
        </div>
      ) : null}

      {visibleGroup === "finance" ? (
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
          <InputField
            label="Sondertilgung p.a."
            value={inputs.annualSpecialRepayment}
            onChange={(value) => onInputChange("annualSpecialRepayment", value)}
            hint="Fallback für Jahre ohne Einzelwert"
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

      {visibleGroup === "wait" ? (
        <div className="input-grid">
          <InputField
            label="Wartezeit"
            value={inputs.waitMonths}
            suffix="Monate"
            step={1}
            min={0}
            onChange={(value) => onInputChange("waitMonths", value)}
            highlight
          />
          <InputField
            label="Sparrate während Warten"
            value={inputs.waitSavingsMonthly}
            onChange={(value) => onInputChange("waitSavingsMonthly", value)}
          />
          <InputField
            label="Kaufpreiswachstum"
            value={inputs.waitPropertyGrowthRate}
            suffix="% p.a."
            step={0.1}
            onChange={(value) => onInputChange("waitPropertyGrowthRate", value)}
          />
          <InputField
            label="Zinsänderung"
            value={inputs.waitRateShift}
            suffix="%-Pkt."
            step={0.1}
            onChange={(value) => onInputChange("waitRateShift", value)}
          />
        </div>
      ) : null}

      {visibleGroup === "advanced" ? (
        <div className="input-grid">
          <InputField
            label="ETF-Rendite Annahme"
            value={inputs.etfReturnRate}
            suffix="% p.a."
            step={0.5}
            min={0}
            onChange={(value) => onInputChange("etfReturnRate", value)}
          />
        </div>
      ) : null}
    </Section>
  );
}
