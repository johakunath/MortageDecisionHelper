export type ScenarioId = "ek5" | "ek10" | "ek15";
export type Tone = "green" | "amber" | "red" | "blue" | "slate" | "orange";

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

export type MortgageSimulationParams = {
  principal: number;
  interestRatePct: number;
  repaymentRatePct: number;
  fixedRateYears: number;
  annualSpecialRepayment: number;
  annualSpecialRepayments?: number[];
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
  futurePrice: number;
  rentPaid: number;
  saved: number;
  adjustedAvailableCapital: number;
  adjustedInterestRate: number;
  deltaInterest: number;
  years: number;
};

export type DecisionResult = {
  feasibleScenarios: ScenarioResult[];
  noSafeScenario: boolean;
  recommendation: ScenarioResult | null;
  costMinimum: ScenarioResult;
  liquidityMaximum: ScenarioResult;
};

export function monthlyAnnuity(
  principal: number,
  interestRatePct: number,
  repaymentRatePct: number,
): number {
  return principal * ((interestRatePct + repaymentRatePct) / 100) / 12;
}

export function simulateMortgage({
  principal,
  interestRatePct,
  repaymentRatePct,
  fixedRateYears,
  annualSpecialRepayment,
  annualSpecialRepayments,
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
  const usedAnnualSpecial = Math.max(
    0,
    Math.min(annualSpecialRepayment, maxAnnualSpecial),
  );
  const requestedAnnualSpecials = annualSpecialRepayments?.length
    ? annualSpecialRepayments
    : [];
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
      const requestedSpecial = Math.max(
        0,
        requestedAnnualSpecials[yearIndex] ?? annualSpecialRepayment,
      );
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

    if (regularMonthlyPayment <= interest && usedAnnualSpecial <= 0) {
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

export function buildScenario(
  base: ScenarioBase,
  inputs: MortgageInputs,
  rates: InterestRates,
  specialOverride = inputs.annualSpecialRepayment,
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
    annualSpecialRepayment: specialOverride,
    annualSpecialRepayments:
      specialOverride === inputs.annualSpecialRepayment
        ? inputs.annualSpecialRepayments
        : undefined,
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
  const feasible = cashLeft >= inputs.reserveTarget && burdenRatio <= 0.4;

  let status = "OK";
  let statusTone: Tone = "green";
  if (cashLeft < inputs.reserveTarget) {
    status = "Reserve verletzt";
    statusTone = "red";
  } else if (burdenRatio > 0.4) {
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

export function evaluateDecision(scenarios: ScenarioResult[]): DecisionResult {
  const feasibleScenarios = scenarios.filter((scenario) => scenario.feasible);
  const noSafeScenario = feasibleScenarios.length === 0;
  const preferred10 = feasibleScenarios.find((scenario) => scenario.id === "ek10");
  const lowestInterestFeasible = feasibleScenarios.reduce<ScenarioResult | null>(
    (best, scenario) =>
      best === null || scenario.mortgage.interestTotal < best.mortgage.interestTotal
        ? scenario
        : best,
    null,
  );

  return {
    feasibleScenarios,
    noSafeScenario,
    recommendation: noSafeScenario ? null : preferred10 ?? lowestInterestFeasible,
    costMinimum: scenarios.reduce((best, scenario) =>
      scenario.mortgage.interestTotal < best.mortgage.interestTotal ? scenario : best,
    ),
    liquidityMaximum: scenarios.reduce((best, scenario) =>
      scenario.cashLeft > best.cashLeft ? scenario : best,
    ),
  };
}

export function requiredSpecialToMatch(
  scenarioBase: ScenarioBase,
  targetInterest: number,
  inputs: MortgageInputs,
  rates: InterestRates,
): SpecialBreakEven {
  const loan = inputs.purchasePrice * (1 - scenarioBase.ekRate / 100);
  const maxSpecial = loan * (inputs.specialRepaymentLimitRate / 100);
  const noSpecial = buildScenario(scenarioBase, inputs, rates, 0).mortgage.interestTotal;

  if (noSpecial <= targetInterest) {
    return { amount: 0, feasible: true, maxSpecial };
  }

  const withMax = buildScenario(
    scenarioBase,
    inputs,
    rates,
    maxSpecial,
  ).mortgage.interestTotal;

  if (withMax > targetInterest) {
    return { amount: null, feasible: false, maxSpecial };
  }

  let low = 0;
  let high = maxSpecial;
  for (let i = 0; i < 40; i += 1) {
    const mid = (low + high) / 2;
    const interest = buildScenario(scenarioBase, inputs, rates, mid).mortgage
      .interestTotal;
    if (interest > targetInterest) {
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
): WaitScenario {
  const years = inputs.waitMonths / 12;
  const futurePrice =
    inputs.purchasePrice * Math.pow(1 + inputs.waitPropertyGrowthRate / 100, years);
  const rentPaid = inputs.currentWarmRent * inputs.waitMonths;
  const saved = inputs.waitSavingsMonthly * inputs.waitMonths;
  const adjustedAvailableCapital = inputs.availableCapital + saved - rentPaid;
  const adjustedInterestRate = Math.max(0.1, rates[selectedBase.id] + inputs.waitRateShift);
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
    futurePrice,
    rentPaid,
    saved,
    adjustedAvailableCapital,
    adjustedInterestRate,
    deltaInterest: scenario.mortgage.interestTotal - selectedNow.mortgage.interestTotal,
    years,
  };
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
