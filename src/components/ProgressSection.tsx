import { useMemo, useState } from "react";
import type { MortgageInputs, ScenarioResult, WealthAtHorizon } from "../lib/calculations";
import { GLOSSARY } from "../lib/glossary";
import { formatCompactEur, formatEur, formatNumber, formatPct, formatYears } from "../lib/format";
import LineChart, { type ChartSeries } from "./LineChart";
import { Button, Readout, Section } from "./ui";

type ProgressSectionProps = {
  scenarios: ScenarioResult[];
  selected: ScenarioResult;
  /** The same scenario simulated with no Sondertilgung, for the comparison line. */
  selectedWithoutSpecial: ScenarioResult;
  /** The selected scenario valued at the end of the binding (`wealthAtHorizon`). */
  selectedWealth: WealthAtHorizon;
  inputs: MortgageInputs;
};

type ViewId = "balance" | "interest" | "equity";

const VIEWS: { id: ViewId; label: string }[] = [
  { id: "balance", label: "Restschuld" },
  { id: "interest", label: "Zinsen kumuliert" },
  { id: "equity", label: "Eigenkapital" },
];

const SERIES_COLORS: Record<string, string> = {
  ek10: "var(--blue)",
  ek15: "var(--sage)",
  ek20: "var(--amber)",
};

/**
 * The time dimension the app otherwise lacks: every number elsewhere is a single
 * moment (monthly rate, total interest), and this is where the path between them
 * becomes visible — including what Sondertilgung actually buys.
 *
 * Supporting evidence, not the verdict: it sits after the trade-off matrix, and the
 * decision at the top never depends on reading it.
 */
export default function ProgressSection({
  scenarios,
  selected,
  selectedWithoutSpecial,
  selectedWealth,
  inputs,
}: ProgressSectionProps) {
  const [view, setView] = useState<ViewId>("balance");

  const specialYears = useMemo(
    () =>
      inputs.annualSpecialRepayments
        .map((amount, index) => (amount > 0 ? index + 1 : 0))
        .filter((year) => year > 0),
    [inputs.annualSpecialRepayments],
  );

  const series = useMemo<ChartSeries[]>(() => {
    const valueAt = (point: { year: number; balance: number; interestTotal: number }) => {
      if (view === "balance") return point.balance;
      if (view === "interest") return point.interestTotal;
      const propertyValue =
        inputs.purchasePrice * Math.pow(1 + inputs.propertyGrowthRate / 100, point.year);
      return Math.max(0, propertyValue - point.balance);
    };

    const lines: ChartSeries[] = scenarios.map((scenario) => ({
      id: scenario.id,
      label: scenario.label,
      color: SERIES_COLORS[scenario.id] ?? "var(--ink)",
      points: scenario.mortgage.yearly.map((point) => ({
        x: point.year,
        y: valueAt(point),
      })),
    }));

    // Only the selected scenario gets a no-Sondertilgung twin. Drawing all three
    // would double the lines and make the chart unreadable for no extra insight.
    if (specialYears.length > 0 && view !== "equity") {
      lines.push({
        id: `${selected.id}-base`,
        label: `${selected.label} ohne ST`,
        color: SERIES_COLORS[selected.id] ?? "var(--ink)",
        dashed: true,
        points: selectedWithoutSpecial.mortgage.yearly.map((point) => ({
          x: point.year,
          y: valueAt(point),
        })),
      });
    }

    return lines;
  }, [scenarios, selected, selectedWithoutSpecial, view, inputs, specialYears]);

  const activeView = VIEWS.find((entry) => entry.id === view)!;

  return (
    <Section
      title="Verlauf"
      subtitle="Wie sich Schuld, Zinsen und Eigenkapital über die Jahre entwickeln. Ergänzende Evidenz — die Entscheidung oben hängt nicht davon ab."
      right={
        <div className="button-row">
          {VIEWS.map((entry) => (
            <Button key={entry.id} active={view === entry.id} onClick={() => setView(entry.id)}>
              {entry.label}
            </Button>
          ))}
        </div>
      }
    >
      <LineChart
        series={series}
        markers={view === "equity" ? [] : specialYears}
        markerLabel="Sondertilgung"
        formatValue={formatCompactEur}
        // The axis has to round to "450k"; the hover panel has room for the real figure.
        formatDetail={(value) => formatEur(value)}
        caption={`${activeView.label} über die Laufzeit, für ${scenarios.map((scenario) => `${scenario.ekRate}%`).join(", ")} Eigenkapital`}
      />

      <div className="readout-grid three progress-readouts">
        <Readout
          label="Laufzeit"
          value={formatYears(selected.mortgage.runtimeYears)}
          sub={`bis zur vollständigen Abzahlung · ${selected.label}`}
          info={GLOSSARY.runtimeYears}
        />
        {/*
          These two replaced "Immobilienwert bei Abzahlung" and "Nettovermögen", which were
          valued at each scenario's own payoff year: the same flat was worth 67.000 € more
          at 10% EK than at 20% only because that loan runs five years longer (K19). Both
          figures now sit on one date, the end of the binding, for every EK level.
        */}
        <Readout
          label={`Vermögen nach ${formatNumber(selectedWealth.horizonMonths / 12, 0)} Jahren`}
          value={formatEur(selectedWealth.wealth)}
          sub="Wohnung − Restschuld + freies Kapital nach Steuer · gleicher Stichtag für alle Stufen"
          info={GLOSSARY.wealthAtHorizon}
        />
        <Readout
          label="Davon frei verfügbar"
          value={formatEur(selectedWealth.liquid - selectedWealth.liquidTax)}
          sub={`angelegt zu ${formatPct(inputs.etfReturnRate)} p.a. · inkl. eurer Netto-Sparrate`}
          info={GLOSSARY.liquidAtHorizon}
        />
      </div>
      <p className="progress-caveat">
        Die Laufzeit setzt einen konstanten Zins bis zum Ende voraus. Die beiden
        Vermögenswerte gelten für das Ende der Zinsbindung, nehmen aber eure Wertsteigerung
        und ETF-Rendite an.
      </p>
    </Section>
  );
}
