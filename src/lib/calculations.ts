export type ScenarioId = "ek10" | "ek15" | "ek20";
export type Tone = "green" | "amber" | "red" | "blue" | "slate" | "orange";

/**
 * The two Sollzinsbindungen the bank actually quoted. There is no third column, so
 * there is no third option: a freely typed binding would have no rate behind it and
 * would only pretend to compute something.
 */
export const FIXED_PERIODS = [10, 15] as const;
export type FixedPeriod = (typeof FIXED_PERIODS)[number];

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
  /**
   * The monthly annuity, identical across every EK level. THIS is the contract input;
   * the Tilgungssatz is derived per scenario from it. The bank's offers hold the rate
   * constant and let Tilgung rise with Eigenkapital, and so does this model — holding
   * Tilgung constant instead understated what more Eigenkapital buys by 35.494 € of
   * remaining debt after ten years. See docs/DECISIONS.md D14.
   */
  monthlyPayment: number;
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

/**
 * The Sollzins depends on two axes, not one: how much Eigenkapital goes in AND how
 * long the rate is fixed. The bank quoted both, and they do not move together — at a
 * 15-year binding 10% and 15% EK carry the identical rate, and the real drop only
 * arrives at 80% Beleihung. Nothing here may assume monotonicity across EK levels.
 */
export type InterestRates = Record<FixedPeriod, Record<ScenarioId, number>>;

/** Nearest supported binding. Guards old saved states that still hold 20 years. */
export function normaliseFixedPeriod(fixedRateYears: number): FixedPeriod {
  return fixedRateYears <= 12.5 ? 10 : 15;
}

export function rateFor(
  rates: InterestRates,
  fixedRateYears: number,
  id: ScenarioId,
): number {
  return rates[normaliseFixedPeriod(fixedRateYears)]?.[id] ?? 0;
}

export type ScenarioBase = {
  id: ScenarioId;
  ekRate: number;
  label: string;
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
 *
 * `payment` exists because the monthly rate became a free input: one that does not
 * cover the monthly interest produces a loan that never amortises, and reporting that
 * as "80 years" would be a number pretending to be an answer.
 */
export type ConstraintId = "payment" | "cash" | "reserve" | "burden";

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
  /** Derived from the monthly payment, not entered — differs per EK level. */
  repaymentRate: number;
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
  /**
   * True when the entered Monatsrate cannot amortise the loan and the model simulated
   * a higher one instead. Every derived figure — Laufzeit, Zinsen, Restschuld — then
   * belongs to `mortgage.regularMonthlyPayment`, not to what the couple typed, and the
   * UI has to say so. See docs/ASSUMPTIONS.md K14.
   */
  paymentSubstituted: boolean;
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
  /**
   * Near zero by construction — the monthly rate is held constant across EK levels.
   * Kept because it is still a true figure, but `runtimeDelta` is what actually moves.
   */
  monthlyDelta: number;
  /** Negative = debt-free this many years sooner. What more Eigenkapital really buys. */
  runtimeDelta: number;
  horizonYears: number;
  /** Reliable: both sides are inside the fixed-rate period. */
  interestSavedFixed: number;
  etfForegone: number;
  /** interestSavedFixed − etfForegone. Positive favours more Eigenkapital. */
  netAdvantageFixed: number;
};

export type ApartmentCase = {
  id: string;
  label: string;
  purchasePrice: number;
  renovation: number;
  monthlyOwnershipCosts: number;
  annualSpecialRepayments: number[];
};

export type ApartmentComparisonResult = {
  apartment: ApartmentCase;
  inputs: MortgageInputs;
  scenarios: ScenarioResult[];
  decision: DecisionResult;
  /** This apartment at the EK level the couple has selected on screen. */
  selectedScenario: ScenarioResult;
};

export function monthlyAnnuity(
  principal: number,
  interestRatePct: number,
  repaymentRatePct: number,
): number {
  return principal * ((interestRatePct + repaymentRatePct) / 100) / 12;
}

/*
 * Anfangstilgung, Laufzeit and Monatsrate are three ways of saying the same thing:
 * fix any one and the other two follow. These closed-form conversions let the user
 * enter whichever they actually know ("we can pay 2.400 €/month", "we want to be
 * done in 25 years") instead of being forced to think in Tilgungssatz.
 *
 * They deliberately ignore Sondertilgung — they describe the *contract*, not the
 * plan. The real payoff date, which extra repayments pull forward, comes from
 * simulateMortgage().
 */

/** Years to full repayment at a given initial repayment rate, without Sondertilgung. */
export function runtimeYearsFromRepaymentRate(
  interestRatePct: number,
  repaymentRatePct: number,
): number {
  if (repaymentRatePct <= 0) return Infinity;
  if (interestRatePct <= 0) return 100 / repaymentRatePct;

  const ratio = interestRatePct / (interestRatePct + repaymentRatePct);
  if (ratio >= 1) return Infinity;

  const monthlyRate = interestRatePct / 1200;
  return -Math.log(1 - ratio) / Math.log(1 + monthlyRate) / 12;
}

/** The initial repayment rate that pays the loan off in exactly `years`. */
export function repaymentRateFromRuntimeYears(
  interestRatePct: number,
  years: number,
): number {
  if (years <= 0) return 0;
  if (interestRatePct <= 0) return 100 / years;

  const monthlyRate = interestRatePct / 1200;
  const months = years * 12;
  const growth = Math.pow(1 + monthlyRate, months);
  const monthlyFactor = (monthlyRate * growth) / (growth - 1);
  return Math.max(0.01, (monthlyFactor * 12 - interestRatePct / 100) * 100);
}

/** The initial repayment rate implied by a target monthly payment. */
export function repaymentRateFromMonthlyPayment(
  loan: number,
  interestRatePct: number,
  monthlyPayment: number,
): number {
  if (loan <= 0) return 0;
  return Math.max(0.01, (monthlyPayment * 1200) / loan - interestRatePct);
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
  const cashNeeded = calculateCashNeeded(
    inputs.purchasePrice,
    base.ekRate,
    inputs.closingCostRate,
    inputs.renovation,
    inputs.moving,
  );
  const interestRate = rateFor(rates, inputs.fixedRateYears, base.id);
  // Same € every month at every EK level; the Tilgungssatz is what moves. Verified
  // against the broker's Tilgungsplan: 405.000 € at 3,87 % and 1.900 €/month yields
  // 1,759630 % and reproduces their 10-year figures to the cent.
  const repaymentRate = repaymentRateFromMonthlyPayment(loan, interestRate, inputs.monthlyPayment);
  const mortgage = simulateMortgage({
    principal: loan,
    interestRatePct: interestRate,
    repaymentRatePct: repaymentRate,
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
  // Interest-only floor: below this the balance never falls, whatever the plan says.
  const interestOnlyPayment = (loan * interestRate) / 1200;
  const amortises = inputs.monthlyPayment > interestOnlyPayment && mortgage.runtimeYears <= 60;
  // `repaymentRateFromMonthlyPayment` floors the Tilgungssatz at 0,01%, so the simulated
  // annuity equals the entered one exactly unless that floor bit. When it did, the whole
  // scenario describes a payment nobody asked for and must be labelled, not just failed.
  const paymentSubstituted = mortgage.regularMonthlyPayment > inputs.monthlyPayment + 0.5;
  const checks: ConstraintCheck[] = [
    // Does the rate repay the loan at all, within a lifetime?
    {
      id: "payment",
      passed: amortises,
      actual: inputs.monthlyPayment,
      required: interestOnlyPayment,
      gap: inputs.monthlyPayment - interestOnlyPayment,
    },
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

  // Feasibility keys off the payment, reserve and burden checks; `cash` is a strictly
  // worse subset of `reserve` and exists to tell the two failures apart in the UI.
  const feasible =
    amortises && cashLeft >= inputs.reserveTarget && burdenRatio <= maxBurdenRatio;

  // Plain-language labels: these are read aloud between two non-experts, so they say
  // what is wrong rather than naming an internal constraint.
  let status = "Tragbar";
  let statusTone: Tone = "green";
  if (failed.includes("payment")) {
    status = "Rate zu niedrig";
    statusTone = "red";
  } else if (failed.includes("cash")) {
    status = "Geld reicht nicht";
    statusTone = "red";
  } else if (failed.includes("reserve")) {
    status = "Reserve zu dünn";
    statusTone = "red";
  } else if (failed.includes("burden")) {
    status = "Rate zu hoch";
    statusTone = "amber";
  } else if (cashLeft < inputs.reserveTarget * 1.5) {
    status = "Gerade so tragbar";
    statusTone = "amber";
  }

  return {
    ...base,
    interestRate,
    repaymentRate,
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
    paymentSubstituted,
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

/**
 * Every apartment at one EK level — the one selected on screen.
 *
 * `selectedId` is a parameter rather than a property of the apartment: `ApartmentCase`
 * used to carry a `selectedScenarioId` that no control ever wrote, so it sat frozen at
 * its default while the page showed whatever the doors had selected. An apartment is
 * the context a decision is made in, not a place to keep a second copy of it (D3).
 */
export function compareApartmentCases(
  apartments: ApartmentCase[],
  scenarioBases: ScenarioBase[],
  baseInputs: MortgageInputs,
  rates: InterestRates,
  selectedId: ScenarioId,
): ApartmentComparisonResult[] {
  return apartments.map((apartment) => {
    const apartmentInputs = buildApartmentInputs(baseInputs, apartment);
    const scenarios = buildScenarios(scenarioBases, apartmentInputs, rates);
    const decision = evaluateDecision(scenarios);
    const selectedScenario =
      scenarios.find((scenario) => scenario.id === selectedId) ?? scenarios[0];

    return { apartment, inputs: apartmentInputs, scenarios, decision, selectedScenario };
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

  const candidates: ConstraintId[] = ["payment", "cash", "reserve", "burden"];
  return candidates.filter((id) =>
    scenarios.every((scenario) => scenario.diagnosis.failed.includes(id)),
  );
}

/**
 * The infeasible scenario that came closest, and its primary blocker.
 *
 * Ranked by how many constraints failed; ties keep the given scenario order.
 * NOTE: `gap` carries a different unit per constraint — € for `cash`/`reserve`,
 * €/Monat for `payment`, a ratio for `burden`. The consumer must format according to
 * `constraint`; this list omitted `payment` and the UI printed it as a one-off €.
 */
function findNarrowestMiss(scenarios: ScenarioResult[]): DecisionDiagnosis["narrowestMiss"] {
  const infeasible = scenarios.filter((scenario) => !scenario.feasible);
  if (infeasible.length === 0) {
    return null;
  }

  const closest = infeasible.reduce((best, scenario) =>
    scenario.diagnosis.failed.length < best.diagnosis.failed.length ? scenario : best,
  );
  const priority: ConstraintId[] = ["payment", "cash", "reserve", "burden"];
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
    monthlyDelta: to.allInMonthly - from.allInMonthly,
    runtimeDelta: to.mortgage.runtimeYears - from.mortgage.runtimeYears,
    horizonYears,
    interestSavedFixed,
    etfForegone,
    netAdvantageFixed: interestSavedFixed - etfForegone,
  };
}

/**
 * Total interest for a scenario running a given Sondertilgung plan.
 * Use with `{ kind: "none" }` for the break-even target — an EK level making no
 * special repayments at all. See docs/DECISIONS.md D1, D17.
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
 * `interestForPlan(other, ..., { kind: "none" })`. Comparing a flat-repaying candidate
 * against a target that itself runs a full yearly path understates the answer, which
 * is what the code used to do implicitly.
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

/**
 * Who would have to pay extra to close the gap between two EK levels.
 *
 * The direction is the whole point. "Your choice needs 7.400 €/year" and "20% EK
 * needs 7.400 €/year" are different statements about different people's money, and
 * the old freely-chosen-baseline UI let them be confused for one another.
 */
export type SpecialCatchUp = {
  payer: "selection" | "row";
  /**
   * Flat annual amount, paid **every year for the whole runtime**. Null = unreachable
   * under the cap. It is not comparable to the yearly plan's average: the plan is a
   * finite path (ten years, then nothing), so the same € figure buys less interest.
   * Use `planCovers` for "does our plan get there", never a comparison against the average.
   */
  amount: number | null;
  maxSpecial: number;
  /** The payer is already at least as cheap, so nothing is required. */
  alreadyAhead: boolean;
  /** Total interest the payer has to reach. */
  targetInterest: number;
  /** The payer's modelled total interest running the configured yearly path. */
  payerInterestWithPlan: number;
  /**
   * Whether that modelled path — not its average — already reaches the target.
   * The UI once answered this by comparing `annualSpecialRepayment` against `amount`,
   * which claimed a ten-year 6.000 €/Jahr plan covered a 5.712 €/Jahr indefinite
   * requirement while it was in fact 15.519 € of interest short. See docs/DECISIONS.md D22.
   */
  planCovers: boolean;
  /** Interest the payer is still short. ≤ 0 once the path reaches the target. */
  planShortfall: number;
};

export type SpecialMatchRow = {
  base: ScenarioBase;
  isSelected: boolean;
  /** Total interest for this EK level with no special repayments at all. */
  interestNoSpecial: number;
  /** Total interest for this EK level running the configured yearly plan. */
  interestWithPlan: number;
  /** This row without Sondertilgung minus the selection with its plan. Negative = row is cheaper. */
  deltaToSelection: number;
  /** Null on the selected row — a scenario does not catch up with itself. */
  catchUp: SpecialCatchUp | null;
};

export type SpecialComparison = {
  selectionInterestNoSpecial: number;
  selectionInterestWithPlan: number;
  /** Negative = the plan saves this much interest. */
  planSaving: number;
  rows: SpecialMatchRow[];
};

/**
 * Measures every EK level against the one the couple has actually selected, running
 * its current yearly plan.
 *
 * The reference point used to be freely choosable, with a second control for "with or
 * without Sondertilgung". Two pickers meant four readings of the same table and the
 * owner could not tell which question was on screen. There is only one question worth
 * asking here — "what does our Sondertilgung buy us, and does it close the gap to the
 * other EK levels?" — so the selection above is the reference and nothing is chosen
 * twice. See docs/DECISIONS.md D17.
 */
export function compareSpecialScenarios(
  bases: ScenarioBase[],
  selectedId: ScenarioId,
  inputs: MortgageInputs,
  rates: InterestRates,
): SpecialComparison {
  const selectedBase = bases.find((base) => base.id === selectedId) ?? bases[0];
  const selectionInterestNoSpecial = interestForPlan(selectedBase, inputs, rates, { kind: "none" });
  const selectionInterestWithPlan = interestForPlan(
    selectedBase,
    inputs,
    rates,
    planFromInputs(inputs),
  );

  const rows = bases.map((base) => {
    const interestNoSpecial = interestForPlan(base, inputs, rates, { kind: "none" });
    const interestWithPlan = interestForPlan(base, inputs, rates, planFromInputs(inputs));

    let catchUp: SpecialCatchUp | null = null;
    if (base.id !== selectedBase.id) {
      // Whoever is behind is the one who has to pay. Measured against the other side
      // running no Sondertilgung, because that is the honest comparison: the other EK
      // level is not obliged to adopt our plan.
      const rowIsCheaper = interestNoSpecial < selectionInterestWithPlan;
      const payer = rowIsCheaper ? "selection" : "row";
      const target = rowIsCheaper ? interestNoSpecial : selectionInterestWithPlan;
      const chaser = rowIsCheaper ? selectedBase : base;
      const required = requiredSpecialToMatch(chaser, target, inputs, rates);
      // What the payer's configured yearly path actually achieves, so "covered" is
      // decided on modelled interest instead of on the path's average € figure.
      const payerInterestWithPlan = rowIsCheaper ? selectionInterestWithPlan : interestWithPlan;

      catchUp = {
        payer,
        amount: required.amount,
        maxSpecial: required.maxSpecial,
        alreadyAhead: required.amount === 0,
        targetInterest: target,
        payerInterestWithPlan,
        planCovers: payerInterestWithPlan <= target,
        planShortfall: payerInterestWithPlan - target,
      };
    }

    return {
      base,
      isSelected: base.id === selectedBase.id,
      interestNoSpecial,
      interestWithPlan,
      deltaToSelection: interestNoSpecial - selectionInterestWithPlan,
      catchUp,
    };
  });

  return {
    selectionInterestNoSpecial,
    selectionInterestWithPlan,
    planSaving: selectionInterestWithPlan - selectionInterestNoSpecial,
    rows,
  };
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
    rateFor(rates, inputs.fixedRateYears, selectedBase.id) +
      (waitMonths > 0 ? inputs.waitRateShift : 0),
  );
  const futureInputs: MortgageInputs = {
    ...inputs,
    purchasePrice: futurePrice,
    availableCapital: adjustedAvailableCapital,
  };
  // Only the column actually in use is shifted — the other binding's rates are not
  // a forecast this function has any basis to move.
  const period = normaliseFixedPeriod(inputs.fixedRateYears);
  const futureRates: InterestRates = {
    ...rates,
    [period]: { ...rates[period], [selectedBase.id]: adjustedInterestRate },
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
 * The columns the Warten table shows: the buy-now baseline, the spec's two reference
 * periods (PRODUCT_SPEC §7.5), and whatever the couple typed into "Wartezeit".
 *
 * That last one is the point. The table used to be hardcoded to `[0, 12, 24]` while
 * "Wartezeit" sat above it as a highlighted input — stored, persisted, and read by
 * nothing. Deduplicated, so the default of 12 does not produce two identical columns.
 */
export function waitPeriodsFor(waitMonths: number): number[] {
  const requested = Number.isFinite(waitMonths) ? Math.max(0, Math.round(waitMonths)) : 0;
  return [...new Set([0, 12, 24, requested])].sort((a, b) => a - b);
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
