export type BarGroup = {
  id: string;
  label: string;
  /** Marks the group the user has selected, so it reads as "ours" without colour alone. */
  highlighted?: boolean;
  bars: { id: string; label: string; value: number; muted?: boolean }[];
};

type BarChartProps = {
  groups: BarGroup[];
  formatValue: (value: number) => string;
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
 */
export default function BarChart({ groups, formatValue, caption, seriesLabels }: BarChartProps) {
  const values = groups.flatMap((group) => group.bars.map((bar) => bar.value));
  if (values.length === 0) return null;

  const maxValue = Math.max(...values, 1);
  const height = PAD.top + groups.length * ROW_HEIGHT + PAD.bottom;
  const plotW = WIDTH - PAD.left - PAD.right;
  const barsPerGroup = Math.max(1, groups[0].bars.length);
  const barHeight = (ROW_HEIGHT - 16 - (barsPerGroup - 1) * BAR_GAP) / barsPerGroup;

  return (
    <figure className="chart-figure">
      <svg
        className="chart-svg"
        viewBox={`0 0 ${WIDTH} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={caption}
      >
        {groups.map((group, groupIndex) => {
          const top = PAD.top + groupIndex * ROW_HEIGHT + 8;
          return (
            <g key={group.id}>
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
            </g>
          );
        })}
      </svg>

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
      </figcaption>
    </figure>
  );
}
