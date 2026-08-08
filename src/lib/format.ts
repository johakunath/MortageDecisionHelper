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
  if (!Number.isFinite(value)) {
    return "—";
  }

  return `${value.toLocaleString("de-DE", { maximumFractionDigits: 1 })} Jahre`;
}

/** Signed years in the compact column form: "+1,5 J." / "−1,5 J." */
export function formatSignedYears(value: number, digits = 1): string {
  if (!Number.isFinite(value)) {
    return "—";
  }

  const amount = Math.abs(value).toLocaleString("de-DE", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${amount} J.`;
}

/**
 * Chart-axis short form: "1,2 Mio", "450k", "820". Two components had grown their own
 * near-identical version of this, both emitting an English decimal point into German
 * copy. `withSymbol` keeps the € where the axis does not already carry it.
 */
export function formatCompactEur(value: number, withSymbol = false): string {
  if (!Number.isFinite(value)) {
    return "—";
  }

  const suffix = withSymbol ? " €" : "";
  const abs = Math.abs(value);
  if (abs >= 1_000_000) {
    const millions = (value / 1_000_000).toLocaleString("de-DE", { maximumFractionDigits: 1 });
    return `${millions} Mio${suffix}`;
  }
  if (abs >= 1000) {
    return `${Math.round(value / 1000)}k${suffix}`;
  }
  return withSymbol ? formatEur(value) : String(Math.round(value));
}

/**
 * Always emits an explicit sign — "+1.234 €" or "−1.234 €" (typographic minus, not a
 * hyphen) — never bare. Signs must be unambiguous without colour: PRODUCT_SPEC §14.
 */
export function formatSignedEur(value: number, digits = 0): string {
  if (!Number.isFinite(value)) {
    return "—";
  }

  const amount = formatEur(Math.abs(value), digits);
  if (value > 0) return `+${amount}`;
  if (value < 0) return `−${amount}`;
  return amount;
}

export function formatSignedPct(value: number, digits = 1): string {
  if (!Number.isFinite(value)) {
    return "—";
  }

  const amount = formatPct(Math.abs(value), digits);
  if (value > 0) return `+${amount}`;
  if (value < 0) return `−${amount}`;
  return amount;
}
