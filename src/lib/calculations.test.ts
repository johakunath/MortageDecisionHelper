import { describe, expect, it } from "vitest";
import {
  buildScenario,
  buildScenarios,
  buildWaitScenario,
  buildWaitScenarios,
  calculateCashNeeded,
  compareApartmentCases,
  compareEkScenarios,
  compareExternal,
  compareSpecialScenarios,
  evaluateDecision,
  interestForPlan,
  monthlyAnnuity,
  repaymentRateFromMonthlyPayment,
  repaymentRateFromRuntimeYears,
  requiredSpecialToMatch,
  runtimeYearsFromRepaymentRate,
  simulateMortgage,
} from "./calculations";
import { CASE_PRESETS, DEFAULT_INPUTS, DEFAULT_RATES, EK_SCENARIOS } from "./defaults";

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
    const scenario = buildScenario(EK_SCENARIOS[1], preset.inputs, preset.rates);

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
          selectedScenarioId: "ek10",
          annualSpecialRepayments: [0, 0, 0],
        },
        {
          id: "apartment-b",
          label: "Apartment B",
          purchasePrice: 700000,
          renovation: 10000,
          monthlyOwnershipCosts: 900,
          selectedScenarioId: "ek10",
          annualSpecialRepayments: [10000, 10000, 10000],
        },
      ],
      EK_SCENARIOS,
      DEFAULT_INPUTS,
      CASE_PRESETS.case720.rates,
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
    const now = buildScenario(EK_SCENARIOS[1], inputs, DEFAULT_RATES);
    const wait = buildWaitScenario(EK_SCENARIOS[1], now, inputs, DEFAULT_RATES);

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
      EK_SCENARIOS[1].ekRate,
      roomy.closingCostRate,
      roomy.renovation,
      roomy.moving,
    );

    const reserveOnly = buildScenario(
      EK_SCENARIOS[1],
      { ...roomy, availableCapital: cashNeeded + roomy.reserveTarget / 2 },
      DEFAULT_RATES,
    );
    const cannotAfford = buildScenario(
      EK_SCENARIOS[1],
      { ...roomy, availableCapital: cashNeeded - 10000 },
      DEFAULT_RATES,
    );

    expect(reserveOnly.cashLeft).toBeGreaterThan(0);
    expect(reserveOnly.diagnosis.failed).toContain("reserve");
    expect(reserveOnly.diagnosis.failed).not.toContain("cash");

    expect(cannotAfford.cashLeft).toBeLessThan(0);
    expect(cannotAfford.diagnosis.failed).toContain("cash");
  });

  it("measures the break-even against 15% EK without Sondertilgung (D1)", () => {
    const withoutSpecial = interestForPlan(EK_SCENARIOS[2], DEFAULT_INPUTS, DEFAULT_RATES, {
      kind: "none",
    });
    const withPath = interestForPlan(
      EK_SCENARIOS[2],
      DEFAULT_INPUTS,
      DEFAULT_RATES,
      { kind: "path", years: DEFAULT_INPUTS.annualSpecialRepayments },
    );

    // A 15% EK that also makes special repayments pays less interest, which would set a
    // harder bar. The chosen baseline is the one without.
    expect(withoutSpecial).toBeGreaterThan(withPath);

    const againstBaseline = requiredSpecialToMatch(
      EK_SCENARIOS[0],
      withoutSpecial,
      DEFAULT_INPUTS,
      DEFAULT_RATES,
    );
    const againstPath = requiredSpecialToMatch(
      EK_SCENARIOS[0],
      withPath,
      DEFAULT_INPUTS,
      DEFAULT_RATES,
    );

    expect(againstBaseline.amount).not.toBeNull();
    expect(againstBaseline.amount!).toBeLessThan(againstPath.amount ?? Infinity);
  });

  it("nets mortgage interest saved against foregone ETF growth over one horizon", () => {
    const scenarios = buildScenarios(EK_SCENARIOS, DEFAULT_INPUTS, DEFAULT_RATES);
    const tradeoff = compareEkScenarios(scenarios[0], scenarios[2], DEFAULT_INPUTS);

    expect(tradeoff.horizonYears).toBe(DEFAULT_INPUTS.fixedRateYears);
    expect(tradeoff.extraCashRequired).toBeGreaterThan(0);
    expect(tradeoff.interestSavedFixed).toBeGreaterThan(0);
    expect(tradeoff.netAdvantageFixed).toBeCloseTo(
      tradeoff.interestSavedFixed - tradeoff.etfForegone,
      6,
    );

    // A high enough assumed ETF return must be able to flip the conclusion.
    const optimistic = compareEkScenarios(scenarios[0], scenarios[2], {
      ...DEFAULT_INPUTS,
      etfReturnRate: 14,
    });
    expect(optimistic.netAdvantageFixed).toBeLessThan(tradeoff.netAdvantageFixed);
  });

  it("builds buy-now and waiting periods side by side", () => {
    const now = buildScenario(EK_SCENARIOS[1], DEFAULT_INPUTS, DEFAULT_RATES);
    const columns = buildWaitScenarios(
      EK_SCENARIOS[1],
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

  it("compares every EK level against a freely chosen baseline", () => {
    const against10 = compareSpecialScenarios(
      EK_SCENARIOS,
      "ek10",
      "none",
      DEFAULT_INPUTS,
      DEFAULT_RATES,
    );

    // The baseline row is itself, so it needs nothing and has no delta.
    const baselineRow = against10.rows.find((row) => row.base.id === "ek10")!;
    expect(baselineRow.isBaseline).toBe(true);
    expect(baselineRow.deltaToBaseline).toBeCloseTo(0, 6);
    expect(against10.baselineInterest).toBeCloseTo(baselineRow.interestNoSpecial, 6);

    // 5% EK borrows more, so it costs more interest and must repay extra to catch up.
    const row5 = against10.rows.find((row) => row.base.id === "ek5")!;
    expect(row5.deltaToBaseline).toBeGreaterThan(0);
    expect(row5.required.amount).not.toBeNull();

    // 15% EK is already cheaper than the 10% baseline, so it needs nothing.
    const row15 = against10.rows.find((row) => row.base.id === "ek15")!;
    expect(row15.deltaToBaseline).toBeLessThan(0);
    expect(row15.required.amount).toBe(0);

    // Moving the baseline to 15% raises the bar for 5% EK.
    const against15 = compareSpecialScenarios(
      EK_SCENARIOS,
      "ek15",
      "none",
      DEFAULT_INPUTS,
      DEFAULT_RATES,
    );
    const row5Against15 = against15.rows.find((row) => row.base.id === "ek5")!;
    expect(row5Against15.required.amount!).toBeGreaterThan(row5.required.amount!);
  });

  it("makes the baseline harder to reach when it runs its own Sondertilgung", () => {
    const vsPlain = compareSpecialScenarios(EK_SCENARIOS, "ek10", "none", DEFAULT_INPUTS, DEFAULT_RATES);
    const vsPlan = compareSpecialScenarios(EK_SCENARIOS, "ek10", "plan", DEFAULT_INPUTS, DEFAULT_RATES);

    // A baseline that also pays Sondertilgung ends up cheaper, so matching it costs more.
    expect(vsPlan.baselineInterest).toBeLessThan(vsPlain.baselineInterest);

    const plainRequired = vsPlain.rows.find((row) => row.base.id === "ek5")!.required.amount!;
    const planRequired = vsPlan.rows.find((row) => row.base.id === "ek5")!.required.amount;
    expect(planRequired === null || planRequired > plainRequired).toBe(true);
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

  it("flags external figures outside the tolerance band", () => {
    const scenario = buildScenario(EK_SCENARIOS[1], DEFAULT_INPUTS, DEFAULT_RATES);
    const monthly = scenario.mortgage.regularMonthlyPayment;
    const diffs = compareExternal(scenario, { monthlyPayment: monthly * 1.005 }, 1);

    expect(diffs).toHaveLength(1);
    expect(diffs[0].withinTolerance).toBe(true);
    expect(compareExternal(scenario, { monthlyPayment: monthly * 1.03 }, 1)[0].withinTolerance)
      .toBe(false);
  });
});
