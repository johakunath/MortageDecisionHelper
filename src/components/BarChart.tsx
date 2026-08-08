import { useRef, useState, type PointerEvent } from "react";
import ChartTooltip, { type TooltipRow } from "./ChartTooltip";

export type BarGroup = {
  id: string;
  label: string;
  /** Marks the group the user has selected, so it reads as "ours" without colour alone. */
  highlighted?: boolean;
  bars: { id: string; label: string; value: number; muted?: boolean }[];
};

type BarChartProps = {
  groups: BarGroup[];
  /** Bar-end form — short by necessity. */
  formatValue: (value: number) => string;
  /** Hover form. Defaults to the bar-end form; pass the exact one where there is room. */
  formatDetail?: (value: number) => string;
  /**
   * Names the difference between the first and last bar of a row, e.g.
   * `(delta) => "Ersparnis: " + delta`. Omitted rows show the bars only.
   */
  formatDelta?: (delta: number) => { label: string; value: string };
  caption: string;
  /** Legend entries, in bar order. Same length as every group's `bars`. */
  seriesLabels: string[];
};

const WIDTH = 720;
const ROW_HEIGHT = 62;
const PAD = { top: 10, right: 118, bottom: 30, left: 96 };
const BAR_GAP = 5;

/**
 * Grouped horizontal bars, hand-rolled for the same reason as LineChart: the build
 * inlines everything into one standalone HTML file, so a charting dependency would
 * cost more than the chart is worth.
 *
 * Horizontal rather than vertical because the categories are text ("15% EK") and the
 * comparison being made is between the two bars *within* a row — which the eye reads
 * far more reliably when the bars share a baseline on the left.
 *
 * The selected group is marked with a word, not just a tint (spec §14).
 *
 * Hovering a row gives it what the bar-end labels cannot: the exact figures behind the
 * rounded ones, and the difference between the two bars — which is the number the row
 * exists to show and the only one nobody can read off a bar.
 */
export default function BarChart({
  groups,
  formatValue,
  formatDetail = formatValue,
  formatDelta,
  caption,
  seriesLabels,
}: BarChartProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  // Kept only so the panel appears beside the cursor rather than pinned to a corner;
  // the row it describes comes from the row band, never from x.
  const [pointerX, setPointerX] = useState(50);

  const values = groups.flatMap((group) => group.bars.map((bar) => bar.value));
  const maxValue = Math.max(...values, 1);
  const height = PAD.top + groups.length * ROW_HEIGHT + PAD.bottom;
  const plotW = WIDTH - PAD.left - PAD.right;
  const barsPerGroup = Math.max(1, groups[0]?.bars.length ?? 1);
  const barHeight = (ROW_HEIGHT - 16 - (barsPerGroup - 1) * BAR_GAP) / barsPerGroup;

  const hovered = groups.find((group) => group.id === hoverId) ?? null;
  const hoveredIndex = hovered ? groups.indexOf(hovered) : -1;

  function handlePointer(event: PointerEvent<SVGRectElement>, groupId: string) {
    const box = svgRef.current?.getBoundingClientRect();
    if (box && box.width > 0) {
      setPointerX(((event.clientX - box.left) / box.width) * 100);
    }
    setHoverId(groupId);
  }

  const delta =
    hovered && formatDelta && hovered.bars.length > 1
      ? formatDelta(hovered.bars[hovered.bars.length - 1].value - hovered.bars[0].value)
      : null;

  const tooltipRows: TooltipRow[] = hovered
    ? [
        ...hovered.bars.map((bar) => ({
          id: bar.id,
          label: bar.label,
          value: formatDetail(bar.value),
          muted: bar.muted,
        })),
        ...(delta ? [{ id: "delta", label: delta.label, value: delta.value, derived: true }] : []),
      ]
    : [];

  if (values.length === 0) return null;

  return (
    <figure className="chart-figure">
      <div className="chart-plot">
        <svg
          ref={svgRef}
          className="chart-svg"
          viewBox={`0 0 ${WIDTH} ${height}`}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label={caption}
        >
          {groups.map((group, groupIndex) => {
            const top = PAD.top + groupIndex * ROW_HEIGHT + 8;
            const isHovered = group.id === hoverId;
            return (
              <g key={group.id} className={isHovered ? "bar-group is-hovered" : "bar-group"}>
                <text x={PAD.left - 10} y={top + ROW_HEIGHT / 2 - 10} className="bar-group-label">
                  {group.label}
                </text>
                {group.highlighted ? (
                  <text x={PAD.left - 10} y={top + ROW_HEIGHT / 2 + 5} className="bar-group-tag">
                    deine Wahl
                  </text>
                ) : null}

                {group.bars.map((bar, barIndex) => {
                  const y = top + barIndex * (barHeight + BAR_GAP);
                  const width = Math.max(1, (bar.value / maxValue) * plotW);
                  return (
                    <g key={bar.id}>
                      <rect
                        x={PAD.left}
                        y={y}
                        width={width}
                        height={barHeight}
                        rx={2}
                        className={`bar ${bar.muted ? "bar-muted" : "bar-solid"} ${
                          group.highlighted ? "bar-highlighted" : ""
                        }`}
                      />
                      <text x={PAD.left + width + 8} y={y + barHeight / 2 + 4} className="bar-value">
                        {formatValue(bar.value)}
                      </text>
                    </g>
                  );
                })}

                {/*
                  One hit band per ROW, not per bar: the comparison the row exists for
                  is between its own bars, so aiming at either of them must produce the
                  same panel. It starts at x=0 so the row's own label counts as part of
                  it — otherwise pointing at "15% EK" dims every row and selects none.
                  Drawn last so it sits above the bars it covers.
                */}
                <rect
                  x={0}
                  y={top - 8}
                  width={WIDTH}
                  height={ROW_HEIGHT}
                  fill="transparent"
                  className="chart-hover-surface"
                  onPointerMove={(event) => handlePointer(event, group.id)}
                  onPointerDown={(event) => handlePointer(event, group.id)}
                  onPointerLeave={() => setHoverId(null)}
                />
              </g>
            );
          })}
        </svg>

        {hovered ? (
          <ChartTooltip
            title={hovered.label}
            rows={tooltipRows}
            note={hovered.highlighted ? "deine Wahl" : undefined}
            x={Math.min(88, Math.max(12, pointerX))}
            y={((PAD.top + hoveredIndex * ROW_HEIGHT) / height) * 100}
          />
        ) : null}
      </div>

      <p className="visually-hidden" aria-live="polite">
        {hovered
          ? `${hovered.label}: ${tooltipRows.map((row) => `${row.label} ${row.value}`).join(", ")}`
          : ""}
      </p>

      <figcaption className="chart-legend">
        {seriesLabels.map((label, index) => (
          <span key={label} className="chart-legend-item">
            <span
              className={`chart-swatch ${index === 0 ? "chart-swatch-muted" : ""}`}
              aria-hidden="true"
            />
            {label}
          </span>
        ))}
        <span className="chart-legend-item chart-legend-note">{caption}</span>
        <span className="chart-legend-item chart-legend-hint">
          Zeigt auf eine Zeile für die genauen Zahlen und den Unterschied
        </span>
      </figcaption>
    </figure>
  );
}
