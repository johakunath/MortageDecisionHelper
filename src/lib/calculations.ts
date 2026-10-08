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
  | "wealth";

export const BETTER_WHEN: Record<MetricKey, "higher" | "lower"> = {
  cashLeft: "higher",
  interestTotal: "lower",
  interestFixed: "lower",
  allInMonthly: "lower",
  remainingAfterFixed: "lower",
  wealth: "higher",
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
  /**
   * Tax on ETF gains when they are realised, in percent of the gain. The default
   * 18,4625% is Abgeltungsteuer 25% plus Soli 5,5% on it, applied to 70% of the gain
   * (Teilfreistellung for equity ETFs): 26,375% × 0,7. Kirchensteuer raises it, an
   * unused Sparerpauschbetrag lowers it.
   *
   * It belongs in every ETF comparison because the other side of it is tax-free: the
   * interest an owner-occupier does not pay is not income. Comparing pre-tax ETF growth
   * against tax-free interest saved flipped the headline verdict on all three default
   * apartments. See docs/ASSUMPTIONS.md K18.
   */
  etfTaxRate: number;
  /**
   * How much higher the Anschlusszins might be than today's Sollzins, in percentage
   * points. A stress test, not a forecast: nobody knows the rate in ten years, but the
   * Restschuld that has to be refinanced at it is known, and so is what a shock does to
   * it. See docs/DECISIONS.md D31.
   */
  refiStressShift: number;
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
  /**
   * Called once per simulated month with what was paid. Read-only: it observes the
   * schedule and cannot change it, so the offer-pinned amortisation stays exactly as
   * it is. Used by `wealthAtHorizon` to follow the cash month by month.
   */
  onMonth?: (entry: MortgageMonth) => void;
};

export type MortgageMonth = {
  /** 1 = the first month after disbursement. */
  month: number;
  interest: number;
  principal: number;
  /** Sondertilgung applied at the end of this month (only at loan-year ends). */
  special: number;
  balance: number;
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
  /**
   * Signed shortfall. Negative means the constraint is missed by this much.
   *
   * For `payment` the bar is the smallest Monatsrate that clears the loan within 60
   * years **under the configured Sondertilgung plan** — the same plan the pass
   * condition reads its runtime from, so the gap and the verdict cannot disagree about
   * what is running.
   */
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
  /**
   * The full extra cost of waiting: `deltaInterest + rentPaid`.
   *
   * Interest alone understates it. While the waiting column pays rent for a home it
   * does not own, the buy-now column is already paying interest over exactly those
   * months — and that interest sits inside its `interestTotal`. So rent is the
   * waiting side's counterpart to it, and adding the two is a comparison of like
   * with like rather than a double count. See docs/ASSUMPTIONS.md §2 (Waiting).
   */
  deltaTotalCost: number;
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
 *
 * There is deliberately no single `recommendation`. It used to prefer "10% EK", a rule
 * written when 10% was the middle of 5/10/15. Since D15 it is the lowest level, so the
 * rule named the maximum-liquidity option in the verdict headline, which is one side of
 * the couple's disagreement chosen by code. The verdict now lists `feasibleScenarios`
 * and leaves the choice to the two people reading it. See docs/DECISIONS.md D28.
 */
export type DecisionResult = {
  feasibleScenarios: ScenarioResult[];
  noSafeScenario: boolean;
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
  /** Growth the extra capital would have earned in the ETF over the horizon, before tax. */
  etfForegoneGross: number;
  /**
   * The same growth after tax on realising it at the horizon: what would actually be
   * there to compare. The interest saved needs no such adjustment: it is tax-free.
   */
  etfForegone: number;
  /** interestSavedFixed − etfForegone (after tax). Positive favours more Eigenkapital. */
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
  onMonth,
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

    let appliedSpecial = 0;
    if (months % 12 === 0 && balance > 0.01) {
      const yearIndex = months / 12 - 1;
      const requestedSpecial = requestedSpecialForYear(specialPlan, yearIndex);
      const cappedSpecial = Math.min(requestedSpecial, maxAnnualSpecial);
      usedAnnualSpecialRepayments[yearIndex] = cappedSpecial;

      if (cappedSpecial > 0) {
        appliedSpecial = Math.min(balance, cappedSpecial);
        balance -= appliedSpecial;
      }
    }

    onMonth?.({
      month: months,
      interest,
      principal: principalPart,
      special: appliedSpecial,
      balance: Math.max(0, balance),
    });

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

/**
 * The smallest Monatsrate that clears the loan inside the 60-year horizon, **under the
 * Sondertilgung plan that is actually running**.
 *
 * The plan has to be in here because the pass condition already is: feasibility reads
 * the simulated runtime, which the plan shortens. A bar computed without it overstates
 * what is missing — 1.350 €/Monat with 2.000 €/Jahr for ten years needs about 41 € more,
 * not the 99 € a no-plan bar reports.
 *
 * Closed form when nothing is repaid early; otherwise bisected, because the runtime
 * under a yearly path has no closed form. Runtime is non-increasing in the payment, so
 * the no-plan annuity is always a valid upper bound.
 */
export function minimumPaymentForLifetime(
  loan: number,
  interestRatePct: number,
  fixedRateYears: number,
  specialPlan: SpecialPlan,
  specialRepaymentLimitRate: number,
  horizonYears = 60,
): number {
  if (loan <= 0) {
    return 0;
  }

  const withoutPlan = monthlyAnnuity(
    loan,
    interestRatePct,
    repaymentRateFromRuntimeYears(interestRatePct, horizonYears),
  );
  if (!planEverPays(specialPlan)) {
    return withoutPlan;
  }

  const runtimeAt = (payment: number) =>
    simulateMortgage({
      principal: loan,
      interestRatePct,
      repaymentRatePct: repaymentRateFromMonthlyPayment(loan, interestRatePct, payment),
      fixedRateYears,
      specialPlan,
      specialRepaymentLimitRate,
    }).runtimeYears;

  let low = 0;
  let high = withoutPlan;
  for (let i = 0; i < 30; i += 1) {
    const mid = (low + high) / 2;
    if (runtimeAt(mid) > horizonYears) {
      low = mid;
    } else {
      high = mid;
    }
  }

  return high;
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
  // No "net worth at payoff" here any more. It was valued at each scenario's own payoff
  // year, so the same flat was worth 67.000 € more at 10% EK than at 20% purely because
  // that loan runs five years longer. Wealth is compared on one common date by
  // `wealthAtHorizon` instead (K19).
  const maxBurdenRatio = inputs.maxBurdenRate / 100;
  // Interest-only floor: below this the balance never falls, whatever the plan says.
  const interestOnlyPayment = (loan * interestRate) / 1200;
  const amortises = inputs.monthlyPayment > interestOnlyPayment && mortgage.runtimeYears <= 60;
  // The bar the check actually applies: the smallest annuity that clears the loan
  // inside the 60-year horizon, under the same plan the pass condition is read from.
  // Reporting the shortfall against `interestOnlyPayment` instead produced a POSITIVE
  // gap for a payment that clears the interest but would take 80 years — and the UI
  // printed that as an amount still missing. K17.
  const minimumPayment = minimumPaymentForLifetime(
    loan,
    interestRate,
    inputs.fixedRateYears,
    specialPlan,
    inputs.specialRepaymentLimitRate,
  );
  // `repaymentRateFromMonthlyPayment` floors the Tilgungssatz at 0,01%. Detect that
  // floor from the unrounded implied rate rather than from a euro tolerance: close to
  // the boundary the substituted annuity can differ by only a few cents, but the
  // derived Laufzeit, Zinsen and Restschuld still belong to a payment nobody entered.
  const impliedRepaymentRate = (inputs.monthlyPayment * 1200) / loan - interestRate;
  const paymentSubstituted = loan > 0 && impliedRepaymentRate < 0.01;
  const checks: ConstraintCheck[] = [
    // Does the rate repay the loan at all, within a lifetime?
    {
      id: "payment",
      passed: amortises,
      actual: inputs.monthlyPayment,
      required: minimumPayment,
      gap: inputs.monthlyPayment - minimumPayment,
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

  return {
    feasibleScenarios,
    noSafeScenario,
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
  const etfForegoneGross = opportunityCost(
    Math.max(0, extraCashRequired),
    inputs.etfReturnRate,
    horizonYears,
  );
  // Taxed, because the interest it is set against is not: an owner-occupier's saved
  // interest is no income. Untaxed, this flipped the verdict on every default apartment
  // toward "mehr Liquidität" (K18).
  const etfForegone = etfForegoneGross * (1 - clampRate(inputs.etfTaxRate) / 100);

  return {
    from,
    to,
    extraCashRequired,
    monthlyDelta: to.allInMonthly - from.allInMonthly,
    runtimeDelta: to.mortgage.runtimeYears - from.mortgage.runtimeYears,
    horizonYears,
    interestSavedFixed,
    etfForegoneGross,
    etfForegone,
    netAdvantageFixed: interestSavedFixed - etfForegone,
  };
}

export type EkStepReturn = {
  from: ScenarioResult;
  to: ScenarioResult;
  /** Extra cash `to` needs over `from`. */
  extraCash: number;
  /** How much lower `to`'s Restschuld is at the end of the binding. */
  debtReduction: number;
  /**
   * What the extra Eigenkapital earns per year inside the binding, tax-free and without
   * market risk: the rate at which `extraCash` grows into `debtReduction` over the
   * binding. At one Monatsrate that is exactly extra EK plus interest saved (pinned in
   * invariants.test.ts). Null when `to` needs no extra cash.
   */
  annualReturn: number | null;
  /** The pre-tax ETF return at which keeping the money invested does exactly as well. */
  breakEvenEtfReturn: number | null;
  /** Whether the extra EK beats the ETF assumption, after its tax. Null without extra cash. */
  ekAhead: boolean | null;
};

/**
 * The return on one step of extra Eigenkapital, in the unit the couple's disagreement
 * is actually about: a yearly rate, set against the ETF.
 *
 * The headline compares only the two ends (10% vs 20%). Per step the answer can differ
 * because the bank's pricing is not monotone: on the offer, 10→15% earns about 4,1%
 * a year and 15→20% about 5,0%, against roughly 4,2% for a 5% ETF after tax. See
 * docs/DECISIONS.md D32.
 */
export function ekStepReturn(
  from: ScenarioResult,
  to: ScenarioResult,
  inputs: MortgageInputs,
): EkStepReturn {
  const years = inputs.fixedRateYears;
  const extraCash = to.cashNeeded - from.cashNeeded;
  const debtReduction = from.mortgage.remainingAfterFixed - to.mortgage.remainingAfterFixed;
  if (extraCash <= 0 || years <= 0) {
    return { from, to, extraCash, debtReduction, annualReturn: null, breakEvenEtfReturn: null, ekAhead: null };
  }

  const multiple = debtReduction / extraCash;
  const annualReturn = multiple > 0 ? (Math.pow(multiple, 1 / years) - 1) * 100 : -100;
  const keep = 1 - clampRate(inputs.etfTaxRate) / 100;
  // ETF gain needed so that, after tax, the kept money ends where the extra EK does.
  const grossGrowth = keep > 0 ? 1 + (multiple - 1) / keep : Infinity;
  const breakEvenEtfReturn =
    grossGrowth > 0 && Number.isFinite(grossGrowth)
      ? (Math.pow(grossGrowth, 1 / years) - 1) * 100
      : null;
  const etfEnd = 1 + (Math.pow(1 + inputs.etfReturnRate / 100, years) - 1) * keep;

  return {
    from,
    to,
    extraCash,
    debtReduction,
    annualReturn,
    breakEvenEtfReturn,
    ekAhead: multiple > etfEnd,
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

/**
 * The price and the Sollzins a purchase after `waitMonths` would meet: the price grown
 * at the waiting assumption, the rate moved by the assumed shift. Shared by the Warten
 * table and `wealthAtHorizon`, so the two can never disagree about what waiting buys.
 */
function purchaseAfterWaiting(
  base: ScenarioBase,
  inputs: MortgageInputs,
  rates: InterestRates,
  waitMonths: number,
): { futurePrice: number; adjustedInterestRate: number; purchaseRates: InterestRates } {
  const futurePrice =
    inputs.purchasePrice * Math.pow(1 + inputs.waitPropertyGrowthRate / 100, waitMonths / 12);
  const adjustedInterestRate = Math.max(
    0.1,
    rateFor(rates, inputs.fixedRateYears, base.id) + (waitMonths > 0 ? inputs.waitRateShift : 0),
  );
  // Only the column actually in use is shifted: the other binding's rates are not a
  // forecast this function has any basis to move.
  const period = normaliseFixedPeriod(inputs.fixedRateYears);
  const purchaseRates: InterestRates = {
    ...rates,
    [period]: { ...rates[period], [base.id]: adjustedInterestRate },
  };
  return { futurePrice, adjustedInterestRate, purchaseRates };
}

export function buildWaitScenario(
  selectedBase: ScenarioBase,
  selectedNow: ScenarioResult,
  inputs: MortgageInputs,
  rates: InterestRates,
  waitMonths: number = inputs.waitMonths,
): WaitScenario {
  const years = waitMonths / 12;
  const { futurePrice, adjustedInterestRate, purchaseRates } = purchaseAfterWaiting(
    selectedBase,
    inputs,
    rates,
    waitMonths,
  );
  // Zero for the buy-now column, so `deltaTotalCost` collapses to the interest delta there.
  const rentPaid = inputs.currentWarmRent * waitMonths;
  const saved = inputs.waitSavingsMonthly * waitMonths;
  // Rent is NOT subtracted: `waitSavingsMonthly` is already the net amount that reaches
  // Eigenkapital after rent. Subtracting it here as well double-counted it and made
  // waiting look far worse than it is. See docs/DECISIONS.md D4.
  const adjustedAvailableCapital = inputs.availableCapital + saved;
  const futureInputs: MortgageInputs = {
    ...inputs,
    purchasePrice: futurePrice,
    availableCapital: adjustedAvailableCapital,
  };
  const scenario = buildScenario(selectedBase, futureInputs, purchaseRates);
  const deltaInterest = scenario.mortgage.interestTotal - selectedNow.mortgage.interestTotal;

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
    deltaInterest,
    // Rent is added to the DELTA, never to `adjustedAvailableCapital` — D4 still holds.
    // The two are different questions: what waiting costs, and what capital it leaves.
    deltaTotalCost: deltaInterest + rentPaid,
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

export type WealthPathParams = {
  base: ScenarioBase;
  inputs: MortgageInputs;
  rates: InterestRates;
  /** Months of renting before the purchase. 0 = buy now. */
  waitMonths?: number;
  /** Defaults to the yearly plan in `inputs`. */
  specialPlan?: SpecialPlan;
  /**
   * The common date every path is valued at, in months from today. Defaults to the
   * Zinsbindung: the longest span over which every rate in play is contractually known
   * (a later purchase is still inside its own binding then). Beyond it the figure
   * inherits the constant-rate assumption of ASSUMPTIONS §1.
   */
  horizonMonths?: number;
};

export type WealthAtHorizon = {
  horizonMonths: number;
  /** What was paid for the flat, at the month of purchase. */
  purchasePrice: number;
  loan: number;
  /** Market value of the flat at the horizon. Identical across every path for one flat. */
  propertyValue: number;
  debt: number;
  /** Free capital at the horizon, before tax on its gains. */
  liquid: number;
  /**
   * Tax on that capital's gains if realised at the horizon. Linear in the gain, so it
   * turns negative where withdrawals (a down payment, Sondertilgung) leave the pot below
   * what was put in: that is the after-tax growth those withdrawals gave up.
   */
  liquidTax: number;
  /** propertyValue − debt + liquid − liquidTax. */
  wealth: number;
  /** Sondertilgung actually paid by the horizon, after the contractual cap. */
  specialPaid: number;
  /** Rent paid before the purchase. */
  rentPaid: number;
};

/**
 * Everything the household owns at one common date: the flat, minus what is still owed,
 * plus the free capital, after tax on its gains. Followed month by month.
 *
 * This is the comparison every other one in the app approximates. Each of them used to
 * compare on its own basis: interest alone, interest plus rent, pre-tax ETF growth, a
 * full-term total at each path's own payoff date. Several defects came from exactly
 * that (K1, K10, K15, K18, the old Nettovermögen). Here every path pays the same
 * household out of the same budget and is valued on the same day, so a difference
 * between two calls is a like-for-like difference and nothing else.
 *
 * The household budget for housing plus saving is `waitSavingsMonthly + currentWarmRent`.
 * That is D4's definition read the other way round: the net savings rate is what is left
 * after rent, so rent plus savings is what is available for housing at all. Before the
 * purchase the household pays rent from it; after, the Monatsrate and the ownership
 * costs. Whatever is left, and the starting capital not spent on the purchase, is
 * invested at the ETF assumption; Sondertilgung is drawn from it. The amortisation
 * itself is `simulateMortgage`, observed through `onMonth`, so the offer-pinned schedule
 * is reused, not re-implemented.
 */
export function wealthAtHorizon(params: WealthPathParams): WealthAtHorizon {
  const { base, inputs, rates } = params;
  const waitMonths = Math.max(0, Math.round(params.waitMonths ?? 0));
  const horizonMonths = Math.max(
    waitMonths,
    Math.round(params.horizonMonths ?? inputs.fixedRateYears * 12),
  );
  const specialPlan = params.specialPlan ?? planFromInputs(inputs);
  const monthlyReturn = Math.pow(1 + inputs.etfReturnRate / 100, 1 / 12) - 1;
  const budget = inputs.waitSavingsMonthly + inputs.currentWarmRent;

  let liquid = inputs.availableCapital;
  let contributed = liquid;
  const move = (amount: number) => {
    liquid += amount;
    contributed += amount;
  };

  // Renting until the purchase.
  for (let month = 1; month <= waitMonths; month += 1) {
    liquid *= 1 + monthlyReturn;
    move(budget - inputs.currentWarmRent);
  }

  const { futurePrice, purchaseRates } = purchaseAfterWaiting(base, inputs, rates, waitMonths);
  const purchase = buildScenario(
    base,
    { ...inputs, purchasePrice: futurePrice },
    purchaseRates,
    specialPlan,
  );
  move(-purchase.cashNeeded);

  // Owning, until the horizon. Months after the loan is repaid carry no bank payment.
  const loanMonths = horizonMonths - waitMonths;
  const paidToBank = new Array<number>(loanMonths + 1).fill(0);
  const specialByMonth = new Array<number>(loanMonths + 1).fill(0);
  let debt = purchase.loan;
  simulateMortgage({
    principal: purchase.loan,
    interestRatePct: purchase.interestRate,
    repaymentRatePct: purchase.repaymentRate,
    fixedRateYears: inputs.fixedRateYears,
    specialPlan,
    specialRepaymentLimitRate: inputs.specialRepaymentLimitRate,
    onMonth: (entry) => {
      if (entry.month > loanMonths) return;
      paidToBank[entry.month] = entry.interest + entry.principal;
      specialByMonth[entry.month] = entry.special;
      debt = entry.balance;
    },
  });
  if (loanMonths === 0) debt = purchase.loan;

  let specialPaid = 0;
  for (let month = 1; month <= loanMonths; month += 1) {
    liquid *= 1 + monthlyReturn;
    move(budget - inputs.monthlyOwnershipCosts - paidToBank[month] - specialByMonth[month]);
    specialPaid += specialByMonth[month];
  }

  const propertyValue =
    inputs.purchasePrice * Math.pow(1 + inputs.propertyGrowthRate / 100, horizonMonths / 12);
  const liquidTax = (liquid - contributed) * (clampRate(inputs.etfTaxRate) / 100);

  return {
    horizonMonths,
    purchasePrice: futurePrice,
    loan: purchase.loan,
    propertyValue,
    debt,
    liquid,
    liquidTax,
    wealth: propertyValue - debt + liquid - liquidTax,
    specialPaid,
    rentPaid: inputs.currentWarmRent * waitMonths,
  };
}

export type RefinanceStress = {
  /** False when the loan is repaid inside the binding: there is nothing to refinance. */
  applies: boolean;
  stressRate: number;
  /** Whether the same Monatsrate still covers the interest on the Restschuld at that rate. */
  coversInterest: boolean;
  /** Years to debt-free in total, at today's rate after the binding (the usual assumption). */
  runtimeYearsAtSameRate: number;
  /** Years to debt-free in total if the rate after the binding is `stressRate`. Infinity if never. */
  runtimeYearsStressed: number;
  /** `runtimeYearsStressed − runtimeYearsAtSameRate`. */
  extraYears: number;
};

/**
 * The refinancing risk as one number: at the same Monatsrate, how much longer the loan
 * runs if the Anschlusszins is `refiStressShift` points above today's.
 *
 * The Restschuld after the binding was already on screen, but a balance does not say
 * what it means. Holding the rate constant keeps D14's reading (the Monatsrate is the
 * budget) and makes the risk comparable across EK levels: more Eigenkapital leaves less
 * debt exposed to the new rate. Both runtimes are computed the same way, from the
 * Restschuld onward with the rest of the yearly plan, so only the rate differs.
 */
export function refinanceStress(scenario: ScenarioResult, inputs: MortgageInputs): RefinanceStress {
  const fixedYears = inputs.fixedRateYears;
  const remaining = scenario.mortgage.remainingAfterFixed;
  const stressRate = Math.max(0, scenario.interestRate + inputs.refiStressShift);
  const payment = scenario.mortgage.regularMonthlyPayment;
  const laterPlan: SpecialPlan = {
    kind: "path",
    years: inputs.annualSpecialRepayments.slice(Math.round(fixedYears)),
  };

  if (remaining <= 0.01 || !Number.isFinite(remaining)) {
    const runtime = scenario.mortgage.runtimeYears;
    return {
      applies: false,
      stressRate,
      coversInterest: true,
      runtimeYearsAtSameRate: runtime,
      runtimeYearsStressed: runtime,
      extraYears: 0,
    };
  }

  const followUp = (ratePct: number): { covers: boolean; years: number } => {
    const covers = payment > (remaining * ratePct) / 1200;
    if (!covers) return { covers, years: Infinity };
    const simulation = simulateMortgage({
      principal: remaining,
      interestRatePct: ratePct,
      repaymentRatePct: repaymentRateFromMonthlyPayment(remaining, ratePct, payment),
      fixedRateYears: 0,
      specialPlan: laterPlan,
      specialRepaymentLimitRate: inputs.specialRepaymentLimitRate,
    });
    return { covers, years: simulation.runtimeYears };
  };

  const same = followUp(scenario.interestRate);
  const stressed = followUp(stressRate);
  const runtimeYearsAtSameRate = fixedYears + same.years;
  const runtimeYearsStressed = fixedYears + stressed.years;

  return {
    applies: true,
    stressRate,
    coversInterest: stressed.covers,
    runtimeYearsAtSameRate,
    runtimeYearsStressed,
    extraYears: runtimeYearsStressed - runtimeYearsAtSameRate,
  };
}

export type SpecialPlanEffect = {
  horizonMonths: number;
  /** Sondertilgung actually paid by the end of the binding, after the cap. */
  paid: number;
  /** How much lower the Restschuld is at the end of the binding. Reliable. */
  debtReduction: number;
  /** `debtReduction − paid`: interest not paid inside the binding thanks to the plan. */
  interestSaved: number;
  /**
   * Wealth with the plan minus wealth without it, on the same date and from the same
   * budget: the plan's money kept invested at the ETF assumption instead, after tax.
   * Positive = the plan beats keeping the money in the ETF.
   */
  wealthDelta: number;
};

/**
 * What the yearly plan buys inside the binding, measured the same way the EK trade-off
 * is: against the same money kept invested, after tax, on one date.
 *
 * The section used to lead with "Das bringt der Plan: 78.750 € gespart", a full-term
 * interest total at a rate nobody can know for 24 years, and with no opportunity cost,
 * while section 1 charged extra Eigenkapital an ETF opportunity cost. Two frames for
 * the same decision (K20).
 */
export function specialPlanEffect(
  base: ScenarioBase,
  inputs: MortgageInputs,
  rates: InterestRates,
): SpecialPlanEffect {
  const withPlan = wealthAtHorizon({ base, inputs, rates });
  const without = wealthAtHorizon({ base, inputs, rates, specialPlan: { kind: "none" } });
  const debtReduction = without.debt - withPlan.debt;

  return {
    horizonMonths: withPlan.horizonMonths,
    paid: withPlan.specialPaid,
    debtReduction,
    interestSaved: debtReduction - withPlan.specialPaid,
    wealthDelta: withPlan.wealth - without.wealth,
  };
}

/** A tax rate in percent, kept inside 0–100 so a stray input cannot invert a gain. */
function clampRate(ratePct: number): number {
  return Number.isFinite(ratePct) ? Math.min(100, Math.max(0, ratePct)) : 0;
}

/**
 * The ETF return per year that is left after tax on realising the gain at the end of
 * `years`: the figure that is comparable with a tax-free mortgage rate. Tax is paid
 * once, on the whole gain, so the after-tax rate depends on the holding period.
 */
export function afterTaxAnnualReturn(
  annualReturnPct: number,
  taxRatePct: number,
  years: number,
): number {
  if (years <= 0) {
    return annualReturnPct * (1 - clampRate(taxRatePct) / 100);
  }

  const gain = Math.pow(1 + annualReturnPct / 100, years) - 1;
  const netGrowth = 1 + gain * (1 - clampRate(taxRatePct) / 100);
  return netGrowth > 0 ? (Math.pow(netGrowth, 1 / years) - 1) * 100 : -100;
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
