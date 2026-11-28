import { describe, expect, it } from "vitest";
import { repaymentRateFromMonthlyPayment, simulateMortgage } from "./calculations";
import { DEFAULT_APARTMENT_CASES } from "./defaults";

/**
 * The engine measured against the four bank offers of 27.11.2026 (BauDarlehen24,
 * Angebote 1a/1b/2a/2b on Henriette-Lustig-Straße 13). Like `offer.test.ts` and
 * `offer2026-11.test.ts`, only the financial parameters, no personal data.
 *
 * Two loan amounts, two Sollzinsbindungen, four banks, one price. The offers print a
 * Restschuld after ten years for all four, so the two 15-year offers are pinned twice:
 * once mid-binding and once at the end. That is what makes this set worth pinning —
 * a mid-binding Restschuld checks the schedule, not just its endpoint.
 *
 * Tolerance: 11 cents against the figures the offers print to the cent, 51 cents
 * against the ones they print rounded to whole euros.
 */

const CENTS = 0.11;
const EURO = 0.51;

const PRICE = 499000;
/** 6 % Grunderwerbsteuer + 2 % Notar/Grundbuch + 3,57 % Käufercourtage. */
const CLOSING_COST_RATE = 11.57;
const HAUSGELD = 428;

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

describe("bank offers of 27.11.2026", () => {
  it("1a · 10 % EK · Lloyds Bank · 10 Jahre", () => {
    expect(repaymentRateFromMonthlyPayment(444000, 4.17, 2571.5)).toBeCloseTo(2.78, 4);
    const run = single(444000, 4.17, 2571.5, 120);
    expect(Math.abs(run.remainingAfterFixed - 291173.42)).toBeLessThan(CENTS);
  });

  it("1b · 10 % EK · PSD Bank Nürnberg · 15 Jahre", () => {
    expect(repaymentRateFromMonthlyPayment(444000, 4.35, 2571.5)).toBeCloseTo(2.6, 4);
    // The offer prints both: where the loan stands after ten years, and at the end of
    // the binding. The same schedule has to produce both or neither.
    expect(Math.abs(single(444000, 4.35, 2571.5, 120).remainingAfterFixed - 299700)).toBeLessThan(EURO);
    expect(Math.abs(single(444000, 4.35, 2571.5, 180).remainingAfterFixed - 200362.89)).toBeLessThan(CENTS);
  });

  it("2a · 20 % EK · Commerzbank · 10 Jahre (die bevorzugte Variante)", () => {
    expect(repaymentRateFromMonthlyPayment(394000, 4.02, 2570.85)).toBeCloseTo(3.81, 4);
    const run = single(394000, 4.02, 2570.85, 120);
    expect(Math.abs(run.remainingAfterFixed - 209603.49)).toBeLessThan(CENTS);
  });

  it("2b · 20 % EK · OLB · 15 Jahre", () => {
    expect(repaymentRateFromMonthlyPayment(394000, 4.16, 2570.85)).toBeCloseTo(3.67, 4);
    expect(Math.abs(single(394000, 4.16, 2570.85, 120).remainingAfterFixed - 215061)).toBeLessThan(EURO);
    expect(Math.abs(single(394000, 4.16, 2570.85, 180).remainingAfterFixed - 93553.9)).toBeLessThan(CENTS);
  });

  it("reproduces the offers' Eigenkapital and Gesamtbelastung", () => {
    const closingCosts = PRICE * (CLOSING_COST_RATE / 100);
    expect(closingCosts).toBeCloseTo(57734.3, 2);
    // "Eigenkapital" on the offers is the down payment plus the Kaufnebenkosten.
    expect(PRICE - 444000 + closingCosts).toBeCloseTo(112734.3, 2);
    expect(PRICE - 394000 + closingCosts).toBeCloseTo(162734.3, 2);
    // Price and Kaufnebenkostensatz are not printed; both follow from EK + Darlehen.
    expect((112734.3 + 444000) / (1 + CLOSING_COST_RATE / 100)).toBeCloseTo(PRICE, 1);
    expect((162734.3 + 394000) / (1 + CLOSING_COST_RATE / 100)).toBeCloseTo(PRICE, 1);
    // "Gesamtbelastung mtl." = Kreditrate + Hausgeld, without the owner's extra.
    expect(2571.5 + HAUSGELD).toBeCloseTo(2999.5, 2);
    expect(2570.85 + HAUSGELD).toBeCloseTo(2998.85, 2);
  });

  it("ships these offers on the apartment (D47)", () => {
    const flat = DEFAULT_APARTMENT_CASES.find((apartment) => apartment.id === "flat-c")!;
    expect(flat.purchasePrice).toBe(PRICE);
    expect(flat.closingCostRate).toBe(CLOSING_COST_RATE);
    expect(flat.hausgeld).toBe(HAUSGELD);
    expect(flat.offerLoans).toEqual({ ek10: 444000, ek20: 394000 });
    expect(flat.rates[10].ek10).toBe(4.17);
    expect(flat.rates[10].ek20).toBe(4.02);
    expect(flat.rates[15].ek10).toBe(4.35);
    expect(flat.rates[15].ek20).toBe(4.16);
    // The shared Monatsrate is Variante 2a's; the 10 % offers run 0,65 € higher.
    expect(flat.monthlyPayment).toBe(2570.85);
    // 15 % EK has no offer: a rounded midpoint, flagged as an assumption in the note.
    expect(flat.rates[10].ek15).toBe(4.1);
    expect(flat.rates[15].ek15).toBe(4.26);
    expect(flat.ratesNote).toContain("Modellannahme");
    expect(flat.offerLoans?.ek15).toBeUndefined();
    // Pinned to the offer: no Sondertilgung in the base plan.
    expect(flat.annualSpecialRepayments.every((amount) => amount === 0)).toBe(true);
  });
});
