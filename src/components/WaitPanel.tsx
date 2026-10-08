import {
  BETTER_WHEN,
  type WaitAssumption,
  type WaitScenario,
  type WaitTippingPoint,
} from "../lib/calculations";
import { formatEur, formatNumber, formatPct, formatSignedPoints } from "../lib/format";
import { Section, SignedValue } from "./ui";

type WaitPanelProps = {
  scenarios: WaitScenario[];
  /** Tipping points for the Wartezeit the couple entered; empty when it is 0. */
  tippingPoints: WaitTippingPoint[];
  waitMonths: number;
};

function columnLabel(waitMonths: number): string {
  return waitMonths === 0 ? "Jetzt kaufen" : `${waitMonths} Monate warten`;
}

/** One clause per assumption, in the couple's words, with what they assumed. */
function describePoint(point: WaitTippingPoint): string | null {
  if (point.flipsAt == null) return null;
  const phrases: Record<WaitAssumption, (value: number) => string> = {
    waitRateShift: (value) => `einer Zinsänderung von ${formatSignedPoints(value)}`,
    waitPropertyGrowthRate: (value) => `einem Preisanstieg von ${formatPct(value)} p.a.`,
    etfReturnRate: (value) => `einer Kapitalrendite von ${formatPct(value)} p.a.`,
  };
  const assumed =
    point.assumption === "waitRateShift" ? formatSignedPoints(point.assumed) : formatPct(point.assumed);
  return `${phrases[point.assumption](point.flipsAt)} (Annahme ${assumed})`;
}

function joinClauses(parts: string[]): string {
  if (parts.length <= 1) return parts.join("");
  return `${parts.slice(0, -1).join(", ")} oder ${parts[parts.length - 1]}`;
}

/**
 * Buy-now against each waiting period (PRODUCT_SPEC §7.5), as a table with the metrics
 * as ROWS and the waiting periods as columns (D20).
 *
 * The bottom line is the wealth difference on one common date, from the same ledger as
 * every other comparison (D30, D33). It replaces D27's "Δ gesamt", a full-term interest
 * delta plus rent, which left out the buy-now path's ownership costs and principal and
 * what capital earns while waiting, and read "6.662 € teurer" on the offer flat where
 * waiting is in fact ahead at the default assumptions. Below the table, the values at
 * which that verdict would flip: the question spec §2.3 actually asks.
 */
export default function WaitPanel({ scenarios, tippingPoints, waitMonths }: WaitPanelProps) {
  const horizonYears = formatNumber((scenarios[0]?.wealth.horizonMonths ?? 0) / 12, 0);
  const rows: {
    label: string;
    note?: string;
    /** The bottom line of the section — the row the couple actually argues over. */
    emphasis?: boolean;
    render: (wait: WaitScenario) => React.ReactNode;
  }[] = [
    { label: "Kaufpreis dann", render: (w) => formatEur(w.futurePrice) },
    { label: "Zinssatz dann", render: (w) => formatPct(w.adjustedInterestRate, 2) },
    { label: "Darlehen dann", render: (w) => formatEur(w.futureLoan) },
    {
      label: "Cash nach Kauf",
      note: "inkl. dem, was ihr bis dahin spart",
      render: (w) => (
        <span className={w.cashLeftAfterPurchase >= 0 ? "wait-ok" : "wait-bad"}>
          {formatEur(w.cashLeftAfterPurchase)}
        </span>
      ),
    },
    {
      label: `Restschuld in ${horizonYears} Jahren`,
      note: "am selben Stichtag für alle Spalten",
      render: (w) => formatEur(w.wealth.debt),
    },
    {
      label: `Freies Kapital in ${horizonYears} Jahren`,
      note: "angelegt zur ETF-Annahme, nach Steuer",
      render: (w) => formatEur(w.wealth.liquid - w.wealth.liquidTax),
    },
    {
      label: "Δ Vermögen zu jetzt kaufen",
      note: `Wohnung − Restschuld + freies Kapital, in ${horizonYears} Jahren`,
      emphasis: true,
      render: (w) =>
        w.waitMonths === 0 ? (
          <span className="muted">—</span>
        ) : (
          <SignedValue value={w.deltaWealth} betterWhen={BETTER_WHEN.wealth} />
        ),
    },
  ];

  const entered = scenarios.find((wait) => wait.waitMonths === waitMonths && waitMonths > 0);
  const clauses = tippingPoints.map(describePoint).filter((part): part is string => part !== null);

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
      {entered ? (
        <p className="wait-verdict">
          {waitMonths} Monate warten liegt bei euren Annahmen{" "}
          <strong>{formatEur(Math.abs(entered.deltaWealth))}</strong>{" "}
          {entered.deltaWealth >= 0 ? "vorn" : "hinten"}.{" "}
          {clauses.length > 0
            ? `Das dreht sich bei ${joinClauses(clauses)}, jeweils für sich genommen.`
            : "Das dreht sich bei keiner der drei Annahmen in einem realistischen Bereich."}
        </p>
      ) : null}
      <p className="wait-footnote">
        Gerechnet wird mit eurem Monatsbudget: Netto-Sparrate plus Warmmiete. Wartend
        zahlt ihr davon die Miete, nach dem Kauf Rate und Eigentumskosten; der Rest wird
        zur ETF-Annahme angelegt. Die Miete wird nicht zusätzlich vom Kapital abgezogen,
        weil die Netto-Sparrate schon nach der Miete gerechnet ist.
      </p>
    </Section>
  );
}
