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
