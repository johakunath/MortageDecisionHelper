import type { DecisionResult, MortgageInputs, ScenarioResult } from "../lib/calculations";
import { formatEur, formatPct } from "../lib/format";
import { Readout } from "./ui";

type ExecutiveSummaryProps = {
  decision: DecisionResult;
  inputs: MortgageInputs;
  selected: ScenarioResult;
  onSelectScenario: (id: ScenarioResult["id"]) => void;
};

export default function ExecutiveSummary({
  decision,
  inputs,
  selected,
  onSelectScenario,
}: ExecutiveSummaryProps) {
  return (
    <div className="summary-grid">
      <button type="button" onClick={() => onSelectScenario(decision.costMinimum.id)}>
        <Readout
          label="Kosten-Minimum"
          value={decision.costMinimum.label}
          sub={`${formatEur(decision.costMinimum.mortgage.interestTotal)} Zinsen gesamt`}
          tone="green"
        />
      </button>
      <button type="button" onClick={() => onSelectScenario(decision.liquidityMaximum.id)}>
        <Readout
          label="Liquiditäts-Maximum"
          value={decision.liquidityMaximum.label}
          sub={`${formatEur(decision.liquidityMaximum.cashLeft)} Cash nach Kauf`}
          tone="blue"
        />
      </button>
      <button
        type="button"
        onClick={() => decision.recommendation && onSelectScenario(decision.recommendation.id)}
      >
        <Readout
          label="Kompromiss"
          value={decision.noSafeScenario ? "Kein sauberes Szenario" : decision.recommendation?.label}
          sub={
            decision.noSafeScenario
              ? "Reserve oder Monatslast verletzt"
              : `${formatEur(decision.recommendation?.allInMonthly ?? 0)} all-in mtl.`
          }
          tone={decision.noSafeScenario ? "red" : "amber"}
        />
      </button>
      <Readout
        label="Aktuelle Auswahl"
        value={selected.label}
        sub={`${formatPct(selected.burdenRatio * 100)} Haushaltsbelastung · Ziel max. 40%`}
        tone={selected.feasible ? "slate" : selected.reserveGap < 0 ? "red" : "amber"}
      />
      <div className="decision-note">
        <strong>Regel:</strong> Sauber ist ein Szenario nur, wenn nach dem Kauf mindestens{" "}
        {formatEur(inputs.reserveTarget)} Reserve bleibt und die Monatsbelastung höchstens 40% vom
        Haushaltsnetto beträgt.
      </div>
    </div>
  );
}
