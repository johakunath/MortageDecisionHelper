import { useEffect, useRef, useState } from "react";
import type { DecisionResult, MortgageInputs, ScenarioResult } from "../lib/calculations";
import { GLOSSARY } from "../lib/glossary";
import { formatEur, formatPct, formatSignedEur } from "../lib/format";
import { Readout, StatusPill } from "./ui";

type RightPanelProps = {
  selected: ScenarioResult;
  inputs: MortgageInputs;
  decision: DecisionResult;
};

type MetricSnapshot = { allInMonthly: number; cashLeft: number; interestFixed: number };

function snapshot(selected: ScenarioResult): MetricSnapshot {
  return {
    allInMonthly: selected.allInMonthly,
    cashLeft: selected.cashLeft,
    interestFixed: selected.mortgage.interestFixed,
  };
}

/**
 * Delta only when the assumptions changed for the SAME scenario — not when the user
 * picked a different EK%. Switching scenarios is a comparison the trade-off matrix
 * owns; mixing the two here would make the panel lie about what moved and why.
 */
function useMetricDelta(selected: ScenarioResult, inputs: MortgageInputs): MetricSnapshot | null {
  const prevRef = useRef<{ signature: string; selectedId: string; metrics: MetricSnapshot } | null>(null);
  const [delta, setDelta] = useState<MetricSnapshot | null>(null);
  const signature = JSON.stringify(inputs);

  useEffect(() => {
    const prev = prevRef.current;
    const current = snapshot(selected);

    if (prev && prev.selectedId === selected.id && prev.signature !== signature) {
      setDelta({
        allInMonthly: current.allInMonthly - prev.metrics.allInMonthly,
        cashLeft: current.cashLeft - prev.metrics.cashLeft,
        interestFixed: current.interestFixed - prev.metrics.interestFixed,
      });
    } else {
      setDelta(null);
    }

    prevRef.current = { signature, selectedId: selected.id, metrics: current };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, selected.id]);

  return delta;
}

/**
 * Four numbers, sized to fit the viewport without an internal scrollbar — "always
 * visible" only means anything if nothing is hidden below a fold. The break-even
 * block that used to live here was removed: it duplicated the Sondertilgung section.
 * See docs/DECISIONS.md D6.
 */
export default function RightPanel({ selected, inputs, decision }: RightPanelProps) {
  const delta = useMetricDelta(selected, inputs);
  const since = (value: number) => `${formatSignedEur(value)} seit letzter Änderung`;

  return (
    <aside className="right-panel">
      <div className="result-panel" aria-live="polite">
        <div className="result-panel-head">
          <div>
            <div className="eyebrow">Deine Zahlen</div>
            <h2>{selected.label}</h2>
          </div>
          <StatusPill tone={selected.statusTone}>{selected.status}</StatusPill>
        </div>

        <div className="result-list">
          <Readout
            label="All-in monatlich"
            value={formatEur(selected.allInMonthly)}
            sub={delta ? since(delta.allInMonthly) : `${formatPct(selected.burdenRatio * 100)} vom Haushaltsnetto`}
            info={GLOSSARY.allInMonthly}
          />
          <Readout
            label="Cash nach Kauf"
            value={formatEur(selected.cashLeft)}
            sub={delta ? since(delta.cashLeft) : `Reserve-Gap: ${formatEur(selected.reserveGap)}`}
            tone={selected.reserveGap < 0 ? "red" : "green"}
            info={GLOSSARY.cashLeft}
          />
          <Readout
            label={`Zinsen in ${inputs.fixedRateYears} Jahren`}
            value={formatEur(selected.mortgage.interestFixed)}
            sub={delta ? since(delta.interestFixed) : "Verlässlich — innerhalb der Zinsbindung"}
            tone="amber"
            info={GLOSSARY.interestFixed}
          />
          <Readout
            label="Restschuld danach"
            value={formatEur(selected.mortgage.remainingAfterFixed)}
            sub={`Darlehen: ${formatEur(selected.loan)}`}
            info={GLOSSARY.remainingAfterFixed}
          />
        </div>
      </div>

      {decision.noSafeScenario ? (
        <div className="logic-panel logic-danger">
          <p>Keine Variante ist tragbar — nicht als sichere Option behandeln.</p>
        </div>
      ) : null}
    </aside>
  );
}
