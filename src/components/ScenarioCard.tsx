import type { ScenarioResult } from "../lib/calculations";
import { formatEur, formatPct } from "../lib/format";
import { MiniMetric, StatusPill } from "./ui";

type ScenarioCardProps = {
  scenario: ScenarioResult;
  selected: boolean;
  onSelect: () => void;
};

export default function ScenarioCard({ scenario, selected, onSelect }: ScenarioCardProps) {
  return (
    <button
      type="button"
      className={`scenario-card scenario-${scenario.id} ${selected ? "is-selected" : ""}`}
      onClick={onSelect}
      aria-pressed={selected}
    >
      <div className="scenario-card-header">
        <div>
          <span>{scenario.short}</span>
          <h3>{scenario.label}</h3>
        </div>
        <StatusPill tone={scenario.statusTone}>{scenario.status}</StatusPill>
      </div>

      <div className="scenario-grid">
        <MiniMetric label="Cash nötig" value={formatEur(scenario.cashNeeded)} />
        <MiniMetric
          label="Cash übrig"
          value={formatEur(scenario.cashLeft)}
          positive={scenario.cashLeft >= 0}
          negative={scenario.cashLeft < 0}
        />
        <MiniMetric label="All-in monatlich" value={formatEur(scenario.allInMonthly)} />
        <MiniMetric label="Immobilienwert" value={formatEur(scenario.propertyValueAtPayoff)} />
      </div>

      <p>
        {formatEur(scenario.downPayment)} Eigenkapital, {formatEur(scenario.loan)} Darlehen,
        {" "}
        {formatPct(scenario.interestRate)} Zins und {formatEur(scenario.mortgage.regularMonthlyPayment)} Rate.
      </p>
    </button>
  );
}
