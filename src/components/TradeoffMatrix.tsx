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
function interpret(cashDelta: number, interestDelta: number, runtimeDelta: number): string {
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
  const runtimePart =
    Math.abs(runtimeDelta) < 0.1
      ? ""
      : runtimeDelta < 0
        ? `, ${Math.abs(runtimeDelta).toFixed(1)} Jahre früher schuldenfrei`
        : `, ${runtimeDelta.toFixed(1)} Jahre länger`;

  return `${interestPart}, ${cashPart}${runtimePart}.`;
}

/**
 * Rows are derived from the scenario list, not hardcoded: the middle EK level against
 * each end, plus the two ends against each other. Changing the EK set is a change in
 * `defaults.ts` and nowhere else.
 *
 * There is no "Monat" column any more. The monthly rate is held constant across EK
 * levels (docs/DECISIONS.md D14), so that column read zero everywhere; the runtime is
 * what more Eigenkapital actually moves.
 */
export default function TradeoffMatrix({ scenarios }: TradeoffMatrixProps) {
  const low = scenarios[0];
  const mid = scenarios[Math.floor(scenarios.length / 2)];
  const high = scenarios[scenarios.length - 1];

  const rows = [
    { from: mid, to: low },
    { from: mid, to: high },
    { from: low, to: high },
  ].map(({ from, to }) => {
    const cash = to.cashLeft - from.cashLeft;
    const interest = to.mortgage.interestTotal - from.mortgage.interestTotal;
    const runtime = to.mortgage.runtimeYears - from.mortgage.runtimeYears;
    const remainingDebt = to.mortgage.remainingAfterFixed - from.mortgage.remainingAfterFixed;

    return {
      label: `${to.ekRate}% statt ${from.ekRate}% EK`,
      cash,
      interest,
      runtime,
      remainingDebt,
      meaning: interpret(cash, interest, runtime),
    };
  });

  return (
    <div className="table-wrap">
      <table className="tradeoff-table is-dense">
        <thead>
          <tr>
            <th>Vergleich</th>
            <th>Cash</th>
            <th>Zinsen gesamt</th>
            <th>Laufzeit</th>
            <th>Restschuld n. Bindung</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <td>
                <strong>{row.label}</strong>
                <small>{row.meaning}</small>
              </td>
              <td>
                <SignedValue value={row.cash} betterWhen={BETTER_WHEN.cashLeft} />
              </td>
              <td>
                <SignedValue value={row.interest} betterWhen={BETTER_WHEN.interestTotal} />
              </td>
              <td>
                <SignedValue
                  value={row.runtime}
                  betterWhen="lower"
                  epsilon={0.05}
                  format={(value) =>
                    `${value > 0 ? "+" : value < 0 ? "−" : ""}${Math.abs(value).toFixed(1)} J.`
                  }
                />
              </td>
              <td>
                <SignedValue
                  value={row.remainingDebt}
                  betterWhen={BETTER_WHEN.remainingAfterFixed}
                  format={formatSignedEur}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
