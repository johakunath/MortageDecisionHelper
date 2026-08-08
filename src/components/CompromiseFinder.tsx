import { BETTER_WHEN, type DecisionResult, type ScenarioResult } from "../lib/calculations";
import { formatYears } from "../lib/format";
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
        {/*
          Not the monthly rate: it is identical on all three doors by construction
          (D14). What differs is how fast that same rate pays the loan off.
        */}
        <span>{formatYears(scenario.mortgage.runtimeYears)} schuldenfrei</span>
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
  // Derived from the list, not from hardcoded ids: least Eigenkapital protects the
  // most liquidity, most Eigenkapital buys the lowest interest, the middle is the
  // compromise. Changing the EK set is a change in defaults.ts and nowhere else.
  //
  // The middle door is strictly the middle SCENARIO, never `decision.recommendation`:
  // the recommendation prefers 10% EK, which is now also the lowest level, so binding
  // it here rendered the same door twice and hid one EK level entirely.
  const liquidity = scenarios[0];
  const compromise = scenarios[Math.floor(scenarios.length / 2)];
  const interest = scenarios[scenarios.length - 1];

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
          verdict="mehr Cash, aber teurer"
          onSelect={() => onSelectScenario(liquidity.id)}
        />

        <ScenarioDoor
          scenario={compromise}
          selected={selected.id === compromise.id}
          label={decision.noSafeScenario ? "Warnung" : "Mittelweg"}
          verdict={decision.noSafeScenario ? "erst Annahmen prüfen" : "zwischen beidem"}
          onSelect={() => onSelectScenario(compromise.id)}
        />

        <ScenarioDoor
          scenario={interest}
          selected={selected.id === interest.id}
          label="Zinsen senken"
          verdict="früher schuldenfrei, knapper"
          onSelect={() => onSelectScenario(interest.id)}
        />
      </div>
    </section>
  );
}
