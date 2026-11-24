import { describe, expect, it } from "vitest";
import {
  kfwAnnuity,
  repaymentRateFromMonthlyPayment,
  simulateMortgage,
  simulateSplitLoan,
} from "./calculations";

/**
 * The engine measured against the four bank offers of 24.11.2026 (BauDarlehen24,
 * Angebote 1a/1b Lindenstraße and 2a/2b BUWOG Arbor, 10 Jahre Sollzinsbindung). Like
 * `offer.test.ts`, only the financial parameters, no personal data.
 *
 * The BUWOG offers are the first real check of the two-loan model (D44): a KfW 300 part
 * with its own rate, one repayment-free year and a 35-year term, beside a bank part that
 * takes the rest of the Monatsrate. Each part's Restschuld is pinned to the offer.
 *
 * Tolerance: 10 cents. The KfW part is the one at 10: the offer prints the annuity
 * rounded to 474,49 €, the engine carries 474,4905 €.
 */

const CENTS = 0.11;

function single(loan: number, ratePct: number, payment: number, months: number) {
  return simulateMortgage({
    principal: loan,
    interestRatePct: ratePct,
    repaymentRatePct: repaymentRateFromMonthlyPayment(loan, ratePct, payment),
    fixedRateYears: months / 12,
    specialPlan: { kind: "none" },
    specialRepaymentLimitRate: 5,
  });
}

describe("bank offers of 24.11.2026", () => {
  it("1a · Lindenstraße 90 % · HypoVereinsbank", () => {
    const run = single(445000, 4.11, 2369.63, 120);
    expect(Math.abs(run.remainingAfterFixed - 319774.73)).toBeLessThan(CENTS);
    // Not pinned: the offer's "Geleistete Zinszahlungen" (160.654,45 €) is 120 × Rate −
    // Tilgung + one more month of interest, a disbursement artefact the plan itself
    // does not show. The Restschuld and the Tilgung match.
    // "Vsl. Laufzeit 25 Jahre 2 Monate": the last, partial payment in 01/2052.
    expect(run.runtimeYears).toBeCloseTo(25 + 2 / 12, 9);
  });

  it("1b · Lindenstraße 85 % · Commerzbank", () => {
    const run = single(420850, 4.06, 2370.79, 120);
    expect(Math.abs(run.remainingAfterFixed - 280975.05)).toBeLessThan(CENTS);
    expect(run.runtimeYears).toBeCloseTo(22 + 8 / 12, 9);
  });

  it("2a · BUWOG 90 % · Deutsche Bank part, after one interest-only month", () => {
    // Paid out 01.12.2026, repayment from 01.01.2027: December carries interest only,
    // then 119 annuity months to the end of the binding.
    const run = single(413508, 4.01, 2195.04, 119);
    expect(Math.abs(run.remainingAfterFixed - 294905.9)).toBeLessThan(CENTS);
    expect(Math.abs(run.interestFixed + (413508 * 4.01) / 1200 - 143989.47)).toBeLessThan(CENTS);
    // "24 Jahre 11 Monate" including that first month.
    expect(run.runtimeYears + 1 / 12).toBeCloseTo(24 + 11 / 12, 9);
  });

  it("2b · BUWOG 85 % · Commerzbank part", () => {
    const run = single(380508, 3.94, 2194.26, 120);
    expect(Math.abs(run.remainingAfterFixed - 241807.17)).toBeLessThan(CENTS);
    // Interest not pinned: Commerzbank's first month is a one-day stub (paid out 30.12.),
    // which moves the interest total by about 42 € but not the Restschuld.
    expect(run.runtimeYears).toBeCloseTo(21.5, 9);
  });

  it("KfW 300 part · 170.000 € at 0,78 %, one free year, 35 years", () => {
    expect(Math.abs(kfwAnnuity(170000, 0.78, 35) - 474.49)).toBeLessThan(0.01);
    const run = simulateSplitLoan({
      bankPrincipal: 0,
      bankRatePct: 0,
      kfwPrincipal: 170000,
      kfwRatePct: 0.78,
      kfwTermYears: 35,
      monthlyPayment: kfwAnnuity(170000, 0.78, 35),
      fixedRateYears: 10,
      specialPlan: { kind: "none" },
      specialRepaymentLimitRate: 5,
    });
    expect(Math.abs(run.remainingAfterFixed - 129290.15)).toBeLessThan(CENTS);
    expect(Math.abs(run.interestFixed - 11861.07)).toBeLessThan(CENTS);
    expect(run.runtimeYears).toBeCloseTo(35, 9);
  });

  it("2b as one two-loan run reproduces the offer's combined Restschuld", () => {
    // The summary e-mail: "Restschuld nach 10 Jahren 371.097 €" = 241.807,17 + 129.290,15.
    const run = simulateSplitLoan({
      bankPrincipal: 380508,
      bankRatePct: 3.94,
      kfwPrincipal: 170000,
      kfwRatePct: 0.78,
      kfwTermYears: 35,
      monthlyPayment: 2668.75,
      fixedRateYears: 10,
      specialPlan: { kind: "none" },
      specialRepaymentLimitRate: 5,
    });
    expect(Math.abs(run.remainingAfterFixed - (241807.17 + 129290.15))).toBeLessThan(0.25);
    expect(run.amortises).toBe(true);
  });
});
