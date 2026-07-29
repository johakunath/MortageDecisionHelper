import { BETTER_WHEN, type MortgageInputs, type ScenarioResult } from "../lib/calculations";
import { GLOSSARY } from "../lib/glossary";
import { formatEur, formatPct, formatSignedEur } from "../lib/format";
import { InfoTip, SignedValue } from "./ui";

type CashBlockProps = {
  selected: ScenarioResult;
  inputs: MortgageInputs;
};

/**
 * "How much cash do we need upfront, and what is left?" — PRODUCT_SPEC §2.1, a
 * primary question in its own right. It had quietly lost its display surface when
 * the scenario cards were removed, leaving cashNeeded and downPayment computed but
 * invisible. Kept as one dense line rather than a card grid so it informs the
 * decision above without competing with it.
 */
export default function CashBlock({ selected, inputs }: CashBlockProps) {
  return (
    <div className="cash-block">
      <div className="cash-row">
        <div className="cash-item">
          <span>Anzahlung</span>
          <strong>{formatEur(selected.downPayment)}</strong>
          <small>{formatPct(selected.ekRate)} vom Kaufpreis</small>
        </div>
        <div className="cash-op" aria-hidden="true">+</div>
        <div className="cash-item">
          <span>Kaufnebenkosten</span>
          <strong>{formatEur(selected.closingCosts)}</strong>
          <small>{formatPct(inputs.closingCostRate)}</small>
        </div>
        <div className="cash-op" aria-hidden="true">+</div>
        <div className="cash-item">
          <span>Renovierung / Umzug</span>
          <strong>{formatEur(inputs.renovation + inputs.moving)}</strong>
          <small>einmalig</small>
        </div>
        <div className="cash-op" aria-hidden="true">=</div>
        <div className="cash-item cash-item-total">
          <span>
            Cash beim Kauf
            <InfoTip text={GLOSSARY.cashNeeded} term="Cash beim Kauf" />
          </span>
          <strong>{formatEur(selected.cashNeeded)}</strong>
          <small>von {formatEur(inputs.availableCapital)} verfügbar</small>
        </div>
      </div>

      <div className="cash-footer">
        <span>
          Danach bleiben{" "}
          <SignedValue
            value={selected.cashLeft}
            betterWhen={BETTER_WHEN.cashLeft}
            verdictLabels={{ better: "vorhanden", worse: "Reserve verletzt" }}
          />
        </span>
        <span className="cash-footer-rent">
          Monatlich {formatEur(selected.allInMonthly)} all-in ·{" "}
          {formatSignedEur(selected.rentDelta)} gegenüber eurer Warmmiete von{" "}
          {formatEur(inputs.currentWarmRent)}
        </span>
      </div>
    </div>
  );
}
