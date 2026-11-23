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
  /**
   * Everything owning costs per month except the loan, on the same basis as the warm
   * rent (heating and Nebenkosten in, electricity out). For an apartment it is built by
   * `buildApartmentInputs` as `hausgeld + ownerExtraMonthly`; the QA presets set it
   * directly. See docs/DECISIONS.md D35.
   */
  monthlyOwnershipCosts: number;
  /**
   * What an owner pays on top of the Hausgeld: Grundsteuer (billed by the municipality,
   * never part of the Hausgeld) and an own reserve for the inside of the flat, which the
   * WEG's Erhaltungsrücklage does not cover. A flat estimate, not a per-flat figure.
   */
  ownerExtraMonthly: number;
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
  /**
   * A KfW loan inside the financing: its fixed amount and Sollzins. Owned by the
   * apartment (0 = none). The model blends it with the bank's rate into one rate per EK
   * level, weighted by amount; the KfW part is fixed, so more EK only shrinks the bank
   * part and the blend differs by EK level (D42, ASSUMPTIONS §4.19).
   */
  kfwAmount: number;
  kfwRate: number;
  /** The KfW loan's term in years, its repayment-free year included (D44). */
  kfwTermYears: number;
  /**
   * Months from signing to moving in (Neubau). The Zinsbindung starts at signing, but
   * the annuity starts only at handover, so the loan amortises for this much less of
   * the binding. 0 for a flat that is moved into at once. Owned by the apartment (D42).
   */
  moveInMonths: number;
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
  /**
   * Debt-free after at most this many years, e.g. by the older partner's retirement.
   * A scenario that runs longer stays tragbar but is flagged: the runtime rests on
   * today's rate holding for the whole term (ASSUMPTIONS §1), so it is a warning, not a
   * failed constraint. See docs/DECISIONS.md D34.
   */
  maxRuntimeYears: number;
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

/**
 * One Sollzins for a loan made of a bank part and a fixed KfW part, weighted by amount.
 * Exact for the interest of the first month; afterwards an approximation, because the
 * two parts would amortise at their own pace (ASSUMPTIONS §4.19).
 */
export function blendedRate(
  bankRatePct: number,
  loan: number,
  kfwAmount: number,
  kfwRatePct: number,
): number {
  if (loan <= 0 || kfwAmount <= 0) return bankRatePct;
  const kfw = Math.min(kfwAmount, loan);
  return (kfw * kfwRatePct + (loan - kfw) * bankRatePct) / loan;
}

/**
 * The months the loan amortises inside the Zinsbindung: the binding minus the time
 * until the flat is handed over (D42). Every horizon "within the binding" uses this;
 * only the rate lookup still reads `fixedRateYears`, because the bank prices the
 * binding it signs, not the part of it that is left after the handover.
 */
export function bindingMonths(inputs: Pick<MortgageInputs, "fixedRateYears" | "moveInMonths">): number {
  return Math.max(0, Math.round(inputs.fixedRateYears * 12) - Math.max(0, Math.round(inputs.moveInMonths ?? 0)));
}

export function bindingYears(inputs: Pick<MortgageInputs, "fixedRateYears" | "moveInMonths">): number {
  return bindingMonths(inputs) / 12;
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
   * Months of the same loan already behind this simulation, for a follow-up that
   * continues it (the refinancing). Sondertilgung then falls on the original loan's
   * year-ends and reads the plan at the original year index. 0 = a new loan.
   */
  monthOffset?: number;
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
export type ConstraintId = "payment" | "cash" | "reserve" | "runtime" | "burden";

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
  /** Failed checks that make a scenario not tragbar: payment, cash, burden. */
  failed: ConstraintId[];
  /**
   * Failed checks that are shown but do not block (D44): the reserve target and the
   * retirement deadline. Both are negotiable; the couple decides, not the code.
   */
  warnings: ConstraintId[];
};

/** The constraints that make a scenario not tragbar. Reserve and runtime only warn (D44). */
export const BLOCKING_CONSTRAINTS: ConstraintId[] = ["payment", "cash", "burden"];

export type ScenarioResult = ScenarioBase & {
  /** The rate the loan pays on average at the start: the bank's, blended with KfW. */
  interestRate: number;
  /** The bank's own Sollzins for this EK level. Equals `interestRate` without KfW. */
  bankRate: number;
  /** The KfW part of `loan` (0 = none). Modelled as a loan of its own (D44). */
  kfwPart: number;
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
  /**
   * Not repaid within `maxRuntimeYears` of signing at the regular rate, the bank's
   * usual condition (repaid by retirement). A warning, not a failed constraint: some
   * banks accept the couple's Sondertilgung against it (D44, superseding D43).
   */
  runsPastLimit: boolean;
  /** Years from signing until repaid at the regular rate, without any Sondertilgung. */
  contractYearsFromSigning: number;
  /** Years from signing until repaid with the Sondertilgung plan that is running. */
  debtFreeYearsFromSigning: number;
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
   * Rent paid over the waiting period. Never subtracted from `adjustedAvailableCapital`,
   * because `waitSavingsMonthly` is already net of rent (D4). In the ledger it is paid
   * out of the household budget, which is where it belongs.
   */
  rentPaid: number;
  saved: number;
  adjustedAvailableCapital: number;
  adjustedInterestRate: number;
  futureLoan: number;
  /** Free capital right after the purchase, from the ledger: savings and their return included. */
  cashLeftAfterPurchase: number;
  /** This path on the common date. */
  wealth: WealthAtHorizon;
  /**
   * Wealth minus buying now, both on the same date. Positive = waiting comes out ahead.
   *
   * Replaces D27's "Δ gesamt" (full-term interest delta + rent). That sum left out the
   * buy-now path's ownership costs and principal, the return on capital while waiting
   * and the extra cash the later purchase leaves, and it extrapolated the assumed rate
   * shift over 25+ years: on the offer flat it read "6.662 € teurer" where the ledger
   * puts waiting 3.207 € ahead. See docs/DECISIONS.md D33.
   */
  deltaWealth: number;
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
  /**
   * Wealth with more EK minus wealth with less, at the end of the binding, from the
   * ledger. Equals `interestSavedFixed − etfForegone` while both loans run through the
   * binding; also counts freed payments once one is repaid earlier. Positive favours
   * more Eigenkapital.
   */
  netAdvantageFixed: number;
};

export type ApartmentCase = {
  id: string;
  label: string;
  purchasePrice: number;
  renovation: number;
  /**
   * The monthly Hausgeld as the Exposé or Wirtschaftsplan states it: WEG administration,
   * building insurance, Betriebskosten, the WEG's Erhaltungsrücklage and, with central
   * heating, heating. Not Grundsteuer, not repairs inside the flat: those come from
   * `ownerExtraMonthly`. A number the couple can look up, which "Eigentumskosten" was not.
   */
  hausgeld: number;
  /**
   * Kaufnebenkosten in % of this apartment's price. Per apartment because the Makler
   * is a property of the offer: one flat with Käuferprovision (11,57%) and one sold
   * directly by the developer (8%) differ by ~23.000 € on 650k (D40).
   */
  closingCostRate: number;
  /** KfW loan amount, Sollzins and term for this apartment; amount 0 = none (D42, D44). */
  kfwAmount: number;
  kfwRate: number;
  kfwTermYears: number;
  /** Months from signing to handover; 0 = moved into at once (D42). */
  moveInMonths: number;
  /**
   * The parking space's share of `purchasePrice`, which already includes it. Read only
   * to show what the space costs; the model finances the whole price (D42).
   */
  parkingPrice: number;
  /**
   * The Monatsrate of this apartment's loan, the same for all three EK levels. Per
   * apartment because a rate sized for a 405k loan does not even cover the interest on
   * a 590k one; one global rate made every larger flat "nicht tragbar" by construction (D40).
   */
  monthlyPayment: number;
  annualSpecialRepayments: number[];
  /** Free text: address, Makler, link to the Exposé. Never read by the model. */
  note?: string;
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
  monthOffset = 0,
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

  // Rounded once: a binding shortened by a handover delay is a fractional number of
  // years, and `months === years * 12` must not hinge on floating-point luck.
  const fixedMonths = Math.round(fixedRateYears * 12);
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

    if (months <= fixedMonths) {
      interestFixed += interest;
    }

    let appliedSpecial = 0;
    const loanMonth = months + monthOffset;
    if (loanMonth % 12 === 0 && balance > 0.01) {
      const yearIndex = loanMonth / 12 - 1;
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

    if (months === fixedMonths) {
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
      months < fixedMonths ? Math.max(0, balance) : remainingAfterFixed,
    runtimeYears: months / 12,
    maxAnnualSpecial,
    usedAnnualSpecial,
    usedAnnualSpecialRepayments,
    yearly,
  };
}

/**
 * KfW 300's repayment-free start (D44): one year, as the owners were told. The term is
 * the apartment's `kfwTermYears`, counted from the start of repayment and including
 * this year.
 */
export const KFW_GRACE_MONTHS = 12;

/** The KfW part's monthly annuity after its repayment-free months. */
export function kfwAnnuity(principal: number, ratePct: number, termYears: number): number {
  if (principal <= 0) return 0;
  const months = Math.max(1, Math.round(termYears * 12) - KFW_GRACE_MONTHS);
  const monthly = Math.max(0, ratePct) / 1200;
  if (monthly === 0) return principal / months;
  return (principal * monthly) / (1 - Math.pow(1 + monthly, -months));
}

export type SplitLoanParams = {
  bankPrincipal: number;
  bankRatePct: number;
  kfwPrincipal: number;
  kfwRatePct: number;
  kfwTermYears: number;
  /**
   * The total Monatsrate once the KfW part repays: its annuity plus the bank's. The
   * bank part gets the rest and keeps it; in the KfW's repayment-free year the couple
   * pays only the KfW interest on top, so the first year is cheaper.
   */
  monthlyPayment: number;
  fixedRateYears: number;
  specialPlan: SpecialPlan;
  /** Cap as a share of the ORIGINAL BANK loan: KfW 300 takes no Sondertilgung. */
  specialRepaymentLimitRate: number;
  /** Points added to both rates after this many months: the refinancing stress. */
  rateShift?: { afterMonths: number; points: number };
  onMonth?: (entry: MortgageMonth) => void;
};

/**
 * A bank loan and a KfW loan, run side by side and reported as one (D44). Each has its
 * own rate and annuity; the KfW part repays nothing in its first year, and Sondertilgung
 * only ever goes into the bank part. The result has the same shape as a single loan, so
 * every chart and the ledger read it unchanged. `amortises` is false when either part
 * never falls (its payment does not cover its interest).
 */
export function simulateSplitLoan(params: SplitLoanParams): MortgageSimulation & { amortises: boolean } {
  let bank = Math.max(0, params.bankPrincipal);
  let kfw = Math.max(0, params.kfwPrincipal);
  const principal = bank + kfw;
  const kfwPayment = kfwAnnuity(kfw, params.kfwRatePct, params.kfwTermYears);
  const bankPayment = params.monthlyPayment - kfwPayment;
  const fixedMonths = Math.round(params.fixedRateYears * 12);
  const maxAnnualSpecial = bank * (Math.max(0, params.specialRepaymentLimitRate) / 100);
  const usedAnnualSpecial = Math.min(requestedSpecialForYear(params.specialPlan, 0), maxAnnualSpecial);
  const planPays = planEverPays(params.specialPlan);
  const usedAnnualSpecialRepayments: number[] = [];
  const yearly: YearlyMortgagePoint[] = [{ year: 0, balance: principal, interestTotal: 0 }];

  let interestTotal = 0;
  let interestFixed = 0;
  let remainingAfterFixed = principal;
  let months = 0;
  let amortises = true;

  while (bank + kfw > 0.01 && months < 80 * 12) {
    months += 1;
    const shift = params.rateShift && months > params.rateShift.afterMonths ? params.rateShift.points : 0;
    const bankInterest = (bank * Math.max(0, params.bankRatePct + shift)) / 1200;
    const kfwInterest = (kfw * Math.max(0, params.kfwRatePct + shift)) / 1200;
    const bankPart = bank > 0.01 ? Math.min(bank, Math.max(0, bankPayment - bankInterest)) : 0;
    const kfwPart =
      kfw > 0.01 && months > KFW_GRACE_MONTHS ? Math.min(kfw, Math.max(0, kfwPayment - kfwInterest)) : 0;
    bank -= bankPart;
    kfw -= kfwPart;
    const interest = bankInterest + kfwInterest;
    interestTotal += interest;
    if (months <= fixedMonths) interestFixed += interest;

    let appliedSpecial = 0;
    if (months % 12 === 0 && bank > 0.01) {
      const yearIndex = months / 12 - 1;
      const capped = Math.min(requestedSpecialForYear(params.specialPlan, yearIndex), maxAnnualSpecial);
      usedAnnualSpecialRepayments[yearIndex] = capped;
      appliedSpecial = Math.min(bank, capped);
      bank -= appliedSpecial;
    }

    params.onMonth?.({
      month: months,
      interest,
      principal: bankPart + kfwPart,
      special: appliedSpecial,
      balance: Math.max(0, bank + kfw),
    });

    if (months === fixedMonths) remainingAfterFixed = Math.max(0, bank + kfw);
    if (months % 12 === 0 || bank + kfw <= 0.01) {
      yearly.push({ year: months / 12, balance: Math.max(0, bank + kfw), interestTotal });
    }

    const bankStuck = bank > 0.01 && bankPayment <= bankInterest && !planPays;
    const kfwStuck = kfw > 0.01 && months > KFW_GRACE_MONTHS && kfwPayment <= kfwInterest;
    if (bankStuck || kfwStuck) {
      amortises = false;
      break;
    }
  }
  if (bank + kfw > 0.01) amortises = false;

  return {
    regularMonthlyPayment: params.monthlyPayment,
    interestTotal,
    interestFixed,
    remainingAfterFixed: months < fixedMonths ? Math.max(0, bank + kfw) : remainingAfterFixed,
    runtimeYears: months / 12,
    maxAnnualSpecial,
    usedAnnualSpecial,
    usedAnnualSpecialRepayments,
    yearly,
    amortises,
  };
}

/** The smallest total Monatsrate at which both parts are repaid within `horizonYears`. */
function minimumSplitPayment(
  base: Omit<SplitLoanParams, "monthlyPayment">,
  horizonYears = 60,
): number {
  const bankFloor = monthlyAnnuity(
    base.bankPrincipal,
    base.bankRatePct,
    repaymentRateFromRuntimeYears(base.bankRatePct, horizonYears),
  );
  let low = 0;
  let high = kfwAnnuity(base.kfwPrincipal, base.kfwRatePct, base.kfwTermYears) + bankFloor;
  const runtimeAt = (payment: number) => {
    const run = simulateSplitLoan({ ...base, monthlyPayment: payment });
    return run.amortises ? run.runtimeYears : Infinity;
  };
  for (let i = 0; i < 30; i += 1) {
    const mid = (low + high) / 2;
    if (runtimeAt(mid) > horizonYears) low = mid;
    else high = mid;
  }
  return high;
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
  const bankRate = rateFor(rates, inputs.fixedRateYears, base.id);
  const kfwPart = Math.min(Math.max(0, inputs.kfwAmount), loan);
  const interestRate = blendedRate(bankRate, loan, inputs.kfwAmount, inputs.kfwRate);
  // Same € every month at every EK level; the Tilgungssatz is what moves. Verified
  // against the broker's Tilgungsplan: 405.000 € at 3,87 % and 1.900 €/month yields
  // 1,759630 % and reproduces their 10-year figures to the cent. With KfW it is only a
  // display figure: the two parts amortise on their own (D44).
  const repaymentRate =
    kfwPart > 0
      ? Math.max(0, (inputs.monthlyPayment * 1200) / loan - interestRate)
      : repaymentRateFromMonthlyPayment(loan, interestRate, inputs.monthlyPayment);
  const splitBase =
    kfwPart > 0
      ? {
          bankPrincipal: loan - kfwPart,
          bankRatePct: bankRate,
          kfwPrincipal: kfwPart,
          kfwRatePct: inputs.kfwRate,
          kfwTermYears: inputs.kfwTermYears,
          fixedRateYears: bindingYears(inputs),
          specialRepaymentLimitRate: inputs.specialRepaymentLimitRate,
        }
      : null;
  const split = splitBase
    ? simulateSplitLoan({ ...splitBase, monthlyPayment: inputs.monthlyPayment, specialPlan })
    : null;
  const mortgage: MortgageSimulation =
    split ??
    simulateMortgage({
      principal: loan,
      interestRatePct: interestRate,
      repaymentRatePct: repaymentRate,
      fixedRateYears: bindingYears(inputs),
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
  const amortises = split
    ? split.amortises && mortgage.runtimeYears <= 60
    : inputs.monthlyPayment > interestOnlyPayment && mortgage.runtimeYears <= 60;
  // The bar the check actually applies: the smallest annuity that clears the loan
  // inside the 60-year horizon, under the same plan the pass condition is read from.
  // Reporting the shortfall against `interestOnlyPayment` instead produced a POSITIVE
  // gap for a payment that clears the interest but would take 80 years — and the UI
  // printed that as an amount still missing. K17.
  const minimumPayment = splitBase
    ? minimumSplitPayment({ ...splitBase, specialPlan })
    : minimumPaymentForLifetime(
        loan,
        interestRate,
        bindingYears(inputs),
        specialPlan,
        inputs.specialRepaymentLimitRate,
      );
  // `repaymentRateFromMonthlyPayment` floors the Tilgungssatz at 0,01%. Detect that
  // floor from the unrounded implied rate rather than from a euro tolerance: close to
  // the boundary the substituted annuity can differ by only a few cents, but the
  // derived Laufzeit, Zinsen and Restschuld still belong to a payment nobody entered.
  const impliedRepaymentRate = (inputs.monthlyPayment * 1200) / loan - interestRate;
  const paymentSubstituted = !split && loan > 0 && impliedRepaymentRate < 0.01;
  const delayYears = Math.max(0, inputs.moveInMonths) / 12;
  // The contract as the bank reads it: the regular rate, no Sondertilgung, from signing.
  const contractRun = splitBase
    ? simulateSplitLoan({ ...splitBase, monthlyPayment: inputs.monthlyPayment, specialPlan: { kind: "none" } })
    : null;
  const contractYears = contractRun
    ? contractRun.amortises
      ? contractRun.runtimeYears
      : Infinity
    : inputs.monthlyPayment > interestOnlyPayment
      ? runtimeYearsFromRepaymentRate(interestRate, repaymentRate)
      : Infinity;
  const contractYearsFromSigning = delayYears + contractYears;
  const debtFreeYearsFromSigning = amortises ? delayYears + mortgage.runtimeYears : Infinity;
  const runtimeWithinLimit = contractYearsFromSigning <= inputs.maxRuntimeYears + 1e-9;
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
    // Repaid by retirement, as banks usually require? Counted from signing, so a
    // Neubau's wait counts, and without Sondertilgung, as the bank reads the contract.
    // A warning: some banks accept the couple's Sondertilgung against it (D44).
    {
      id: "runtime",
      passed: runtimeWithinLimit,
      actual: contractYearsFromSigning,
      required: inputs.maxRuntimeYears,
      gap: inputs.maxRuntimeYears - contractYearsFromSigning,
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
  const failing = checks.filter((check) => !check.passed).map((check) => check.id);
  const failed = failing.filter((id) => BLOCKING_CONSTRAINTS.includes(id));
  const warnings = failing.filter((id) => !BLOCKING_CONSTRAINTS.includes(id));
  const diagnosis: ScenarioDiagnosis = { checks, failed, warnings };

  // Tragbar: the rate repays the loan, the money covers the purchase, the monthly load
  // stays under the couple's limit. The reserve target and the retirement deadline are
  // shown as warnings and never block (D44): both are the couple's call.
  const feasible = amortises && cashLeft >= 0 && burdenRatio <= maxBurdenRatio;
  const runsPastLimit = !runtimeWithinLimit;

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
  } else if (failed.includes("burden")) {
    status = "Rate zu hoch";
    statusTone = "amber";
  } else if (warnings.includes("reserve")) {
    status = "Reserve unter Ziel";
    statusTone = "amber";
  } else if (warnings.includes("runtime")) {
    status = "Läuft über die Grenze";
    statusTone = "amber";
  } else if (cashLeft < inputs.reserveTarget * 1.5) {
    status = "Gerade so tragbar";
    statusTone = "amber";
  }

  return {
    ...base,
    interestRate,
    bankRate,
    kfwPart,
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
    runsPastLimit,
    contractYearsFromSigning,
    debtFreeYearsFromSigning,
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
    closingCostRate: apartment.closingCostRate,
    monthlyPayment: apartment.monthlyPayment,
    kfwAmount: apartment.kfwAmount,
    kfwRate: apartment.kfwRate,
    kfwTermYears: apartment.kfwTermYears,
    moveInMonths: apartment.moveInMonths,
    renovation: apartment.renovation,
    monthlyOwnershipCosts: apartment.hausgeld + baseInputs.ownerExtraMonthly,
    annualSpecialRepayment,
    annualSpecialRepayments: apartment.annualSpecialRepayments,
  };
}

/**
 * Share of the loan assumed drawn, on average, while a Neubau is built (MaBV tranches).
 * A guess, not a payment plan: it only feeds `constructionInterest` (ASSUMPTIONS §4.20).
 */
export const CONSTRUCTION_DRAW_SHARE = 0.5;

export type ApartmentColumn = {
  apartment: ApartmentCase;
  inputs: MortgageInputs;
  /** This apartment at the chosen EK level, with its own Sondertilgung plan. */
  scenario: ScenarioResult;
  /** The same loan with no Sondertilgung at all. */
  withoutSpecial: ScenarioResult;
  /** The bank's own rate for this EK level, before any KfW blend. */
  bankRate: number;
  /** The KfW part's own monthly annuity after its free year; the bank gets the rest. */
  kfwMonthly: number;
  /** Months the loan amortises inside the Zinsbindung (binding minus handover delay). */
  bindingMonths: number;
  /** Rough Bauzeit- and Bereitstellungszinsen until handover. 0 without a delay. */
  constructionInterest: number;
  /** Sondertilgung actually paid inside the binding. */
  specialInBinding: number;
  /** Years from signing until debt-free: the handover delay plus the runtime. */
  debtFreeAfterYears: number;
  /** The parking space's share of the Monatsrate, at this EK level. */
  parkingMonthly: number;
  /** Cash the parking space needs at signing: its share of EK and Kaufnebenkosten. */
  parkingCash: number;
};

/**
 * One apartment at one EK level, as the side-by-side comparison shows it (D42). Each
 * column picks its own EK level, so "Lindenstraße at 10% against BUWOG at 15%" is a
 * question the screen can answer — the limitation D3 recorded.
 */
export function apartmentColumn(
  apartment: ApartmentCase,
  base: ScenarioBase,
  baseInputs: MortgageInputs,
  rates: InterestRates,
): ApartmentColumn {
  const inputs = buildApartmentInputs(baseInputs, apartment);
  const scenario = buildScenario(base, inputs, rates);
  const withoutSpecial = buildScenario(base, inputs, rates, { kind: "none" });
  const months = bindingMonths(inputs);
  const constructionInterest =
    ((scenario.loan * scenario.interestRate) / 100) *
    (Math.max(0, inputs.moveInMonths) / 12) *
    CONSTRUCTION_DRAW_SHARE;
  const specialInBinding = scenario.mortgage.usedAnnualSpecialRepayments
    .slice(0, Math.floor(months / 12))
    .reduce((sum, amount) => sum + (amount ?? 0), 0);
  // The Monatsrate scales with the loan at a fixed EK share, so the space carries its
  // share of the price; at signing it needs its share of EK and Kaufnebenkosten.
  const parkingShare = inputs.purchasePrice > 0 ? apartment.parkingPrice / inputs.purchasePrice : 0;

  return {
    apartment,
    inputs,
    scenario,
    withoutSpecial,
    bankRate: scenario.bankRate,
    kfwMonthly: kfwAnnuity(scenario.kfwPart, inputs.kfwRate, inputs.kfwTermYears),
    bindingMonths: months,
    constructionInterest,
    specialInBinding,
    debtFreeAfterYears: Math.max(0, inputs.moveInMonths) / 12 + scenario.mortgage.runtimeYears,
    parkingMonthly: scenario.mortgage.regularMonthlyPayment * parkingShare,
    parkingCash: apartment.parkingPrice * ((base.ekRate + inputs.closingCostRate) / 100),
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

  const candidates: ConstraintId[] = BLOCKING_CONSTRAINTS;
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
  const priority: ConstraintId[] = BLOCKING_CONSTRAINTS;
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
  const horizonYears = bindingYears(inputs);
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
  // The verdict comes from the ledger, not from `interestSavedFixed − etfForegone`.
  // The two agree to the cent while both loans run through the binding (pinned in
  // invariants.test.ts); once a loan is repaid earlier, only the ledger also counts
  // the payments it no longer makes, which keep earning (K23).
  const netAdvantageFixed =
    scenarioWealthAtHorizon(to, inputs).wealth - scenarioWealthAtHorizon(from, inputs).wealth;

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
    netAdvantageFixed,
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
   * market risk: the rate at which `extraCash` grows into what it is worth at the end of
   * the binding in the ledger. While both loans run through the binding that is exactly
   * `debtReduction` (extra EK plus interest saved); after an early payoff it includes
   * the freed payments. Null when `to` needs no extra cash.
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
  const years = bindingYears(inputs);
  const extraCash = to.cashNeeded - from.cashNeeded;
  const debtReduction = from.mortgage.remainingAfterFixed - to.mortgage.remainingAfterFixed;
  if (extraCash <= 0 || years <= 0) {
    return { from, to, extraCash, debtReduction, annualReturn: null, breakEvenEtfReturn: null, ekAhead: null };
  }

  // Valued in the ledger, not read off the Restschuld: if a loan is repaid inside the
  // binding, its freed payments keep earning, and a Restschuld of zero on both sides
  // used to report a −100% return (K23).
  const wealthGap = (etfReturnRate: number) => {
    const assumed = { ...inputs, etfReturnRate };
    return (
      scenarioWealthAtHorizon(to, assumed).wealth - scenarioWealthAtHorizon(from, assumed).wealth
    );
  };
  const gap = wealthGap(inputs.etfReturnRate);
  const keep = 1 - clampRate(inputs.etfTaxRate) / 100;
  // What the extra cash grows to if it stays in the ETF, after tax at the horizon, and
  // therefore what the extra EK grew to: that plus the wealth it is ahead or behind by.
  const etfMultiple = 1 + (Math.pow(1 + inputs.etfReturnRate / 100, years) - 1) * keep;
  const ekMultiple = (gap + extraCash * etfMultiple) / extraCash;
  const annualReturn = ekMultiple > 0 ? (Math.pow(ekMultiple, 1 / years) - 1) * 100 : -100;

  return {
    from,
    to,
    extraCash,
    debtReduction,
    annualReturn,
    breakEvenEtfReturn: nearestRoot(wealthGap, inputs.etfReturnRate, 0.5, 30),
    ekAhead: gap > 0,
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
  inputs: MortgageInputs,
  rates: InterestRates,
  waitMonths: number = inputs.waitMonths,
  /** The common date. Pass one value for every column of a table. */
  horizonMonths: number = Math.max(bindingMonths(inputs), waitMonths),
): WaitScenario {
  const years = waitMonths / 12;
  const { futurePrice, adjustedInterestRate, purchaseRates } = purchaseAfterWaiting(
    selectedBase,
    inputs,
    rates,
    waitMonths,
  );
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
  const wealth = wealthAtHorizon({ base: selectedBase, inputs, rates, waitMonths, horizonMonths });
  const now =
    waitMonths === 0
      ? wealth
      : wealthAtHorizon({ base: selectedBase, inputs, rates, waitMonths: 0, horizonMonths });

  return {
    scenario,
    waitMonths,
    futurePrice,
    rentPaid,
    saved,
    adjustedAvailableCapital,
    adjustedInterestRate,
    futureLoan: scenario.loan,
    cashLeftAfterPurchase: wealth.liquidAfterPurchase,
    wealth,
    deltaWealth: wealth.wealth - now.wealth,
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
  inputs: MortgageInputs,
  rates: InterestRates,
  months: number[] = [0, 12, 24],
): WaitScenario[] {
  // One date for every column, so the table compares like with like even if someone
  // types a Wartezeit longer than the binding.
  const horizonMonths = Math.max(bindingMonths(inputs), ...months);
  return months.map((waitMonths) =>
    buildWaitScenario(selectedBase, inputs, rates, waitMonths, horizonMonths),
  );
}

export type WaitAssumption = "waitRateShift" | "waitPropertyGrowthRate" | "etfReturnRate";

export type WaitTippingPoint = {
  assumption: WaitAssumption;
  assumed: number;
  /**
   * The value at which waiting and buying now end level on the common date, the
   * nearest one to `assumed`, with every other input unchanged. Null if there is none
   * within a wide range.
   */
  flipsAt: number | null;
};

/** How far each assumption is searched, and in which steps, before giving up. */
const TIPPING_SEARCH: Record<WaitAssumption, { step: number; reach: number }> = {
  waitRateShift: { step: 0.25, reach: 5 },
  waitPropertyGrowthRate: { step: 0.5, reach: 20 },
  etfReturnRate: { step: 0.5, reach: 20 },
};

/**
 * What would have to be different for waiting to stop (or start) beating buying now.
 * PRODUCT_SPEC §2.3 asks exactly this: "what conditions would need to occur for waiting
 * to beat buying now". Each assumption is moved on its own; the nearest value at which
 * the wealth difference changes sign is reported.
 *
 * Searched outward from the assumed value in steps, then bisected, so the answer is the
 * nearest tipping point even if the difference is not monotone over the whole range.
 */
export function waitTippingPoints(
  base: ScenarioBase,
  inputs: MortgageInputs,
  rates: InterestRates,
  waitMonths: number = inputs.waitMonths,
): WaitTippingPoint[] {
  const horizonMonths = Math.max(bindingMonths(inputs), waitMonths);
  const delta = (assumption: WaitAssumption, value: number) => {
    const varied = { ...inputs, [assumption]: value };
    return (
      wealthAtHorizon({ base, inputs: varied, rates, waitMonths, horizonMonths }).wealth -
      wealthAtHorizon({ base, inputs: varied, rates, waitMonths: 0, horizonMonths }).wealth
    );
  };

  return (Object.keys(TIPPING_SEARCH) as WaitAssumption[]).map((assumption) => {
    const assumed = inputs[assumption];
    const atAssumed = delta(assumption, assumed);
    if (waitMonths <= 0) return { assumption, assumed, flipsAt: null };

    const { step, reach } = TIPPING_SEARCH[assumption];
    const flipsAt = nearestRoot((value) => delta(assumption, value), assumed, step, reach, atAssumed);
    return { assumption, assumed, flipsAt };
  });
}

/**
 * The value nearest to `start` at which `f` changes sign: searched outward in `step`s
 * on both sides up to `reach`, then bisected. Null if there is none in range. Nearest,
 * not first-found from one end, so a non-monotone `f` still yields the tipping point
 * the reader is closest to.
 */
function nearestRoot(
  f: (value: number) => number,
  start: number,
  step: number,
  reach: number,
  atStart: number = f(start),
): number | null {
  if (atStart === 0) return start;
  for (let distance = step; distance <= reach + 1e-9; distance += step) {
    for (const direction of [-1, 1]) {
      const inner = start + direction * (distance - step);
      const outer = start + direction * distance;
      const innerValue = distance === step ? atStart : f(inner);
      if (Math.sign(f(outer)) === Math.sign(innerValue)) continue;

      let lo = inner;
      let hi = outer;
      const loSign = Math.sign(innerValue);
      for (let i = 0; i < 40; i += 1) {
        const mid = (lo + hi) / 2;
        if (Math.sign(f(mid)) === loSign) lo = mid;
        else hi = mid;
      }
      return (lo + hi) / 2;
    }
  }
  return null;
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
  /** Free capital right after paying for the purchase. */
  liquidAfterPurchase: number;
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
    Math.round(params.horizonMonths ?? bindingMonths(inputs)),
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

  return ownUntilHorizon(purchase, inputs, specialPlan, {
    horizonMonths,
    waitMonths,
    purchasePrice: futurePrice,
    liquid,
    contributed,
  });
}

/**
 * `wealthAtHorizon` for a scenario that is already built, bought today. Comparisons
 * that hold `ScenarioResult`s (the EK trade-off, the return per EK step) value them
 * with this, so they need no rates and cannot drift from the scenarios on screen.
 * Pass the Sondertilgung plan the scenario was built with.
 */
export function scenarioWealthAtHorizon(
  scenario: ScenarioResult,
  inputs: MortgageInputs,
  specialPlan: SpecialPlan = planFromInputs(inputs),
  horizonMonths: number = bindingMonths(inputs),
): WealthAtHorizon {
  return ownUntilHorizon(scenario, inputs, specialPlan, {
    horizonMonths,
    waitMonths: 0,
    purchasePrice: inputs.purchasePrice,
    liquid: inputs.availableCapital,
    contributed: inputs.availableCapital,
  });
}

/**
 * The owning half of the ledger: pay for the purchase, then month by month the
 * Monatsrate, ownership costs and Sondertilgung out of the household budget, the rest
 * invested, until the horizon. Months after the loan is repaid carry no bank payment,
 * so a loan that finishes early leaves its freed payments invested, which is exactly
 * what a Restschuld comparison alone cannot see.
 */
function ownUntilHorizon(
  purchase: ScenarioResult,
  inputs: MortgageInputs,
  specialPlan: SpecialPlan,
  start: {
    horizonMonths: number;
    waitMonths: number;
    purchasePrice: number;
    liquid: number;
    contributed: number;
  },
): WealthAtHorizon {
  const monthlyReturn = Math.pow(1 + inputs.etfReturnRate / 100, 1 / 12) - 1;
  const budget = inputs.waitSavingsMonthly + inputs.currentWarmRent;
  let liquid = start.liquid - purchase.cashNeeded;
  let contributed = start.contributed - purchase.cashNeeded;
  const liquidAfterPurchase = liquid;

  const loanMonths = start.horizonMonths - start.waitMonths;
  const paidToBank = new Array<number>(loanMonths + 1).fill(0);
  const specialByMonth = new Array<number>(loanMonths + 1).fill(0);
  let debt = purchase.loan;
  const onMonth = (entry: MortgageMonth) => {
    if (entry.month > loanMonths) return;
    paidToBank[entry.month] = entry.interest + entry.principal;
    specialByMonth[entry.month] = entry.special;
    debt = entry.balance;
  };
  if (purchase.kfwPart > 0) {
    simulateSplitLoan({
      bankPrincipal: purchase.loan - purchase.kfwPart,
      bankRatePct: purchase.bankRate,
      kfwPrincipal: purchase.kfwPart,
      kfwRatePct: inputs.kfwRate,
      kfwTermYears: inputs.kfwTermYears,
      monthlyPayment: purchase.mortgage.regularMonthlyPayment,
      fixedRateYears: bindingYears(inputs),
      specialPlan,
      specialRepaymentLimitRate: inputs.specialRepaymentLimitRate,
      onMonth,
    });
  } else {
    simulateMortgage({
      principal: purchase.loan,
      interestRatePct: purchase.interestRate,
      repaymentRatePct: purchase.repaymentRate,
      fixedRateYears: bindingYears(inputs),
      specialPlan,
      specialRepaymentLimitRate: inputs.specialRepaymentLimitRate,
      onMonth,
    });
  }
  if (loanMonths === 0) debt = purchase.loan;

  let specialPaid = 0;
  for (let month = 1; month <= loanMonths; month += 1) {
    liquid *= 1 + monthlyReturn;
    const flow = budget - inputs.monthlyOwnershipCosts - paidToBank[month] - specialByMonth[month];
    liquid += flow;
    contributed += flow;
    specialPaid += specialByMonth[month];
  }

  const propertyValue =
    inputs.purchasePrice *
    Math.pow(1 + inputs.propertyGrowthRate / 100, start.horizonMonths / 12);
  const liquidTax = (liquid - contributed) * (clampRate(inputs.etfTaxRate) / 100);

  return {
    horizonMonths: start.horizonMonths,
    purchasePrice: start.purchasePrice,
    loan: purchase.loan,
    propertyValue,
    debt,
    liquid,
    liquidTax,
    wealth: propertyValue - debt + liquid - liquidTax,
    liquidAfterPurchase,
    specialPaid,
    rentPaid: inputs.currentWarmRent * start.waitMonths,
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
  const fixedYears = bindingYears(inputs);
  const remaining = scenario.mortgage.remainingAfterFixed;
  const stressRate = Math.max(0, scenario.interestRate + inputs.refiStressShift);
  const payment = scenario.mortgage.regularMonthlyPayment;
  // The whole plan, read on the original loan's calendar through `monthOffset`: with a
  // handover delay the binding ends mid-year, and slicing the plan by whole years
  // dropped or shifted a Sondertilgung, so even the same-rate baseline ran longer
  // than the scenario itself (Codex review of PR #11).
  const laterPlan: SpecialPlan = { kind: "path", years: inputs.annualSpecialRepayments };
  const offsetMonths = bindingMonths(inputs);

  if (scenario.kfwPart > 0 && remaining > 0.01 && Number.isFinite(remaining)) {
    // Two loans: run the whole schedule again with both rates shifted from the end of
    // the binding, so each part keeps its own annuity and calendar (D44).
    const stressed = simulateSplitLoan({
      bankPrincipal: scenario.loan - scenario.kfwPart,
      bankRatePct: scenario.bankRate,
      kfwPrincipal: scenario.kfwPart,
      kfwRatePct: inputs.kfwRate,
      kfwTermYears: inputs.kfwTermYears,
      monthlyPayment: payment,
      fixedRateYears: fixedYears,
      specialPlan: planFromInputs(inputs),
      specialRepaymentLimitRate: inputs.specialRepaymentLimitRate,
      rateShift: { afterMonths: bindingMonths(inputs), points: inputs.refiStressShift },
    });
    const runtimeYearsAtSameRate = scenario.mortgage.runtimeYears;
    const runtimeYearsStressed = stressed.amortises ? stressed.runtimeYears : Infinity;
    return {
      applies: true,
      stressRate,
      coversInterest: stressed.amortises,
      runtimeYearsAtSameRate,
      runtimeYearsStressed,
      extraYears: runtimeYearsStressed - runtimeYearsAtSameRate,
    };
  }

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
      monthOffset: offsetMonths,
      // The cap stays a share of the ORIGINAL loan, as everywhere else in the model.
      // The follow-up runs on the Restschuld, so the rate is rescaled to the same € cap;
      // otherwise even the same-rate baseline ran longer than the scenario itself.
      specialRepaymentLimitRate: (inputs.specialRepaymentLimitRate * scenario.loan) / remaining,
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
