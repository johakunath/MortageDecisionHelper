import type { MortgageInputs, ScenarioResult, SpecialBreakEven } from "../lib/calculations";
import { formatEur, formatPct } from "../lib/format";
import { Readout, Section } from "./ui";

type SondertilgungPanelProps = {
  inputs: MortgageInputs;
  selected: ScenarioResult;
  special5: SpecialBreakEven;
  special10: SpecialBreakEven;
  onSpecialRepaymentChange: (yearIndex: number, value: number) => void;
};

export default function SondertilgungPanel({
  inputs,
  selected,
  special5,
  special10,
  onSpecialRepaymentChange,
}: SondertilgungPanelProps) {
  const visibleYears = Math.min(Math.max(inputs.fixedRateYears, 5), 15);
  const specialRows = Array.from({ length: visibleYears }, (_, index) => ({
    year: index + 1,
    amount: inputs.annualSpecialRepayments[index] ?? inputs.annualSpecialRepayment,
  }));

  return (
    <Section
      title="Sondertilgung"
      subtitle="Prüft, ob niedrigeres EK später realistisch durch konkrete jährliche Sondertilgungen kompensiert werden kann."
    >
      <div className="readout-grid three">
        <Readout
          label="5% → 15%-Zinskosten"
          value={special5.amount == null ? "Nicht möglich" : `${formatEur(special5.amount)}/Jahr`}
          sub={`Max. erlaubt: ${formatEur(special5.maxSpecial)}/Jahr`}
          tone={special5.feasible ? "green" : "red"}
        />
        <Readout
          label="10% → 15%-Zinskosten"
          value={special10.amount == null ? "Nicht möglich" : `${formatEur(special10.amount)}/Jahr`}
          sub={`Max. erlaubt: ${formatEur(special10.maxSpecial)}/Jahr`}
          tone={special10.feasible ? "green" : "red"}
        />
        <Readout
          label="Ø geplante Sondertilgung"
          value={`${formatEur(inputs.annualSpecialRepayment)}/Jahr`}
          sub={`Cap in Auswahl: ${formatEur(selected.mortgage.maxAnnualSpecial)} (${formatPct(inputs.specialRepaymentLimitRate)})`}
          tone="blue"
        />
      </div>

      <div className="special-editor">
        <div className="special-editor-head">
          <div>
            <h3>Jährliche Sondertilgungen</h3>
            <p>Jedes Jahr kann einzeln gesetzt werden. Der Bank-Cap wird in der Simulation automatisch angewendet.</p>
          </div>
          <span>Auswahl: {selected.label}</span>
        </div>
        <div className="special-grid">
          {specialRows.map((row, index) => (
            <label key={row.year} className="special-row">
              <span>Jahr {row.year}</span>
              <input
                type="number"
                min={0}
                step={500}
                value={row.amount}
                onChange={(event) => onSpecialRepaymentChange(index, Number(event.target.value) || 0)}
              />
              <em>€</em>
            </label>
          ))}
        </div>
      </div>

      <div className={`interpretation ${special5.feasible ? "interpretation-ok" : "interpretation-danger"}`}>
        {special5.feasible
          ? "Interpretation: 5% EK kann in diesem Modell durch Sondertilgung auf die Zinskosten von 15% EK gebracht werden. Die offene Frage ist, ob diese Sondertilgung jedes Jahr realistisch bleibt."
          : "Interpretation: Selbst maximale Sondertilgung reicht nicht, um 5% EK auf die Zinskosten von 15% EK zu bringen. Niedriges EK wäre dann primär eine Liquiditätsentscheidung."}
      </div>
    </Section>
  );
}
