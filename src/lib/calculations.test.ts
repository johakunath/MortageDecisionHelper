import { describe, expect, it } from "vitest";
import {
  buildScenario,
  buildScenarios,
  calculateCashNeeded,
  evaluateDecision,
  monthlyAnnuity,
  simulateMortgage,
} from "./calculations";
import { CASE_PRESETS, EK_SCENARIOS } from "./defaults";

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
      annualSpecialRepayment: 0,
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
      annualSpecialRepayment: 20000,
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
      annualSpecialRepayment: 0,
      annualSpecialRepayments: [1000, 20000, 3000],
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
});
