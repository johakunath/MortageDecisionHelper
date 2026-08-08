import type { ScenarioId, ScenarioResult } from "../lib/calculations";

type EkSwitchProps = {
  scenarios: ScenarioResult[];
  selectedId: ScenarioId;
  onSelect: (id: ScenarioId) => void;
};

/**
 * The EK choice, permanently reachable from the sticky header.
 *
 * It is the same selection the doors in §1 make — deliberately, and this is the one
 * case where a second control for one value is not the accretion D6 warns about: the
 * page is six sections long, the question "and at 20%?" comes up while reading section
 * 5, and scrolling back to §1 to answer it loses the place both readers are holding.
 * See docs/DECISIONS.md D25.
 *
 * What it must NOT become is a second *view* of the comparison. It carries the rate and
 * nothing else — no status, no interest, no cash. The doors keep those, where there is
 * room to say them in words rather than in colour.
 *
 * Fixed height by construction: three fixed-height buttons on one row, nothing
 * collapsible, nothing that grows with its content. `--header-height` stays a constant
 * and everything sticky below it keeps clearing it (D8).
 */
export default function EkSwitch({ scenarios, selectedId, onSelect }: EkSwitchProps) {
  return (
    <div className="ek-switch" role="group" aria-label="Eigenkapital wählen">
      <span className="ek-switch-label">Eigenkapital</span>
      {scenarios.map((scenario) => (
        <button
          key={scenario.id}
          type="button"
          className={`ek-switch-button ${scenario.id === selectedId ? "is-active" : ""}`}
          aria-pressed={scenario.id === selectedId}
          // The status stays out of the visible chip but not out of the accessible
          // name — a screen-reader user should not have to scroll to §1 to hear it.
          aria-label={`${scenario.ekRate}% Eigenkapital — ${scenario.status}`}
          onClick={() => onSelect(scenario.id)}
        >
          {scenario.ekRate}
          <span>%</span>
        </button>
      ))}
    </div>
  );
}
