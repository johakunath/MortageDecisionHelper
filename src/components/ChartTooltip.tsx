export type TooltipRow = {
  id: string;
  label: string;
  value: string;
  /** Repeats the series colour. Never the only carrier — the label is always spelled out. */
  color?: string;
  dashed?: boolean;
  muted?: boolean;
  /** A derived line (a difference, a saving) rather than one of the plotted values. */
  derived?: boolean;
};

type ChartTooltipProps = {
  title: string;
  rows: TooltipRow[];
  note?: string;
  /** Anchor as a percentage of the figure box, so it tracks the SVG as it scales. */
  x: number;
  y: number;
};

/**
 * The hover panel for both charts. HTML rather than SVG `<text>`: it needs wrapping,
 * a background and the app's own type, all of which cost more inside an SVG than they
 * are worth — and it must never be clipped by the plot area.
 *
 * Positioned in percentages of the figure box because the SVGs are declared in a fixed
 * viewBox and stretched to the column width. Absolute pixels would drift the moment
 * the window is resized.
 *
 * `pointer-events: none` (in CSS) so the panel can never sit between the cursor and
 * the plot it describes — hovering would otherwise flicker at the panel's edge.
 *
 * Deliberately NOT a live region: the charts announce the hovered point through their
 * own persistent `aria-live` text, because a node that mounts and unmounts with the
 * cursor is announced unreliably.
 */
export default function ChartTooltip({ title, rows, note, x, y }: ChartTooltipProps) {
  // Past the middle the panel would run off the right edge, so it flips to the other
  // side of the anchor rather than being clamped on top of it.
  const flipped = x > 55;

  return (
    <div
      className={`chart-tooltip ${flipped ? "is-flipped" : ""}`}
      style={{ left: `${x}%`, top: `${y}%` }}
      aria-hidden="true"
    >
      <div className="chart-tooltip-title">{title}</div>
      <ul className="chart-tooltip-rows">
        {rows.map((row) => (
          <li key={row.id} className={row.derived ? "is-derived" : ""}>
            <span
              className={`chart-tooltip-swatch ${row.dashed ? "chart-swatch-dashed" : ""} ${
                row.muted ? "is-muted" : ""
              } ${row.derived ? "is-blank" : ""}`}
              style={row.color ? { background: row.color, color: row.color } : undefined}
            />
            <span className="chart-tooltip-label">{row.label}</span>
            <span className="chart-tooltip-value">{row.value}</span>
          </li>
        ))}
      </ul>
      {note ? <div className="chart-tooltip-note">{note}</div> : null}
    </div>
  );
}
