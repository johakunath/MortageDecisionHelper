import type { WaitScenario } from "../lib/calculations";
import { formatEur, formatPct } from "../lib/format";
import { Readout, Section } from "./ui";

type WaitPanelProps = {
  wait: WaitScenario;
  waitMonths: number;
};

export default function WaitPanel({ wait, waitMonths }: WaitPanelProps) {
  const deltaIsPositive = wait.deltaInterest > 0;

  return (
    <Section
      title="Warten"
      subtitle="Kein Forecast, sondern eine Szenario-Sicht: Was passiert mit Preis, Kapital, Miete und Zinsannahme?"
    >
      <div className="readout-grid four">
        <Readout label="Wartezeit" value={`${waitMonths} Monate`} sub="Annahme" />
        <Readout label="Zusätzlich gespart" value={formatEur(wait.saved)} sub="vor Mietabzug" tone="green" />
        <Readout label="Miete beim Warten" value={formatEur(wait.rentPaid)} sub="Liquiditätsabfluss" tone="amber" />
        <Readout label="Kaufpreis später" value={formatEur(wait.futurePrice)} sub="mit Preisannahme" />
        <Readout
          label="Kapital später"
          value={formatEur(wait.adjustedAvailableCapital)}
          sub="EK + Sparen - Miete"
          tone={wait.adjustedAvailableCapital >= 0 ? "blue" : "red"}
        />
        <Readout
          label="Zinsannahme später"
          value={formatPct(wait.adjustedInterestRate)}
          sub="für die aktuelle EK-Auswahl"
        />
        <Readout
          label="Zinsen bei Warten"
          value={formatEur(wait.scenario.mortgage.interestTotal)}
          sub="Gesamtlaufzeit im Modell"
        />
        <Readout
          label="Delta zu Kaufen jetzt"
          value={formatEur(wait.deltaInterest)}
          sub={deltaIsPositive ? "Warten ist zinsseitig teurer" : "Warten ist zinsseitig günstiger"}
          tone={deltaIsPositive ? "red" : "green"}
        />
      </div>
    </Section>
  );
}
