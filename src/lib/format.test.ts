import { describe, expect, it } from "vitest";
import { formatSignedEur, formatSignedPct } from "./format";

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
