import { BETTER_WHEN, type DecisionResult, type ScenarioResult } from "../lib/calculations";
import { formatEur, formatPct } from "../lib/format";
import { SignedValue, StatusPill } from "./ui";

type CompromiseFinderProps = {
  scenarios: ScenarioResult[];
  selected: ScenarioResult;
  decision: DecisionResult;
  onSelectScenario: (id: ScenarioResult["id"]) => void;
};

function ScenarioDoor({
  scenario,
  selected,
  label,
  verdict,
  onSelect,
}: {
  scenario: ScenarioResult;
  selected: boolean;
  label: string;
  verdict: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className={`compromise-door door-${scenario.id} ${selected ? "is-selected" : ""}`}
      onClick={onSelect}
      aria-pressed={selected}
    >
      <div className="door-rate">
        {scenario.ekRate}
        <span>%</span>
      </div>
      <div className="door-name">{label}</div>
      <div className="door-verdict">{verdict}</div>
      <div className="door-status">
        <StatusPill tone={scenario.statusTone}>{scenario.status}</StatusPill>
      </div>
      <div className="door-meta">
        <span>{formatEur(scenario.mortgage.regularMonthlyPayment)} mtl.</span>
        <i />
        <span className="door-meta-cash">
          <SignedValue
            value={scenario.cashLeft}
            betterWhen={BETTER_WHEN.cashLeft}
            verdictLabels={{ better: "übrig", worse: "Reserve verletzt" }}
          />
        </span>
      </div>
    </button>
  );
}

export default function CompromiseFinder({
  scenarios,
  selected,
  decision,
  onSelectScenario,
}: CompromiseFinderProps) {
  const liquidity = scenarios.find((scenario) => scenario.id === "ek5") ?? scenarios[0];
  const compromise = decision.recommendation ?? scenarios.find((scenario) => scenario.id === "ek10") ?? selected;
  const interest = scenarios.find((scenario) => scenario.id === "ek15") ?? scenarios[2];

  return (
    <section className="compromise-finder">
      <div className="compromise-copy">
        <div className="section-kicker">Drei Wege</div>
        <p>Tippe einen an. Die Geschichte unten passt sich an.</p>
      </div>

      <div className="compromise-grid">
        <ScenarioDoor
          scenario={liquidity}
          selected={selected.id === liquidity.id}
          label="Reserve halten"
          verdict="sicherer, aber teurer"
          onSelect={() => onSelectScenario(liquidity.id)}
        />

        <ScenarioDoor
          scenario={compromise}
          selected={selected.id === compromise.id}
          label={decision.noSafeScenario ? "Warnung" : "Mittelweg"}
          verdict={decision.noSafeScenario ? "erst Annahmen prüfen" : `Belastung ${formatPct(compromise.burdenRatio * 100)}`}
          onSelect={() => onSelectScenario(compromise.id)}
        />

        <ScenarioDoor
          scenario={interest}
          selected={selected.id === interest.id}
          label="Zinsen senken"
          verdict="günstiger, aber knapper"
          onSelect={() => onSelectScenario(interest.id)}
        />
      </div>
    </section>
  );
}
