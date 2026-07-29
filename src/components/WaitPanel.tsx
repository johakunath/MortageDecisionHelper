import type { WaitScenario } from "../lib/calculations";
import { formatEur, formatPct } from "../lib/format";
import { Readout, Section } from "./ui";

type WaitPanelProps = {
  scenarios: WaitScenario[];
};

function columnLabel(waitMonths: number): string {
  return waitMonths === 0 ? "Jetzt kaufen" : `${waitMonths} Monate warten`;
}

/**
 * Buy-now against each waiting period, side by side (PRODUCT_SPEC §7.5). Rent is
 * always shown as an outflow but never subtracted from the adjusted capital — see
 * docs/DECISIONS.md D4.
 */
export default function WaitPanel({ scenarios }: WaitPanelProps) {
  return (
    <Section
      title="Warten"
      subtitle="Kein Forecast, sondern eine Szenario-Sicht: Was passiert mit Preis, Kapital, Miete und Zinsannahme, wenn ihr wartet?"
    >
      <div className="wait-columns">
        {scenarios.map((wait) => {
          const deltaIsPositive = wait.deltaInterest > 0;
          return (
            <div key={wait.waitMonths} className="wait-column">
              <div className="wait-column-head">{columnLabel(wait.waitMonths)}</div>
              <div className="readout-grid one">
                <Readout label="Kaufpreis dann" value={formatEur(wait.futurePrice)} sub="mit Preisannahme" />
                <Readout
                  label="Kapital dann"
                  value={formatEur(wait.adjustedAvailableCapital)}
                  sub={wait.waitMonths === 0 ? "unverändert" : `+ ${formatEur(wait.saved)} gespart`}
                  tone={wait.adjustedAvailableCapital >= 0 ? "blue" : "red"}
                />
                {wait.waitMonths > 0 ? (
                  <Readout
                    label="Miete in der Zwischenzeit"
                    value={formatEur(wait.rentPaid)}
                    sub="Kosten des Wartens, nicht vom Kapital abgezogen"
                    tone="amber"
                  />
                ) : null}
                <Readout label="Zinssatz dann" value={formatPct(wait.adjustedInterestRate)} />
                <Readout label="Darlehen dann" value={formatEur(wait.futureLoan)} />
                <Readout
                  label="Cash nach Kauf"
                  value={formatEur(wait.cashLeftAfterPurchase)}
                  tone={wait.cashLeftAfterPurchase >= 0 ? "green" : "red"}
                />
                <Readout label="Zinsen gesamt (illustrativ)" value={formatEur(wait.scenario.mortgage.interestTotal)} />
                {wait.waitMonths > 0 ? (
                  <Readout
                    label="Delta zu jetzt kaufen"
                    value={formatEur(wait.deltaInterest)}
                    sub={deltaIsPositive ? "Warten ist zinsseitig teurer" : "Warten ist zinsseitig günstiger"}
                    tone={deltaIsPositive ? "red" : "green"}
                  />
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </Section>
  );
}
