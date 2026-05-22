import type {
  DecisionResult,
  MortgageInputs,
  ScenarioResult,
  SpecialBreakEven,
} from "../lib/calculations";
import { formatEur, formatPct, formatYears } from "../lib/format";
import { Readout, StatusPill } from "./ui";

type RightPanelProps = {
  selected: ScenarioResult;
  inputs: MortgageInputs;
  decision: DecisionResult;
  special5: SpecialBreakEven;
  special10: SpecialBreakEven;
};

export default function RightPanel({
  selected,
  inputs,
  decision,
  special5,
  special10,
}: RightPanelProps) {
  return (
    <aside className="right-panel">
      <div className="result-panel">
        <div className="eyebrow">Deine Zahlen</div>
        <h2>{selected.label}</h2>
        <StatusPill tone={selected.statusTone}>{selected.status}</StatusPill>
        <div className="result-list">
          <Readout
            label="Darlehen"
            value={formatEur(selected.loan)}
            sub={`Anzahlung: ${formatEur(selected.downPayment)}`}
          />
          <Readout
            label="Monatsrate Darlehen"
            value={formatEur(selected.mortgage.regularMonthlyPayment)}
            sub={`${formatPct(selected.interestRate)} Zins · ${formatPct(inputs.repaymentRate)} Tilgung`}
            tone="blue"
          />
          <Readout
            label="All-in monatlich"
            value={formatEur(selected.allInMonthly)}
            sub={`Delta zur Warmmiete: ${formatEur(selected.rentDelta)}`}
          />
          <Readout
            label="Cash nach Kauf"
            value={formatEur(selected.cashLeft)}
            sub={`Reserve-Gap: ${formatEur(selected.reserveGap)}`}
            tone={selected.reserveGap < 0 ? "red" : "green"}
          />
          <Readout
            label="Immobilienwert"
            value={formatEur(selected.propertyValueAtPayoff)}
            sub={`bei Abzahlung · real ${formatPct(selected.realPropertyReturnRate)} p.a.`}
            tone="orange"
          />
          <Readout
            label="Nettovermögen"
            value={formatEur(selected.netWorthAtPayoff)}
            sub="Immobilienwert - EK/Kosten - Zinsen"
            tone={selected.netWorthAtPayoff >= 0 ? "green" : "red"}
          />
          <Readout
            label={`Zinsen in ${inputs.fixedRateYears} Jahren`}
            value={formatEur(selected.mortgage.interestFixed)}
            sub={`Restschuld: ${formatEur(selected.mortgage.remainingAfterFixed)}`}
            tone="amber"
          />
          <Readout
            label="Zinsen gesamt"
            value={formatEur(selected.mortgage.interestTotal)}
            sub={`Laufzeit: ${formatYears(selected.mortgage.runtimeYears)}`}
          />
        </div>
      </div>

      <div className={`logic-panel ${decision.noSafeScenario ? "logic-danger" : "logic-ok"}`}>
        <h3>Empfehlungslogik</h3>
        <p>
          {decision.noSafeScenario
            ? "Kein Szenario erfüllt gleichzeitig Reserve-Ziel und maximale 40% Haushaltsbelastung. Nicht als sicher empfehlen."
            : `${decision.recommendation?.label} ist aktuell der Kompromiss nach Regel: 10% EK bevorzugen, sofern sauber machbar.`}
        </p>
      </div>

      <div className="break-even-panel">
        <h3>Sondertilgung Break-even</h3>
        <dl>
          <div>
            <dt>5% → 15%</dt>
            <dd>{special5.amount == null ? "nicht möglich" : `${formatEur(special5.amount)}/Jahr`}</dd>
          </div>
          <div>
            <dt>10% → 15%</dt>
            <dd>{special10.amount == null ? "nicht möglich" : `${formatEur(special10.amount)}/Jahr`}</dd>
          </div>
          <div>
            <dt>Max. bei 5%</dt>
            <dd>{formatEur(special5.maxSpecial)}/Jahr</dd>
          </div>
        </dl>
      </div>
    </aside>
  );
}
