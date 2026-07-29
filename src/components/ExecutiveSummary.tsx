import type {
  ConstraintId,
  DecisionResult,
  MortgageInputs,
  ScenarioResult,
} from "../lib/calculations";
import { formatEur, formatPct } from "../lib/format";

type ExecutiveSummaryProps = {
  decision: DecisionResult;
  inputs: MortgageInputs;
  selected: ScenarioResult;
};

const CONSTRAINT_LABELS: Record<ConstraintId, string> = {
  cash: "das Geld reicht nicht für den Kauf",
  reserve: "die Sicherheitsreserve wird unterschritten",
  burden: "die Monatsbelastung ist zu hoch",
};

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
 * fixed — the cost minimum is always 15% EK, the liquidity maximum always 5% — so
 * they restated the axis rather than informing the choice. The doors below already
 * carry the same selection. See docs/DECISIONS.md D6.
 */
export default function ExecutiveSummary({ decision, inputs, selected }: ExecutiveSummaryProps) {
  const { diagnosis } = decision;

  // PRODUCT_SPEC §5.3: when nothing is clean, say so plainly and name the reason.
  if (decision.noSafeScenario) {
    const miss = diagnosis.narrowestMiss;

    return (
      <div className="verdict verdict-blocked">
        <h2>Kein sauberes Szenario</h2>
        <p>
          Kein Weg hält gleichzeitig die Reserve von{" "}
          <strong>{formatEur(inputs.reserveTarget)}</strong> und die Grenze von{" "}
          <strong>{formatPct(inputs.maxBurdenRate)}</strong> Haushaltsbelastung.
          {diagnosis.failedInAll.length > 0 ? <> Überall gilt: {describeBlockers(diagnosis.failedInAll)}.</> : null}
          {miss ? (
            <>
              {" "}Am nächsten dran: <strong>{miss.scenarioId.replace("ek", "")}% EK</strong>
              {miss.constraint === "burden"
                ? `, ${formatPct(Math.abs(miss.gap) * 100)} über der Grenze.`
                : `, ${formatEur(Math.abs(miss.gap))} zu wenig.`}
            </>
          ) : null}
        </p>
      </div>
    );
  }

  return (
    <div className="verdict verdict-ok">
      <h2>{decision.recommendation?.label} als Kompromiss</h2>
      <p>
        Sauber heißt: mindestens <strong>{formatEur(inputs.reserveTarget)}</strong> Reserve nach dem
        Kauf und höchstens <strong>{formatPct(inputs.maxBurdenRate)}</strong> Haushaltsbelastung.
        Gewählt ist <strong>{selected.label}</strong> mit{" "}
        {formatPct(selected.burdenRatio * 100)} Belastung.
      </p>
    </div>
  );
}
