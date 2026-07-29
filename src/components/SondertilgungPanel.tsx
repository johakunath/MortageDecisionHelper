import type { MortgageInputs, ScenarioResult, SpecialBreakEven } from "../lib/calculations";
import { formatEur } from "../lib/format";
import { Section } from "./ui";

type SondertilgungPanelProps = {
  inputs: MortgageInputs;
  selected: ScenarioResult;
  special5: SpecialBreakEven;
  special10: SpecialBreakEven;
  onSpecialRepaymentChange: (yearIndex: number, value: number) => void;
};

function breakEvenLine(label: string, breakEven: SpecialBreakEven, configured: number) {
  if (breakEven.amount == null) {
    return (
      <p key={label}>
        <strong>{label}:</strong> nicht erreichbar — selbst die maximal erlaubte Sondertilgung von{" "}
        {formatEur(breakEven.maxSpecial)}/Jahr reicht nicht. Weniger EK wäre hier eine reine
        Liquiditätsentscheidung.
      </p>
    );
  }

  const covered = configured >= breakEven.amount;
  return (
    <p key={label}>
      <strong>{label}:</strong> {formatEur(breakEven.amount)}/Jahr —{" "}
      {covered ? "vom aktuellen Plan gedeckt." : `mehr als die geplanten ${formatEur(configured)}/Jahr.`}
    </p>
  );
}

/**
 * Slimmed deliberately (docs/DECISIONS.md D6): this section answers one question —
 * can Sondertilgung substitute for Eigenkapital? — and the ten year-by-year inputs
 * that used to dominate it are editing detail, not the answer, so they sit behind a
 * disclosure.
 */
export default function SondertilgungPanel({
  inputs,
  selected,
  special5,
  special10,
  onSpecialRepaymentChange,
}: SondertilgungPanelProps) {
  const configured = inputs.annualSpecialRepayment;
  const visibleYears = Math.min(Math.max(inputs.fixedRateYears, 5), 15);
  const specialRows = Array.from({ length: visibleYears }, (_, index) => ({
    year: index + 1,
    amount: inputs.annualSpecialRepayments[index] ?? 0,
  }));

  return (
    <Section
      title="Sondertilgung"
      subtitle="Kann weniger Eigenkapital später durch Sondertilgung aufgeholt werden? Verglichen mit 15% EK ohne eigene Sondertilgung."
    >
      <div className="interpretation">
        {breakEvenLine("5% EK", special5, configured)}
        {breakEvenLine("10% EK", special10, configured)}
        <p className="interpretation-caveat">
          Rechnerisches Ergebnis, keine Verhaltensgarantie: die offene Frage bleibt, ob diese
          Sondertilgung tatsächlich jedes Jahr geleistet wird. Cap laut Vertrag:{" "}
          {formatEur(selected.mortgage.maxAnnualSpecial)}/Jahr.
        </p>
      </div>

      <details className="special-editor-details">
        <summary>Jahresplan bearbeiten (Ø {formatEur(configured)}/Jahr)</summary>
        <div className="special-grid">
          {specialRows.map((row, index) => (
            <label key={row.year} className="special-row">
              <span>J{row.year}</span>
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
      </details>
    </Section>
  );
}
