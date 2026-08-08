import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { formatNumber } from "../lib/format";
import ChartTooltip, { type TooltipRow } from "./ChartTooltip";

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
  /** Axis form — short by necessity, e.g. "450k". */
  formatValue: (value: number) => string;
  /**
   * Hover form. Defaults to the axis form, but the whole point of the hover panel is
   * that it has room for the exact figure the axis had to round away.
   */
  formatDetail?: (value: number) => string;
  xLabel?: string;
  /**
   * Names a hovered x, e.g. `(x) => "Jahr 12"`. Read out loud to screen readers.
   * Note the x values are NOT all integers — a series' last point is its exact payoff
   * moment — so this must go through `format.ts` like everything else.
   */
  formatX?: (x: number) => string;
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
 * roughly 200 lines rather than a 400 KB dependency.
 *
 * Every series is labelled at its right-hand end and repeated in the legend with its
 * own dash pattern, so the lines remain distinguishable without colour (spec §14).
 *
 * Hovering the plot reads every series at one year at once — which is the question the
 * chart is actually asked ("what is the Restschuld in year 12, in all three?") and the
 * one the right-hand end labels cannot answer. The same readout is reachable by
 * keyboard: focus the chart and walk it with the arrow keys, because two people at one
 * screen do not always share a mouse.
 */
export default function LineChart({
  series,
  markers = [],
  markerLabel,
  formatValue,
  formatDetail = formatValue,
  xLabel = "Jahr",
  formatX = (x) => `${xLabel} ${formatNumber(x)}`,
  caption,
}: LineChartProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hoverX, setHoverX] = useState<number | null>(null);

  const allPoints = series.flatMap((s) => s.points);
  const maxX = Math.max(...allPoints.map((p) => p.x), 1);
  const maxY = niceCeil(Math.max(...allPoints.map((p) => p.y), 1));
  const plotW = WIDTH - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;

  const sx = (x: number) => PAD.left + (x / maxX) * plotW;
  const sy = (y: number) => PAD.top + plotH - (y / maxY) * plotH;

  // The x positions that actually exist. Series end at different years — a scenario
  // that pays off sooner simply has no point past its last — so the hover snaps to a
  // real x and each series contributes only where it still runs.
  const xValues = [...new Set(allPoints.map((point) => point.x))].sort((a, b) => a - b);

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => maxY * f);
  const xStep = maxX <= 12 ? 2 : maxX <= 30 ? 5 : 10;
  const xTicks: number[] = [];
  for (let x = 0; x <= maxX; x += xStep) xTicks.push(x);

  function snapTo(value: number): number {
    return xValues.reduce(
      (best, candidate) => (Math.abs(candidate - value) < Math.abs(best - value) ? candidate : best),
      xValues[0],
    );
  }

  function handlePointer(event: PointerEvent<SVGRectElement>) {
    const box = svgRef.current?.getBoundingClientRect();
    if (!box || box.width === 0) return;

    // Client pixels → viewBox units. The SVG is declared at a fixed viewBox and
    // stretched to the column, so the two only coincide at one window width.
    const viewX = ((event.clientX - box.left) / box.width) * WIDTH;
    setHoverX(snapTo(((viewX - PAD.left) / plotW) * maxX));
  }

  function handleKey(event: KeyboardEvent<SVGSVGElement>) {
    const last = xValues.length - 1;
    const goTo = (index: number) => {
      event.preventDefault();
      setHoverX(xValues[Math.min(last, Math.max(0, index))]);
    };

    // Arrows step from where the reader is; Home/End are absolute. Routing Home
    // through a negative step sent an un-hovered chart to its LAST point, because
    // "no position yet" was being resolved from the direction of travel.
    const index = hoverX === null ? null : xValues.indexOf(hoverX);
    if (event.key === "ArrowRight") goTo(index === null ? 0 : index + 1);
    else if (event.key === "ArrowLeft") goTo(index === null ? last : index - 1);
    else if (event.key === "Home") goTo(0);
    else if (event.key === "End") goTo(last);
    else if (event.key === "Escape") setHoverX(null);
  }

  const hovered =
    hoverX === null
      ? []
      : series
          .map((s) => ({ series: s, point: s.points.find((p) => p.x === hoverX) }))
          .filter((entry): entry is { series: ChartSeries; point: { x: number; y: number } } =>
            Boolean(entry.point),
          );

  /*
   * A hovered x can go stale: switching the Verlauf view, changing the EK level or
   * editing an assumption rebuilds `series` with different runtimes, and the year
   * under the cursor may no longer exist in any of them. Everything the hover draws
   * hangs off this one flag, so the guide line can never outlive its own readout —
   * it used to survive on a non-null `hoverX` alone and stand there pointing at
   * nothing.
   */
  const showHover = hoverX !== null && hovered.length > 0;

  const tooltipRows: TooltipRow[] = hovered.map((entry) => ({
    id: entry.series.id,
    label: entry.series.label,
    value: formatDetail(entry.point.y),
    color: entry.series.color,
    dashed: entry.series.dashed,
  }));

  const markerHit = hoverX !== null && markers.includes(hoverX);

  if (allPoints.length === 0) return null;

  return (
    <figure className="chart-figure">
      <div className="chart-plot">
        <svg
          ref={svgRef}
          className="chart-svg"
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label={caption}
          tabIndex={0}
          onKeyDown={handleKey}
          onBlur={() => setHoverX(null)}
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

          {showHover ? (
            <g className="chart-hover" aria-hidden="true">
              <line
                x1={sx(hoverX)}
                x2={sx(hoverX)}
                y1={PAD.top}
                y2={PAD.top + plotH}
                className="chart-hover-line"
              />
              {hovered.map((entry) => (
                <circle
                  key={entry.series.id}
                  cx={sx(entry.point.x)}
                  cy={sy(entry.point.y)}
                  r={4}
                  className="chart-hover-dot"
                  fill={entry.series.color}
                />
              ))}
            </g>
          ) : null}

          {/*
            One transparent overlay rather than hit areas per line: the question is
            always "what happens in year N", never "what does this one line do here".
          */}
          <rect
            x={PAD.left}
            y={PAD.top}
            width={plotW}
            height={plotH}
            fill="transparent"
            className="chart-hover-surface"
            onPointerMove={handlePointer}
            onPointerDown={handlePointer}
            onPointerLeave={() => setHoverX(null)}
          />
        </svg>

        {showHover ? (
          <ChartTooltip
            title={formatX(hoverX)}
            rows={tooltipRows}
            note={markerHit ? markerLabel : undefined}
            x={(sx(hoverX) / WIDTH) * 100}
            y={(PAD.top / HEIGHT) * 100}
          />
        ) : null}
      </div>

      {/*
        Persistent live region, not the tooltip itself: a node that mounts and unmounts
        with the cursor is announced unreliably, while a stable one whose text changes
        is announced every time.
      */}
      <p className="visually-hidden" aria-live="polite">
        {showHover
          ? `${formatX(hoverX)}: ${hovered
              .map((entry) => `${entry.series.label} ${formatDetail(entry.point.y)}`)
              .join(", ")}`
          : ""}
      </p>

      <figcaption className="chart-legend">
        {series.map((s) => (
          <span key={s.id} className="chart-legend-item">
            <span
              className={`chart-swatch ${s.dashed ? "chart-swatch-dashed" : ""}`}
              style={{ background: s.color, color: s.color }}
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
        <span className="chart-legend-item chart-legend-hint">
          Zeigt auf eine Stelle im Chart — oder Tab und dann ←/→ — für die Werte in dem Jahr
        </span>
      </figcaption>
    </figure>
  );
}
