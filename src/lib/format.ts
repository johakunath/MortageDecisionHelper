export function formatEur(value: number, digits = 0): string {
  if (!Number.isFinite(value)) {
    return "—";
  }

  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value);
}

export function formatPct(value: number, digits = 1): string {
  if (!Number.isFinite(value)) {
    return "—";
  }

  return `${value.toLocaleString("de-DE", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  })}%`;
}

export function formatYears(value: number): string {
  return `${value.toLocaleString("de-DE", { maximumFractionDigits: 1 })} Jahre`;
}
