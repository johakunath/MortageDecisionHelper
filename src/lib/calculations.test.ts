import { describe, expect, it } from "vitest";
import {
  afterTaxAnnualReturn,
  apartmentColumn,
  bindingMonths,
  blendedRate,
  kfwAnnuity,
  loanFor,
  simulateSplitLoan,
  type MortgageMonth,
  type SpecialPlan,
  buildApartmentInputs,
  buildScenario,
  buildScenarios,
  buildWaitScenario,
  buildWaitScenarios,
  calculateCashNeeded,
  compareApartmentCases,
  compareEkScenarios,
  compareSpecialScenarios,
  ekStepReturn,
  evaluateDecision,
  interestForPlan,
  monthlyAnnuity,
  normaliseFixedPeriod,
  planFromInputs,
  rateFor,
  refinanceStress,
  repaymentRateFromMonthlyPayment,
  repaymentRateFromRuntimeYears,
  requiredSpecialToMatch,
  runtimeYearsFromRepaymentRate,
  scenarioWealthAtHorizon,
  simulateMortgage,
  specialPlanEffect,
  waitPeriodsFor,
  waitTippingPoints,
  wealthAtHorizon,
  type ScenarioId,
} from "./calculations";
import {
  CASE_PRESETS,
  DEFAULT_APARTMENT_CASES,
  DEFAULT_INPUTS,
  DEFAULT_RATES,
  OFFER_RATES,
  EK_SCENARIOS,
} from "./defaults";

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

  it("builds an apartment's ownership costs from its Hausgeld plus the owner's extra (D35)", () => {
    const apartment = { ...DEFAULT_APARTMENT_CASES[0], hausgeld: 400 };
    const inputs = buildApartmentInputs({ ...DEFAULT_INPUTS, ownerExtraMonthly: 75 }, apartment);
    expect(inputs.monthlyOwnershipCosts).toBe(475);

    // The split did not move a single default figure: the old totals were 640/690/760 €.
    // Only the first two are still placeholders — `flat-c` carries a real Hausgeld from
    // the Wirtschaftsplan since D47 (428 + 90 = 518 €), so its old 760 € is gone on purpose.
    expect(
      DEFAULT_APARTMENT_CASES.slice(0, 2).map(
        (flat) => buildApartmentInputs(DEFAULT_INPUTS, flat).monthlyOwnershipCosts,
      ),
    ).toEqual([640, 690]);
    expect(buildApartmentInputs(DEFAULT_INPUTS, DEFAULT_APARTMENT_CASES[2]).monthlyOwnershipCosts).toBe(518);
  });

  it("calculates cash needed as down payment plus costs, renovation, and moving", () => {
    expect(calculateCashNeeded(600000, 10, 9, 15000, 5000)).toBe(134000);
  });

  it("values every EK level's wealth on the same date, not at its own payoff (K19)", () => {
    // The old "Nettovermögen" grew the flat until each scenario's own payoff year, so
    // the longest loan looked richest. On one date the flat is worth the same at every
    // EK level, and only debt and free capital tell the levels apart.
    const preset = CASE_PRESETS.case720;
    const paths = EK_SCENARIOS.map((base) =>
      wealthAtHorizon({ base, inputs: preset.inputs, rates: preset.rates }),
    );

    expect(paths[0].propertyValue).toBeGreaterThan(preset.inputs.purchasePrice);
    expect(new Set(paths.map((path) => path.propertyValue)).size).toBe(1);
    expect(paths.every((path) => path.horizonMonths === preset.inputs.fixedRateYears * 12)).toBe(true);
  });

  it("marks the 850k stress preset as no clean scenario", () => {
    const preset = CASE_PRESETS.case850;
    const scenarios = buildScenarios(EK_SCENARIOS, preset.inputs, preset.rates);
    const decision = evaluateDecision(scenarios);

    expect(decision.noSafeScenario).toBe(true);
    expect(decision.feasibleScenarios).toHaveLength(0);
  });

  it("keeps the 600k preset clean when at least one scenario is feasible", () => {
    const preset = CASE_PRESETS.case600;
    const scenarios = buildScenarios(EK_SCENARIOS, preset.inputs, preset.rates);
    const decision = evaluateDecision(scenarios);

    expect(decision.noSafeScenario).toBe(false);
    expect(decision.feasibleScenarios.length).toBeGreaterThan(0);
  });

  it("takes the Kaufnebenkosten from the apartment, not from a global (D40)", () => {
    const withMakler = buildApartmentInputs(
      { ...DEFAULT_INPUTS, closingCostRate: 3 },
      { ...DEFAULT_APARTMENT_CASES[0], purchasePrice: 655100, closingCostRate: 11.57 },
    );
    const direct = buildApartmentInputs(
      { ...DEFAULT_INPUTS, closingCostRate: 3 },
      { ...DEFAULT_APARTMENT_CASES[0], purchasePrice: 655100, closingCostRate: 8 },
    );
    const [makler] = buildScenarios(EK_SCENARIOS, withMakler, OFFER_RATES);
    const [developer] = buildScenarios(EK_SCENARIOS, direct, OFFER_RATES);
    // The Shortlist Sheet's own figure for BUWOG: 52.408 € on 655.100 €.
    expect(developer.closingCosts).toBeCloseTo(52408, 0);
    expect(makler.closingCosts - developer.closingCosts).toBeCloseTo(655100 * 0.0357, 0);
  });

  it("takes the loan from the apartment's offer, and only for a purchase today (D45)", () => {
    const flat = {
      ...DEFAULT_APARTMENT_CASES[0],
      purchasePrice: 500000,
      closingCostRate: 11.57,
      renovation: 12000,
      offerLoans: { ek10: 445000 },
    };
    const inputs = buildApartmentInputs(DEFAULT_INPUTS, flat);
    const [ek10, ek15] = buildScenarios(EK_SCENARIOS, inputs, OFFER_RATES);
    // The offer's 445.000 €, not 90 % of the price; the rest is down payment.
    expect(loanFor(EK_SCENARIOS[0], inputs)).toBe(445000);
    expect(ek10.loan).toBe(445000);
    expect(ek10.downPayment).toBe(55000);
    // Offer EK 112.850 € (55.000 + 57.850 KNK), plus the kitchen the offer leaves out.
    expect(ek10.cashNeeded).toBeCloseTo(112850 + 12000, 6);
    // A level without an offer loan stays at its share of the price.
    expect(ek15.loan).toBeCloseTo(425000, 6);
    // Waiting moves the price, so a later purchase is financed by share again.
    const later = buildWaitScenario(EK_SCENARIOS[0], inputs, OFFER_RATES, 12);
    expect(later.scenario.loan).toBeCloseTo(later.futurePrice * 0.9, 6);
    const now = buildWaitScenario(EK_SCENARIOS[0], inputs, OFFER_RATES, 0);
    expect(now.scenario.loan).toBe(445000);
  });

  it("blends a fixed KfW loan into one rate per EK level (D42)", () => {
    // More EK shrinks only the bank part, so the blend falls with EK: one average for
    // all three levels would understate what extra EK saves.
    expect(blendedRate(4.3, 589590, 170000, 1.3)).toBeCloseTo(3.435, 3);
    expect(blendedRate(4.0, 524080, 170000, 1.3)).toBeCloseTo(3.124, 3);
    expect(blendedRate(4.3, 100000, 170000, 1.3)).toBeCloseTo(1.3, 6);
    expect(blendedRate(4.3, 500000, 0, 1.3)).toBe(4.3);

    const flat = { ...DEFAULT_APARTMENT_CASES[0], purchasePrice: 655100, kfwAmount: 170000, kfwRate: 1.3, monthlyPayment: 2700 };
    const [ek10] = buildScenarios(EK_SCENARIOS, buildApartmentInputs(DEFAULT_INPUTS, flat), DEFAULT_RATES);
    expect(ek10.interestRate).toBeCloseTo(blendedRate(DEFAULT_RATES[10].ek10, 589590, 170000, 1.3), 9);
  });

  it("runs KfW as a loan of its own: a repayment-free year, its own annuity, no Sondertilgung (D44)", () => {
    const kfwOnly = (plan: SpecialPlan) => {
      const balances: number[] = [];
      const run = simulateSplitLoan({
        bankPrincipal: 0,
        bankRatePct: 4.3,
        kfwPrincipal: 170000,
        kfwRatePct: 1.3,
        kfwTermYears: 30,
        monthlyPayment: kfwAnnuity(170000, 1.3, 30),
        fixedRateYears: 10,
        specialPlan: plan,
        specialRepaymentLimitRate: 5,
        onMonth: (entry) => balances.push(entry.balance),
      });
      return { run, balances };
    };
    const { run, balances } = kfwOnly({ kind: "none" });
    // Interest only for twelve months, then repaid exactly at the end of its 30-year term.
    expect(balances[11]).toBeCloseTo(170000, 6);
    expect(balances[12]).toBeLessThan(170000);
    expect(run.runtimeYears).toBeCloseTo(30, 9);
    // Sondertilgung cannot touch the KfW part: its cap is a share of the bank part only.
    const withPlan = kfwOnly({ kind: "flat", annual: 20000 });
    expect(withPlan.run.maxAnnualSpecial).toBe(0);
    expect(withPlan.run.runtimeYears).toBeCloseTo(30, 9);
  });

  it("recomputes the KfW annuity over its remaining term when the rate is stressed (D45)", () => {
    const base = {
      bankPrincipal: 413508,
      bankRatePct: 4.01,
      kfwPrincipal: 170000,
      kfwRatePct: 0.78,
      kfwTermYears: 35,
      monthlyPayment: 2669,
      fixedRateYears: 10,
      specialPlan: { kind: "none" } as SpecialPlan,
      specialRepaymentLimitRate: 5,
    };
    const plain = simulateSplitLoan(base);
    // At an unchanged rate the recomputed annuity is the old one: nothing moves.
    const same = simulateSplitLoan({ ...base, rateShift: { afterMonths: 120, points: 0 } });
    expect(same.runtimeYears).toBeCloseTo(plain.runtimeYears, 9);
    expect(same.interestTotal).toBeCloseTo(plain.interestTotal, 4);
    // Two points higher: the KfW still ends with its term, the bank part carries the
    // extra cost out of the same total, so more interest but a finite runtime.
    const stressed = simulateSplitLoan({ ...base, rateShift: { afterMonths: 120, points: 2 } });
    expect(stressed.amortises).toBe(true);
    expect(stressed.interestTotal).toBeGreaterThan(plain.interestTotal + 10000);
    expect(stressed.runtimeYears).toBeCloseTo(35, 6);
  });

  it("pays each part's own rate and puts Sondertilgung into the bank part (D44)", () => {
    const flat = { ...DEFAULT_APARTMENT_CASES[0], purchasePrice: 655100, kfwAmount: 170000, kfwRate: 1.3, monthlyPayment: 2976 };
    const inputs = buildApartmentInputs(DEFAULT_INPUTS, flat);
    const [ek10] = buildScenarios(EK_SCENARIOS, inputs, DEFAULT_RATES);
    expect(ek10.kfwPart).toBe(170000);
    expect(ek10.bankRate).toBe(DEFAULT_RATES[10].ek10);

    let firstMonth: MortgageMonth | null = null;
    simulateSplitLoan({
      bankPrincipal: ek10.loan - 170000,
      bankRatePct: ek10.bankRate,
      kfwPrincipal: 170000,
      kfwRatePct: 1.3,
      kfwTermYears: 20,
      monthlyPayment: 2976,
      fixedRateYears: 10,
      specialPlan: { kind: "none" },
      specialRepaymentLimitRate: 5,
      onMonth: (entry) => {
        firstMonth ??= entry;
      },
    });
    const bankPart = ek10.loan - 170000;
    expect(firstMonth!.interest).toBeCloseTo((bankPart * 4.3) / 1200 + (170000 * 1.3) / 1200, 6);
    // In the KfW's free year only the bank part repays: the rate minus the KfW annuity.
    expect(firstMonth!.principal).toBeCloseTo(2976 - kfwAnnuity(170000, 1.3, 20) - (bankPart * 4.3) / 1200, 6);
    // The 5 % cap is taken on the bank part, not the whole loan.
    expect(ek10.mortgage.maxAnnualSpecial).toBeCloseTo(bankPart * 0.05, 6);
    // The same-rate refinancing baseline is the scenario itself.
    expect(refinanceStress(ek10, inputs).runtimeYearsAtSameRate).toBeCloseTo(ek10.mortgage.runtimeYears, 9);
  });

  it("amortises a Neubau only for the part of the binding after handover (D42)", () => {
    const flat = { ...DEFAULT_APARTMENT_CASES[0], moveInMonths: 19 };
    const delayed = buildApartmentInputs(DEFAULT_INPUTS, flat);
    const atOnce = buildApartmentInputs(DEFAULT_INPUTS, { ...flat, moveInMonths: 0 });
    expect(bindingMonths(delayed)).toBe(101);
    expect(bindingMonths(atOnce)).toBe(120);

    const [late] = buildScenarios(EK_SCENARIOS, delayed, OFFER_RATES);
    const [now] = buildScenarios(EK_SCENARIOS, atOnce, OFFER_RATES);
    // Same loan, same rate, same runtime from handover; but at the end of the binding
    // 19 fewer months have been repaid, so more is left to refinance.
    expect(late.mortgage.runtimeYears).toBeCloseTo(now.mortgage.runtimeYears, 9);
    expect(late.mortgage.remainingAfterFixed).toBeGreaterThan(now.mortgage.remainingAfterFixed + 10000);
    // Equal to the balance after month 101 of the undelayed loan.
    const after101 = simulateMortgage({
      principal: now.loan,
      interestRatePct: now.interestRate,
      repaymentRatePct: now.repaymentRate,
      fixedRateYears: 101 / 12,
      specialPlan: planFromInputs(atOnce),
      specialRepaymentLimitRate: atOnce.specialRepaymentLimitRate,
    }).remainingAfterFixed;
    expect(late.mortgage.remainingAfterFixed).toBeCloseTo(after101, 6);
  });

  it("keeps the refinancing baseline on the loan's own calendar after a handover delay", () => {
    // At the same rate, refinancing changes nothing, so the baseline must run exactly
    // as long as the scenario, whatever month the binding ends in.
    for (const moveInMonths of [0, 5, 12, 17, 19, 23]) {
      const inputs = buildApartmentInputs(DEFAULT_INPUTS, { ...DEFAULT_APARTMENT_CASES[0], moveInMonths });
      for (const scenario of buildScenarios(EK_SCENARIOS, inputs, OFFER_RATES)) {
        const stress = refinanceStress(scenario, inputs);
        if (!stress.applies) continue;
        expect(stress.runtimeYearsAtSameRate).toBeCloseTo(scenario.mortgage.runtimeYears, 9);
      }
    }
  });

  it("builds a comparison column with construction interest and the parking space's share (D42)", () => {
    const flat = {
      ...DEFAULT_APARTMENT_CASES[0],
      purchasePrice: 520000,
      closingCostRate: 11.57,
      monthlyPayment: 2460,
      moveInMonths: 12,
      parkingPrice: 26000,
      rates: DEFAULT_RATES,
    };
    const column = apartmentColumn(flat, EK_SCENARIOS[0], DEFAULT_INPUTS);
    // 468.000 € × 4,3 % × 1 Jahr × halb abgerufen.
    expect(column.constructionInterest).toBeCloseTo(468000 * 0.043 * 0.5, 6);
    // 5 % of the price: 5 % of the rate; and 10 % EK + 11,57 % KNK of 26.000 €.
    expect(column.parkingMonthly).toBeCloseTo(column.scenario.mortgage.regularMonthlyPayment * 0.05, 6);
    expect(column.parkingCash).toBeCloseTo(26000 * 0.2157, 6);
    expect(column.withoutSpecial.mortgage.remainingAfterFixed).toBeGreaterThan(
      column.scenario.mortgage.remainingAfterFixed,
    );
    expect(column.debtFreeAfterYears).toBeCloseTo(1 + column.scenario.mortgage.runtimeYears, 9);
    expect(column.specialInBinding).toBe(9 * 6000);
  });

  it("compares apartment cases with independent prices and Sondertilgung paths", () => {
    const results = compareApartmentCases(
      [
        {
          id: "apartment-a",
          label: "Apartment A",
          purchasePrice: 600000,
          renovation: 0,
          hausgeld: 610,
          closingCostRate: 8,
          monthlyPayment: 2900,
          kfwAmount: 0,
          kfwRate: 0,
          kfwTermYears: 20,
          moveInMonths: 0,
          parkingPrice: 0,
          rates: CASE_PRESETS.case720.rates,
          ratesNote: "",
          annualSpecialRepayments: [0, 0, 0],
        },
        {
          id: "apartment-b",
          label: "Apartment B",
          purchasePrice: 700000,
          renovation: 10000,
          hausgeld: 810,
          closingCostRate: 11.57,
          monthlyPayment: 2900,
          kfwAmount: 0,
          kfwRate: 0,
          kfwTermYears: 20,
          moveInMonths: 0,
          parkingPrice: 0,
          rates: CASE_PRESETS.case720.rates,
          ratesNote: "",
          annualSpecialRepayments: [10000, 10000, 10000],
        },
      ],
      EK_SCENARIOS,
      DEFAULT_INPUTS,
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
    const wait = buildWaitScenario(MIDDLE, inputs, OFFER_RATES);

    expect(wait.saved).toBe(18000);
    expect(wait.adjustedAvailableCapital).toBe(inputs.availableCapital + 18000);
    // Rent is still reported, and paid inside the ledger out of the household budget,
    // never deducted from capital a second time.
    expect(wait.rentPaid).toBe(23640);
    expect(wait.wealth.rentPaid).toBe(23640);
  });

  it("values waiting against buying now on one common date (D33)", () => {
    // The bottom line is a wealth difference on the same day, read off the ledger:
    // not an interest delta over 25+ years plus rent, which left out ownership costs,
    // principal, and what capital earns while waiting.
    const inputs = buildApartmentInputs(DEFAULT_INPUTS, DEFAULT_APARTMENT_CASES[0]);
    const columns = buildWaitScenarios(LOWEST, inputs, OFFER_RATES, [0, 12, 24]);
    const now = wealthAtHorizon({ base: LOWEST, inputs, rates: OFFER_RATES });

    expect(new Set(columns.map((column) => column.wealth.horizonMonths)).size).toBe(1);
    expect(columns[0].deltaWealth).toBe(0);
    expect(columns[1].deltaWealth).toBeCloseTo(columns[1].wealth.wealth - now.wealth, 6);
    // On the offer flat at the default assumptions: a year of waiting is ahead, two are not.
    expect(Math.round(columns[1].deltaWealth)).toBe(3207);
    expect(Math.round(columns[2].deltaWealth)).toBe(-5410);
  });

  it("names the assumption values at which waiting stops paying off (spec 2.3)", () => {
    const inputs = buildApartmentInputs(DEFAULT_INPUTS, DEFAULT_APARTMENT_CASES[0]);
    const points = waitTippingPoints(LOWEST, inputs, OFFER_RATES, 12);
    const byKey = Object.fromEntries(points.map((point) => [point.assumption, point]));

    expect(byKey.waitRateShift.assumed).toBe(-0.3);
    expect(byKey.waitRateShift.flipsAt).toBeCloseTo(-0.21, 2);
    expect(byKey.waitPropertyGrowthRate.flipsAt).toBeCloseTo(2.46, 2);
    expect(byKey.etfReturnRate.flipsAt).toBeCloseTo(3.85, 2);

    // At each tipping point the two paths really do end level.
    for (const point of points) {
      const varied = { ...inputs, [point.assumption]: point.flipsAt as number };
      const wait = buildWaitScenario(LOWEST, varied, OFFER_RATES, 12);
      expect(Math.abs(wait.deltaWealth)).toBeLessThan(1);
    }

    // Buying now has nothing to tip.
    expect(waitTippingPoints(LOWEST, inputs, OFFER_RATES, 0).every((p) => p.flipsAt === null)).toBe(true);
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
    expect(decision.feasibleScenarios).toHaveLength(0);
    expect(decision.costMinimum).toBeNull();
    expect(decision.liquidityMaximum).toBeNull();
    expect(decision.monthlyMinimum).toBeNull();
  });

  it("lists every tragbar level instead of preferring one (D28)", () => {
    // The offer flat: 10% and 15% EK carry the reserve, 20% does not. The old rule
    // named "10% EK" as the recommendation, which since D15 is the lowest level.
    // Pinned: this test is about listing, not about the retirement deadline (D43), which
    // the offer's 1.900 € rate misses at 10% EK (30 years without Sondertilgung).
    const inputs = { ...buildApartmentInputs(DEFAULT_INPUTS, DEFAULT_APARTMENT_CASES[0]), maxRuntimeYears: 35 };
    const decision = evaluateDecision(buildScenarios(EK_SCENARIOS, inputs, OFFER_RATES));

    // 20% EK leaves less than the reserve target, which only warns since D44.
    expect(decision.feasibleScenarios.map((scenario) => scenario.id)).toEqual(["ek10", "ek15", "ek20"]);
    expect("recommendation" in decision).toBe(false);
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
      OFFER_RATES,
    );
    const cannotAfford = buildScenario(
      MIDDLE,
      { ...roomy, availableCapital: cashNeeded - 10000 },
      OFFER_RATES,
    );

    // A thin reserve warns, it does not block (D44); a purchase the money cannot cover does.
    expect(reserveOnly.cashLeft).toBeGreaterThan(0);
    expect(reserveOnly.diagnosis.warnings).toContain("reserve");
    expect(reserveOnly.diagnosis.failed).toEqual([]);
    expect(reserveOnly.feasible).toBe(true);
    expect(reserveOnly.status).toBe("Reserve unter Ziel");

    expect(cannotAfford.cashLeft).toBeLessThan(0);
    expect(cannotAfford.diagnosis.failed).toContain("cash");
    expect(cannotAfford.feasible).toBe(false);
  });

  it("measures the break-even against the target without Sondertilgung (D1)", () => {
    const withoutSpecial = interestForPlan(HIGHEST, DEFAULT_INPUTS, OFFER_RATES, {
      kind: "none",
    });
    const withPath = interestForPlan(
      HIGHEST,
      DEFAULT_INPUTS,
      OFFER_RATES,
      { kind: "path", years: DEFAULT_INPUTS.annualSpecialRepayments },
    );

    // A target that also makes special repayments pays less interest, which would set a
    // harder bar. The chosen baseline is the one without.
    expect(withoutSpecial).toBeGreaterThan(withPath);

    const againstBaseline = requiredSpecialToMatch(
      LOWEST,
      withoutSpecial,
      DEFAULT_INPUTS,
      OFFER_RATES,
    );
    const againstPath = requiredSpecialToMatch(
      LOWEST,
      withPath,
      DEFAULT_INPUTS,
      OFFER_RATES,
    );

    expect(againstBaseline.amount).not.toBeNull();
    expect(againstBaseline.amount!).toBeLessThan(againstPath.amount ?? Infinity);
  });

  it("nets mortgage interest saved against foregone ETF growth over one horizon", () => {
    const scenarios = buildScenarios(EK_SCENARIOS, DEFAULT_INPUTS, OFFER_RATES);
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

  it("taxes the foregone ETF growth, which flips the verdict on the real offer (K18)", () => {
    // The offer flat, 10% against 20% EK. Interest saved is tax-free for an owner-occupier;
    // ETF gains are not. Left untaxed, the comparison read "für mehr Liquidität".
    const inputs = buildApartmentInputs(DEFAULT_INPUTS, DEFAULT_APARTMENT_CASES[0]);
    const scenarios = buildScenarios(EK_SCENARIOS, inputs, OFFER_RATES);
    const taxed = compareEkScenarios(scenarios[0], scenarios[2], inputs);
    const untaxed = compareEkScenarios(scenarios[0], scenarios[2], { ...inputs, etfTaxRate: 0 });

    expect(taxed.etfForegone).toBeCloseTo(taxed.etfForegoneGross * (1 - 0.184625), 6);
    expect(taxed.netAdvantageFixed).toBeCloseTo(taxed.interestSavedFixed - taxed.etfForegone, 6);
    expect(untaxed.netAdvantageFixed).toBeLessThan(0);
    expect(taxed.netAdvantageFixed).toBeGreaterThan(0);
  });

  it("converts an ETF return into its after-tax annual equivalent", () => {
    expect(afterTaxAnnualReturn(5, 0, 10)).toBeCloseTo(5, 9);
    // 5% for ten years, 18,4625% on the gain at the end: about 4,23% a year.
    expect(afterTaxAnnualReturn(5, 18.4625, 10)).toBeCloseTo(4.23, 2);
    // A stray rate above 100% cannot turn a gain into more than a total loss of it.
    expect(afterTaxAnnualReturn(5, 250, 10)).toBeCloseTo(0, 9);
  });

  it("values buying now and waiting on one common date (wealth ledger)", () => {
    // Pinned against the hand calculation in docs/REVIEW.md: the offer flat at 10% EK,
    // valued at the end of the binding, with free capital earning 0% and no tax. Waiting
    // a year then costs 8.028 € of wealth, while the old interest-plus-rent delta said
    // 6.662 €; at 5% before tax, waiting comes out ahead. Same flat, same day, so the
    // property value cancels and only cash, debt and capital differ.
    const inputs = {
      ...buildApartmentInputs(DEFAULT_INPUTS, DEFAULT_APARTMENT_CASES[0]),
      etfReturnRate: 0,
      etfTaxRate: 0,
    };
    const now = wealthAtHorizon({ base: LOWEST, inputs, rates: OFFER_RATES });
    const wait = wealthAtHorizon({ base: LOWEST, inputs, rates: OFFER_RATES, waitMonths: 12 });

    expect(now.propertyValue).toBeCloseTo(wait.propertyValue, 6);
    expect(wait.rentPaid).toBe(23640);
    expect(Math.round(now.wealth)).toBe(401768);
    expect(Math.round(wait.wealth - now.wealth)).toBe(-8028);

    const invested = { ...inputs, etfReturnRate: 5, etfTaxRate: 18.4625 };
    const nowInvested = wealthAtHorizon({ base: LOWEST, inputs: invested, rates: OFFER_RATES });
    const waitInvested = wealthAtHorizon({
      base: LOWEST,
      inputs: invested,
      rates: OFFER_RATES,
      waitMonths: 12,
    });
    expect(waitInvested.wealth).toBeGreaterThan(nowInvested.wealth);
  });

  it("measures the Sondertilgung plan inside the binding, against the ETF (K20)", () => {
    // The offer flat at 10% EK, 6.000 €/Jahr for ten years. Inside the binding the plan
    // pays 60.000 € in; the Restschuld falls by that plus the interest it saves. Against
    // the same money in the ETF the verdict depends on the ETF assumption: 5% before
    // tax (≈4,2% after) beats a 3,87% loan, 2% does not.
    const inputs = buildApartmentInputs(DEFAULT_INPUTS, DEFAULT_APARTMENT_CASES[0]);
    const effect = specialPlanEffect(LOWEST, inputs, OFFER_RATES);

    expect(effect.horizonMonths).toBe(120);
    expect(effect.paid).toBeCloseTo(60000, 6);
    expect(effect.interestSaved).toBeGreaterThan(0);
    expect(effect.debtReduction).toBeCloseTo(effect.paid + effect.interestSaved, 6);
    expect(effect.wealthDelta).toBeLessThan(0);

    const cautious = specialPlanEffect(LOWEST, { ...inputs, etfReturnRate: 2 }, OFFER_RATES);
    expect(cautious.wealthDelta).toBeGreaterThan(0);
  });

  it("turns the Restschuld into a refinancing stress test (D31)", () => {
    // Offer flat, same Monatsrate, Anschlusszins 2 points above today's: the less
    // Eigenkapital, the more debt meets the new rate and the longer the loan runs.
    const offer = buildApartmentInputs(DEFAULT_INPUTS, DEFAULT_APARTMENT_CASES[0]);
    const stresses = buildScenarios(EK_SCENARIOS, offer, OFFER_RATES).map((scenario) => ({
      scenario,
      stress: refinanceStress(scenario, offer),
    }));
    for (const { scenario, stress } of stresses) {
      expect(stress.applies).toBe(true);
      expect(stress.runtimeYearsAtSameRate).toBeCloseTo(scenario.mortgage.runtimeYears, 6);
    }
    expect(stresses[0].stress.extraYears).toBeGreaterThan(stresses[1].stress.extraYears);
    expect(stresses[1].stress.extraYears).toBeGreaterThan(stresses[2].stress.extraYears);
    expect(stresses[0].stress.extraYears).toBeCloseTo(3.17, 1);

    // A 600.000 € flat at 10% EK where 1.900 € no longer even covers the interest on the
    // Restschuld. Pinned here rather than read off a shipped apartment (D12): this fixture
    // used to be the "Wohnung C" placeholder, and when that became a real flat with a real
    // Monatsrate (D47) the case silently stopped being a case.
    const tightFlat = buildApartmentInputs(DEFAULT_INPUTS, {
      ...DEFAULT_APARTMENT_CASES[2],
      purchasePrice: 600000,
      monthlyPayment: 1900,
      offerLoans: undefined,
    });
    const tight = refinanceStress(buildScenario(LOWEST, tightFlat, OFFER_RATES), tightFlat);
    expect(tight.coversInterest).toBe(false);
    expect(tight.runtimeYearsStressed).toBe(Infinity);

    // Repaid inside the binding: nothing to refinance, nothing to stress.
    const small = { ...offer, purchasePrice: 150000 };
    const repaid = refinanceStress(buildScenario(LOWEST, small, OFFER_RATES), small);
    expect(repaid.applies).toBe(false);
    expect(repaid.extraYears).toBe(0);
  });

  it("prices every step of extra EK as a yearly return against the ETF (D32)", () => {
    // The offer: 10→15% buys almost nothing in rate (3,87 → 3,86), 15→20% buys the
    // drop to 3,76 on the whole loan. Against a 5% ETF (≈4,2% after tax) the first step
    // loses and the second wins, which a 10-vs-20 headline alone cannot show.
    const inputs = buildApartmentInputs(DEFAULT_INPUTS, DEFAULT_APARTMENT_CASES[0]);
    const [ek10, ek15, ek20] = buildScenarios(EK_SCENARIOS, inputs, OFFER_RATES);
    const first = ekStepReturn(ek10, ek15, inputs);
    const second = ekStepReturn(ek15, ek20, inputs);
    const span = ekStepReturn(ek10, ek20, inputs);

    expect(first.annualReturn).toBeCloseTo(4.06, 2);
    expect(second.annualReturn).toBeCloseTo(4.97, 2);
    expect(span.annualReturn).toBeCloseTo(4.52, 2);
    expect(first.breakEvenEtfReturn).toBeCloseTo(4.81, 2);
    expect(second.breakEvenEtfReturn).toBeCloseTo(5.84, 2);
    expect(first.ekAhead).toBe(false);
    expect(second.ekAhead).toBe(true);
    expect(span.ekAhead).toBe(true);

    // No extra cash, no return to speak of.
    expect(ekStepReturn(ek15, ek10, inputs).annualReturn).toBeNull();
  });

  it("warns, never blocks, when the contract runs past the retirement deadline (D44)", () => {
    // The offer flat at the offer's own rate runs about 30,1 years without Sondertilgung;
    // the broker's Tilgungsplan says "30 Jahre 2 Monate".
    const offer = { ...buildApartmentInputs(DEFAULT_INPUTS, DEFAULT_APARTMENT_CASES[0]), maxRuntimeYears: 26 };
    const [ek10] = buildScenarios(EK_SCENARIOS, offer, OFFER_RATES);
    expect(ek10.contractYearsFromSigning).toBeCloseTo(30.1, 1);
    expect(ek10.runsPastLimit).toBe(true);
    expect(ek10.diagnosis.warnings).toContain("runtime");
    expect(ek10.feasible).toBe(true);
    expect(ek10.status).toBe("Läuft über die Grenze");
    expect(ek10.statusTone).toBe("amber");
    // With the 6.000 €/Jahr plan it is repaid well inside the deadline: the figure some
    // banks accept, and the one the warning puts next to the contract.
    expect(ek10.debtFreeYearsFromSigning).toBeLessThan(26);

    // Sondertilgung never changes the contract reading itself.
    const generous = { ...offer, annualSpecialRepayments: offer.annualSpecialRepayments.map(() => 20000) };
    expect(buildScenarios(EK_SCENARIOS, generous, OFFER_RATES)[0].contractYearsFromSigning).toBeCloseTo(
      ek10.contractYearsFromSigning,
      9,
    );

    // A Neubau's wait counts: the deadline is a date, measured from signing.
    const late = buildScenarios(EK_SCENARIOS, { ...offer, moveInMonths: 12 }, OFFER_RATES)[0];
    expect(late.contractYearsFromSigning).toBeCloseTo(ek10.contractYearsFromSigning + 1, 9);
  });
  it("values a step of EK in the ledger when the loans are repaid inside the binding (K23)", () => {
    // A 150k flat at 1.900 €/Monat: every loan is gone after about five years, so the
    // Restschuld is zero on both sides. Read off the Restschuld, the step reported a
    // −100% return and "ETF vorn". In the ledger the earlier-finishing loan's freed
    // payments keep earning, and the extra EK earns about what the loans cost.
    const inputs = {
      ...buildApartmentInputs(DEFAULT_INPUTS, DEFAULT_APARTMENT_CASES[0]),
      purchasePrice: 150000,
    };
    const [ek10, , ek20] = buildScenarios(EK_SCENARIOS, inputs, OFFER_RATES);
    expect(ek10.mortgage.runtimeYears).toBeLessThan(inputs.fixedRateYears);
    expect(ek20.mortgage.runtimeYears).toBeLessThan(inputs.fixedRateYears);

    const step = ekStepReturn(ek10, ek20, inputs);
    const tradeoff = compareEkScenarios(ek10, ek20, inputs);
    const gap =
      wealthAtHorizon({ base: HIGHEST, inputs, rates: OFFER_RATES }).wealth -
      wealthAtHorizon({ base: LOWEST, inputs, rates: OFFER_RATES }).wealth;

    expect(step.debtReduction).toBe(0);
    expect(step.annualReturn).toBeGreaterThan(3);
    expect(step.annualReturn).toBeLessThan(5);
    expect(step.ekAhead).toBe(gap > 0);
    expect(tradeoff.netAdvantageFixed).toBeCloseTo(gap, 6);
  });

  it("values a built scenario exactly as the ledger values the same purchase", () => {
    const inputs = buildApartmentInputs(DEFAULT_INPUTS, DEFAULT_APARTMENT_CASES[1]);
    for (const base of EK_SCENARIOS) {
      const built = buildScenario(base, inputs, OFFER_RATES);
      expect(scenarioWealthAtHorizon(built, inputs).wealth).toBeCloseTo(
        wealthAtHorizon({ base, inputs, rates: OFFER_RATES }).wealth,
        6,
      );
    }
  });

  it("keeps the original loan's Sondertilgung cap in the refinancing stress run", () => {
    // 15.000 €/Jahr for 25 years: inside 5% of the original 405.000 €, above 5% of the
    // Restschuld after ten years. Capped against the Restschuld, the same-rate baseline
    // ran 15,25 years where the scenario itself runs 14,00.
    const inputs = {
      ...buildApartmentInputs(DEFAULT_INPUTS, DEFAULT_APARTMENT_CASES[0]),
      annualSpecialRepayments: Array(25).fill(15000),
    };
    const scenario = buildScenario(LOWEST, inputs, OFFER_RATES);
    const stress = refinanceStress(scenario, inputs);
    expect(stress.runtimeYearsAtSameRate).toBeCloseTo(scenario.mortgage.runtimeYears, 6);
    expect(stress.extraYears).toBeGreaterThan(0);
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
    const columns = buildWaitScenarios(MIDDLE, DEFAULT_INPUTS, OFFER_RATES, [0, 12, 24]);

    expect(columns).toHaveLength(3);
    expect(columns[0].waitMonths).toBe(0);
    expect(columns[0].saved).toBe(0);
    expect(columns[0].rentPaid).toBe(0);
    // The baseline column must read as a true zero, not as the rent of a wait that
    // never happens.
    expect(columns[0].deltaWealth).toBe(0);
    expect(columns[2].adjustedAvailableCapital).toBeGreaterThan(
      columns[1].adjustedAvailableCapital,
    );
  });

  it("measures every EK level against the selected one running its plan", () => {
    const fromLowest = compareSpecialScenarios(
      EK_SCENARIOS,
      LOWEST.id,
      DEFAULT_INPUTS,
      OFFER_RATES,
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
    const fromLowest = compareSpecialScenarios(EK_SCENARIOS, LOWEST.id, DEFAULT_INPUTS, OFFER_RATES);
    const higher = fromLowest.rows.find((row) => row.base.id === HIGHEST.id)!;
    expect(higher.deltaToSelection).toBeLessThan(0);
    expect(higher.catchUp!.payer).toBe("selection");

    // From the highest EK level with a plan running, the lower one is behind and it is
    // THAT row which would have to pay. The direction must actually flip.
    const fromHighest = compareSpecialScenarios(EK_SCENARIOS, HIGHEST.id, DEFAULT_INPUTS, OFFER_RATES);
    const lower = fromHighest.rows.find((row) => row.base.id === LOWEST.id)!;
    expect(lower.deltaToSelection).toBeGreaterThan(0);
    expect(lower.catchUp!.payer).toBe("row");
  });

  it("decides 'covered' on the modelled path, not on the plan's average (D22)", () => {
    const fromLowest = compareSpecialScenarios(EK_SCENARIOS, LOWEST.id, DEFAULT_INPUTS, OFFER_RATES);
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
    const comparison = compareSpecialScenarios(EK_SCENARIOS, LOWEST.id, generous, OFFER_RATES);
    const higher = comparison.rows.find((row) => row.base.id === HIGHEST.id)!;

    // With the selection now cheaper than the untouched higher level, the payer flips to
    // that row — and our side is recorded as needing nothing.
    expect(comparison.selectionInterestWithPlan).toBeLessThan(higher.interestNoSpecial);
    expect(higher.catchUp!.payer).toBe("row");
    expect(higher.catchUp!.planShortfall).toBeLessThanOrEqual(0);
    expect(higher.catchUp!.planCovers).toBe(true);
  });

  it("raises the required catch-up as the target gets cheaper", () => {
    const modest = compareSpecialScenarios(EK_SCENARIOS, LOWEST.id, DEFAULT_INPUTS, OFFER_RATES);
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
    expect(rateFor(OFFER_RATES, 10, "ek10")).toBe(OFFER_RATES[10].ek10);
    expect(rateFor(OFFER_RATES, 15, "ek10")).toBe(OFFER_RATES[15].ek10);
    expect(rateFor(OFFER_RATES, 10, "ek10")).not.toBe(rateFor(OFFER_RATES, 15, "ek10"));

    // The offer prices 10% and 15% EK identically at a 15-year binding. The model must
    // carry that through rather than assuming more Eigenkapital is always cheaper.
    expect(rateFor(OFFER_RATES, 15, "ek15")).toBe(rateFor(OFFER_RATES, 15, "ek10"));

    // An unsupported binding — e.g. a state saved when 20 years was still offered —
    // must land on a real column instead of producing undefined.
    expect(normaliseFixedPeriod(20)).toBe(15);
    expect(normaliseFixedPeriod(5)).toBe(10);
    expect(rateFor(OFFER_RATES, 20, "ek20")).toBe(OFFER_RATES[15].ek20);
  });

  it("holds the monthly rate constant and lets Tilgung and runtime move (D14)", () => {
    const scenarios = buildScenarios(EK_SCENARIOS, DEFAULT_INPUTS, OFFER_RATES);

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
      OFFER_RATES,
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

  it("measures the payment shortfall against the 60-year bar, not the interest (K17)", () => {
    const loan = DEFAULT_INPUTS.purchasePrice * 0.9;
    const interestOnly = (loan * OFFER_RATES[10].ek10) / 1200;

    // Just above the interest-only floor: the loan DOES amortise — in about 80 years.
    // Reporting the gap against the interest made it positive, and the UI printed that
    // positive number as an amount still missing.
    const inputs = {
      ...DEFAULT_INPUTS,
      monthlyPayment: Math.ceil(interestOnly) + 5,
      annualSpecialRepayments: [],
    };
    const scenario = buildScenario(LOWEST, inputs, OFFER_RATES);
    const check = scenario.diagnosis.checks.find((entry) => entry.id === "payment")!;

    expect(scenario.mortgage.runtimeYears).toBeGreaterThan(60);
    expect(check.passed).toBe(false);
    expect(inputs.monthlyPayment).toBeGreaterThan(interestOnly);
    // The failure must read as a shortfall, so the gap has to be negative.
    expect(check.gap).toBeLessThan(0);
    expect(check.required).toBeGreaterThan(interestOnly);

    // Paying exactly the reported requirement must clear the check.
    const atTheBar = buildScenario(
      LOWEST,
      { ...inputs, monthlyPayment: Math.ceil(check.required) },
      OFFER_RATES,
    );
    expect(atTheBar.diagnosis.checks.find((entry) => entry.id === "payment")!.passed).toBe(true);
  });

  it("measures the payment bar under the Sondertilgung plan that is running (K17)", () => {
    // The pass condition reads the simulated runtime, which the plan shortens. A bar
    // computed without the plan therefore overstates what is missing.
    const inputs = {
      ...DEFAULT_INPUTS,
      monthlyPayment: 1350,
      annualSpecialRepayments: Array.from({ length: 10 }, () => 2000),
    };
    const scenario = buildScenario(LOWEST, inputs, OFFER_RATES);
    const check = scenario.diagnosis.checks.find((entry) => entry.id === "payment")!;

    expect(check.passed).toBe(false);
    expect(scenario.mortgage.runtimeYears).toBeGreaterThan(60);

    // Ignoring the plan reports roughly 99 €; the honest figure is about 41 €.
    expect(Math.abs(check.gap)).toBeLessThan(60);

    // The bar has to be tight in both directions, or it is not the requirement.
    const atTheBar = buildScenario(
      LOWEST,
      { ...inputs, monthlyPayment: Math.ceil(check.required) },
      OFFER_RATES,
    );
    const justUnder = buildScenario(
      LOWEST,
      { ...inputs, monthlyPayment: Math.floor(check.required) - 1 },
      OFFER_RATES,
    );
    expect(atTheBar.diagnosis.checks.find((entry) => entry.id === "payment")!.passed).toBe(true);
    expect(justUnder.diagnosis.checks.find((entry) => entry.id === "payment")!.passed).toBe(false);
  });

  it("flags a Monatsrate the model had to raise to simulate at all (K14)", () => {
    const inputs = { ...DEFAULT_INPUTS, monthlyPayment: 1200 };
    const scenario = buildScenario(LOWEST, inputs, OFFER_RATES);

    // 405.000 € at 3,87% costs about 1.306 €/Monat in interest alone, so 1.200 € can
    // never repay it. The Tilgungssatz floor means the model simulates a higher rate.
    expect(scenario.diagnosis.failed).toContain("payment");
    expect(scenario.paymentSubstituted).toBe(true);
    expect(scenario.mortgage.regularMonthlyPayment).toBeGreaterThan(inputs.monthlyPayment);

    // A rate that does amortise is simulated exactly as entered — no silent bump, and
    // therefore nothing for the UI to warn about.
    const honest = buildScenario(LOWEST, DEFAULT_INPUTS, OFFER_RATES);
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
    }, OFFER_RATES);
    expect(boundary.mortgage.regularMonthlyPayment - boundary.diagnosis.checks[0].actual)
      .toBeCloseTo(0.25, 6);
    expect(boundary.paymentSubstituted).toBe(true);
  });
});
