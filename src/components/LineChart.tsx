export type ChartSeries = {
  id: string;
  label: string;
  /** CSS colour. Never the only carrier of identity — every line is also labelled. */
  color: string;
  dashed?: boolean;
  points: { x: number; y: number }[];
};

type LineChartProps = {
  series: ChartSeries[];
  /** Vertical markers, e.g. years in which a Sondertilgung falls. */
  markers?: number[];
  markerLabel?: string;
  formatValue: (value: number) => string;
  xLabel?: string;
  caption: string;
};

const WIDTH = 720;
const HEIGHT = 300;
const PAD = { top: 16, right: 108, bottom: 34, left: 64 };

function niceCeil(value: number): number {
  if (value <= 0) return 1;
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
  return Math.ceil(value / magnitude) * magnitude;
}

/**
 * A hand-rolled SVG chart. Deliberately not a charting library: the build inlines
 * everything into one standalone HTML file the owner opens from disk, and this needs
 * roughly 80 lines rather than a 400 KB dependency.
 *
 * Every series is labelled at its right-hand end and repeated in the legend with its
 * own dash pattern, so the lines remain distinguishable without colour (spec §14).
 */
export default function LineChart({
  series,
  markers = [],
  markerLabel,
  formatValue,
  xLabel = "Jahr",
  caption,
}: LineChartProps) {
  const allPoints = series.flatMap((s) => s.points);
  if (allPoints.length === 0) return null;

  const maxX = Math.max(...allPoints.map((p) => p.x), 1);
  const maxY = niceCeil(Math.max(...allPoints.map((p) => p.y), 1));
  const plotW = WIDTH - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;

  const sx = (x: number) => PAD.left + (x / maxX) * plotW;
  const sy = (y: number) => PAD.top + plotH - (y / maxY) * plotH;

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => maxY * f);
  const xStep = maxX <= 12 ? 2 : maxX <= 30 ? 5 : 10;
  const xTicks: number[] = [];
  for (let x = 0; x <= maxX; x += xStep) xTicks.push(x);

  return (
    <figure className="chart-figure">
      <svg
        className="chart-svg"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={caption}
      >
        {yTicks.map((value) => (
          <g key={value}>
            <line
              x1={PAD.left}
              x2={PAD.left + plotW}
              y1={sy(value)}
              y2={sy(value)}
              className="chart-grid"
            />
            <text x={PAD.left - 8} y={sy(value) + 4} className="chart-tick chart-tick-y">
              {formatValue(value)}
            </text>
          </g>
        ))}

        {xTicks.map((x) => (
          <text key={x} x={sx(x)} y={HEIGHT - PAD.bottom + 18} className="chart-tick chart-tick-x">
            {x}
          </text>
        ))}
        <text x={PAD.left + plotW / 2} y={HEIGHT - 2} className="chart-axis-label">
          {xLabel}
        </text>

        {markers.map((year) => (
          <line
            key={`marker-${year}`}
            x1={sx(year)}
            x2={sx(year)}
            y1={PAD.top}
            y2={PAD.top + plotH}
            className="chart-marker"
          />
        ))}

        {series.map((s) => {
          const d = s.points
            .map((p, index) => `${index === 0 ? "M" : "L"} ${sx(p.x).toFixed(1)} ${sy(p.y).toFixed(1)}`)
            .join(" ");
          const last = s.points[s.points.length - 1];
          return (
            <g key={s.id}>
              <path
                d={d}
                fill="none"
                stroke={s.color}
                strokeWidth={s.dashed ? 1.5 : 2.5}
                strokeDasharray={s.dashed ? "6 4" : undefined}
                opacity={s.dashed ? 0.7 : 1}
              />
              <text
                x={Math.min(sx(last.x) + 6, WIDTH - PAD.right + 6)}
                y={sy(last.y) + 4}
                className="chart-series-label"
                fill={s.color}
              >
                {s.label}
              </text>
            </g>
          );
        })}
      </svg>

      <figcaption className="chart-legend">
        {series.map((s) => (
          <span key={s.id} className="chart-legend-item">
            <span
              className={`chart-swatch ${s.dashed ? "chart-swatch-dashed" : ""}`}
              style={{ background: s.color }}
              aria-hidden="true"
            />
            {s.label}
          </span>
        ))}
        {markers.length > 0 && markerLabel ? (
          <span className="chart-legend-item chart-legend-marker">{markerLabel}</span>
        ) : null}
        {/* Shown, not only announced — this used to reach screen readers via the
            svg's aria-label and nobody else, while BarChart printed its own. */}
        <span className="chart-legend-item chart-legend-note">{caption}</span>
      </figcaption>
    </figure>
  );
}
