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
export default function ExecutiveSummary({ decision, inputs, selected }: ExecutiveSummaryProps) {
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
          Tragbar heißt für euch: nach dem Kauf bleiben mindestens{" "}
          <strong>{formatEur(inputs.reserveTarget)}</strong> Reserve übrig <em>und</em> die
          Monatsrate bleibt unter <strong>{formatPct(inputs.maxBurdenRate)}</strong> vom
          Haushaltsnetto. Beides zusammen schafft hier keine Variante.
          {diagnosis.failedInAll.length > 0 ? <> Bei allen dreien gilt: {describeBlockers(diagnosis.failedInAll)}.</> : null}
        </p>
        {miss ? (
          <p className="verdict-miss">
            Am nächsten dran ist <strong>{miss.scenarioId.replace("ek", "")}% EK</strong> —{" "}
            {miss.constraint === "burden"
              ? `die Rate liegt ${formatPct(Math.abs(miss.gap) * 100)} über eurer Grenze.`
              : `es fehlen ${formatEur(Math.abs(miss.gap))}.`}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="verdict verdict-ok">
      <h2>
        {decision.recommendation?.label} ist tragbar
        <InfoTip text={GLOSSARY.cleanScenario} term="Tragbar" />
      </h2>
      <p>
        Tragbar heißt: nach dem Kauf bleiben mindestens{" "}
        <strong>{formatEur(inputs.reserveTarget)}</strong> Reserve übrig und die Monatsrate bleibt
        unter <strong>{formatPct(inputs.maxBurdenRate)}</strong> vom Haushaltsnetto. Gewählt ist{" "}
        <strong>{selected.label}</strong> mit {formatPct(selected.burdenRatio * 100)} Belastung.
      </p>
    </div>
  );
}
