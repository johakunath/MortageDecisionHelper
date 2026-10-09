import {
  BETTER_WHEN,
  ekStepReturn,
  type MortgageInputs,
  type ScenarioResult,
} from "../lib/calculations";
import { formatEur, formatPct, formatSignedEur, formatSignedYears, formatYears } from "../lib/format";
import { SignedValue } from "./ui";

type TradeoffMatrixProps = {
  scenarios: ScenarioResult[];
  /** Zinsbindung for the reliable column; ETF return and tax for the Rendite column. */
  inputs: MortgageInputs;
};

/**
 * Plain-language interpretation, derived from the actual signs rather than a fixed
 * string per row — so it stays correct if the underlying inputs change and a
 * comparison flips direction, which three hardcoded sentences could not do.
 */
function interpret(
  cashDelta: number,
  interestDelta: number,
  runtimeDelta: number,
  fixedRateYears: number,
): string {
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
      ? `${formatEur(Math.abs(interestDelta))} weniger Zinsen in ${fixedRateYears} Jahren`
      : interestDelta > 0
        ? `${formatEur(interestDelta)} mehr Zinsen in ${fixedRateYears} Jahren`
        : "gleich viele Zinsen";
  const runtimePart =
    Math.abs(runtimeDelta) < 0.1
      ? ""
      : runtimeDelta < 0
        ? `, ${formatYears(Math.abs(runtimeDelta))} früher schuldenfrei`
        : `, ${formatYears(runtimeDelta)} länger`;

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
export default function TradeoffMatrix({ scenarios, inputs }: TradeoffMatrixProps) {
  const { fixedRateYears } = inputs;
  const low = scenarios[0];
  const mid = scenarios[Math.floor(scenarios.length / 2)];
  const high = scenarios[scenarios.length - 1];

  const rows = [
    { from: mid, to: low },
    { from: mid, to: high },
    { from: low, to: high },
  ].map(({ from, to }) => {
    const cash = to.cashLeft - from.cashLeft;
    // Interest inside the binding, not over the full term: the full-term total assumes
    // today's rate for 20+ years and read 65.867 € where the reliable figure is 25.021 €
    // (10 vs 20% on the offer). ASSUMPTIONS §1: never give the two the same weight.
    const interest = to.mortgage.interestFixed - from.mortgage.interestFixed;
    const runtime = to.mortgage.runtimeYears - from.mortgage.runtimeYears;
    const remainingDebt = to.mortgage.remainingAfterFixed - from.mortgage.remainingAfterFixed;
    // The return of the step itself, read from the lower to the higher EK level
    // whichever way round the row is phrased (D32).
    const [lower, higher] = from.ekRate < to.ekRate ? [from, to] : [to, from];
    const step = ekStepReturn(lower, higher, inputs);

    return {
      label: `${to.ekRate}% statt ${from.ekRate}% EK`,
      cash,
      interest,
      runtime,
      remainingDebt,
      step,
      meaning: interpret(cash, interest, runtime, fixedRateYears),
    };
  });

  return (
    <div className="table-wrap">
      <table className="tradeoff-table is-dense">
        <thead>
          <tr>
            <th>Vergleich</th>
            <th>Cash</th>
            <th>Zinsen in {fixedRateYears} J.</th>
            <th>Laufzeit</th>
            <th>Restschuld n. Bindung</th>
            <th>Rendite der Mehr-EK</th>
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
                <SignedValue value={row.interest} betterWhen={BETTER_WHEN.interestFixed} />
              </td>
              <td>
                <SignedValue
                  value={row.runtime}
                  betterWhen="lower"
                  epsilon={0.05}
                  format={formatSignedYears}
                />
              </td>
              <td>
                <SignedValue
                  value={row.remainingDebt}
                  betterWhen={BETTER_WHEN.remainingAfterFixed}
                  format={formatSignedEur}
                />
              </td>
              <td>
                {row.step.annualReturn == null ? (
                  <span className="muted">—</span>
                ) : (
                  <>
                    <strong>{formatPct(row.step.annualReturn)} p.a.</strong>
                    <small>
                      {row.step.breakEvenEtfReturn == null
                        ? "steuerfrei"
                        : `ETF lohnt ab ${formatPct(row.step.breakEvenEtfReturn)} vor Steuer`}
                    </small>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
