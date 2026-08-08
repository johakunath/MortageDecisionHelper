import { BETTER_WHEN, type WaitScenario } from "../lib/calculations";
import { formatEur, formatPct } from "../lib/format";
import { Section, SignedValue } from "./ui";

type WaitPanelProps = {
  scenarios: WaitScenario[];
};

function columnLabel(waitMonths: number): string {
  return waitMonths === 0 ? "Jetzt kaufen" : `${waitMonths} Monate warten`;
}

/**
 * Buy-now against each waiting period (PRODUCT_SPEC §7.5), as a table with the metrics
 * as ROWS and the waiting periods as columns.
 *
 * It used to be three stacked cards of up to eight readouts each — twenty-odd numbers
 * with no shared baseline, so comparing "Cash nach Kauf" across the options meant
 * hunting for the same label three times at three different heights. Reading across a
 * row is the entire job here, so the layout is a row.
 *
 * Rent is never subtracted from the adjusted capital (docs/DECISIONS.md D4) but it IS
 * part of what waiting costs, so it carries the bottom row: "Δ gesamt zu jetzt kaufen"
 * = Zinsdifferenz + Miete. The interest-only delta stays visible directly above it,
 * because a single combined figure would hide which half moved (D27).
 */
export default function WaitPanel({ scenarios }: WaitPanelProps) {
  const rows: {
    label: string;
    note?: string;
    /** The bottom line of the section — the row the couple actually argues over. */
    emphasis?: boolean;
    render: (wait: WaitScenario) => React.ReactNode;
  }[] = [
    { label: "Kaufpreis dann", render: (w) => formatEur(w.futurePrice) },
    {
      label: "Kapital dann",
      note: "inkl. dem, was ihr bis dahin spart",
      render: (w) => formatEur(w.adjustedAvailableCapital),
    },
    { label: "Zinssatz dann", render: (w) => formatPct(w.adjustedInterestRate) },
    { label: "Darlehen dann", render: (w) => formatEur(w.futureLoan) },
    {
      label: "Cash nach Kauf",
      render: (w) => (
        <span className={w.cashLeftAfterPurchase >= 0 ? "wait-ok" : "wait-bad"}>
          {formatEur(w.cashLeftAfterPurchase)}
        </span>
      ),
    },
    {
      label: "Zinsen gesamt",
      note: "illustrativ, bei konstantem Zins",
      render: (w) => formatEur(w.scenario.mortgage.interestTotal),
    },
    {
      label: "Δ Zinsen zu jetzt kaufen",
      note: "nur die Zinsen — ohne die Miete aus der Zeile darunter",
      render: (w) =>
        w.waitMonths === 0 ? (
          <span className="muted">—</span>
        ) : (
          <SignedValue value={w.deltaInterest} betterWhen={BETTER_WHEN.interestTotal} />
        ),
    },
    {
      label: "Miete in der Zwischenzeit",
      note: "Kosten des Wartens — bewusst nicht vom Kapital abgezogen",
      render: (w) =>
        w.waitMonths === 0 ? <span className="muted">—</span> : formatEur(w.rentPaid),
    },
    {
      label: "Δ gesamt zu jetzt kaufen",
      note: "Zinsdifferenz + Miete in der Zwischenzeit",
      emphasis: true,
      render: (w) =>
        w.waitMonths === 0 ? (
          <span className="muted">—</span>
        ) : (
          <SignedValue value={w.deltaTotalCost} betterWhen={BETTER_WHEN.interestTotal} />
        ),
    },
  ];

  return (
    <Section
      title="Warten"
      subtitle="Kein Forecast, sondern eine Szenario-Sicht: Was passiert mit Preis, Kapital, Miete und Zinsannahme, wenn ihr wartet?"
    >
      <div className="table-wrap">
        <table className="tradeoff-table is-dense wait-table">
          <thead>
            <tr>
              <th>Kennzahl</th>
              {scenarios.map((wait) => (
                <th key={wait.waitMonths} className={wait.waitMonths === 0 ? "is-active-col" : ""}>
                  {columnLabel(wait.waitMonths)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className={row.emphasis ? "is-total-row" : ""}>
                <td>
                  <strong>{row.label}</strong>
                  {row.note ? <small>{row.note}</small> : null}
                </td>
                {scenarios.map((wait) => (
                  <td key={wait.waitMonths} className={wait.waitMonths === 0 ? "is-active-col" : ""}>
                    {row.render(wait)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/*
        Says out loud why rent appears in one row and not in the other — otherwise the
        two look like they contradict each other.
      */}
      <p className="wait-footnote">
        Die Miete zählt bei den Kosten mit, beim Kapital nicht: „Netto-Sparrate“ ist
        bereits der Betrag, der <em>nach</em> der Miete übrig bleibt. Sie ein zweites Mal
        vom Kapital abzuziehen würde sie doppelt zählen.
      </p>
    </Section>
  );
}
