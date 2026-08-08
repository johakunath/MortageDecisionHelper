import type { DecisionResult, MortgageInputs, ScenarioResult } from "../lib/calculations";
import { GLOSSARY } from "../lib/glossary";
import { formatEur, formatPct } from "../lib/format";
import { Readout, StatusPill } from "./ui";

type RightPanelProps = {
  selected: ScenarioResult;
  inputs: MortgageInputs;
  decision: DecisionResult;
};

/**
 * Five numbers, sized to fit the viewport without an internal scrollbar — "always
 * visible" only means anything if nothing is hidden below a fold. The count is a
 * consequence of that rule, not the rule itself (docs/DECISIONS.md D19).
 *
 * The "x seit letzter Änderung" line that used to replace these subtitles was removed:
 * it fired on apartment switches too, and it cost every readout its explanation to
 * report a delta nobody had asked for.
 */
export default function RightPanel({ selected, inputs, decision }: RightPanelProps) {
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
            label="Darlehen"
            value={formatEur(selected.loan)}
            sub={`${selected.ekRate}% EK + ${formatEur(selected.closingCosts)} Nebenkosten aus eigener Tasche`}
            info={GLOSSARY.loan}
          />
          <Readout
            label="All-in monatlich"
            value={formatEur(selected.allInMonthly)}
            sub={`${formatPct(selected.burdenRatio * 100)} vom Haushaltsnetto · ${formatPct(selected.repaymentRate, 2)} Tilgung`}
            info={GLOSSARY.allInMonthly}
          />
          <Readout
            label="Cash nach Kauf"
            value={formatEur(selected.cashLeft)}
            sub={`Reserve-Gap: ${formatEur(selected.reserveGap)}`}
            tone={selected.reserveGap < 0 ? "red" : "green"}
            info={GLOSSARY.cashLeft}
          />
          <Readout
            label={`Zinsen in ${inputs.fixedRateYears} Jahren`}
            value={formatEur(selected.mortgage.interestFixed)}
            sub="Verlässlich — innerhalb der Zinsbindung"
            tone="amber"
            info={GLOSSARY.interestFixed}
          />
          <Readout
            label="Restschuld danach"
            value={formatEur(selected.mortgage.remainingAfterFixed)}
            sub={`nach ${inputs.fixedRateYears} Jahren Zinsbindung`}
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
