import {
  BETTER_WHEN,
  type MortgageInputs,
  type ScenarioResult,
  type SpecialComparison,
  type SpecialMatchRow,
} from "../lib/calculations";
import { formatCompactEur, formatEur } from "../lib/format";
import BarChart, { type BarGroup } from "./BarChart";
import { Button, Readout, Section, SignedValue, useNumericDraft } from "./ui";

type SondertilgungPanelProps = {
  inputs: MortgageInputs;
  selected: ScenarioResult;
  comparison: SpecialComparison;
  onSpecialRepaymentChange: (yearIndex: number, value: number) => void;
  onLevelSpecialRepayments: (value: number) => void;
};

/**
 * Names who would have to pay, always. "Deine Wahl braucht 7.400 €/Jahr" and
 * "20% EK bräuchte 7.400 €/Jahr" are statements about different people's money, and
 * the previous free-baseline UI made them impossible to tell apart.
 *
 * The amount is a flat payment for the **whole runtime**; the yearly plan is a finite
 * path. Comparing the two as bare € figures is what made this cell claim "vom Plan
 * gedeckt" for a plan that was 15.519 € of interest short, so the covered state comes
 * from the engine's modelled path (`catchUp.planCovers`), never from the average.
 * See docs/DECISIONS.md D22.
 */
function CatchUpCell({ row, selected }: { row: SpecialMatchRow; selected: ScenarioResult }) {
  const { catchUp } = row;
  if (!catchUp) return <span className="muted">—</span>;

  const payerName = catchUp.payer === "selection" ? `Deine Wahl (${selected.label})` : row.base.label;

  if (catchUp.alreadyAhead) {
    return (
      <span className="special-covered">
        nichts nötig
        <small>{payerName} ist schon günstiger</small>
      </span>
    );
  }

  if (catchUp.amount == null) {
    return (
      <span className="special-unreachable">
        nicht erreichbar
        <small>
          {payerName}, max. {formatEur(catchUp.maxSpecial)}/Jahr laut Vertrag
        </small>
      </span>
    );
  }

  const covered = catchUp.payer === "selection" && catchUp.planCovers;
  return (
    <span className={covered ? "special-covered" : "special-short"}>
      {formatEur(catchUp.amount)}/Jahr
      <small>
        {payerName} · jedes Jahr der Laufzeit
        {catchUp.payer === "selection"
          ? covered
            ? " — euer Jahresplan erreicht das bereits"
            : ` — euer Jahresplan bleibt ${formatEur(catchUp.planShortfall)} Zinsen darüber`
          : ""}
      </small>
    </span>
  );
}

/**
 * One year of the plan.
 *
 * Its own component so the year's input can hold a typing draft: 0 means "no
 * repayment in this year", so clearing the field to retype it used to commit a 0 and
 * drop the row out of the list mid-edit — the same click as the ✕ button beside it.
 */
function SpecialYearRow({
  year,
  amount,
  cap,
  onChange,
}: {
  year: number;
  amount: number;
  cap: number;
  onChange: (value: number) => void;
}) {
  const draft = useNumericDraft(amount, onChange);

  return (
    <div className={`special-entry ${amount > cap ? "is-over-cap" : ""}`}>
      <span className="special-entry-year">Jahr {year}</span>
      <label className="special-row">
        <input type="number" min={0} step={500} aria-label={`Sondertilgung Jahr ${year}`} {...draft} />
        <em>€</em>
      </label>
      <span className="special-entry-monthly">
        = {formatEur(amount / 12)}/Monat
        {amount > cap ? <em className="special-over-cap">über dem Cap</em> : null}
      </span>
      <button
        type="button"
        className="special-entry-remove"
        aria-label={`Jahr ${year} entfernen`}
        onClick={() => onChange(0)}
      >
        ✕
      </button>
    </div>
  );
}

/**
 * Answers one question and only one: what does our Sondertilgung buy us, and does it
 * close the gap to the other EK levels?
 *
 * The reference point is the EK level selected at the top of the page, running the
 * current yearly plan — not a separately chosen baseline. Two pickers ("Vergleichsziel"
 * and "dabei ohne/mit Plan") produced four readings of one table and the owner could
 * not tell which question was on screen. See docs/DECISIONS.md D17.
 *
 * Note on the labels: Kaufnebenkosten are never financed in this model — the loan is
 * always `Kaufpreis − Anzahlung`, and the Nebenkosten come out of cash. So every row
 * is really "X% EK + Nebenkosten", and the heading says so, because "10% EK" alone
 * is ambiguous about exactly the thing German buyers most often get wrong.
 */
export default function SondertilgungPanel({
  inputs,
  selected,
  comparison,
  onSpecialRepaymentChange,
  onLevelSpecialRepayments,
}: SondertilgungPanelProps) {
  const configured = inputs.annualSpecialRepayment;
  const cap = selected.mortgage.maxAnnualSpecial;

  const entries = inputs.annualSpecialRepayments
    .map((amount, index) => ({ year: index + 1, amount }))
    .filter((entry) => entry.amount > 0);

  /** The first year with nothing in it — so deleting year 4 and adding refills year 4. */
  function addNextYear() {
    const plan = inputs.annualSpecialRepayments;
    let year = 1;
    while (year <= 60 && (plan[year - 1] ?? 0) > 0) year += 1;
    if (year > 60) return;

    const last = entries.length > 0 ? entries[entries.length - 1].amount : 0;
    onSpecialRepaymentChange(year - 1, last > 0 ? last : configured > 0 ? configured : 6000);
  }

  const otherRows = comparison.rows.filter((row) => !row.isSelected);
  const groups: BarGroup[] = comparison.rows.map((row) => ({
    id: row.base.id,
    label: row.base.label,
    highlighted: row.isSelected,
    bars: [
      { id: `${row.base.id}-none`, label: "ohne ST", value: row.interestNoSpecial, muted: true },
      { id: `${row.base.id}-plan`, label: "mit Plan", value: row.interestWithPlan },
    ],
  }));

  return (
    <Section
      title="Sondertilgung"
      subtitle="Was bringt euer Jahresplan — und holt er auf, was eine höhere Eigenkapitalstufe an Zinsen spart? Verglichen wird immer gegen die oben gewählte Stufe. Kaufnebenkosten werden in jedem Szenario aus Eigenkapital bezahlt, nie mitfinanziert."
    >
      <div className="special-headline">
        <div className="special-headline-title">
          <div className="eyebrow">Deine Wahl</div>
          <h3>{selected.label} + Nebenkosten</h3>
        </div>
        <div className="readout-grid three">
          <Readout
            label="Zinsen ohne Sondertilgung"
            value={formatEur(comparison.selectionInterestNoSpecial)}
            sub="gesamte Laufzeit · illustrativ"
          />
          <Readout
            label="Zinsen mit eurem Plan"
            value={formatEur(comparison.selectionInterestWithPlan)}
            sub={`Ø ${formatEur(configured)}/Jahr`}
            tone="amber"
          />
          <Readout
            label="Das bringt der Plan"
            value={
              <SignedValue
                value={comparison.planSaving}
                betterWhen={BETTER_WHEN.interestTotal}
                verdictLabels={{ better: "gespart", worse: "teurer" }}
              />
            }
            sub="über die gesamte Laufzeit"
            tone={comparison.planSaving < 0 ? "green" : "slate"}
          />
        </div>
      </div>

      <BarChart
        groups={groups}
        formatValue={(value) => formatCompactEur(value, true)}
        seriesLabels={["Zinsen ohne Sondertilgung", "Zinsen mit eurem Plan"]}
        caption="Gesamtzinsen je EK-Stufe über die volle Laufzeit — illustrativ, bei konstantem Zins"
      />

      <div className="table-wrap">
        <table className="tradeoff-table is-dense">
          <thead>
            <tr>
              <th>Andere Stufen</th>
              <th>Zinsen ohne ST</th>
              <th>Unterschied zu deiner Wahl</th>
              <th>Aufholen mit Sondertilgung</th>
            </tr>
          </thead>
          <tbody>
            {otherRows.map((row) => (
              <tr key={row.base.id}>
                <td>
                  <strong>{row.base.ekRate}% EK + Nebenkosten</strong>
                  <small>ohne eigene Sondertilgung gerechnet</small>
                </td>
                <td>{formatEur(row.interestNoSpecial)}</td>
                <td>
                  {/*
                    Positive = this level costs more than our choice, which is good for
                    us — hence "higher is better" here, read from our side of the table.
                  */}
                  <SignedValue
                    value={row.deltaToSelection}
                    betterWhen="higher"
                    verdictLabels={{
                      better: "deine Wahl ist günstiger",
                      worse: "deine Wahl ist teurer",
                    }}
                  />
                </td>
                <td>
                  <CatchUpCell row={row} selected={selected} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="special-editor">
        <div className="special-editor-head">
          <h3>Jahresplan</h3>
          <p>
            {entries.length} {entries.length === 1 ? "Jahr" : "Jahre"} · Ø {formatEur(configured)}
            /Jahr · Cap laut Vertrag {formatEur(cap)}/Jahr
          </p>
        </div>

        <div className="special-list">
          {entries.length === 0 ? (
            <p className="save-empty">Keine Sondertilgung geplant.</p>
          ) : (
            entries.map((entry) => (
              <SpecialYearRow
                key={entry.year}
                year={entry.year}
                amount={entry.amount}
                cap={cap}
                onChange={(value) => onSpecialRepaymentChange(entry.year - 1, value)}
              />
            ))
          )}
        </div>

        <div className="special-actions">
          <Button variant="action" onClick={addNextYear}>Jahr hinzufügen</Button>
          {entries.length > 1 ? (
            <Button variant="action" onClick={() => onLevelSpecialRepayments(entries[0].amount)}>
              Alle auf {formatEur(entries[0].amount)}
            </Button>
          ) : null}
        </div>
      </div>
    </Section>
  );
}
