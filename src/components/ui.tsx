import { useId, useState, type ReactNode } from "react";
import { formatSignedEur } from "../lib/format";
import type { Tone } from "../lib/calculations";

type InfoTipProps = {
  text: string;
  /** Names the thing being explained, so screen-reader users get "Erklärung: Zinsbindung". */
  term: string;
};

/**
 * Opens on hover AND on focus/click — hover alone would be unreachable by keyboard
 * and unusable on touch. The panel is rendered next to the trigger and referenced by
 * `aria-describedby`, so the explanation is announced rather than merely visible.
 */
export function InfoTip({ text, term }: InfoTipProps) {
  const [open, setOpen] = useState(false);
  const id = useId();

  return (
    <span className="infotip">
      <button
        type="button"
        className="infotip-trigger"
        aria-label={`Erklärung: ${term}`}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onClick={(event) => {
          // Inside a <label>, a bare click would focus the input and close this again.
          event.preventDefault();
          setOpen((current) => !current);
        }}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      >
        ?
      </button>
      {open ? (
        <span id={id} role="tooltip" className="infotip-body">
          {text}
        </span>
      ) : null}
    </span>
  );
}

type SectionProps = {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  info?: string;
  children: ReactNode;
};

export function Section({ title, subtitle, right, info, children }: SectionProps) {
  return (
    <section className="section">
      <div className="section-header">
        <div>
          <h2>
            {title}
            {info ? <InfoTip text={info} term={title} /> : null}
          </h2>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        {right ? <div className="section-action">{right}</div> : null}
      </div>
      {children}
    </section>
  );
}

type ButtonProps = {
  children: ReactNode;
  active?: boolean;
  onClick: () => void;
  /**
   * "tab" — switches which group of fields is shown (navigation, has an active state).
   * "action" — does something when pressed (reset, apply a preset); never "active".
   * These must not look alike: a pressed-looking control that is really a one-shot
   * action reads as state the user thinks they can toggle back.
   */
  variant?: "tab" | "action";
};

export function Button({ children, active = false, onClick, variant = "tab" }: ButtonProps) {
  return (
    <button
      type="button"
      className={`button button-${variant} ${active ? "is-active" : ""}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

type ReadoutProps = {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: Tone | "default";
  info?: string;
};

export function Readout({ label, value, sub, tone = "default", info }: ReadoutProps) {
  return (
    <div className={`readout readout-${tone}`}>
      <div className="readout-label">
        {label}
        {info ? <InfoTip text={info} term={label} /> : null}
      </div>
      <div className="readout-value">{value}</div>
      {sub ? <div className="readout-sub">{sub}</div> : null}
    </div>
  );
}

type StatusPillProps = {
  tone: Tone;
  children: ReactNode;
};

export function StatusPill({ tone, children }: StatusPillProps) {
  return <span className={`status status-${tone}`}>{children}</span>;
}

type InputFieldProps = {
  label: string;
  value: number;
  onChange: (value: number) => void;
  suffix?: string;
  step?: number;
  min?: number;
  highlight?: boolean;
  hint?: string;
  info?: string;
  /**
   * Hides the label visually but keeps it for screen readers. Only for grids where a
   * row and column header already name the field — never to save space on a lone input.
   */
  labelHidden?: boolean;
};

export function InputField({
  label,
  value,
  onChange,
  suffix = "€",
  step = 1000,
  min = -999999999,
  highlight = false,
  hint,
  info,
  labelHidden = false,
}: InputFieldProps) {
  return (
    <label
      className={`input-field ${highlight ? "input-field-highlight" : ""} ${labelHidden ? "input-field-bare" : ""}`}
    >
      <span className={labelHidden ? "visually-hidden" : undefined}>
        {label}
        {info && !labelHidden ? <InfoTip text={info} term={label} /> : null}
      </span>
      <div className="input-row">
        <input
          type="number"
          value={value}
          step={step}
          min={min}
          onChange={(event) => onChange(Number(event.target.value) || 0)}
        />
        <em>{suffix}</em>
      </div>
      {hint ? <small>{hint}</small> : null}
    </label>
  );
}

export type SegmentedOption = { value: number; label: string };

type SegmentedChoiceProps = {
  label: string;
  value: number;
  options: SegmentedOption[];
  onChange: (value: number) => void;
  info?: string;
};

export function SegmentedChoice({ label, value, options, onChange, info }: SegmentedChoiceProps) {
  return (
    <div className="segmented-field">
      <span>
        {label}
        {info ? <InfoTip text={info} term={label} /> : null}
      </span>
      <div className="segmented-row">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className={Math.abs(value - option.value) < 0.001 ? "is-active" : ""}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

type Verdict = "better" | "worse" | "neutral";

const DEFAULT_VERDICT_WORDS: Record<Verdict, string> = {
  better: "besser",
  worse: "schlechter",
  neutral: "neutral",
};

type SignedValueProps = {
  /** The delta itself, already signed (positive = increase). */
  value: number;
  /**
   * Which direction of change is favourable. "neutral" renders the glyph and number
   * without a verdict — for figures where a sign only means "short" vs. "over", not
   * "good" vs. "bad" (e.g. an absolute cash balance where the label already carries
   * the judgement).
   */
  betterWhen: "higher" | "lower" | "neutral";
  /** Defaults to signed euros; pass formatSignedPct or a custom formatter for other units. */
  format?: (value: number) => string;
  /** Override the verdict words, e.g. { worse: "Reserve verletzt" } for absolute figures. */
  verdictLabels?: Partial<Record<Verdict, string>>;
  /** Absolute values smaller than this count as unchanged. Guards against float noise. */
  epsilon?: number;
};

/**
 * Renders glyph → signed number → plain-word verdict, in that order. Colour is applied
 * last, via CSS, and is never the only carrier of meaning (PRODUCT_SPEC §14). Because
 * `betterWhen` is passed explicitly per call site rather than inferred from the sign,
 * "−45.000 €" can correctly read as "besser" in one column and "schlechter" in
 * another — the exact inversion that made the old .positive/.negative classes
 * ambiguous is structurally impossible here.
 */
export function SignedValue({
  value,
  betterWhen,
  format = formatSignedEur,
  verdictLabels,
  epsilon = 0.5,
}: SignedValueProps) {
  const direction: "up" | "down" | "flat" =
    value > epsilon ? "up" : value < -epsilon ? "down" : "flat";

  let verdict: Verdict = "neutral";
  if (betterWhen !== "neutral" && direction !== "flat") {
    const goesUp = direction === "up";
    const isBetter = betterWhen === "higher" ? goesUp : !goesUp;
    verdict = isBetter ? "better" : "worse";
  }

  const glyph = direction === "up" ? "▲" : direction === "down" ? "▼" : "–";
  const words = { ...DEFAULT_VERDICT_WORDS, ...verdictLabels };
  const verdictWord = words[verdict];
  const signWord = direction === "up" ? "plus" : direction === "down" ? "minus" : "unverändert";
  const displayValue = direction === "flat" ? 0 : value;

  return (
    <span
      className={`signed-value signed-${verdict}`}
      aria-label={`${signWord} ${format(displayValue)}, ${verdictWord}`}
    >
      <span className="signed-glyph" aria-hidden="true">{glyph}</span>
      <span className="signed-number">{format(displayValue)}</span>
      {betterWhen !== "neutral" || verdictLabels ? (
        <span className="signed-word">{verdictWord}</span>
      ) : null}
    </span>
  );
}

