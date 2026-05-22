import type { ScenarioResult } from "../lib/calculations";
import { formatEur } from "../lib/format";

type TradeoffMatrixProps = {
  scenarios: ScenarioResult[];
};

export default function TradeoffMatrix({ scenarios }: TradeoffMatrixProps) {
  const s5 = scenarios.find((scenario) => scenario.id === "ek5") ?? scenarios[0];
  const s10 = scenarios.find((scenario) => scenario.id === "ek10") ?? scenarios[1];
  const s15 = scenarios.find((scenario) => scenario.id === "ek15") ?? scenarios[2];
  const rows = [
    {
      label: "5% statt 10% EK",
      cash: s5.cashLeft - s10.cashLeft,
      interest: s5.mortgage.interestTotal - s10.mortgage.interestTotal,
      monthly: s5.allInMonthly - s10.allInMonthly,
      netWorth: s5.netWorthAtPayoff - s10.netWorthAtPayoff,
      meaning: "Mehr Liquidität, aber teurer.",
    },
    {
      label: "15% statt 10% EK",
      cash: s15.cashLeft - s10.cashLeft,
      interest: s15.mortgage.interestTotal - s10.mortgage.interestTotal,
      monthly: s15.allInMonthly - s10.allInMonthly,
      netWorth: s15.netWorthAtPayoff - s10.netWorthAtPayoff,
      meaning: "Weniger Zinsen, weniger Puffer.",
    },
    {
      label: "15% statt 5% EK",
      cash: s15.cashLeft - s5.cashLeft,
      interest: s15.mortgage.interestTotal - s5.mortgage.interestTotal,
      monthly: s15.allInMonthly - s5.allInMonthly,
      netWorth: s15.netWorthAtPayoff - s5.netWorthAtPayoff,
      meaning: "Maximaler Zinsvorteil gegen maximale Liquiditätsbindung.",
    },
  ];

  return (
    <div className="table-wrap">
      <table className="tradeoff-table">
        <thead>
          <tr>
            <th>Vergleich</th>
            <th>Cash</th>
            <th>Zinsen</th>
            <th>Monat</th>
            <th>Nettovermögen</th>
            <th>Interpretation</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <td>{row.label}</td>
              <td className={row.cash >= 0 ? "positive" : "negative"}>{formatEur(row.cash)}</td>
              <td className={row.interest <= 0 ? "positive" : "negative"}>
                {formatEur(row.interest)}
              </td>
              <td className={row.monthly <= 0 ? "positive" : "negative"}>
                {formatEur(row.monthly)}
              </td>
              <td className={row.netWorth >= 0 ? "positive" : "negative"}>
                {formatEur(row.netWorth)}
              </td>
              <td>{row.meaning}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
