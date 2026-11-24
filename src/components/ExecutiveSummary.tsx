import type {
  ConstraintId,
  DecisionResult,
  MortgageInputs,
  ScenarioResult,
} from "../lib/calculations";
import { GLOSSARY } from "../lib/glossary";
import { formatCalendarYear, formatEur, formatPct } from "../lib/format";
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
  runtime: "das Darlehen ist bis zu eurer Grenze nicht abbezahlt",
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

/**
 * What a tragbar scenario still asks the couple to accept (D44): a reserve below their
 * target, or a contract that runs past the retirement deadline. Shown in the verdict,
 * so a warning is never hidden behind a green headline. The calendar year assumes
 * signing today, as the comparison section does.
 */
function describeWarnings(scenario: ScenarioResult, inputs: MortgageInputs, startYear: number): string[] {
  const notes: string[] = [];
  if (scenario.diagnosis.warnings.includes("reserve")) {
    notes.push(
      `nur ${formatEur(Math.max(0, scenario.cashLeft))} Reserve statt ${formatEur(inputs.reserveTarget)}`,
    );
  }
  if (scenario.diagnosis.warnings.includes("runtime")) {
    // When the KfW part sets the end date, Sondertilgung cannot move it: KfW 300 takes
    // none, and saying "mit Sondertilgung" the same year would read as a contradiction.
    const kfwBound =
      scenario.kfwPart > 0 &&
      Math.abs(scenario.debtFreeYearsFromSigning - scenario.contractYearsFromSigning) < 0.1;
    const withPlan = !Number.isFinite(scenario.debtFreeYearsFromSigning)
      ? ""
      : kfwBound
        ? "; das Ende setzt das KfW-Darlehen mit seiner Laufzeit, Sondertilgung ist dort nicht möglich"
        : `, mit eurer Sondertilgung ≈ ${formatCalendarYear(startYear + scenario.debtFreeYearsFromSigning)}`;
    notes.push(
      `ohne Sondertilgung erst ≈ ${formatCalendarYear(startYear + scenario.contractYearsFromSigning)} schuldenfrei, eure Grenze ist ≈ ${formatCalendarYear(startYear + inputs.maxRuntimeYears)}${withPlan}`,
    );
  }
  return notes;
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
          <span aria-hidden="true">✕ </span>Keine der drei Varianten ist tragbar
          <InfoTip text={GLOSSARY.cleanScenario} term="Tragbar" />
        </h2>
        <p>
          Tragbar heißt für euch: die Rate zahlt das Darlehen ab, euer Geld reicht für den
          Kauf <em>und</em> die Monatsrate bleibt unter{" "}
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
  const now = new Date();
  const startYear = now.getFullYear() + now.getMonth() / 12;
  const warned = feasible
    .map((scenario) => ({ scenario, notes: describeWarnings(scenario, inputs, startYear) }))
    .filter((entry) => entry.notes.length > 0);
  const headline =
    blocked.length === 0
      ? "Alle drei Varianten sind tragbar"
      : `${joinLevels(feasible)} EK ${feasible.length === 1 ? "ist" : "sind"} tragbar`;

  return (
    <div className="verdict verdict-ok">
      <h2>
        <span aria-hidden="true">✓ </span>
        {headline}
      </h2>
      {blocked.length > 0 ? (
        <p>
          Nicht tragbar:{" "}
          {blocked.map((scenario, index) => (
            <span key={scenario.id}>
              {index > 0 ? ", " : null}
              {scenario.label} ({scenario.status})
            </span>
          ))}
          .
        </p>
      ) : null}
      {warned.length > 0 ? (
        <ul className="verdict-warnings">
          {warned.map(({ scenario, notes }) => (
            <li key={scenario.id}>
              <span aria-hidden="true">! </span>
              <strong>{scenario.label}:</strong> {notes.join("; ")}.
            </li>
          ))}
        </ul>
      ) : null}
      {/* The definition is one click away rather than on screen: it is the same every
          time, and it pushed the doors below the fold (D37). */}
      <details className="verdict-details">
        <summary>Was heißt tragbar?</summary>
        <p>
          Die Rate zahlt das Darlehen ab, euer Geld reicht für den Kauf und die Monatsrate
          bleibt unter <strong>{formatPct(inputs.maxBurdenRate)}</strong> vom Haushaltsnetto.
          Weniger als <strong>{formatEur(inputs.reserveTarget)}</strong> Reserve oder eine
          Laufzeit über eure Grenze zeigt die App als Hinweis, nicht als Ausschluss: das
          entscheidet ihr, und manche Banken rechnen eure Sondertilgung mit.
          Gewählt ist <strong>{selected.label}</strong> mit {formatPct(selected.burdenRatio * 100)}{" "}
          Belastung.
        </p>
      </details>
    </div>
  );
}
