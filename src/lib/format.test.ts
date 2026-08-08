import { describe, expect, it } from "vitest";
import {
  formatCompactEur,
  formatNumber,
  formatSignedEur,
  formatSignedPct,
  formatSignedYears,
  formatYears,
} from "./format";

describe("signed formatting", () => {
  it("never emits a misleading sign for zero", () => {
    expect(formatSignedEur(0)).not.toMatch(/^[+−]/);
    expect(formatSignedPct(0)).not.toMatch(/^[+−]/);
  });

  it("prefixes positive values with a plus", () => {
    expect(formatSignedEur(1234)).toMatch(/^\+/);
    expect(formatSignedPct(1.5)).toMatch(/^\+/);
  });

  it("prefixes negative values with a typographic minus, not a hyphen", () => {
    const eur = formatSignedEur(-1234);
    const pct = formatSignedPct(-1.5);

    expect(eur.startsWith("−")).toBe(true);
    expect(eur.startsWith("-")).toBe(false);
    expect(pct.startsWith("−")).toBe(true);
  });
});

describe("formatNumber", () => {
  it("uses a German decimal comma and never a raw float", () => {
    // The chart's last x is an exact payoff moment, not a whole year. Interpolated
    // raw it printed "Jahr 30.166666666666668" into German copy.
    expect(formatNumber(30.166666666666668)).toBe("30,2");
    expect(formatNumber(12)).toBe("12");
    expect(formatNumber(0)).toBe("0");
  });

  it("returns the em-dash placeholder for non-finite values, like its siblings", () => {
    expect(formatNumber(NaN)).toBe("—");
    expect(formatNumber(Infinity)).toBe("—");
  });
});

/**
 * The UI is German throughout, so a decimal point in a rendered number is a defect,
 * not a nitpick — several components had grown their own `toFixed()` and were printing
 * "1.5 Jahre" next to "1.234 €".
 */
describe("year and compact formatting", () => {
  it("uses a German decimal comma, never a point", () => {
    expect(formatYears(30.09)).toBe("30,1 Jahre");
    expect(formatSignedYears(-1.45)).toBe("−1,5 J.");
    expect(formatSignedYears(1.45)).toBe("+1,5 J.");
    expect(formatCompactEur(1_250_000)).toBe("1,3 Mio");
  });

  it("emits a typographic minus for negative years, not a hyphen", () => {
    expect(formatSignedYears(-2).startsWith("−")).toBe(true);
    expect(formatSignedYears(-2).startsWith("-")).toBe(false);
    expect(formatSignedYears(0)).toBe("0,0 J.");
  });

  it("guards non-finite values like every other formatter", () => {
    expect(formatYears(Infinity)).toBe("—");
    expect(formatYears(NaN)).toBe("—");
    expect(formatSignedYears(Infinity)).toBe("—");
    expect(formatCompactEur(NaN)).toBe("—");
  });

  it("keeps the euro sign optional so both charts can share one helper", () => {
    expect(formatCompactEur(6000)).toBe("6k");
    expect(formatCompactEur(6000, true)).toBe("6k €");
    expect(formatCompactEur(820, true)).toBe(formatSignedEur(820).replace("+", ""));
  });
});
