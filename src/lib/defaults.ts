import type { InterestRates, MortgageInputs, ScenarioBase, ScenarioId } from "./calculations";

export const DEFAULT_INPUTS: MortgageInputs = {
  purchasePrice: 720000,
  closingCostRate: 9,
  availableCapital: 145000,
  reserveTarget: 20000,
  renovation: 0,
  moving: 0,
  monthlyOwnershipCosts: 830,
  currentWarmRent: 1970,
  householdNetIncome: 8500,
  repaymentRate: 2.4,
  fixedRateYears: 10,
  annualSpecialRepayment: 6000,
  annualSpecialRepayments: [6000, 6000, 6000, 6000, 6000, 6000, 6000, 6000, 6000, 6000],
  specialRepaymentLimitRate: 5,
  propertyGrowthRate: 2,
  inflationRate: 2.3,
  waitMonths: 12,
  waitSavingsMonthly: 1500,
  waitPropertyGrowthRate: 2,
  waitRateShift: -0.3,
  etfReturnRate: 5,
};

export const DEFAULT_RATES: InterestRates = {
  ek5: 4.15,
  ek10: 3.85,
  ek15: 3.65,
};

export const EK_SCENARIOS: ScenarioBase[] = [
  { id: "ek5", ekRate: 5, label: "5% EK", short: "Liquidität schützen", accent: "blue" },
  { id: "ek10", ekRate: 10, label: "10% EK", short: "Kompromiss", accent: "green" },
  { id: "ek15", ekRate: 15, label: "15% EK", short: "Zinsen senken", accent: "orange" },
];

export type PresetId = "case600" | "case720" | "case850";

export type CasePreset = {
  label: string;
  selectedId: ScenarioId;
  inputs: MortgageInputs;
  rates: InterestRates;
};

export const CASE_PRESETS: Record<PresetId, CasePreset> = {
  case600: {
    label: "600k machbar",
    selectedId: "ek10",
    inputs: {
      ...DEFAULT_INPUTS,
      purchasePrice: 600000,
      availableCapital: 145000,
      reserveTarget: 25000,
      monthlyOwnershipCosts: 760,
      householdNetIncome: 9000,
    },
    rates: { ek5: 4.05, ek10: 3.8, ek15: 3.55 },
  },
  case720: {
    label: "720k Base",
    selectedId: "ek10",
    inputs: { ...DEFAULT_INPUTS },
    rates: { ...DEFAULT_RATES },
  },
  case850: {
    label: "850k Stress",
    selectedId: "ek5",
    inputs: {
      ...DEFAULT_INPUTS,
      purchasePrice: 850000,
      availableCapital: 145000,
      reserveTarget: 30000,
      monthlyOwnershipCosts: 950,
    },
    rates: { ek5: 4.3, ek10: 4.05, ek15: 3.85 },
  },
};

export const MAIN_TABS = [
  { id: "decision", label: "Entscheidung" },
  { id: "inputs", label: "Eingaben" },
  { id: "compare", label: "EK-Vergleich" },
  { id: "sonder", label: "Sondertilgung" },
  { id: "wait", label: "Warten" },
  { id: "qa", label: "QA / Formelprüfung" },
] as const;

export type MainTabId = (typeof MAIN_TABS)[number]["id"];

export const INPUT_GROUPS = [
  { id: "purchase", label: "Kauf" },
  { id: "finance", label: "Finanzierung" },
  { id: "wait", label: "Warten" },
  { id: "advanced", label: "Erweitert" },
] as const;

export type InputGroupId = (typeof INPUT_GROUPS)[number]["id"];
