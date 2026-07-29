export type ScenarioId = "ek5" | "ek10" | "ek15";
export type Tone = "green" | "amber" | "red" | "blue" | "slate" | "orange";

/**
 * Which direction is favourable for a given metric — the sign convention is inverted
 * between columns (more cash is good, more interest is bad), so this must live next
 * to the data, not be re-derived ad hoc at each render site. PRODUCT_SPEC §14: the UI
 * must not rely on colour alone, and this map is what makes the direction explicit.
 */
export type MetricKey =
  | "cashLeft"
  | "interestTotal"
  | "interestFixed"
  | "allInMonthly"
  | "remainingAfterFixed"
  | "netWorthAtPayoff";

export const BETTER_WHEN: Record<MetricKey, "higher" | "lower"> = {
  cashLeft: "higher",
  interestTotal: "lower",
  interestFixed: "lower",
  allInMonthly: "lower",
  remainingAfterFixed: "lower",
  netWorthAtPayoff: "higher",
};

export type MortgageInputs = {
  purchasePrice: number;
  closingCostRate: number;
  availableCapital: number;
  reserveTarget: number;
  renovation: number;
  moving: number;
  monthlyOwnershipCosts: number;
  currentWarmRent: number;
  householdNetIncome: number;
  /** Max share of household net income the all-in monthly cost may take, in percent. Heuristic, not a bank rule. */
  maxBurdenRate: number;
  repaymentRate: number;
  fixedRateYears: number;
  annualSpecialRepayment: number;
  annualSpecialRepayments: number[];
  specialRepaymentLimitRate: number;
  propertyGrowthRate: number;
  inflationRate: number;
  waitMonths: number;
  waitSavingsMonthly: number;
  waitPropertyGrowthRate: number;
  waitRateShift: number;
  etfReturnRate: number;
};

export type InterestRates = Record<ScenarioId, number>;

export type ScenarioBase = {
  id: ScenarioId;
  ekRate: number;
  label: string;
  short: string;
  accent: Tone;
};

/**
 * How Sondertilgung is applied across the years.
 *
 * An explicit union, not a sentinel: the previous implementation decided whether to
 * use the yearly path by comparing a number against `inputs.annualSpecialRepayment`,
 * which silently mixed baselines and made the break-even answer the wrong question.
 * See docs/DECISIONS.md D1.
 *
 * - `path` — one amount per year; years beyond the array pay **nothing**
 * - `flat` — the same amount every year, indefinitely
 * - `none` — no special repayments at all (the break-even baseline)
 */
export type SpecialPlan =
  | { kind: "path"; years: number[] }
  | { kind: "flat"; annual: number }
  | { kind: "none" };

export type MortgageSimulationParams = {
  principal: number;
  interestRatePct: number;
  repaymentRatePct: number;
  fixedRateYears: number;
  specialPlan: SpecialPlan;
  specialRepaymentLimitRate: number;
};

export type YearlyMortgagePoint = {
  year: number;
  balance: number;
  interestTotal: number;
};

export type MortgageSimulation = {
  regularMonthlyPayment: number;
  interestTotal: number;
  interestFixed: number;
  remainingAfterFixed: number;
  runtimeYears: number;
  maxAnnualSpecial: number;
  usedAnnualSpecial: number;
  usedAnnualSpecialRepayments: number[];
  yearly: YearlyMortgagePoint[];
};

/**
 * Which constraint a scenario failed.
 * `cash` and `reserve` are deliberately separate: "you cannot complete the purchase"
 * and "you can complete it but your safety buffer is too thin" mean very different
 * things to a couple, and the old code collapsed both into one status.
 */
export type ConstraintId = "cash" | "reserve" | "burden";

export type ConstraintCheck = {
  id: ConstraintId;
  passed: boolean;
  actual: number;
  required: number;
  /** Signed shortfall. Negative means the constraint is missed by this much. */
  gap: number;
};

export type ScenarioDiagnosis = {
  checks: ConstraintCheck[];
  failed: ConstraintId[];
};

export type ScenarioResult = ScenarioBase & {
  interestRate: number;
  downPayment: number;
  loan: number;
  closingCosts: number;
  cashNeeded: number;
  cashLeft: number;
  reserveGap: number;
  allInMonthly: number;
  burdenRatio: number;
  rentDelta: number;
  propertyValueAtPayoff: number;
  realPropertyReturnRate: number;
  netWorthAtPayoff: number;
  mortgage: MortgageSimulation;
  feasible: boolean;
  diagnosis: ScenarioDiagnosis;
  status: string;
  statusTone: Tone;
};

export type SpecialBreakEven = {
  amount: number | null;
  feasible: boolean;
  maxSpecial: number;
};

export type WaitScenario = {
  scenario: ScenarioResult;
  /** 0 means "buy now" — the baseline column. */
  waitMonths: number;
  futurePrice: number;
  /**
   * Rent paid over the waiting period. DISPLAY ONLY — deliberately not subtracted from
   * `adjustedAvailableCapital`, because `waitSavingsMonthly` is already net of rent.
   * See docs/DECISIONS.md D4.
   */
  rentPaid: number;
  saved: number;
  adjustedAvailableCapital: number;
  adjustedInterestRate: number;
  futureLoan: number;
  cashLeftAfterPurchase: number;
  deltaInterest: number;
  years: number;
};

export type DecisionDiagnosis = {
  /** Constraints failed by every single scenario — the blocking problem. */
  failedInAll: ConstraintId[];
  /** The scenario that came closest, and by how much. Null when everything is feasible. */
  narrowestMiss: { scenarioId: ScenarioId; constraint: ConstraintId; gap: number } | null;
};

/**
 * Winners are drawn ONLY from feasible scenarios and are `null` when nothing is clean.
 * PRODUCT_SPEC §5.3: never present the least-bad option as though it were safe.
 */
export type DecisionResult = {
  feasibleScenarios: ScenarioResult[];
  noSafeScenario: boolean;
  recommendation: ScenarioResult | null;
  costMinimum: ScenarioResult | null;
  liquidityMaximum: ScenarioResult | null;
  monthlyMinimum: ScenarioResult | null;
  diagnosis: DecisionDiagnosis;
};

/**
 * The numerical form of the couple's disagreement: what more Eigenkapital buys,
 * and what it costs in foregone ETF growth.
 *
 * Every figure is measured over `horizonYears` (the fixed-rate period). Mixing a
 * 10-year ETF estimate with a 30-year interest total produces a meaningless number,
 * so the full-term figure is reported separately and flagged illustrative.
 */
export type EkTradeoff = {
  from: ScenarioResult;
  to: ScenarioResult;
  extraCashRequired: number;
  cashLeftDelta: number;
  monthlyDelta: number;
  remainingDebtDelta: number;
  horizonYears: number;
  /** Reliable: both sides are inside the fixed-rate period. */
  interestSavedFixed: number;
  /** Illustrative only: assumes today's rate holds for the whole term. */
  interestSavedTotal: number;
  etfForegone: number;
  /** interestSavedFixed − etfForegone. Positive favours more Eigenkapital. */
  netAdvantageFixed: number;
};

export type ExternalCheck = {
  monthlyPayment?: number;
  interestFixed?: number;
  remainingAfterFixed?: number;
};

export type ExternalDiff = {
  field: string;
  label: string;
  ours: number;
  theirs: number;
  abs: number;
  pct: number;
  withinTolerance: boolean;
};

export type ApartmentCase = {
  id: string;
  label: string;
  purchasePrice: number;
  renovation: number;
  monthlyOwnershipCosts: number;
  selectedScenarioId: ScenarioId;
  annualSpecialRepayments: number[];
};

export type ApartmentComparisonResult = {
  apartment: ApartmentCase;
  inputs: MortgageInputs;
  scenarios: ScenarioResult[];
  decision: DecisionResult;
  selectedScenario: ScenarioResult;
  averageSpecialRepayment: number;
  specialRepaymentTotal: number;
};

export function monthlyAnnuity(
  principal: number,
  interestRatePct: number,
  repaymentRatePct: number,
): number {
  return principal * ((interestRatePct + repaymentRatePct) / 100) / 12;
}

/** Amount requested for a given year, before the contractual cap. */
function requestedSpecialForYear(plan: SpecialPlan, yearIndex: number): number {
  switch (plan.kind) {
    case "none":
      return 0;
    case "flat":
      return Math.max(0, plan.annual);
    case "path":
      // Years beyond the entered path pay nothing. Falling back to a scalar here
      // used to keep an expired 10-year plan running forever, which inflated the
      // Sondertilgung strategy — one side of the couple's disagreement.
      return Math.max(0, plan.years[yearIndex] ?? 0);
  }
}

/** Whether the plan will ever pay anything — used to detect a non-amortising loan. */
function planEverPays(plan: SpecialPlan): boolean {
  switch (plan.kind) {
    case "none":
      return false;
    case "flat":
      return plan.annual > 0;
    case "path":
      return plan.years.some((amount) => amount > 0);
  }
}

export function simulateMortgage({
  principal,
  interestRatePct,
  repaymentRatePct,
  fixedRateYears,
  specialPlan,
  specialRepaymentLimitRate,
}: MortgageSimulationParams): MortgageSimulation {
  const safePrincipal = Math.max(0, principal);
  if (safePrincipal === 0) {
    return {
      regularMonthlyPayment: 0,
      interestTotal: 0,
      interestFixed: 0,
      remainingAfterFixed: 0,
      runtimeYears: 0,
      maxAnnualSpecial: 0,
      usedAnnualSpecial: 0,
      usedAnnualSpecialRepayments: [],
      yearly: [{ year: 0, balance: 0, interestTotal: 0 }],
    };
  }

  const monthlyRate = Math.max(0, interestRatePct) / 100 / 12;
  const regularMonthlyPayment = monthlyAnnuity(
    safePrincipal,
    interestRatePct,
    repaymentRatePct,
  );
  const maxAnnualSpecial = safePrincipal * (Math.max(0, specialRepaymentLimitRate) / 100);
  const usedAnnualSpecial = Math.min(
    requestedSpecialForYear(specialPlan, 0),
    maxAnnualSpecial,
  );
  const specialPlanEverPays = planEverPays(specialPlan);
  const usedAnnualSpecialRepayments: number[] = [];

  let balance = safePrincipal;
  let interestTotal = 0;
  let interestFixed = 0;
  let months = 0;
  let remainingAfterFixed = safePrincipal;
  const yearly: YearlyMortgagePoint[] = [
    { year: 0, balance: safePrincipal, interestTotal: 0 },
  ];

  while (balance > 0.01 && months < 80 * 12) {
    months += 1;
    const interest = balance * monthlyRate;
    const principalPart = Math.min(
      balance,
      Math.max(0, regularMonthlyPayment - interest),
    );

    balance -= principalPart;
    interestTotal += interest;

    if (months <= fixedRateYears * 12) {
      interestFixed += interest;
    }

    if (months % 12 === 0 && balance > 0.01) {
      const yearIndex = months / 12 - 1;
      const requestedSpecial = requestedSpecialForYear(specialPlan, yearIndex);
      const cappedSpecial = Math.min(requestedSpecial, maxAnnualSpecial);
      usedAnnualSpecialRepayments[yearIndex] = cappedSpecial;

      if (cappedSpecial > 0) {
        balance -= Math.min(balance, cappedSpecial);
      }
    }

    if (months === fixedRateYears * 12) {
      remainingAfterFixed = Math.max(0, balance);
    }

    if (months % 12 === 0 || balance <= 0.01) {
      yearly.push({
        year: months / 12,
        balance: Math.max(0, balance),
        interestTotal,
      });
    }

    // Non-amortising loan: the payment does not even cover interest and no special
    // repayment will ever arrive. Bail out rather than spin to the iteration limit.
    if (regularMonthlyPayment <= interest && !specialPlanEverPays) {
      break;
    }
  }

  return {
    regularMonthlyPayment,
    interestTotal,
    interestFixed,
    remainingAfterFixed:
      months < fixedRateYears * 12 ? Math.max(0, balance) : remainingAfterFixed,
    runtimeYears: months / 12,
    maxAnnualSpecial,
    usedAnnualSpecial,
    usedAnnualSpecialRepayments,
    yearly,
  };
}

export function calculateCashNeeded(
  purchasePrice: number,
  ekRate: number,
  closingCostRate: number,
  renovation: number,
  moving: number,
): number {
  const downPayment = purchasePrice * (ekRate / 100);
  const closingCosts = purchasePrice * (closingCostRate / 100);
  return downPayment + closingCosts + renovation + moving;
}

/** The Sondertilgung plan implied by the inputs, used when no explicit plan is given. */
export function planFromInputs(inputs: MortgageInputs): SpecialPlan {
  return { kind: "path", years: inputs.annualSpecialRepayments };
}

export function buildScenario(
  base: ScenarioBase,
  inputs: MortgageInputs,
  rates: InterestRates,
  specialPlan: SpecialPlan = planFromInputs(inputs),
): ScenarioResult {
  const downPayment = inputs.purchasePrice * (base.ekRate / 100);
  const loan = Math.max(0, inputs.purchasePrice - downPayment);
  const closingCosts = inputs.purchasePrice * (inputs.closingCostRate / 100);
  const cashNeeded = downPayment + closingCosts + inputs.renovation + inputs.moving;
  const mortgage = simulateMortgage({
    principal: loan,
    interestRatePct: rates[base.id],
    repaymentRatePct: inputs.repaymentRate,
    fixedRateYears: inputs.fixedRateYears,
    specialPlan,
    specialRepaymentLimitRate: inputs.specialRepaymentLimitRate,
  });
  const cashLeft = inputs.availableCapital - cashNeeded;
  const reserveGap = cashLeft - inputs.reserveTarget;
  const allInMonthly = mortgage.regularMonthlyPayment + inputs.monthlyOwnershipCosts;
  const burdenRatio = allInMonthly / Math.max(1, inputs.householdNetIncome);
  const rentDelta = allInMonthly - inputs.currentWarmRent;
  const propertyValueAtPayoff =
    inputs.purchasePrice *
    Math.pow(1 + inputs.propertyGrowthRate / 100, mortgage.runtimeYears);
  const realPropertyReturnRate = inputs.propertyGrowthRate - inputs.inflationRate;
  const netWorthAtPayoff = propertyValueAtPayoff - cashNeeded - mortgage.interestTotal;
  const maxBurdenRatio = inputs.maxBurdenRate / 100;
  const checks: ConstraintCheck[] = [
    // Can the purchase be completed at all?
    { id: "cash", passed: cashLeft >= 0, actual: cashLeft, required: 0, gap: cashLeft },
    // Is the safety buffer intact afterwards?
    {
      id: "reserve",
      passed: cashLeft >= inputs.reserveTarget,
      actual: cashLeft,
      required: inputs.reserveTarget,
      gap: cashLeft - inputs.reserveTarget,
    },
    // Is the monthly load bearable?
    {
      id: "burden",
      passed: burdenRatio <= maxBurdenRatio,
      actual: burdenRatio,
      required: maxBurdenRatio,
      gap: maxBurdenRatio - burdenRatio,
    },
  ];
  const failed = checks.filter((check) => !check.passed).map((check) => check.id);
  const diagnosis: ScenarioDiagnosis = { checks, failed };

  // Feasibility keys off the reserve and burden checks; `cash` is a strictly worse
  // subset of `reserve` and exists to tell the two failures apart in the UI.
  const feasible = cashLeft >= inputs.reserveTarget && burdenRatio <= maxBurdenRatio;

  let status = "OK";
  let statusTone: Tone = "green";
  if (failed.includes("cash")) {
    status = "Kauf nicht gedeckt";
    statusTone = "red";
  } else if (failed.includes("reserve")) {
    status = "Reserve verletzt";
    statusTone = "red";
  } else if (failed.includes("burden")) {
    status = "Monatlich eng";
    statusTone = "amber";
  } else if (cashLeft < inputs.reserveTarget * 1.5) {
    status = "Knapp";
    statusTone = "amber";
  }

  return {
    ...base,
    interestRate: rates[base.id],
    downPayment,
    loan,
    closingCosts,
    cashNeeded,
    cashLeft,
    reserveGap,
    allInMonthly,
    burdenRatio,
    rentDelta,
    propertyValueAtPayoff,
    realPropertyReturnRate,
    netWorthAtPayoff,
    mortgage,
    feasible,
    diagnosis,
    status,
    statusTone,
  };
}

export function buildScenarios(
  bases: ScenarioBase[],
  inputs: MortgageInputs,
  rates: InterestRates,
): ScenarioResult[] {
  return bases.map((base) => buildScenario(base, inputs, rates));
}

export function averageAnnualSpecialRepayment(
  annualSpecialRepayments: number[],
  fallback: number,
): number {
  if (annualSpecialRepayments.length === 0) {
    return Math.max(0, fallback);
  }

  const total = annualSpecialRepayments.reduce(
    (sum, amount) => sum + Math.max(0, amount),
    0,
  );
  return total / annualSpecialRepayments.length;
}

export function buildApartmentInputs(
  baseInputs: MortgageInputs,
  apartment: ApartmentCase,
): MortgageInputs {
  const annualSpecialRepayment = averageAnnualSpecialRepayment(
    apartment.annualSpecialRepayments,
    baseInputs.annualSpecialRepayment,
  );

  return {
    ...baseInputs,
    purchasePrice: apartment.purchasePrice,
    renovation: apartment.renovation,
    monthlyOwnershipCosts: apartment.monthlyOwnershipCosts,
    annualSpecialRepayment,
    annualSpecialRepayments: apartment.annualSpecialRepayments,
  };
}

export function compareApartmentCases(
  apartments: ApartmentCase[],
  scenarioBases: ScenarioBase[],
  baseInputs: MortgageInputs,
  rates: InterestRates,
): ApartmentComparisonResult[] {
  return apartments.map((apartment) => {
    const apartmentInputs = buildApartmentInputs(baseInputs, apartment);
    const scenarios = buildScenarios(scenarioBases, apartmentInputs, rates);
    const decision = evaluateDecision(scenarios);
    const selectedScenario =
      scenarios.find((scenario) => scenario.id === apartment.selectedScenarioId) ??
      decision.recommendation ??
      scenarios[0];

    return {
      apartment,
      inputs: apartmentInputs,
      scenarios,
      decision,
      selectedScenario,
      averageSpecialRepayment: averageAnnualSpecialRepayment(
        apartment.annualSpecialRepayments,
        baseInputs.annualSpecialRepayment,
      ),
      specialRepaymentTotal: apartment.annualSpecialRepayments.reduce(
        (sum, amount) => sum + Math.max(0, amount),
        0,
      ),
    };
  });
}

/** Lowest `score` wins. Returns null for an empty list rather than throwing. */
function pickBest(
  scenarios: ScenarioResult[],
  score: (scenario: ScenarioResult) => number,
): ScenarioResult | null {
  return scenarios.reduce<ScenarioResult | null>(
    (best, scenario) => (best === null || score(scenario) < score(best) ? scenario : best),
    null,
  );
}

/** Constraints failed by every scenario — the problem that blocks the whole decision. */
function constraintsFailedInAll(scenarios: ScenarioResult[]): ConstraintId[] {
  if (scenarios.length === 0) {
    return [];
  }

  const candidates: ConstraintId[] = ["cash", "reserve", "burden"];
  return candidates.filter((id) =>
    scenarios.every((scenario) => scenario.diagnosis.failed.includes(id)),
  );
}

/**
 * The infeasible scenario that came closest, and its primary blocker.
 *
 * Ranked by how many constraints failed; ties keep the given scenario order.
 * NOTE: `gap` is in € for `cash`/`reserve` and a ratio for `burden` — the consumer
 * must format according to `constraint`.
 */
function findNarrowestMiss(scenarios: ScenarioResult[]): DecisionDiagnosis["narrowestMiss"] {
  const infeasible = scenarios.filter((scenario) => !scenario.feasible);
  if (infeasible.length === 0) {
    return null;
  }

  const closest = infeasible.reduce((best, scenario) =>
    scenario.diagnosis.failed.length < best.diagnosis.failed.length ? scenario : best,
  );
  const priority: ConstraintId[] = ["cash", "reserve", "burden"];
  const blocker = priority.find((id) => closest.diagnosis.failed.includes(id));
  if (!blocker) {
    return null;
  }

  const check = closest.diagnosis.checks.find((candidate) => candidate.id === blocker);
  return { scenarioId: closest.id, constraint: blocker, gap: check?.gap ?? 0 };
}

export function evaluateDecision(scenarios: ScenarioResult[]): DecisionResult {
  const feasibleScenarios = scenarios.filter((scenario) => scenario.feasible);
  const noSafeScenario = feasibleScenarios.length === 0;
  const preferred10 = feasibleScenarios.find((scenario) => scenario.id === "ek10");
  const lowestInterestFeasible = pickBest(
    feasibleScenarios,
    (scenario) => scenario.mortgage.interestTotal,
  );

  return {
    feasibleScenarios,
    noSafeScenario,
    recommendation: noSafeScenario ? null : preferred10 ?? lowestInterestFeasible,
    // Winners come only from feasible scenarios: naming a "winner" while nothing is
    // clean would present the least-bad option as safe. PRODUCT_SPEC §5.3.
    costMinimum: pickBest(feasibleScenarios, (scenario) => scenario.mortgage.interestTotal),
    liquidityMaximum: pickBest(feasibleScenarios, (scenario) => -scenario.cashLeft),
    monthlyMinimum: pickBest(feasibleScenarios, (scenario) => scenario.allInMonthly),
    diagnosis: {
      failedInAll: constraintsFailedInAll(scenarios),
      narrowestMiss: findNarrowestMiss(scenarios),
    },
  };
}

/**
 * What more Eigenkapital buys and what it costs — the couple's disagreement as a number.
 * All comparable figures share one horizon (the fixed-rate period); see EkTradeoff.
 */
export function compareEkScenarios(
  from: ScenarioResult,
  to: ScenarioResult,
  inputs: MortgageInputs,
): EkTradeoff {
  const extraCashRequired = to.cashNeeded - from.cashNeeded;
  const horizonYears = inputs.fixedRateYears;
  const interestSavedFixed = from.mortgage.interestFixed - to.mortgage.interestFixed;
  const etfForegone = opportunityCost(
    Math.max(0, extraCashRequired),
    inputs.etfReturnRate,
    horizonYears,
  );

  return {
    from,
    to,
    extraCashRequired,
    cashLeftDelta: to.cashLeft - from.cashLeft,
    monthlyDelta: to.allInMonthly - from.allInMonthly,
    remainingDebtDelta:
      to.mortgage.remainingAfterFixed - from.mortgage.remainingAfterFixed,
    horizonYears,
    interestSavedFixed,
    interestSavedTotal: from.mortgage.interestTotal - to.mortgage.interestTotal,
    etfForegone,
    netAdvantageFixed: interestSavedFixed - etfForegone,
  };
}

/** Compare our numbers against an external calculator or a bank offer. PRODUCT_SPEC §19. */
export function compareExternal(
  scenario: ScenarioResult,
  external: ExternalCheck,
  tolerancePct = 1,
): ExternalDiff[] {
  const fields: { field: keyof ExternalCheck; label: string; ours: number }[] = [
    { field: "monthlyPayment", label: "Monatsrate", ours: scenario.mortgage.regularMonthlyPayment },
    { field: "interestFixed", label: "Zinsen in der Zinsbindung", ours: scenario.mortgage.interestFixed },
    { field: "remainingAfterFixed", label: "Restschuld nach Zinsbindung", ours: scenario.mortgage.remainingAfterFixed },
  ];

  return fields.flatMap(({ field, label, ours }) => {
    const theirs = external[field];
    if (theirs == null || !Number.isFinite(theirs)) {
      return [];
    }

    const abs = ours - theirs;
    const pct = theirs === 0 ? 0 : (abs / theirs) * 100;
    return [{
      field,
      label,
      ours,
      theirs,
      abs,
      pct,
      withinTolerance: Math.abs(pct) <= tolerancePct,
    }];
  });
}

/**
 * Total interest for a scenario running a given Sondertilgung plan.
 * Use with `{ kind: "none" }` to get the break-even target: 15% EK making no special
 * repayments at all. See docs/DECISIONS.md D1.
 */
export function interestForPlan(
  scenarioBase: ScenarioBase,
  inputs: MortgageInputs,
  rates: InterestRates,
  plan: SpecialPlan,
): number {
  return buildScenario(scenarioBase, inputs, rates, plan).mortgage.interestTotal;
}

/**
 * How much flat annual Sondertilgung this scenario needs to reach `targetInterest`.
 *
 * `targetInterest` must be produced under a stated baseline — pass it in from
 * `interestForPlan(ek15, ..., { kind: "none" })` for the default question. Comparing a
 * flat-repaying candidate against a target that itself runs a full yearly path
 * understates the answer, which is what the code used to do implicitly.
 */
export function requiredSpecialToMatch(
  scenarioBase: ScenarioBase,
  targetInterest: number,
  inputs: MortgageInputs,
  rates: InterestRates,
): SpecialBreakEven {
  const loan = inputs.purchasePrice * (1 - scenarioBase.ekRate / 100);
  const maxSpecial = loan * (inputs.specialRepaymentLimitRate / 100);
  const interestAt = (annual: number) =>
    interestForPlan(scenarioBase, inputs, rates, { kind: "flat", annual });

  if (interestForPlan(scenarioBase, inputs, rates, { kind: "none" }) <= targetInterest) {
    return { amount: 0, feasible: true, maxSpecial };
  }

  if (interestAt(maxSpecial) > targetInterest) {
    return { amount: null, feasible: false, maxSpecial };
  }

  // Interest decreases monotonically in the annual amount, so bisect.
  let low = 0;
  let high = maxSpecial;
  for (let i = 0; i < 40; i += 1) {
    const mid = (low + high) / 2;
    if (interestAt(mid) > targetInterest) {
      low = mid;
    } else {
      high = mid;
    }
  }

  return { amount: high, feasible: true, maxSpecial };
}

export function buildWaitScenario(
  selectedBase: ScenarioBase,
  selectedNow: ScenarioResult,
  inputs: MortgageInputs,
  rates: InterestRates,
  waitMonths: number = inputs.waitMonths,
): WaitScenario {
  const years = waitMonths / 12;
  const futurePrice =
    inputs.purchasePrice * Math.pow(1 + inputs.waitPropertyGrowthRate / 100, years);
  const rentPaid = inputs.currentWarmRent * waitMonths;
  const saved = inputs.waitSavingsMonthly * waitMonths;
  // Rent is NOT subtracted: `waitSavingsMonthly` is already the net amount that reaches
  // Eigenkapital after rent. Subtracting it here as well double-counted it and made
  // waiting look far worse than it is. See docs/DECISIONS.md D4.
  const adjustedAvailableCapital = inputs.availableCapital + saved;
  const adjustedInterestRate = Math.max(
    0.1,
    rates[selectedBase.id] + (waitMonths > 0 ? inputs.waitRateShift : 0),
  );
  const futureInputs: MortgageInputs = {
    ...inputs,
    purchasePrice: futurePrice,
    availableCapital: adjustedAvailableCapital,
  };
  const futureRates: InterestRates = {
    ...rates,
    [selectedBase.id]: adjustedInterestRate,
  };
  const scenario = buildScenario(selectedBase, futureInputs, futureRates);

  return {
    scenario,
    waitMonths,
    futurePrice,
    rentPaid,
    saved,
    adjustedAvailableCapital,
    adjustedInterestRate,
    futureLoan: scenario.loan,
    cashLeftAfterPurchase: scenario.cashLeft,
    deltaInterest: scenario.mortgage.interestTotal - selectedNow.mortgage.interestTotal,
    years,
  };
}

/**
 * Buy-now against one or more waiting periods, side by side.
 * Pass `0` for the buy-now baseline column: no time passes, so no savings accrue,
 * no rent is paid and the rate shift does not apply.
 */
export function buildWaitScenarios(
  selectedBase: ScenarioBase,
  selectedNow: ScenarioResult,
  inputs: MortgageInputs,
  rates: InterestRates,
  months: number[] = [0, 12, 24],
): WaitScenario[] {
  return months.map((waitMonths) =>
    buildWaitScenario(selectedBase, selectedNow, inputs, rates, waitMonths),
  );
}

export function opportunityCost(
  amount: number,
  annualReturnPct: number,
  years: number,
): number {
  if (amount <= 0 || years <= 0) {
    return 0;
  }

  return amount * (Math.pow(1 + annualReturnPct / 100, years) - 1);
}
