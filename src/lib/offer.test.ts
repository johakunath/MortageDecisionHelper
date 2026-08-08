import { describe, expect, it } from "vitest";
import { simulateMortgage, repaymentRateFromMonthlyPayment } from "./calculations";

/**
 * The engine measured against a real document rather than against itself.
 *
 * Source: Finanzierungsangebot vom 07.08.2026, Varianten 1A–3B (90% / 85% / 80%
 * Finanzierung × 10 / 15 Jahre Sollzinsbindung), Kaufpreis 450.000 €. Deliberately no
 * personal data from that PDF here — only the financial parameters.
 *
 * Every other test in this repo checks that the model is self-consistent. This one
 * checks that it is *right*: if a refactor quietly changes how interest accrues or
 * when a payment lands, these numbers move and nothing else has to notice.
 */

type Variant = {
  id: string;
  loan: number;
  interestRatePct: number;
  monthlyPayment: number;
  fixedRateYears: number;
  /** "Geleistete Zinszahlungen" over the Zinsbindung, per the offer. */
  interestFixed: number;
  /** "Vsl. Restschuld" at the end of the Zinsbindung, per the offer. */
  remaining: number;
};

const VARIANTS: Variant[] = [
  { id: "1A · 90% · 10 J.", loan: 405000, interestRatePct: 3.87, monthlyPayment: 1900.0, fixedRateYears: 10, interestFixed: 141148.78, remaining: 318148.78 },
  { id: "1B · 90% · 15 J.", loan: 405000, interestRatePct: 4.06, monthlyPayment: 1900.0, fixedRateYears: 15, interestFixed: 210992.07, remaining: 273992.07 },
  { id: "2A · 85% · 10 J.", loan: 382000, interestRatePct: 3.86, monthlyPayment: 1865.43, fixedRateYears: 10, interestFixed: 130791.89, remaining: 288940.29 },
  { id: "2B · 85% · 15 J.", loan: 382000, interestRatePct: 4.06, monthlyPayment: 1900.0, fixedRateYears: 15, interestFixed: 191747.95, remaining: 231747.95 },
  { id: "3A · 80% · 10 J.", loan: 359000, interestRatePct: 3.76, monthlyPayment: 1900.0, fixedRateYears: 10, interestFixed: 115294.48, remaining: 246294.48 },
  { id: "3B · 80% · 15 J.", loan: 359000, interestRatePct: 3.96, monthlyPayment: 1900.0, fixedRateYears: 15, interestFixed: 166545.94, remaining: 183545.94 },
];

function runVariant(variant: Variant) {
  return simulateMortgage({
    principal: variant.loan,
    interestRatePct: variant.interestRatePct,
    repaymentRatePct: repaymentRateFromMonthlyPayment(
      variant.loan,
      variant.interestRatePct,
      variant.monthlyPayment,
    ),
    fixedRateYears: variant.fixedRateYears,
    specialPlan: { kind: "none" },
    specialRepaymentLimitRate: 5,
  });
}

describe("Finanzierungsangebot 1A–3B", () => {
  it.each(VARIANTS)("reproduces variant $id", (variant) => {
    const result = runVariant(variant);

    expect(result.regularMonthlyPayment).toBeCloseTo(variant.monthlyPayment, 2);
    // One euro of tolerance over ten to fifteen years: anything wider would let a real
    // change in the amortisation order slip through unnoticed.
    expect(result.interestFixed).toBeCloseTo(variant.interestFixed, -0.5);
    expect(Math.abs(result.interestFixed - variant.interestFixed)).toBeLessThan(1);
    expect(Math.abs(result.remainingAfterFixed - variant.remaining)).toBeLessThan(1);
  });

  it("matches variant 1A's Tilgungsplan month by month", () => {
    // Auszahlung 01.09.2026, erste Rate 09/2026. The offer prints the first four months
    // individually and then year-end balances.
    const variant = VARIANTS[0];
    const monthlyRate = variant.interestRatePct / 100 / 12;
    let balance = variant.loan;
    const balances: number[] = [];
    for (let month = 1; month <= 124; month += 1) {
      const interest = balance * monthlyRate;
      balance -= variant.monthlyPayment - interest;
      balances[month] = balance;
    }

    // 09/2026, 12/2026, 12/2027, 12/2036 from the printed plan.
    expect(balances[1]).toBeCloseTo(404406.13, 1);
    expect(balances[4]).toBeCloseTo(402612.99, 1);
    expect(balances[16]).toBeCloseTo(395264.68, 1);
    expect(balances[124]).toBeCloseTo(314635.95, 1);

    // First month split: 1.306,13 € Zins / 593,87 € Tilgung.
    expect(variant.loan * monthlyRate).toBeCloseTo(1306.13, 1);
  });

  it("pays variant 1A off in 30 years and 2 months, as the offer states", () => {
    const result = runVariant(VARIANTS[0]);
    expect(Math.round(result.runtimeYears * 12)).toBe(362);
  });

  it("derives the offer's Tilgungssatz from its monthly rate", () => {
    // The offer rounds it to 1,76 %; the exact value is what reproduces the plan.
    const derived = repaymentRateFromMonthlyPayment(405000, 3.87, 1900);
    expect(derived).toBeCloseTo(1.76, 2);
  });

  it("allows the contractual 5% Sondertilgung on the original loan", () => {
    const result = runVariant(VARIANTS[0]);
    expect(result.maxAnnualSpecial).toBeCloseTo(20250, 6);
  });
});
