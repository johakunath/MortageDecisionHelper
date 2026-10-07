import type {
  ConstraintId,
  DecisionResult,
  MortgageInputs,
  ScenarioResult,
} from "../lib/calculations";
import { GLOSSARY } from "../lib/glossary";
import { formatEur, formatPct } from "../lib/format";
import { InfoTip } from "./ui";

type ExecutiveSummaryProps = {
  scenarios: ScenarioResult[];
  decision: DecisionResult;
  inputs: MortgageInputs;
  selected: ScenarioResult;
};

const CONSTRAINT_LABELS: Record<ConstraintId, string> = {
  payment: "die Monatsrate tilgt das Darlehen nicht ab",
  cash: "das Geld reicht nicht für den Kauf",
  reserve: "die Sicherheitsreserve wird unterschritten",
  burden: "die Monatsbelastung ist zu hoch",
};

/**
 * `gap` carries a different unit per constraint — a ratio for `burden`, €/Monat for
 * `payment`, € for `cash` and `reserve` — so the unit is chosen here rather than
 * assumed. Printing the payment gap as a plain "es fehlen X €" read as a one-off
 * shortfall when it is a monthly one.
 */
function describeMiss(constraint: ConstraintId, gap: number): string {
  const missing = Math.abs(gap);
  if (constraint === "burden") {
    return `die Rate liegt ${formatPct(missing * 100)} über eurer Grenze.`;
  }
  if (constraint === "payment") {
    // Covers both failures: a rate below the interest, and one that pays the loan off
    // but not within a lifetime. "um überhaupt zu tilgen" was false for the second.
    return `der Monatsrate fehlen ${formatEur(missing)} pro Monat, um das Darlehen in einem Leben abzuzahlen.`;
  }
  return `es fehlen ${formatEur(missing)}.`;
}

/** "10%", "10% und 15%", "10%, 15% und 20%". The levels, in the order given. */
function joinLevels(scenarios: ScenarioResult[]): string {
  const levels = scenarios.map((scenario) => `${scenario.ekRate}%`);
  if (levels.length <= 1) return levels.join("");
  return `${levels.slice(0, -1).join(", ")} und ${levels[levels.length - 1]}`;
}

function describeBlockers(failed: ConstraintId[]): string {
  const parts = failed.map((id) => CONSTRAINT_LABELS[id]);
  if (parts.length === 0) return "die Annahmen passen nicht zusammen";
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(", ")} und ${parts[parts.length - 1]}`;
}

/**
 * The verdict, and nothing else.
 *
 * The four winner tiles this used to render (Kosten-Minimum, Liquiditäts-Maximum,
 * niedrigste Monatslast, Kompromiss) were removed: three of them are structurally
 * fixed — the cost minimum is always the highest EK level, the liquidity maximum
 * always the lowest — so they restated the axis rather than informing the choice. The
 * doors below already carry the same selection. See docs/DECISIONS.md D6.
 */
export default function ExecutiveSummary({ scenarios, decision, inputs, selected }: ExecutiveSummaryProps) {
  const { diagnosis } = decision;

  // PRODUCT_SPEC §5.3: when nothing works, say so plainly and name the reason.
  // "Kein sauberes Szenario" was the spec's phrasing but meant nothing to the people
  // actually reading it — the headline now states the problem in their own words.
  if (decision.noSafeScenario) {
    const miss = diagnosis.narrowestMiss;

    return (
      <div className="verdict verdict-blocked">
        <h2>
          Keine der drei Varianten ist tragbar
          <InfoTip text={GLOSSARY.cleanScenario} term="Tragbar" />
        </h2>
        <p>
          Tragbar heißt für euch: die Rate zahlt das Darlehen ab, nach dem Kauf bleiben
          mindestens <strong>{formatEur(inputs.reserveTarget)}</strong> Reserve übrig{" "}
          <em>und</em> die Monatsrate bleibt unter{" "}
          <strong>{formatPct(inputs.maxBurdenRate)}</strong> vom Haushaltsnetto. Alles zusammen
          schafft hier keine Variante.
          {diagnosis.failedInAll.length > 0 ? <> Bei allen dreien gilt: {describeBlockers(diagnosis.failedInAll)}.</> : null}
        </p>
        {miss ? (
          <p className="verdict-miss">
            Am nächsten dran ist <strong>{miss.scenarioId.replace("ek", "")}% EK</strong> —{" "}
            {describeMiss(miss.constraint, miss.gap)}
          </p>
        ) : null}
      </div>
    );
  }

  // Every tragbar level, never one picked by rule. The headline used to name a single
  // "recommendation" that preferred 10% EK, a rule from the 5/10/15 grid that since D15
  // names the lowest level: one spouse's side of the argument, chosen by code (D28).
  const feasible = decision.feasibleScenarios;
  const blocked = scenarios.filter((scenario) => !scenario.feasible);
  const headline =
    blocked.length === 0
      ? "Alle drei Varianten sind tragbar"
      : `${joinLevels(feasible)} EK ${feasible.length === 1 ? "ist" : "sind"} tragbar`;

  return (
    <div className="verdict verdict-ok">
      <h2>
        {headline}
        <InfoTip text={GLOSSARY.cleanScenario} term="Tragbar" />
      </h2>
      <p>
        Tragbar heißt: die Rate zahlt das Darlehen ab, nach dem Kauf bleiben mindestens{" "}
        <strong>{formatEur(inputs.reserveTarget)}</strong> Reserve übrig und die Monatsrate bleibt
        unter <strong>{formatPct(inputs.maxBurdenRate)}</strong> vom Haushaltsnetto.
        {blocked.length > 0 ? (
          <>
            {" "}Nicht tragbar:{" "}
            {blocked.map((scenario, index) => (
              <span key={scenario.id}>
                {index > 0 ? ", " : null}
                {scenario.label} ({scenario.status})
              </span>
            ))}
            .
          </>
        ) : null}{" "}
        Gewählt ist <strong>{selected.label}</strong> mit {formatPct(selected.burdenRatio * 100)}{" "}
        Belastung.
      </p>
    </div>
  );
}
