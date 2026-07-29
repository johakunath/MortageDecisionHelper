import { BETTER_WHEN, type ScenarioResult } from "../lib/calculations";
import { formatEur, formatSignedEur } from "../lib/format";
import { SignedValue } from "./ui";

type TradeoffMatrixProps = {
  scenarios: ScenarioResult[];
};

/**
 * Plain-language interpretation, derived from the actual signs rather than a fixed
 * string per row — so it stays correct if the underlying inputs change and a
 * comparison flips direction, which three hardcoded sentences could not do.
 */
function interpret(cashDelta: number, interestDelta: number): string {
  if (Math.abs(cashDelta) < 1 && Math.abs(interestDelta) < 1) {
    return "Praktisch kein Unterschied.";
  }

  const cashPart =
    cashDelta > 0
      ? `${formatEur(cashDelta)} mehr Cash`
      : cashDelta < 0
        ? `${formatEur(Math.abs(cashDelta))} weniger Cash`
        : "gleich viel Cash";
  const interestPart =
    interestDelta < 0
      ? `${formatEur(Math.abs(interestDelta))} weniger Zinsen`
      : interestDelta > 0
        ? `${formatEur(interestDelta)} mehr Zinsen`
        : "gleich viele Zinsen";

  return `${interestPart}, ${cashPart}.`;
}

export default function TradeoffMatrix({ scenarios }: TradeoffMatrixProps) {
  const s5 = scenarios.find((scenario) => scenario.id === "ek5") ?? scenarios[0];
  const s10 = scenarios.find((scenario) => scenario.id === "ek10") ?? scenarios[1];
  const s15 = scenarios.find((scenario) => scenario.id === "ek15") ?? scenarios[2];

  const rows = [
    { label: "5% statt 10% EK", from: s10, to: s5 },
    { label: "15% statt 10% EK", from: s10, to: s15 },
    { label: "15% statt 5% EK", from: s5, to: s15 },
  ].map(({ label, from, to }) => {
    const cash = to.cashLeft - from.cashLeft;
    const interest = to.mortgage.interestTotal - from.mortgage.interestTotal;
    const monthly = to.allInMonthly - from.allInMonthly;
    const remainingDebt = to.mortgage.remainingAfterFixed - from.mortgage.remainingAfterFixed;

    return { label, cash, interest, monthly, remainingDebt, meaning: interpret(cash, interest) };
  });

  return (
    <div className="table-wrap">
      <table className="tradeoff-table">
        <thead>
          <tr>
            <th>Vergleich</th>
            <th>Cash</th>
            <th>Zinsen (gesamt, illustrativ)</th>
            <th>Monat</th>
            <th>Restschuld nach Zinsbindung</th>
            <th>Interpretation</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <td>{row.label}</td>
              <td>
                <SignedValue value={row.cash} betterWhen={BETTER_WHEN.cashLeft} />
              </td>
              <td>
                <SignedValue value={row.interest} betterWhen={BETTER_WHEN.interestTotal} />
              </td>
              <td>
                <SignedValue value={row.monthly} betterWhen={BETTER_WHEN.allInMonthly} />
              </td>
              <td>
                <SignedValue
                  value={row.remainingDebt}
                  betterWhen={BETTER_WHEN.remainingAfterFixed}
                  format={formatSignedEur}
                />
              </td>
              <td>{row.meaning}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
