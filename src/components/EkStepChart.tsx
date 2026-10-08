import { afterTaxAnnualReturn, ekStepReturn, type MortgageInputs, type ScenarioResult } from "../lib/calculations";
import { formatPct } from "../lib/format";

type EkStepChartProps = {
  scenarios: ScenarioResult[];
  inputs: MortgageInputs;
};

const WIDTH = 720;
const LABEL_W = 120;
const VALUE_W = 170;
const ROW_H = 38;
const TOP = 30;
const BOTTOM = 28;

/**
 * What each step of extra Eigenkapital earns per year, against the ETF after tax: one
 * bar per step plus the whole span, and one dashed line for the ETF.
 *
 * The owner asked for this next to the matrix column that carries the same figures
 * (D32), because the picture makes the non-monotone pricing visible at a glance: on the
 * offer, the first step earns less than the ETF and the second more.
 *
 * Bars start at 0%, not at the smallest value. A cut axis would make 4,1% against 5,0%
 * look like a factor of three. Every bar carries its verdict in words next to it, so
 * nothing depends on colour (hard rule 4).
 */
export default function EkStepChart({ scenarios, inputs }: EkStepChartProps) {
  const steps = [
    ...scenarios.slice(1).map((to, index) => ({ step: ekStepReturn(scenarios[index], to, inputs), total: false })),
    ...(scenarios.length > 2
      ? [{ step: ekStepReturn(scenarios[0], scenarios[scenarios.length - 1], inputs), total: true }]
      : []),
  ].filter((entry) => entry.step.annualReturn != null);

  if (steps.length === 0) return null;

  const etfNet = afterTaxAnnualReturn(inputs.etfReturnRate, inputs.etfTaxRate, inputs.fixedRateYears);
  const values = [...steps.map((entry) => entry.step.annualReturn as number), etfNet];
  const lo = Math.min(0, Math.floor(Math.min(...values)));
  const hi = Math.max(1, Math.ceil(Math.max(...values) + 0.5));
  const plotLeft = LABEL_W;
  const plotRight = WIDTH - VALUE_W;
  const x = (value: number) => plotLeft + ((value - lo) / (hi - lo)) * (plotRight - plotLeft);
  const height = TOP + steps.length * ROW_H + BOTTOM;
  const ticks = Array.from({ length: hi - lo + 1 }, (_, index) => lo + index);
  const etfX = x(etfNet);

  const caption = `Rendite je EK-Stufe in ${inputs.fixedRateYears} Jahren, steuerfrei, gegen den ETF nach Steuer (${formatPct(etfNet)} p.a.)`;

  return (
    <figure className="chart-figure ek-step-chart">
      <div className="chart-plot">
        <svg className="chart-svg" viewBox={`0 0 ${WIDTH} ${height}`} role="img" aria-label={caption}>
          {ticks.map((tick) => (
            <g key={tick}>
              <line className="chart-grid" x1={x(tick)} x2={x(tick)} y1={TOP - 6} y2={height - BOTTOM} />
              <text className="chart-tick chart-tick-x" x={x(tick)} y={height - BOTTOM + 16}>
                {tick}%
              </text>
            </g>
          ))}

          {steps.map(({ step, total }, index) => {
            const value = step.annualReturn as number;
            const y = TOP + index * ROW_H + 8;
            const barH = ROW_H - 16;
            const start = x(Math.max(lo, Math.min(0, value)));
            const end = x(Math.max(0, value));
            const verdict = step.ekAhead ? "EK vorn" : "ETF vorn";
            return (
              <g key={`${step.from.id}-${step.to.id}`}>
                <text className="bar-group-label" x={LABEL_W - 12} y={y + barH / 2 + 4}>
                  {step.from.ekRate} → {step.to.ekRate}% EK
                </text>
                <rect
                  className={`ek-step-bar ${total ? "is-total" : ""}`}
                  x={start}
                  y={y}
                  width={Math.max(1, end - start)}
                  height={barH}
                  rx={3}
                />
                <text className="bar-value" x={plotRight + 12} y={y + barH / 2 + 4}>
                  {formatPct(value)} p.a. · {verdict}
                </text>
              </g>
            );
          })}

          <line
            className="ek-step-etf"
            x1={etfX}
            x2={etfX}
            y1={TOP - 10}
            y2={height - BOTTOM}
          />
          <text
            className="ek-step-etf-label"
            x={Math.min(plotRight, Math.max(plotLeft, etfX))}
            y={TOP - 14}
          >
            ETF nach Steuer ≈ {formatPct(etfNet)}
          </text>
        </svg>
      </div>
      <figcaption className="chart-legend">
        <span className="chart-legend-item chart-legend-note">
          Rechts der Linie bringt mehr Eigenkapital mehr als euer ETF nach Steuer, links weniger.
          Mehr EK ist dabei steuerfrei und ohne Kursrisiko.
        </span>
      </figcaption>
    </figure>
  );
}
