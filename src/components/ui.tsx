import type { ReactNode } from "react";
import { formatEur } from "../lib/format";
import type { Tone } from "../lib/calculations";

type SectionProps = {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
};

export function Section({ title, subtitle, right, children }: SectionProps) {
  return (
    <section className="section">
      <div className="section-header">
        <div>
          <h2>{title}</h2>
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
  variant?: "default" | "dark";
};

export function Button({ children, active = false, onClick, variant = "default" }: ButtonProps) {
  return (
    <button
      type="button"
      className={`button ${active ? "is-active" : ""} ${variant === "dark" ? "button-dark" : ""}`}
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
};

export function Readout({ label, value, sub, tone = "default" }: ReadoutProps) {
  return (
    <div className={`readout readout-${tone}`}>
      <div className="readout-label">{label}</div>
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
}: InputFieldProps) {
  return (
    <label className={`input-field ${highlight ? "input-field-highlight" : ""}`}>
      <span>{label}</span>
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

type SegmentedChoiceProps = {
  label: string;
  value: number;
  options: number[];
  suffix?: string;
  onChange: (value: number) => void;
};

export function SegmentedChoice({
  label,
  value,
  options,
  suffix = "%",
  onChange,
}: SegmentedChoiceProps) {
  return (
    <div className="segmented-field">
      <span>{label}</span>
      <div className="segmented-row">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            className={Math.abs(value - option) < 0.001 ? "is-active" : ""}
            onClick={() => onChange(option)}
          >
            {option.toLocaleString("de-DE", { maximumFractionDigits: 2 })}
            {suffix}
          </button>
        ))}
      </div>
    </div>
  );
}

type MiniMetricProps = {
  label: string;
  value: ReactNode;
  positive?: boolean;
  negative?: boolean;
};

export function MiniMetric({ label, value, positive, negative }: MiniMetricProps) {
  return (
    <div className="mini-metric">
      <span>{label}</span>
      <strong className={positive ? "positive" : negative ? "negative" : ""}>{value}</strong>
    </div>
  );
}

type MetricBarProps = {
  label: string;
  value: number;
  max: number;
  tone?: Tone;
};

export function MetricBar({ label, value, max, tone = "blue" }: MetricBarProps) {
  const width = max <= 0 ? 0 : Math.min(100, Math.max(4, (Math.abs(value) / max) * 100));
  return (
    <div className="metric-bar">
      <div className="metric-bar-top">
        <span>{label}</span>
        <strong>{formatEur(value)}</strong>
      </div>
      <div className="metric-track">
        <div className={`metric-fill metric-fill-${tone}`} style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}
