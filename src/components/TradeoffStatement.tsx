import type { EkTradeoff, MortgageInputs } from "../lib/calculations";
import { formatEur, formatSignedEur } from "../lib/format";

type TradeoffStatementProps = {
  tradeoff: EkTradeoff;
  etfReturnRate: MortgageInputs["etfReturnRate"];
  onEtfReturnChange: (value: number) => void;
};

/**
 * The numerical form of the couple's disagreement, as one readable sentence.
 * Every number comes from a single compareEkScenarios() call over one horizon
 * (the fixed-rate period) — see docs/PRODUCT_SPEC.md §15. The ETF assumption is
 * rendered as an editable chip so it can be moved mid-conversation and the
 * conclusion watched to flip; that interaction is the whole point of this panel.
 */
export default function TradeoffStatement({
  tradeoff,
  etfReturnRate,
  onEtfReturnChange,
}: TradeoffStatementProps) {
  const { from, to, extraCashRequired, runtimeDelta, interestSavedFixed, etfForegone, netAdvantageFixed, horizonYears } =
    tradeoff;
  const favoursMore = netAdvantageFixed >= 0;

  return (
    <div className="tradeoff-statement">
      <p>
        <strong>{to.label} statt {from.label}:</strong> ihr spart{" "}
        <strong>{formatEur(Math.abs(interestSavedFixed))}</strong> Zinsen in den ersten{" "}
        {horizonYears} Jahren und seid bei gleicher Monatsrate{" "}
        <strong>{Math.abs(runtimeDelta).toFixed(1)} Jahre</strong>{" "}
        {runtimeDelta < 0 ? "früher" : "später"} schuldenfrei. Dafür bindet ihr{" "}
        <strong>{formatEur(Math.abs(extraCashRequired))}</strong> mehr Kapital, das im ETF
        rechnerisch <strong>{formatEur(etfForegone)}</strong> gebracht hätte.
      </p>
      <p className={`tradeoff-net ${favoursMore ? "tradeoff-net-favours" : "tradeoff-net-against"}`}>
        Netto: <strong>{formatSignedEur(netAdvantageFixed)}</strong>{" "}
        {favoursMore ? "für mehr Eigenkapital" : "für mehr Liquidität"} — über {horizonYears}{" "}
        Jahre, bei{" "}
        <label className="tradeoff-etf-chip">
          <input
            type="number"
            step={0.5}
            min={0}
            value={etfReturnRate}
            onChange={(event) => onEtfReturnChange(Number(event.target.value) || 0)}
          />
          % ETF-Annahme
        </label>
        .
      </p>
    </div>
  );
}
