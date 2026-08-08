import { describe, expect, it } from "vitest";
import {
  buildScenario,
  buildScenarios,
  buildWaitScenario,
  buildWaitScenarios,
  calculateCashNeeded,
  compareApartmentCases,
  compareEkScenarios,
  compareSpecialScenarios,
  evaluateDecision,
  interestForPlan,
  monthlyAnnuity,
  normaliseFixedPeriod,
  rateFor,
  repaymentRateFromMonthlyPayment,
  repaymentRateFromRuntimeYears,
  requiredSpecialToMatch,
  runtimeYearsFromRepaymentRate,
  simulateMortgage,
  waitPeriodsFor,
  type ScenarioId,
} from "./calculations";
import { CASE_PRESETS, DEFAULT_INPUTS, DEFAULT_RATES, EK_SCENARIOS } from "./defaults";

/**
 * Scenarios are addressed by id, never by array position. Positional lookups survived
 * the 5/10/15 → 10/15/20 change without a single type error while silently testing a
 * different EK level than their comments claimed.
 */
const EK = (id: ScenarioId) => EK_SCENARIOS.find((scenario) => scenario.id === id)!;
const LOWEST = EK("ek10");
const MIDDLE = EK("ek15");
const HIGHEST = EK("ek20");

describe("calculation engine", () => {
  it("calculates the monthly annuity", () => {
    expect(monthlyAnnuity(100000, 3.6, 2.4)).toBeCloseTo(500, 6);
  });

  it("simulates positive interest and remaining debt after 10 years", () => {
    const simulation = simulateMortgage({
      principal: 100000,
      interestRatePct: 3,
      repaymentRatePct: 3,
      fixedRateYears: 10,
      specialPlan: { kind: "none" },
      specialRepaymentLimitRate: 5,
    });

    expect(simulation.interestTotal).toBeGreaterThan(0);
    expect(simulation.remainingAfterFixed).toBeGreaterThan(0);
  });

  it("caps annual Sondertilgung by the configured percentage of original loan", () => {
    const simulation = simulateMortgage({
      principal: 100000,
      interestRatePct: 3,
      repaymentRatePct: 3,
      fixedRateYears: 10,
      specialPlan: { kind: "flat", annual: 20000 },
      specialRepaymentLimitRate: 5,
    });

    expect(simulation.usedAnnualSpecial).toBe(5000);
  });

  it("supports concrete yearly Sondertilgung values and caps each year", () => {
    const simulation = simulateMortgage({
      principal: 100000,
      interestRatePct: 3,
      repaymentRatePct: 3,
      fixedRateYears: 10,
      specialPlan: { kind: "path", years: [1000, 20000, 3000] },
      specialRepaymentLimitRate: 5,
    });

    expect(simulation.usedAnnualSpecialRepayments[0]).toBe(1000);
    expect(simulation.usedAnnualSpecialRepayments[1]).toBe(5000);
  });

  it("calculates cash needed as down payment plus costs, renovation, and moving", () => {
    expect(calculateCashNeeded(600000, 10, 9, 15000, 5000)).toBe(134000);
  });

  it("includes property value and net worth in each scenario", () => {
    const preset = CASE_PRESETS.case720;
    const scenario = buildScenario(MIDDLE, preset.inputs, preset.rates);

    expect(scenario.propertyValueAtPayoff).toBeGreaterThan(preset.inputs.purchasePrice);
    expect(Number.isFinite(scenario.netWorthAtPayoff)).toBe(true);
  });

  it("marks the 850k stress preset as no clean scenario", () => {
    const preset = CASE_PRESETS.case850;
    const scenarios = buildScenarios(EK_SCENARIOS, preset.inputs, preset.rates);
    const decision = evaluateDecision(scenarios);

    expect(decision.noSafeScenario).toBe(true);
    expect(decision.recommendation).toBeNull();
  });

  it("keeps the 600k preset clean when at least one scenario is feasible", () => {
    const preset = CASE_PRESETS.case600;
    const scenarios = buildScenarios(EK_SCENARIOS, preset.inputs, preset.rates);
    const decision = evaluateDecision(scenarios);

    expect(decision.noSafeScenario).toBe(false);
    expect(decision.feasibleScenarios.length).toBeGreaterThan(0);
  });

  it("compares apartment cases with independent prices and Sondertilgung paths", () => {
    const results = compareApartmentCases(
      [
        {
          id: "apartment-a",
          label: "Apartment A",
          purchasePrice: 600000,
          renovation: 0,
          monthlyOwnershipCosts: 700,
          annualSpecialRepayments: [0, 0, 0],
        },
        {
          id: "apartment-b",
          label: "Apartment B",
          purchasePrice: 700000,
          renovation: 10000,
          monthlyOwnershipCosts: 900,
          annualSpecialRepayments: [10000, 10000, 10000],
        },
      ],
      EK_SCENARIOS,
      DEFAULT_INPUTS,
      CASE_PRESETS.case720.rates,
      "ek10",
    );

    expect(results[0].inputs.purchasePrice).toBe(600000);
    expect(results[1].inputs.purchasePrice).toBe(700000);
    expect(results[0].selectedScenario.loan).toBeLessThan(results[1].selectedScenario.loan);
    expect(results[0].selectedScenario.mortgage.usedAnnualSpecialRepayments[0]).toBe(0);
    expect(results[1].selectedScenario.mortgage.usedAnnualSpecialRepayments[0]).toBe(10000);
  });

  // --- Phase 1 regressions -------------------------------------------------

  it("does not subtract rent from capital while waiting (D4)", () => {
    const inputs = { ...DEFAULT_INPUTS, waitMonths: 12, waitSavingsMonthly: 1500 };
    const now = buildScenario(MIDDLE, inputs, DEFAULT_RATES);
    const wait = buildWaitScenario(MIDDLE, now, inputs, DEFAULT_RATES);

    expect(wait.saved).toBe(18000);
    expect(wait.adjustedAvailableCapital).toBe(inputs.availableCapital + 18000);
    // Rent is still reported, just never deducted.
    expect(wait.rentPaid).toBe(23640);
  });

  it("stops special repayments after the entered path ends (K2)", () => {
    const shared = {
      principal: 400000,
      interestRatePct: 3,
      repaymentRatePct: 2,
      fixedRateYears: 10,
      specialRepaymentLimitRate: 5,
    };
    const path = simulateMortgage({
      ...shared,
      specialPlan: { kind: "path", years: Array.from({ length: 10 }, () => 6000) },
    });
    const flat = simulateMortgage({ ...shared, specialPlan: { kind: "flat", annual: 6000 } });

    expect(path.usedAnnualSpecialRepayments[10] ?? 0).toBe(0);
    // A plan that stops must cost more interest than one that runs forever.
    expect(path.interestTotal).toBeGreaterThan(flat.interestTotal);
  });

  it("returns no winners and does not throw for an empty scenario list", () => {
    const decision = evaluateDecision([]);

    expect(decision.noSafeScenario).toBe(true);
    expect(decision.recommendation).toBeNull();
    expect(decision.costMinimum).toBeNull();
    expect(decision.liquidityMaximum).toBeNull();
    expect(decision.monthlyMinimum).toBeNull();
  });

  it("names no winner when no scenario is clean (spec 5.3)", () => {
    const preset = CASE_PRESETS.case850;
    const decision = evaluateDecision(
      buildScenarios(EK_SCENARIOS, preset.inputs, preset.rates),
    );

    expect(decision.noSafeScenario).toBe(true);
    expect(decision.costMinimum).toBeNull();
    expect(decision.liquidityMaximum).toBeNull();
    expect(decision.monthlyMinimum).toBeNull();
    expect(decision.diagnosis.narrowestMiss).not.toBeNull();
  });

  it("honours a configurable burden threshold", () => {
    const preset = CASE_PRESETS.case600;
    const relaxed = evaluateDecision(
      buildScenarios(EK_SCENARIOS, preset.inputs, preset.rates),
    );
    const strict = evaluateDecision(
      buildScenarios(EK_SCENARIOS, { ...preset.inputs, maxBurdenRate: 15 }, preset.rates),
    );

    expect(relaxed.noSafeScenario).toBe(false);
    expect(strict.noSafeScenario).toBe(true);
    expect(strict.diagnosis.failedInAll).toContain("burden");
  });

  it("distinguishes an unaffordable purchase from a thin reserve", () => {
    const roomy = {
      ...DEFAULT_INPUTS,
      purchasePrice: 600000,
      householdNetIncome: 20000,
      reserveTarget: 20000,
    };

    // Derived, not hardcoded: the two cases are defined by their position relative to
    // cashNeeded, so they keep testing the same distinction whatever the defaults do.
    const cashNeeded = calculateCashNeeded(
      roomy.purchasePrice,
      MIDDLE.ekRate,
      roomy.closingCostRate,
      roomy.renovation,
      roomy.moving,
    );

    const reserveOnly = buildScenario(
      MIDDLE,
      { ...roomy, availableCapital: cashNeeded + roomy.reserveTarget / 2 },
      DEFAULT_RATES,
    );
    const cannotAfford = buildScenario(
      MIDDLE,
      { ...roomy, availableCapital: cashNeeded - 10000 },
      DEFAULT_RATES,
    );

    expect(reserveOnly.cashLeft).toBeGreaterThan(0);
    expect(reserveOnly.diagnosis.failed).toContain("reserve");
    expect(reserveOnly.diagnosis.failed).not.toContain("cash");

    expect(cannotAfford.cashLeft).toBeLessThan(0);
    expect(cannotAfford.diagnosis.failed).toContain("cash");
  });

  it("measures the break-even against the target without Sondertilgung (D1)", () => {
    const withoutSpecial = interestForPlan(HIGHEST, DEFAULT_INPUTS, DEFAULT_RATES, {
      kind: "none",
    });
    const withPath = interestForPlan(
      HIGHEST,
      DEFAULT_INPUTS,
      DEFAULT_RATES,
      { kind: "path", years: DEFAULT_INPUTS.annualSpecialRepayments },
    );

    // A target that also makes special repayments pays less interest, which would set a
    // harder bar. The chosen baseline is the one without.
    expect(withoutSpecial).toBeGreaterThan(withPath);

    const againstBaseline = requiredSpecialToMatch(
      LOWEST,
      withoutSpecial,
      DEFAULT_INPUTS,
      DEFAULT_RATES,
    );
    const againstPath = requiredSpecialToMatch(
      LOWEST,
      withPath,
      DEFAULT_INPUTS,
      DEFAULT_RATES,
    );

    expect(againstBaseline.amount).not.toBeNull();
    expect(againstBaseline.amount!).toBeLessThan(againstPath.amount ?? Infinity);
  });

  it("nets mortgage interest saved against foregone ETF growth over one horizon", () => {
    const scenarios = buildScenarios(EK_SCENARIOS, DEFAULT_INPUTS, DEFAULT_RATES);
    const [least, ...rest] = scenarios;
    const most = rest[rest.length - 1];
    const tradeoff = compareEkScenarios(least, most, DEFAULT_INPUTS);

    expect(tradeoff.horizonYears).toBe(DEFAULT_INPUTS.fixedRateYears);
    expect(tradeoff.extraCashRequired).toBeGreaterThan(0);
    expect(tradeoff.interestSavedFixed).toBeGreaterThan(0);
    // At a constant monthly rate the monthly cost cannot move; the runtime is what does.
    expect(tradeoff.monthlyDelta).toBeCloseTo(0, 6);
    expect(tradeoff.runtimeDelta).toBeLessThan(0);
    expect(tradeoff.netAdvantageFixed).toBeCloseTo(
      tradeoff.interestSavedFixed - tradeoff.etfForegone,
      6,
    );

    // A high enough assumed ETF return must be able to flip the conclusion.
    const optimistic = compareEkScenarios(least, most, {
      ...DEFAULT_INPUTS,
      etfReturnRate: 14,
    });
    expect(optimistic.netAdvantageFixed).toBeLessThan(tradeoff.netAdvantageFixed);
  });

  it("gives the entered Wartezeit its own column", () => {
    // The default coincides with a reference period, so it must NOT add a duplicate.
    expect(waitPeriodsFor(12)).toEqual([0, 12, 24]);
    expect(waitPeriodsFor(24)).toEqual([0, 12, 24]);

    // Anything else earns a column of its own, in chronological order — without one,
    // "Wartezeit" was an input the table ignored.
    expect(waitPeriodsFor(18)).toEqual([0, 12, 18, 24]);
    expect(waitPeriodsFor(36)).toEqual([0, 12, 24, 36]);

    // Nothing a number input can emit may produce a bogus column.
    expect(waitPeriodsFor(0)).toEqual([0, 12, 24]);
    expect(waitPeriodsFor(-5)).toEqual([0, 12, 24]);
    expect(waitPeriodsFor(NaN)).toEqual([0, 12, 24]);
    expect(waitPeriodsFor(18.4)).toEqual([0, 12, 18, 24]);
  });

  it("builds buy-now and waiting periods side by side", () => {
    const now = buildScenario(MIDDLE, DEFAULT_INPUTS, DEFAULT_RATES);
    const columns = buildWaitScenarios(
      MIDDLE,
      now,
      DEFAULT_INPUTS,
      DEFAULT_RATES,
      [0, 12, 24],
    );

    expect(columns).toHaveLength(3);
    expect(columns[0].waitMonths).toBe(0);
    expect(columns[0].saved).toBe(0);
    expect(columns[0].rentPaid).toBe(0);
    expect(columns[0].deltaInterest).toBeCloseTo(0, 6);
    expect(columns[2].adjustedAvailableCapital).toBeGreaterThan(
      columns[1].adjustedAvailableCapital,
    );
  });

  it("measures every EK level against the selected one running its plan", () => {
    const fromLowest = compareSpecialScenarios(
      EK_SCENARIOS,
      LOWEST.id,
      DEFAULT_INPUTS,
      DEFAULT_RATES,
    );

    // The selected row is the reference, so it has no catch-up of its own.
    const selectedRow = fromLowest.rows.find((row) => row.isSelected)!;
    expect(selectedRow.base.id).toBe(LOWEST.id);
    expect(selectedRow.catchUp).toBeNull();

    // The plan can only reduce interest, never raise it.
    expect(fromLowest.planSaving).toBeLessThan(0);
    expect(fromLowest.selectionInterestWithPlan).toBeLessThan(
      fromLowest.selectionInterestNoSpecial,
    );
  });

  it("names the side that has to pay to close the gap", () => {
    // From the lowest EK level, a higher one is cheaper even without Sondertilgung —
    // so it is OUR side that would have to pay to catch up.
    const fromLowest = compareSpecialScenarios(EK_SCENARIOS, LOWEST.id, DEFAULT_INPUTS, DEFAULT_RATES);
    const higher = fromLowest.rows.find((row) => row.base.id === HIGHEST.id)!;
    expect(higher.deltaToSelection).toBeLessThan(0);
    expect(higher.catchUp!.payer).toBe("selection");

    // From the highest EK level with a plan running, the lower one is behind and it is
    // THAT row which would have to pay. The direction must actually flip.
    const fromHighest = compareSpecialScenarios(EK_SCENARIOS, HIGHEST.id, DEFAULT_INPUTS, DEFAULT_RATES);
    const lower = fromHighest.rows.find((row) => row.base.id === LOWEST.id)!;
    expect(lower.deltaToSelection).toBeGreaterThan(0);
    expect(lower.catchUp!.payer).toBe("row");
  });

  it("decides 'covered' on the modelled path, not on the plan's average (D22)", () => {
    const fromLowest = compareSpecialScenarios(EK_SCENARIOS, LOWEST.id, DEFAULT_INPUTS, DEFAULT_RATES);
    const higher = fromLowest.rows.find((row) => row.base.id === HIGHEST.id)!;
    const catchUp = higher.catchUp!;

    // The exact trap: the ten-year 6.000 €/Jahr plan averages MORE than the flat amount
    // the catch-up asks for, and still pays more interest, because the flat amount runs
    // for the whole runtime and the plan stops after year ten.
    expect(catchUp.payer).toBe("selection");
    expect(catchUp.amount).not.toBeNull();
    expect(DEFAULT_INPUTS.annualSpecialRepayment).toBeGreaterThan(catchUp.amount!);
    expect(catchUp.planCovers).toBe(false);
    expect(catchUp.planShortfall).toBeGreaterThan(0);

    // The shortfall is the modelled gap, so it must reconcile with the row's own delta.
    expect(catchUp.targetInterest).toBeCloseTo(higher.interestNoSpecial, 6);
    expect(catchUp.payerInterestWithPlan).toBeCloseTo(fromLowest.selectionInterestWithPlan, 6);
    expect(catchUp.planShortfall).toBeCloseTo(-higher.deltaToSelection, 6);
  });

  it("reports the catch-up as covered once the path really reaches the target", () => {
    // Same defaults, but the plan runs long enough and high enough to actually get there.
    const generous = {
      ...DEFAULT_INPUTS,
      annualSpecialRepayments: Array.from({ length: 30 }, () => 20000),
      annualSpecialRepayment: 20000,
    };
    const comparison = compareSpecialScenarios(EK_SCENARIOS, LOWEST.id, generous, DEFAULT_RATES);
    const higher = comparison.rows.find((row) => row.base.id === HIGHEST.id)!;

    // With the selection now cheaper than the untouched higher level, the payer flips to
    // that row — and our side is recorded as needing nothing.
    expect(comparison.selectionInterestWithPlan).toBeLessThan(higher.interestNoSpecial);
    expect(higher.catchUp!.payer).toBe("row");
    expect(higher.catchUp!.planShortfall).toBeLessThanOrEqual(0);
    expect(higher.catchUp!.planCovers).toBe(true);
  });

  it("raises the required catch-up as the target gets cheaper", () => {
    const modest = compareSpecialScenarios(EK_SCENARIOS, LOWEST.id, DEFAULT_INPUTS, DEFAULT_RATES);
    const modestNeeded = modest.rows.find((row) => row.base.id === MIDDLE.id)!.catchUp!;

    // A higher EK level is a cheaper target still, so reaching it costs our side more.
    const steeper = modest.rows.find((row) => row.base.id === HIGHEST.id)!.catchUp!;
    expect(steeper.payer).toBe("selection");
    if (modestNeeded.amount != null && steeper.amount != null) {
      expect(steeper.amount).toBeGreaterThan(modestNeeded.amount);
    } else {
      // Unreachable under the contractual cap is the stronger form of "costs more".
      expect(steeper.amount).toBeNull();
    }
  });

  it("resolves the Sollzins by EK level and Zinsbindung independently", () => {
    // Both axes matter: same EK level, different binding, different rate.
    expect(rateFor(DEFAULT_RATES, 10, "ek10")).toBe(DEFAULT_RATES[10].ek10);
    expect(rateFor(DEFAULT_RATES, 15, "ek10")).toBe(DEFAULT_RATES[15].ek10);
    expect(rateFor(DEFAULT_RATES, 10, "ek10")).not.toBe(rateFor(DEFAULT_RATES, 15, "ek10"));

    // The offer prices 10% and 15% EK identically at a 15-year binding. The model must
    // carry that through rather than assuming more Eigenkapital is always cheaper.
    expect(rateFor(DEFAULT_RATES, 15, "ek15")).toBe(rateFor(DEFAULT_RATES, 15, "ek10"));

    // An unsupported binding — e.g. a state saved when 20 years was still offered —
    // must land on a real column instead of producing undefined.
    expect(normaliseFixedPeriod(20)).toBe(15);
    expect(normaliseFixedPeriod(5)).toBe(10);
    expect(rateFor(DEFAULT_RATES, 20, "ek20")).toBe(DEFAULT_RATES[15].ek20);
  });

  it("holds the monthly rate constant and lets Tilgung and runtime move (D14)", () => {
    const scenarios = buildScenarios(EK_SCENARIOS, DEFAULT_INPUTS, DEFAULT_RATES);

    for (const scenario of scenarios) {
      expect(scenario.mortgage.regularMonthlyPayment).toBeCloseTo(DEFAULT_INPUTS.monthlyPayment, 6);
    }

    // More Eigenkapital, same rate: a larger share repays capital, so the loan clears
    // sooner. This is the comparison the bank's own offers make.
    for (let i = 1; i < scenarios.length; i += 1) {
      expect(scenarios[i].repaymentRate).toBeGreaterThan(scenarios[i - 1].repaymentRate);
      expect(scenarios[i].mortgage.runtimeYears).toBeLessThan(scenarios[i - 1].mortgage.runtimeYears);
    }
  });

  it("refuses a monthly rate that does not cover the interest", () => {
    const scenario = buildScenario(
      LOWEST,
      { ...DEFAULT_INPUTS, monthlyPayment: 200 },
      DEFAULT_RATES,
    );

    expect(scenario.diagnosis.failed).toContain("payment");
    expect(scenario.feasible).toBe(false);
    // The point is to say "this does not work", not to report an 80-year runtime.
    expect(scenario.status).toBe("Rate zu niedrig");
  });

  it("round-trips repayment rate through runtime and monthly payment", () => {
    const rate = 3.85;
    const loan = 540000;

    // Tilgungssatz -> Laufzeit -> Tilgungssatz must return the original.
    const runtime = runtimeYearsFromRepaymentRate(rate, 2.4);
    expect(runtime).toBeGreaterThan(20);
    expect(runtime).toBeLessThan(30);
    expect(repaymentRateFromRuntimeYears(rate, runtime)).toBeCloseTo(2.4, 4);

    // Tilgungssatz -> Monatsrate -> Tilgungssatz must return the original.
    const payment = monthlyAnnuity(loan, rate, 2.4);
    expect(repaymentRateFromMonthlyPayment(loan, rate, payment)).toBeCloseTo(2.4, 6);

    // Higher repayment must shorten the runtime, never lengthen it.
    expect(runtimeYearsFromRepaymentRate(rate, 3.5)).toBeLessThan(runtime);
  });

  it("handles the zero-interest edge case in the annuity conversions", () => {
    // With no interest the loan amortises linearly: 2% per year takes 50 years.
    expect(runtimeYearsFromRepaymentRate(0, 2)).toBeCloseTo(50, 6);
    expect(repaymentRateFromRuntimeYears(0, 50)).toBeCloseTo(2, 6);
    // A repayment rate that never clears the interest must not report a finite runtime.
    expect(runtimeYearsFromRepaymentRate(3, 0)).toBe(Infinity);
  });

  it("flags a Monatsrate the model had to raise to simulate at all (K14)", () => {
    const inputs = { ...DEFAULT_INPUTS, monthlyPayment: 1200 };
    const scenario = buildScenario(LOWEST, inputs, DEFAULT_RATES);

    // 405.000 € at 3,87% costs about 1.306 €/Monat in interest alone, so 1.200 € can
    // never repay it. The Tilgungssatz floor means the model simulates a higher rate.
    expect(scenario.diagnosis.failed).toContain("payment");
    expect(scenario.paymentSubstituted).toBe(true);
    expect(scenario.mortgage.regularMonthlyPayment).toBeGreaterThan(inputs.monthlyPayment);

    // A rate that does amortise is simulated exactly as entered — no silent bump, and
    // therefore nothing for the UI to warn about.
    const honest = buildScenario(LOWEST, DEFAULT_INPUTS, DEFAULT_RATES);
    expect(honest.paymentSubstituted).toBe(false);
    expect(honest.mortgage.regularMonthlyPayment).toBeCloseTo(DEFAULT_INPUTS.monthlyPayment, 6);

    // Do not hide a substitution merely because it is less than the 50-cent display
    // rounding threshold. The model's 0,01% floor is 3,375 €/month above interest-only
    // for this loan; a payment 25 cents below it still activates the floor.
    const minimumModelledPayment =
      (honest.loan * (honest.interestRate + 0.01)) / 1200;
    const boundary = buildScenario(LOWEST, {
      ...DEFAULT_INPUTS,
      monthlyPayment: minimumModelledPayment - 0.25,
    }, DEFAULT_RATES);
    expect(boundary.mortgage.regularMonthlyPayment - boundary.diagnosis.checks[0].actual)
      .toBeCloseTo(0.25, 6);
    expect(boundary.paymentSubstituted).toBe(true);
  });
});
