import type {
  ApartmentCase,
  InterestRates,
  MortgageInputs,
  ScenarioBase,
  ScenarioId,
} from "./calculations";

export const DEFAULT_INPUTS: MortgageInputs = {
  // Kaufpreis, Nebenkosten und Rate stammen aus dem Finanzierungsangebot vom
  // 07.08.2026 (Varianten 1A–3B), damit die App auf dem echten Fall startet.
  purchasePrice: 450000,
  // 11,57% = mit Makler: 2% Notar/Grundbuch + 6% Grunderwerbsteuer + 3,57% Provision.
  // Ergibt exakt die 52.065 € des Angebots. Ohne Makler sind es 8%.
  closingCostRate: 11.57,
  availableCapital: 145000,
  reserveTarget: 20000,
  renovation: 0,
  moving: 0,
  // Nur für die QA-Presets ohne Wohnung. Wohnungen bilden den Wert aus Hausgeld + Zuschlag.
  monthlyOwnershipCosts: 830,
  // Schätzung (D35): Grundsteuer ≈ 35 € + eigene Rücklage für Bad, Böden, Geräte ≈ 55 €.
  ownerExtraMonthly: 90,
  currentWarmRent: 1970,
  householdNetIncome: 8500,
  maxBurdenRate: 40,
  // Die Rate aus dem Angebot. Sie gilt für jede EK-Stufe gleich — der Tilgungssatz
  // wird daraus je Stufe abgeleitet, genau wie die Bank es rechnet.
  monthlyPayment: 1900,
  // 10 Jahre: die kürzere der beiden angebotenen Bindungen und die günstigere.
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
  // Abgeltungsteuer + Soli auf 70% des Gewinns (Teilfreistellung Aktien-ETF), ohne
  // Kirchensteuer. Die gesparten Kreditzinsen sind steuerfrei, die ETF-Gewinne nicht.
  etfTaxRate: 18.4625,
  // Stresstest, keine Prognose: 2 Prozentpunkte über dem heutigen Sollzins.
  refiStressShift: 2,
  // Persönliche Grenze: schuldenfrei bis zum Renteneintritt des Älteren. Im Feld änderbar.
  maxRuntimeYears: 26,
};

/**
 * Sollzinsen aus dem Finanzierungsangebot vom 07.08.2026, Varianten 1A–3B
 * (90% / 85% / 80% Finanzierung × 10 / 15 Jahre Zinsbindung).
 *
 * Sie fallen über die EK-Stufen NICHT gleichmäßig: 15% EK kauft gegenüber 10% fast
 * nichts, bei 15 Jahren Bindung exakt nichts. Der Sprung kommt erst bei 80%
 * Beleihung. Nichts im Modell darf Monotonie unterstellen.
 */
export const DEFAULT_RATES: InterestRates = {
  10: { ek10: 3.87, ek15: 3.86, ek20: 3.76 },
  15: { ek10: 4.06, ek15: 4.06, ek20: 3.96 },
};

/**
 * Where the Sollzinsen came from and when, as free text. Rates drift weekly; a figure
 * without a date reads as current when it may be months old. Free text rather than a
 * date field because one grid can mix quotes from several sources and days (D36).
 */
export const DEFAULT_RATES_NOTE = "Finanzierungsangebot vom 07.08.2026 (Varianten 1A–3B)";

export const EK_SCENARIOS: ScenarioBase[] = [
  { id: "ek10", ekRate: 10, label: "10% EK" },
  { id: "ek15", ekRate: 15, label: "15% EK" },
  { id: "ek20", ekRate: 20, label: "20% EK" },
];

/**
 * The two flats marked "Vergleichen? Ja" in the couple's Shortlist Sheet (Stand
 * 22.11.2026). Prices include the parking space and Kaufnebenkosten are computed on
 * that total, exactly as the Sheet's own formulas do; "Renovierung" is the 12k kitchen
 * both lack. Stable ids, so `storage.ts` can add them to saves made before they existed
 * without ever adding them twice (D40).
 */
export const SHORTLIST_APARTMENT_CASES: ApartmentCase[] = [
  {
    id: "lindenstrasse-31g-we49",
    label: "Lindenstraße 31G",
    // 495.000 € Wohnung + 25.000 € TG-Stellplatz.
    purchasePrice: 520000,
    renovation: 12000,
    // Laut Exposé; Makler: wegen WEG-Investitionen ca. zwei Jahre erhöht.
    hausgeld: 630,
    closingCostRate: 11.57,
    // Geschätzt, kein Angebot: dasselbe Verhältnis Rate/Darlehen wie im echten Angebot
    // (1.900 € auf 405.000 €), also 468.000 € × 1.900 / 405.000 ≈ 2.196 €.
    monthlyPayment: 2200,
    annualSpecialRepayments: [...DEFAULT_INPUTS.annualSpecialRepayments],
    note:
      "Lindenstraße 31G (Inserat: 32G), WE49?, 93,6 m², 4. OG, Bj. 1998, Energie D. " +
      "Kaufpreis = 495.000 € + 25.000 € TG. Mit Makler (3,57 %). Renovierung = Einbauküche 12k " +
      "(Küchenöffnung 7–8k nicht enthalten). Hausgeld 630 € laut Exposé, evtl. später niedriger. " +
      "Offen: 31G/32G per Grundbuch klären. Quelle: Shortlist-Sheet, Stand 22.11.2026.",
  },
  {
    id: "buwog-arbor-h2-we08",
    label: "BUWOG Arbor WE08",
    // 625.100 € Aktionspreis (bis Beurkundung 30.11.2026) + 30.000 € Stellplatz.
    purchasePrice: 655100,
    renovation: 12000,
    // BUWOG-Schätzung 3,50 €/m², kein finaler Wirtschaftsplan.
    hausgeld: 331,
    // Provisionsfrei: 6 % Grunderwerbsteuer + 2 % Notar/Grundbuch.
    closingCostRate: 8,
    // Geschätzt, kein Angebot: 589.590 € × 1.900 / 405.000 ≈ 2.766 €. Ohne KfW 300.
    monthlyPayment: 2770,
    annualSpecialRepayments: [...DEFAULT_INPUTS.annualSpecialRepayments],
    note:
      "An der Filmfabrik 9, Haus 2 WE08, 94,6 m², 2. OG Nordost, Neubau EH40, Bezug vsl. Juni 2028. " +
      "Kaufpreis = 625.100 € Aktionspreis (bis 30.11.2026) + 30.000 € Stellplatz. Provisionsfrei. " +
      "Renovierung = Einbauküche 12k. Hausgeld 331 € nur BUWOG-Schätzung. Nicht abgebildet: KfW 300 " +
      "(bis 170k zu ca. 1,3 %), Bereitstellungszinsen, Miete bis Bezug 2028. Quelle: Shortlist-Sheet, Stand 22.11.2026.",
  },
];

/**
 * Hausgeld values are placeholders, not Exposé figures: they are the old "Eigentumskosten"
 * estimates (640 / 690 / 760 €) minus the 90 € now carried by `ownerExtraMonthly`, so the
 * totals on screen did not move (D35). Replace them with the Exposé's Hausgeld.
 */
export const DEFAULT_APARTMENT_CASES: ApartmentCase[] = [
  {
    // Das Objekt aus dem Finanzierungsangebot. Bewusst der erste Fall: die App soll
    // auf dem starten, was tatsächlich auf dem Tisch liegt.
    id: "flat-a",
    label: "Angebot 450k",
    purchasePrice: 450000,
    renovation: 0,
    hausgeld: 550,
    closingCostRate: DEFAULT_INPUTS.closingCostRate,
    monthlyPayment: DEFAULT_INPUTS.monthlyPayment,
    annualSpecialRepayments: [...DEFAULT_INPUTS.annualSpecialRepayments],
  },
  {
    id: "flat-b",
    label: "Wohnung B",
    purchasePrice: 500000,
    renovation: 10000,
    hausgeld: 600,
    closingCostRate: DEFAULT_INPUTS.closingCostRate,
    monthlyPayment: DEFAULT_INPUTS.monthlyPayment,
    annualSpecialRepayments: [...DEFAULT_INPUTS.annualSpecialRepayments],
  },
  {
    id: "flat-c",
    label: "Wohnung C",
    purchasePrice: 600000,
    renovation: 5000,
    hausgeld: 670,
    closingCostRate: DEFAULT_INPUTS.closingCostRate,
    monthlyPayment: DEFAULT_INPUTS.monthlyPayment,
    annualSpecialRepayments: [3000, 3000, 4000, 4000, 5000, 5000, 6000, 6000, 6000, 6000],
  },
  ...SHORTLIST_APARTMENT_CASES.map((apartment) => ({
    ...apartment,
    annualSpecialRepayments: [...apartment.annualSpecialRepayments],
  })),
];

export type PresetId = "case600" | "case720" | "case850";

export type CasePreset = {
  label: string;
  selectedId: ScenarioId;
  inputs: MortgageInputs;
  rates: InterestRates;
};

/**
 * Every input that determines the expected outcome is pinned here, never inherited —
 * a fixture that tracks a default silently stops testing what it claims (D12). That
 * now includes `monthlyPayment` and `fixedRateYears`: with the rate held constant
 * across EK levels, the rate IS what decides whether a scenario amortises at all.
 */
export const CASE_PRESETS: Record<PresetId, CasePreset> = {
  case600: {
    label: "600k machbar",
    selectedId: "ek10",
    inputs: {
      ...DEFAULT_INPUTS,
      purchasePrice: 600000,
      closingCostRate: 8,
      availableCapital: 145000,
      reserveTarget: 25000,
      monthlyOwnershipCosts: 760,
      householdNetIncome: 9000,
      monthlyPayment: 2400,
      fixedRateYears: 10,
      // Gepinnt, nicht geerbt (D12): die Fixtures prüfen Tragbarkeit, nicht die
      // persönliche Laufzeitgrenze. Bei 26 Jahren würde 10% EK hier gelb.
      maxRuntimeYears: 35,
    },
    // 10% EK tragbar, 15% reißt die Reserve, 20% reicht das Geld nicht.
    rates: { 10: { ek10: 3.87, ek15: 3.86, ek20: 3.76 }, 15: { ek10: 4.06, ek15: 4.06, ek20: 3.96 } },
  },
  case720: {
    label: "720k grenzwertig",
    selectedId: "ek10",
    inputs: {
      ...DEFAULT_INPUTS,
      purchasePrice: 720000,
      closingCostRate: 8,
      availableCapital: 200000,
      reserveTarget: 25000,
      monthlyOwnershipCosts: 900,
      householdNetIncome: 9600,
      monthlyPayment: 2900,
      fixedRateYears: 10,
      // Gepinnt, nicht geerbt (D12): die Fixtures prüfen Tragbarkeit, nicht die
      // persönliche Laufzeitgrenze. Bei 26 Jahren würde 10% EK hier gelb.
      maxRuntimeYears: 35,
    },
    // Tragbar, aber mit sichtbaren Warnungen: 15% nur "gerade so", 20% scheitert.
    rates: { 10: { ek10: 3.87, ek15: 3.86, ek20: 3.76 }, 15: { ek10: 4.06, ek15: 4.06, ek20: 3.96 } },
  },
  case850: {
    label: "850k Stress",
    selectedId: "ek10",
    inputs: {
      ...DEFAULT_INPUTS,
      purchasePrice: 850000,
      closingCostRate: 11.57,
      availableCapital: 145000,
      reserveTarget: 30000,
      monthlyOwnershipCosts: 950,
      householdNetIncome: 8500,
      // Hoch genug, dass das Darlehen sauber tilgt — sonst scheitern alle drei an der
      // Rate und das Fixture würde nicht mehr prüfen, was es prüfen soll: dass Cash,
      // Reserve und Belastung reißen und trotzdem niemand zum Sieger erklärt wird.
      monthlyPayment: 3400,
      fixedRateYears: 10,
      // Gepinnt, nicht geerbt (D12): die Fixtures prüfen Tragbarkeit, nicht die
      // persönliche Laufzeitgrenze. Bei 26 Jahren würde 10% EK hier gelb.
      maxRuntimeYears: 35,
    },
    rates: { 10: { ek10: 3.87, ek15: 3.86, ek20: 3.76 }, 15: { ek10: 4.06, ek15: 4.06, ek20: 3.96 } },
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
 * The assumption boxes, in the order the decision is actually made: what we bring,
 * what we earn, what the loan looks like, what it costs, what the world does.
 *
 * These used to be tabs. Two people reading together could only ever see a third of
 * their assumptions at once and had to remember the rest, which is the opposite of
 * what a shared screen is for. See docs/DECISIONS.md D18.
 *
 * Purchase price, renovation and ownership costs are NOT here — they belong to the
 * active apartment (ApartmentSwitcher). "Warten" is not here either — its inputs live
 * inline in the Warten section rather than duplicated as a group, which used to leave
 * "Warten" addressable from two different places at once.
 */
export const INPUT_BOXES = [
  { id: "capital", label: "Eigenkapital & Kaufkosten" },
  { id: "household", label: "Haushalt" },
  { id: "loan", label: "Darlehen" },
  { id: "rates", label: "Sollzinsen" },
  { id: "market", label: "Markt" },
] as const;

export type InputBoxId = (typeof INPUT_BOXES)[number]["id"];
