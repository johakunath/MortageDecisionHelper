import { useState } from "react";
import {
  BETTER_WHEN,
  type MortgageInputs,
  type ScenarioBase,
  type ScenarioId,
  type ScenarioResult,
  type SpecialComparison,
  type SpecialPlanMode,
} from "../lib/calculations";
import { formatEur } from "../lib/format";
import { Button, Section, SignedValue } from "./ui";

type SondertilgungPanelProps = {
  inputs: MortgageInputs;
  selected: ScenarioResult;
  bases: ScenarioBase[];
  comparison: SpecialComparison;
  baselineId: ScenarioId;
  baselineMode: SpecialPlanMode;
  onBaselineChange: (id: ScenarioId) => void;
  onBaselineModeChange: (mode: SpecialPlanMode) => void;
  onSpecialRepaymentChange: (yearIndex: number, value: number) => void;
};

/**
 * Answers "can Sondertilgung substitute for Eigenkapital?" against a baseline the
 * user chooses, rather than a hardwired 15% EK target.
 *
 * Note on the labels: Kaufnebenkosten are never financed in this model — the loan is
 * always `Kaufpreis − Anzahlung`, and the Nebenkosten come out of cash. So every row
 * is really "X% EK + Nebenkosten", and the heading says so, because "10% EK" alone
 * is ambiguous about exactly the thing German buyers most often get wrong.
 */
export default function SondertilgungPanel({
  inputs,
  selected,
  bases,
  comparison,
  baselineId,
  baselineMode,
  onBaselineChange,
  onBaselineModeChange,
  onSpecialRepaymentChange,
}: SondertilgungPanelProps) {
  const [newYear, setNewYear] = useState("");
  const configured = inputs.annualSpecialRepayment;

  const entries = inputs.annualSpecialRepayments
    .map((amount, index) => ({ year: index + 1, amount }))
    .filter((entry) => entry.amount > 0);

  function addYear() {
    const year = Number(newYear);
    if (!Number.isFinite(year) || year < 1 || year > 60) return;
    if (inputs.annualSpecialRepayments[year - 1] > 0) return;
    onSpecialRepaymentChange(year - 1, configured > 0 ? configured : 6000);
    setNewYear("");
  }

  const baselineLabel = bases.find((base) => base.id === baselineId)?.label ?? "";

  return (
    <Section
      title="Sondertilgung"
      subtitle="Kann weniger Eigenkapital durch Sondertilgung aufgeholt werden? Vergleichsziel frei wählbar. Kaufnebenkosten werden in jedem Szenario aus Eigenkapital bezahlt, nie mitfinanziert."
    >
      <div className="baseline-picker">
        <div className="baseline-group">
          <span className="baseline-label">Vergleichsziel</span>
          <div className="button-row">
            {bases.map((base) => (
              <Button
                key={base.id}
                active={baselineId === base.id}
                onClick={() => onBaselineChange(base.id)}
              >
                {base.ekRate}% EK
              </Button>
            ))}
          </div>
        </div>
        <div className="baseline-group">
          <span className="baseline-label">dabei</span>
          <div className="button-row">
            <Button active={baselineMode === "none"} onClick={() => onBaselineModeChange("none")}>
              ohne Sondertilgung
            </Button>
            <Button active={baselineMode === "plan"} onClick={() => onBaselineModeChange("plan")}>
              mit aktuellem Plan
            </Button>
          </div>
        </div>
      </div>

      <p className="baseline-summary">
        Ziel: <strong>{baselineLabel} + Nebenkosten</strong>{" "}
        {baselineMode === "none" ? "ohne Sondertilgung" : `mit dem aktuellen Plan (Ø ${formatEur(configured)}/Jahr)`}{" "}
        — Gesamtzinsen <strong>{formatEur(comparison.baselineInterest)}</strong> (illustrativ).
      </p>

      <div className="table-wrap">
        <table className="tradeoff-table">
          <thead>
            <tr>
              <th>Weg</th>
              <th>Zinsen ohne ST</th>
              <th>Zinsen mit Plan</th>
              <th>Differenz zum Ziel</th>
              <th>Nötige Sondertilgung</th>
            </tr>
          </thead>
          <tbody>
            {comparison.rows.map((row) => {
              const covered = row.required.amount != null && configured >= row.required.amount;
              return (
                <tr key={row.base.id} className={row.isBaseline ? "is-active-row" : ""}>
                  <td>
                    <strong>{row.base.ekRate}% EK + Nebenkosten</strong>
                    {row.isBaseline ? <small>Vergleichsziel</small> : null}
                  </td>
                  <td>{formatEur(row.interestNoSpecial)}</td>
                  <td>{formatEur(row.interestWithPlan)}</td>
                  <td>
                    {row.isBaseline ? (
                      <span className="muted">—</span>
                    ) : (
                      <SignedValue value={row.deltaToBaseline} betterWhen={BETTER_WHEN.interestTotal} />
                    )}
                  </td>
                  <td>
                    {row.isBaseline ? (
                      <span className="muted">—</span>
                    ) : row.required.amount == null ? (
                      <span className="special-unreachable">
                        nicht erreichbar
                        <small>max. {formatEur(row.required.maxSpecial)}/Jahr</small>
                      </span>
                    ) : (
                      <span className={covered ? "special-covered" : "special-short"}>
                        {formatEur(row.required.amount)}/Jahr
                        <small>{covered ? "vom Plan gedeckt" : `Plan: ${formatEur(configured)}/Jahr`}</small>
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="interpretation-caveat">
        Rechnerisches Ergebnis, keine Verhaltensgarantie: die offene Frage bleibt, ob diese
        Sondertilgung tatsächlich jedes Jahr geleistet wird. Cap laut Vertrag:{" "}
        {formatEur(selected.mortgage.maxAnnualSpecial)}/Jahr.
      </p>

      <details className="special-editor-details">
        <summary>
          Jahresplan bearbeiten — {entries.length} {entries.length === 1 ? "Jahr" : "Jahre"}, Ø{" "}
          {formatEur(configured)}/Jahr
        </summary>

        <div className="special-list">
          {entries.length === 0 ? (
            <p className="save-empty">Keine Sondertilgung geplant.</p>
          ) : (
            entries.map((entry) => (
              <div key={entry.year} className="special-entry">
                <span className="special-entry-year">Jahr {entry.year}</span>
                <label className="special-row">
                  <input
                    type="number"
                    min={0}
                    step={500}
                    value={entry.amount}
                    aria-label={`Sondertilgung Jahr ${entry.year}`}
                    onChange={(event) =>
                      onSpecialRepaymentChange(entry.year - 1, Number(event.target.value) || 0)
                    }
                  />
                  <em>€</em>
                </label>
                <span className="special-entry-monthly">= {formatEur(entry.amount / 12)}/Monat</span>
                <button
                  type="button"
                  className="special-entry-remove"
                  aria-label={`Jahr ${entry.year} entfernen`}
                  onClick={() => onSpecialRepaymentChange(entry.year - 1, 0)}
                >
                  ✕
                </button>
              </div>
            ))
          )}
        </div>

        <div className="special-add">
          <label className="save-field">
            <span>Jahr hinzufügen</span>
            <input
              type="number"
              min={1}
              max={60}
              value={newYear}
              placeholder="z.B. 14"
              onChange={(event) => setNewYear(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addYear();
                }
              }}
            />
          </label>
          <Button variant="action" onClick={addYear}>Hinzufügen</Button>
        </div>
      </details>
    </Section>
  );
}
