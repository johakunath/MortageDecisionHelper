import { useMemo, useState, type ReactNode } from "react";
import {
  apartmentColumn,
  type ApartmentCase,
  type ApartmentColumn,
  type InterestRates,
  type MortgageInputs,
  type ScenarioBase,
  type ScenarioId,
} from "../lib/calculations";
import { SHORTLIST_APARTMENT_CASES } from "../lib/defaults";
import { formatCalendarYear, formatCompactEur, formatEur, formatNumber, formatPct } from "../lib/format";
import { GLOSSARY } from "../lib/glossary";
import LineChart, { type ChartSeries } from "./LineChart";
import { InfoTip, Section, SegmentedChoice, StatusPill } from "./ui";

type ApartmentComparisonProps = {
  apartments: ApartmentCase[];
  scenarios: ScenarioBase[];
  /** The global inputs; each column builds its own apartment inputs from them. */
  inputs: MortgageInputs;
  rates: InterestRates;
  /** The EK level selected on screen: where both columns start. */
  selectedId: ScenarioId;
};

/** Two colours for two flats. Never the only carrier: every line and column is named. */
const COLUMN_COLORS = ["var(--blue)", "var(--blush)"] as const;

/** Chart horizon: long enough for any realistic runtime, short enough to stay readable. */
const CHART_MAX_YEARS = 40;

function defaultPair(apartments: ApartmentCase[]): [string, string] {
  const shortlist = SHORTLIST_APARTMENT_CASES.map((apartment) => apartment.id).filter((id) =>
    apartments.some((apartment) => apartment.id === id),
  );
  const ids = [...shortlist, ...apartments.map((apartment) => apartment.id)];
  const unique = [...new Set(ids)];
  return [unique[0], unique[1] ?? unique[0]];
}

type Row = {
  label: string;
  info?: string;
  cell: (column: ApartmentColumn) => { value: ReactNode; sub?: string };
};

/**
 * Two apartments side by side, each at its own EK level (D42). It answers the question
 * the chips cannot: which flat, not which EK level. Everything here is derived from the
 * same `apartmentColumn` the tests pin, so it cannot disagree with the rest of the page
 * about one flat at one EK level.
 *
 * Read-only on purpose (D3): the facts are edited in "Fakten bearbeiten" above, and an
 * editable comparison is the overload D3 removed.
 */
export default function ApartmentComparison({
  apartments,
  scenarios,
  inputs,
  rates,
  selectedId,
}: ApartmentComparisonProps) {
  const [pair, setPair] = useState<[string, string]>(() => defaultPair(apartments));
  const [ekIds, setEkIds] = useState<[ScenarioId, ScenarioId]>([selectedId, selectedId]);
  // The year the purchase is signed: today. Only labels the chart's axis.
  const startYear = useMemo(() => {
    const now = new Date();
    return now.getFullYear() + now.getMonth() / 12;
  }, []);

  const columns = useMemo(
    () =>
      pair.map((id, index) => {
        const apartment = apartments.find((entry) => entry.id === id) ?? apartments[0];
        const base = scenarios.find((entry) => entry.id === ekIds[index]) ?? scenarios[0];
        return apartmentColumn(apartment, base, inputs, rates);
      }),
    [pair, ekIds, apartments, scenarios, inputs, rates],
  );

  const series = useMemo<ChartSeries[]>(
    () =>
      columns.flatMap((column, index) => {
        const offset = column.inputs.moveInMonths / 12;
        const toPoints = (yearly: { year: number; balance: number }[]) =>
          yearly
            .map((point) => ({ x: point.year + offset, y: point.balance }))
            .filter((point) => point.x <= CHART_MAX_YEARS);
        const name = `${column.apartment.label} · ${column.scenario.label}`;
        return [
          {
            id: `${index}-plain`,
            label: `${name} ohne Sondertilgung`,
            color: COLUMN_COLORS[index],
            endLabel: "",
            points: toPoints(column.withoutSpecial.mortgage.yearly),
          },
          {
            id: `${index}-special`,
            label: `${name} mit eurer Sondertilgung`,
            color: COLUMN_COLORS[index],
            dashed: true,
            endLabel: "",
            points: toPoints(column.scenario.mortgage.yearly),
          },
        ];
      }),
    [columns],
  );

  if (apartments.length < 2) {
    return (
      <Section title="Wohnungen nebeneinander">
        <p className="input-box-note">Legt oben eine zweite Wohnung an, dann erscheint hier der Vergleich.</p>
      </Section>
    );
  }

  const fixedYears = inputs.fixedRateYears;
  const rows: Row[] = [
    {
      label: "Kaufpreis",
      cell: (column) => ({
        value: formatEur(column.inputs.purchasePrice),
        sub:
          column.apartment.parkingPrice > 0
            ? `davon Stellplatz ${formatEur(column.apartment.parkingPrice)}`
            : "ohne Stellplatz",
      }),
    },
    {
      label: "Einzug",
      info: GLOSSARY.moveInMonths,
      cell: (column) =>
        column.inputs.moveInMonths > 0
          ? {
              value: `in ${formatNumber(column.inputs.moveInMonths, 0)} Monaten`,
              sub: `≈ ${formatCalendarYear(startYear + column.inputs.moveInMonths / 12)} · bis dahin weiter Miete`,
            }
          : { value: "sofort" },
    },
    {
      label: "Zins",
      info: GLOSSARY.kfwAmount,
      cell: (column) =>
        column.inputs.kfwAmount > 0
          ? {
              value: `${formatPct(column.scenario.interestRate, 2)} Mischzins`,
              sub: `Bank ${formatPct(column.bankRate, 2)} · KfW ${formatEur(column.inputs.kfwAmount)} zu ${formatPct(column.inputs.kfwRate, 2)}`,
            }
          : { value: formatPct(column.scenario.interestRate, 2), sub: "nur Bank" },
    },
    {
      label: "Monatsrate",
      info: GLOSSARY.monthlyPayment,
      cell: (column) => ({
        value: formatEur(column.scenario.mortgage.regularMonthlyPayment),
        sub: `${formatPct(column.scenario.repaymentRate, 2)} Anfangstilgung`,
      }),
    },
    {
      label: "All-in monatlich",
      info: GLOSSARY.allInMonthly,
      cell: (column) => ({
        value: formatEur(column.scenario.allInMonthly),
        sub: `${formatPct(column.scenario.burdenRatio * 100)} vom Haushaltsnetto${column.inputs.moveInMonths > 0 ? " · ab Einzug" : ""}`,
      }),
    },
    {
      label: "Cash nach Kauf",
      info: GLOSSARY.cashLeft,
      cell: (column) => ({
        value: formatEur(column.scenario.cashLeft),
        sub: `Reserve-Gap: ${formatEur(column.scenario.reserveGap)}`,
      }),
    },
    {
      label: "Bis zum Einzug",
      info: GLOSSARY.constructionInterest,
      cell: (column) =>
        column.inputs.moveInMonths > 0
          ? {
              value: `≈ ${formatEur(column.constructionInterest)} Bauzeitzinsen`,
              sub: `Schätzung · dazu ${formatEur(column.inputs.currentWarmRent * column.inputs.moveInMonths)} Miete, die ihr heute schon zahlt`,
            }
          : { value: "—", sub: "kein Wartezeitraum" },
    },
    {
      label: `Zinsen bis Ende Zinsbindung`,
      info: GLOSSARY.interestFixed,
      cell: (column) => ({
        value: formatEur(column.scenario.mortgage.interestFixed + column.constructionInterest),
        sub:
          column.constructionInterest > 0
            ? `inkl. geschätzter Bauzeitzinsen · ${formatNumber(fixedYears)} Jahre ab Unterschrift`
            : `${formatNumber(fixedYears)} Jahre ab Unterschrift`,
      }),
    },
    {
      label: "Restschuld Ende Zinsbindung",
      info: GLOSSARY.remainingAfterFixed,
      cell: (column) => ({
        value: formatEur(column.withoutSpecial.mortgage.remainingAfterFixed),
        sub: `ohne Sondertilgung · nach ${formatNumber(column.bindingMonths / 12)} Jahren Tilgung`,
      }),
    },
    {
      label: "… mit eurer Sondertilgung",
      cell: (column) => ({
        value: formatEur(column.scenario.mortgage.remainingAfterFixed),
        sub: `${formatEur(column.specialInBinding)} Sondertilgung in der Zinsbindung`,
      }),
    },
    {
      label: "Schuldenfrei",
      cell: (column) => ({
        value: `≈ ${formatCalendarYear(startYear + column.debtFreeAfterYears)}`,
        sub: `mit eurer Sondertilgung · ohne: ≈ ${formatCalendarYear(startYear + column.scenario.contractYearsFromSigning)}${column.scenario.runsPastLimit ? ", nach der Grenze der Bank" : ""}`,
      }),
    },
    {
      label: "Stellplatz kostet",
      info: GLOSSARY.parkingPrice,
      cell: (column) =>
        column.apartment.parkingPrice > 0
          ? {
              value: `≈ ${formatEur(column.parkingMonthly)} im Monat`,
              sub: `von der Rate · dazu ${formatEur(column.parkingCash)} Eigenkapital und Nebenkosten beim Kauf`,
            }
          : { value: "—", sub: "kein Stellplatz im Preis" },
    },
  ];

  return (
    <Section
      title="Wohnungen nebeneinander"
      subtitle={`Jede Wohnung mit ihrer eigenen EK-Stufe, Rate und Sondertilgung. Restschuld und Zinsen am selben Datum: Ende der Zinsbindung, ${formatNumber(fixedYears)} Jahre nach Unterschrift.`}
    >
      <div className="table-wrap">
        <table className="tradeoff-table is-dense comparison-table">
          <thead>
            <tr>
              <th scope="col">
                <span className="visually-hidden">Kennzahl</span>
              </th>
              {columns.map((column, index) => (
                <th key={index} scope="col">
                  <label className="comparison-pick">
                    <span className="comparison-swatch" style={{ background: COLUMN_COLORS[index] }} aria-hidden="true" />
                    <span className="visually-hidden">{index === 0 ? "Erste Wohnung" : "Zweite Wohnung"}</span>
                    <select
                      value={pair[index]}
                      onChange={(event) => {
                        const next: [string, string] = [...pair];
                        next[index] = event.target.value;
                        setPair(next);
                      }}
                    >
                      {apartments.map((apartment) => (
                        <option key={apartment.id} value={apartment.id}>
                          {apartment.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <SegmentedChoice
                    label="Eigenkapital"
                    value={column.scenario.ekRate}
                    options={scenarios.map((scenario) => ({ value: scenario.ekRate, label: `${scenario.ekRate}%` }))}
                    onChange={(ekRate) => {
                      const scenario = scenarios.find((entry) => entry.ekRate === ekRate);
                      if (!scenario) return;
                      const next: [ScenarioId, ScenarioId] = [...ekIds];
                      next[index] = scenario.id;
                      setEkIds(next);
                    }}
                  />
                  <StatusPill tone={column.scenario.statusTone}>{column.scenario.status}</StatusPill>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label}>
                <th scope="row">
                  {row.label}
                  {row.info ? <InfoTip text={row.info} term={row.label} /> : null}
                </th>
                {columns.map((column, index) => {
                  const cell = row.cell(column);
                  return (
                    <td key={index}>
                      <strong>{cell.value}</strong>
                      {cell.sub ? <small className="comparison-sub">{cell.sub}</small> : null}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <LineChart
        series={series}
        markers={[fixedYears]}
        markerLabel="Ende Zinsbindung"
        xLabel="Jahre nach Unterschrift"
        formatValue={formatCompactEur}
        formatDetail={(value) => formatEur(value)}
        formatX={(x) => `${formatNumber(x)} Jahre nach Unterschrift (≈ ${formatCalendarYear(startYear + x)})`}
        caption="Restschuld beider Wohnungen ab Unterschrift. Durchgezogen ohne, gestrichelt mit eurer Sondertilgung. Eine Linie, die später beginnt, ist ein Neubau: die Tilgung startet erst nach der Übergabe."
      />
    </Section>
  );
}
