import type {
  ApartmentCase,
  InterestRates,
  MortgageInputs,
  ScenarioBase,
  ScenarioId,
} from "./calculations";

export const DEFAULT_INPUTS: MortgageInputs = {
  purchasePrice: 720000,
  // 11,57% = mit Makler (Grunderwerbsteuer + Notar + Grundbuch + Provision).
  // Bewusst der teurere der beiden Fälle: eine Entscheidungshilfe soll die Kosten
  // nicht zu niedrig ansetzen. Ohne Makler sind es 8%.
  closingCostRate: 11.57,
  availableCapital: 145000,
  reserveTarget: 20000,
  renovation: 0,
  moving: 0,
  monthlyOwnershipCosts: 830,
  currentWarmRent: 1970,
  householdNetIncome: 8500,
  maxBurdenRate: 40,
  repaymentRate: 2.4,
  // 15 Jahre: mehr Planungssicherheit als die üblichen 10, und bei den aktuellen
  // Konditionen nur wenig teurer. Frei änderbar — die Zinssätze müssen dann mit.
  fixedRateYears: 15,
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

export const DEFAULT_APARTMENT_CASES: ApartmentCase[] = [
  {
    id: "flat-a",
    label: "Wohnung A",
    purchasePrice: 600000,
    renovation: 5000,
    monthlyOwnershipCosts: 760,
    selectedScenarioId: "ek10",
    annualSpecialRepayments: [3000, 3000, 4000, 4000, 5000, 5000, 6000, 6000, 6000, 6000],
  },
  {
    id: "flat-b",
    label: "Wohnung B",
    purchasePrice: 500000,
    renovation: 10000,
    monthlyOwnershipCosts: 690,
    selectedScenarioId: "ek10",
    annualSpecialRepayments: [...DEFAULT_INPUTS.annualSpecialRepayments],
  },
  {
    id: "flat-c",
    label: "Wohnung C",
    purchasePrice: 450000,
    renovation: 15000,
    monthlyOwnershipCosts: 640,
    selectedScenarioId: "ek10",
    annualSpecialRepayments: [6000, 6000, 6000, 5000, 5000, 5000, 4000, 4000, 4000, 4000],
  },
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
      // Pinned, not inherited: this fixture exists to prove "at least one scenario is
      // feasible" (PRODUCT_SPEC §17). If it tracked the default it would silently stop
      // testing that the moment the default Kaufnebenkosten changed — which is exactly
      // what happened when the default moved to 11,57%.
      closingCostRate: 8,
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

/**
 * The numbered sections of the single scrolling page (docs/DECISIONS.md D2, D6).
 * Deliberately short: every section that merely re-displayed the same EK comparison
 * was removed rather than restyled. Labels are always visible in the rail — a bare
 * number tells two people reading together nothing about where they are.
 */
export const SECTIONS = [
  { id: "decision", number: 1, label: "Entscheidung" },
  { id: "assumptions", number: 2, label: "Annahmen" },
  { id: "tradeoff", number: 3, label: "Was kostet EK?" },
  { id: "progress", number: 4, label: "Verlauf" },
  { id: "special", number: 5, label: "Sondertilgung" },
  { id: "wait", number: 6, label: "Warten" },
] as const;

export type SectionId = (typeof SECTIONS)[number]["id"];

/**
 * Purchase price, renovation and ownership costs are NOT here — they belong to the
 * active apartment (ApartmentSwitcher). "Warten" is not here either — its inputs live
 * inline in the Warten section rather than duplicated as a group, which used to leave
 * "Warten" addressable from two different places at once.
 */
export const INPUT_GROUPS = [
  { id: "household", label: "Haushalt" },
  { id: "finance", label: "Finanzierung" },
  { id: "advanced", label: "Erweitert" },
] as const;

export type InputGroupId = (typeof INPUT_GROUPS)[number]["id"];
