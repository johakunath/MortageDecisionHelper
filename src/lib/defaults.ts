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
  // Gehören der Wohnung (D42); global nur für die QA-Presets ohne Wohnung.
  kfwAmount: 0,
  kfwRate: 0,
  kfwTermYears: 20,
  moveInMonths: 0,
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
  // Bankbedingung: schuldenfrei bis zur Rente mit 67 (Jahrgang 1985, also 2052), gezählt
  // ab Unterschrift Ende 2026, ohne Sondertilgung (D43). Im Feld änderbar.
  maxRuntimeYears: 26,
};

/**
 * Sollzinsen aus dem Finanzierungsangebot vom 07.08.2026, Varianten 1A–3B
 * (90% / 85% / 80% Finanzierung × 10 / 15 Jahre Zinsbindung). Nicht mehr die
 * Voreinstellung, aber der Satz, gegen den `offer.test.ts` die Engine prüft, und der
 * Satz, an dem `storage.ts` unveränderte alte Stände erkennt.
 *
 * Sie fallen über die EK-Stufen NICHT gleichmäßig: 15% EK kauft gegenüber 10% fast
 * nichts, bei 15 Jahren Bindung exakt nichts. Der Sprung kommt erst bei 80%
 * Beleihung. Nichts im Modell darf Monotonie unterstellen.
 */
export const OFFER_RATES: InterestRates = {
  10: { ek10: 3.87, ek15: 3.86, ek20: 3.76 },
  15: { ek10: 4.06, ek15: 4.06, ek20: 3.96 },
};

export const OFFER_RATES_NOTE = "Finanzierungsangebot vom 07.08.2026 (Varianten 1A–3B)";

/**
 * Annahme der Eigentümer vom 22.11.2026, bis die neuen Bankangebote da sind (D41):
 * 10 Jahre 4,3 / 4,2 / 4,0 %. 15 Jahre kosten laut den Eigentümern je 0,2 Punkte mehr.
 */
export const DEFAULT_RATES: InterestRates = {
  10: { ek10: 4.3, ek15: 4.2, ek20: 4.0 },
  15: { ek10: 4.5, ek15: 4.4, ek20: 4.2 },
};

/**
 * Where the Sollzinsen came from and when, as free text. Rates drift weekly; a figure
 * without a date reads as current when it may be months old. Free text rather than a
 * date field because one grid can mix quotes from several sources and days (D36).
 */
export const DEFAULT_RATES_NOTE =
  "Annahme vom 22.11.2026, noch kein Angebot: 10 J. 4,3 / 4,2 / 4,0 % · 15 J. je +0,2 Pkt.";

export const EK_SCENARIOS: ScenarioBase[] = [
  { id: "ek10", ekRate: 10, label: "10% EK" },
  { id: "ek15", ekRate: 15, label: "15% EK" },
  { id: "ek20", ekRate: 20, label: "20% EK" },
];

/**
 * The two flats marked "Vergleichen? Ja" in the couple's Shortlist Sheet, at the bank
 * offers of 24.11.2026 (BauDarlehen24, Angebote 1a/1b/2a/2b, 10 Jahre Sollzinsbindung).
 * Prices include the parking space; "Renovierung" is the 12k kitchen, which the offers'
 * Eigenkapital does not cover. Each flat carries its own banks' rates and the offers'
 * loan amounts (D45). The engine reproduces each offer's Restschuld to within 10 cents
 * (`offer2026-11.test.ts`). Stable ids, so `storage.ts` can add or refresh them (D40, D45).
 */
export const SHORTLIST_APARTMENT_CASES: ApartmentCase[] = [
  {
    id: "lindenstrasse-31g-we49",
    label: "Lindenstraße 31G",
    // Die Angebote rechnen mit 500.000 € inkl. TG-Stellplatz; das Exposé nennt
    // 495.000 € + 25.000 € = 520.000 €.
    purchasePrice: 500000,
    renovation: 12000,
    // Laut Exposé; Makler: wegen WEG-Investitionen ca. zwei Jahre erhöht.
    hausgeld: 630,
    // 2 % Notar/Grundbuch + 6 % Grunderwerbsteuer + 3,57 % Makler = 57.850 € im Angebot.
    closingCostRate: 11.57,
    // Angebot 1a 2.369,63 €, 1b 2.370,79 €: dieselbe Rate, gerundet (D14).
    monthlyPayment: 2370,
    kfwAmount: 0,
    kfwRate: 0,
    kfwTermYears: 20,
    moveInMonths: 0,
    parkingPrice: 25000,
    // 1a HypoVereinsbank 445.000 € (EK 112.850 €), 1b Commerzbank 420.850 € (EK 137.000 €).
    offerLoans: { ek10: 445000, ek15: 420850 },
    rates: {
      // 20 % EK: kein Angebot, 0,1 Pkt. unter 85 % geschätzt wie im Angebot vom August.
      10: { ek10: 4.11, ek15: 4.06, ek20: 3.96 },
      // 15 Jahre: 85 % laut Angebot vom 25.11.2026 (Commerzbank 4,27 %, +0,21 Pkt.);
      // 10 % und 20 % ohne Angebot, mit demselben Aufschlag geschätzt.
      15: { ek10: 4.32, ek15: 4.27, ek20: 4.17 },
    },
    ratesNote:
      "Angebote 24./25.11.2026 (BauDarlehen24): 10 J.: 90 % HypoVereinsbank 4,11 %, 85 % Commerzbank 4,06 % · 15 J.: 85 % Commerzbank 4,27 % · 20 % EK sowie 15 J. bei 10 %/20 % geschätzt",
    annualSpecialRepayments: [...DEFAULT_INPUTS.annualSpecialRepayments],
    note:
      "Lindenstraße 31G, Haus 3 / WE49, 93,6 m², 4. OG rechts, Bj. 1998, Energie D. " +
      "Kaufpreis 500.000 € inkl. TG wie in den Angeboten (Exposé: 495.000 € + 25.000 € TG). Mit Makler (3,57 %). " +
      "Renovierung = Einbauküche 12k, nicht im Angebots-EK. Hausgeld 630 € laut Exposé. " +
      "Angebot 1a (90 %) HypoVereinsbank: 445.000 € zu 4,11 %, Rate 2.369,63 €, Tilgung 2,28 %, Restschuld 2036 319.775 €, Laufzeit 25 J. 2 M. (bis 01/2052). " +
      "Angebot 1b (85 %) Commerzbank: 420.850 € zu 4,06 %, Rate 2.370,79 €, Tilgung 2,70 %, Restschuld 2036 280.975 €, Laufzeit 22 J. 8 M. " +
      "Sondertilgung je 5 % p.a.; Bereitstellungszinsfrei 12 bzw. 6 Monate, danach 0,25 %/Monat. Angebote gültig bis 26./27.11.2026.",
  },
  {
    id: "buwog-arbor-h2-we08",
    label: "BUWOG Arbor WE08",
    // 625.100 € Aktionspreis (bis Beurkundung 30.11.2026) + 30.000 € Stellplatz.
    purchasePrice: 655100,
    renovation: 12000,
    // BUWOG-Schätzung 3,50 €/m², kein finaler Wirtschaftsplan.
    hausgeld: 331,
    // Provisionsfrei: 6 % Grunderwerbsteuer + 2 % Notar/Grundbuch = 52.408 € im Angebot.
    closingCostRate: 8,
    // Angebot 2a 2.669,53 €, 2b 2.668,75 € (Bank + KfW ab dem 2. Jahr), gerundet (D14).
    monthlyPayment: 2669,
    // KfW 300 laut Angebot: 170.000 € zu 0,78 %, 1 tilgungsfreies Jahr, 35 Jahre
    // Laufzeit (Rate ab dem 2. Jahr 474,49 €), keine Sondertilgung.
    kfwAmount: 170000,
    kfwRate: 0.78,
    kfwTermYears: 35,
    // Unterschrift Dezember 2026, Übergabe vsl. Juni 2028. Die Angebote rechnen dagegen
    // mit Auszahlung 12/2026 und Tilgung ab 2027, als gäbe es keine Bauzeit (D45).
    moveInMonths: 19,
    parkingPrice: 30000,
    // 2a Deutsche Bank 413.508 € + KfW (EK 124.000 €), 2b Commerzbank 380.508 € + KfW (EK 157.000 €).
    offerLoans: { ek10: 583508, ek15: 550508 },
    rates: {
      // Bankteil ohne KfW. 20 % EK: kein Angebot, 0,1 Pkt. unter 85 % geschätzt.
      10: { ek10: 4.01, ek15: 3.94, ek20: 3.84 },
      // 15 Jahre: 85 % aus dem Angebot vom 25.11.2026 abgeleitet: Mischzins 3,11 % auf
      // 550.508 €, davon KfW 170.000 € zu 0,78 % → Bankteil ≈ 4,15 % (+0,21 Pkt.). Die
      // KfW bleibt bei 10 Jahren Bindung. 10 % und 20 % mit demselben Aufschlag geschätzt.
      15: { ek10: 4.22, ek15: 4.15, ek20: 4.05 },
    },
    ratesNote:
      "Angebote 24./25.11.2026 (BauDarlehen24): Bankteil 10 J.: 90 % Deutsche Bank 4,01 %, 85 % Commerzbank 3,94 % · 15 J.: 85 % Commerzbank ≈ 4,15 % (aus Mischzins 3,11 %) · dazu KfW 300 0,78 % (10 J.) · 20 % EK sowie 15 J. bei 10 %/20 % geschätzt",
    annualSpecialRepayments: [...DEFAULT_INPUTS.annualSpecialRepayments],
    note:
      "An der Filmfabrik 9, Haus 2 WE08, 94,6 m², 2. OG Nordost, Neubau EH40, Bezug vsl. Juni 2028. " +
      "Kaufpreis = 625.100 € Aktionspreis (bis 30.11.2026) + 30.000 € Stellplatz. Provisionsfrei. " +
      "Renovierung = Einbauküche 12k, nicht im Angebots-EK. Hausgeld 331 € nur BUWOG-Schätzung. " +
      "Angebot 2a (90 %) Deutsche Bank 413.508 € zu 4,01 % (Rate 2.195,04 €) + KfW 300 170.000 € zu 0,78 % (474,49 € ab dem 2. Jahr, 35 J.), Mischzins 3,07 %, Restschuld 2036 424.196 €. " +
      "Angebot 2b (85 %) Commerzbank 380.508 € zu 3,94 % (2.194,26 €) + dieselbe KfW, Mischzins 2,96 %, Restschuld 2036 371.097 €. " +
      "Die Angebote rechnen mit Tilgung ab 2027; real beginnt sie nach Übergabe (Juni 2028), daher zeigt die App höhere Restschulden. " +
      "Bereitstellungszinsfrei: Deutsche Bank 12, Commerzbank nur 6 Monate, danach 0,25 %/Monat; KfW 12 Monate, danach 0,15 %/Monat. " +
      "KfW 300: zu versteuerndes Haushaltseinkommen max. 100.000 € (2 Kinder), Ø des 2. und 3. Jahres vor Antrag.",
  },
];

/**
 * Bumped whenever shipped apartment data changes (D45). Despite the name it now also
 * governs the default flats: revision 3 replaced the "Wohnung C" placeholder (D47),
 * revision 4 does it again with a check that actually fires (D49). The persisted field
 * keeps its name so older saves still read.
 */
export const SHORTLIST_REVISION = 4;

/**
 * What `flat-c` shipped as before D47: a round-number placeholder ("Wohnung C",
 * 600.000 €), never a real flat. A stored `flat-c` still matching this was never
 * edited, so `storage.ts` replaces it with the Henriette-Lustig data.
 *
 * **Only fields the couple could have set on this flat are listed** (D49). Monatsrate,
 * Kaufnebenkostensatz, Zinsraster and Zins-Notiz are deliberately absent: the placeholder
 * never carried its own, it took the global ones, and `reviveApartment` still hands an
 * older save its globals for them. Checking those asked "did you ever change a global
 * setting anywhere in the app", which has nothing to do with whether this flat was
 * touched — and answered yes for every real save, so the first version of this refresh
 * fired for nobody.
 */
export const SUPERSEDED_PLACEHOLDER_FLAT_C = {
  id: "flat-c",
  label: "Wohnung C",
  purchasePrice: 600000,
  renovation: 5000,
  hausgeld: 670,
  kfwAmount: 0,
  kfwRate: 0,
  /** 20 as shipped; saves from before the field revive with today's term. */
  kfwTermYears: [20],
  moveInMonths: 0,
  parkingPrice: 0,
  /**
   * Plans that mean "never set a plan on this flat": the one shipped with the
   * placeholder, the empty one an older save revives with, and the global default. The
   * new flat starts at zero on purpose, so a plan the couple really chose keeps the flat.
   */
  annualSpecialRepaymentPlans: [
    [3000, 3000, 4000, 4000, 5000, 5000, 6000, 6000, 6000, 6000],
    [],
    [...DEFAULT_INPUTS.annualSpecialRepayments],
  ],
};

/**
 * Revision 1 (24.11.2026) shipped these rate grids and notes. A Shortlist flat that
 * still holds them gets the 15-year offers of 25.11.2026 (revision 2) and nothing else.
 */
export const SUPERSEDED_SHORTLIST_RATES: Record<string, { rates: InterestRates; ratesNote: string }> = {
  "lindenstrasse-31g-we49": {
    rates: { 10: { ek10: 4.11, ek15: 4.06, ek20: 3.96 }, 15: { ek10: 4.31, ek15: 4.26, ek20: 4.16 } },
    ratesNote: "Angebote 24.11.2026 (BauDarlehen24): 90 % HypoVereinsbank 4,11 %, 85 % Commerzbank 4,06 %, je 10 J. · 20 % EK und 15 J. geschätzt",
  },
  "buwog-arbor-h2-we08": {
    rates: { 10: { ek10: 4.01, ek15: 3.94, ek20: 3.84 }, 15: { ek10: 4.21, ek15: 4.14, ek20: 4.04 } },
    ratesNote: "Angebote 24.11.2026 (BauDarlehen24): Bankteil 90 % Deutsche Bank 4,01 %, 85 % Commerzbank 3,94 %, je 10 J., dazu KfW 300 0,78 % · 20 % EK und 15 J. geschätzt",
  },
};

export type SupersededShortlist = {
  purchasePrice: number;
  monthlyPayments: number[];
  kfwAmount: number;
  kfwRates: number[];
  /** 20 as shipped in D44; saves from before that field revive with today's term. */
  kfwTermYears: number[];
  moveInMonths: number;
  /** `textHash` of every note shipped before, so a note the couple wrote is kept. */
  noteHashes: number[];
};

/**
 * What earlier versions shipped for the Shortlist flats: a stored flat that still
 * matches one of these in every field that changed was never edited, so `storage.ts`
 * replaces it with the current data (D45).
 */
export const SUPERSEDED_SHORTLIST: Record<string, SupersededShortlist> = {
  "lindenstrasse-31g-we49": {
    purchasePrice: 520000,
    monthlyPayments: [2200, 2460, 2500],
    kfwAmount: 0,
    kfwRates: [0],
    kfwTermYears: [20],
    moveInMonths: 0,
    noteHashes: [4117728304, 1755963962],
  },
  "buwog-arbor-h2-we08": {
    purchasePrice: 655100,
    monthlyPayments: [2770, 2670, 2976],
    kfwAmount: 170000,
    kfwRates: [1.3],
    kfwTermYears: [20, 35],
    moveInMonths: 19,
    noteHashes: [3363609318, 577526082, 823980744],
  },
};

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
    kfwAmount: 0,
    kfwRate: 0,
    kfwTermYears: 20,
    moveInMonths: 0,
    parkingPrice: 0,
    rates: { 10: { ...DEFAULT_RATES[10] }, 15: { ...DEFAULT_RATES[15] } },
    ratesNote: DEFAULT_RATES_NOTE,
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
    kfwAmount: 0,
    kfwRate: 0,
    kfwTermYears: 20,
    moveInMonths: 0,
    parkingPrice: 0,
    rates: { 10: { ...DEFAULT_RATES[10] }, 15: { ...DEFAULT_RATES[15] } },
    ratesNote: DEFAULT_RATES_NOTE,
    annualSpecialRepayments: [...DEFAULT_INPUTS.annualSpecialRepayments],
  },
  {
    // Henriette-Lustig-Straße 13 (Wasserstadt Spindlersfeld), an den vier Angeboten
    // von BauDarlehen24 vom 27.11.2026. Ersetzt den früheren Platzhalter "Wohnung C"
    // (D47). Preis 499.000 € inkl. Stellplatz P6, der als Sondernutzungsrecht zur
    // Wohnung gehört; ein separater Stellplatzpreis ist unbekannt, daher 0 €.
    id: "flat-c",
    label: "SpreeLofts · WE 06",
    purchasePrice: 499000,
    // Planwert: 12.000 € Küche + 3.000 € Aufarbeitung EG-Parkett. Fenster, Wallbox
    // und WEG-Ladeumlage sind darin NICHT enthalten (siehe note).
    renovation: 15000,
    // Wirtschaftsplan 2026.
    hausgeld: 428,
    // 6 % Grunderwerbsteuer + 2 % Notar/Grundbuch + 3,57 % Käufercourtage
    // = 57.734,30 €, genau die Kaufnebenkosten der Angebote.
    closingCostRate: 11.57,
    // Die Kreditrate der bevorzugten Variante 2a. Die 10-%-Angebote laufen mit
    // 2.571,50 €, also 0,65 € höher; eine Rate je Wohnung, gerundet wie in D14.
    monthlyPayment: 2570.85,
    // Kein KfW-Darlehen in diesen Angeboten.
    kfwAmount: 0,
    kfwRate: 0,
    kfwTermYears: 20,
    // Bezugsfreier Bestand; Übergabetermin offen.
    moveInMonths: 0,
    parkingPrice: 0,
    // 1a/1b Lloyds bzw. PSD 444.000 € (EK 55.000 € auf den Kaufpreis, 11,02 %),
    // 2a/2b Commerzbank bzw. OLB 394.000 € (EK 105.000 €, 21,04 %). Für 15 % EK
    // gibt es kein Angebot: dort rechnet das Modell wieder nach Anteil.
    offerLoans: { ek10: 444000, ek20: 394000 },
    rates: {
      // 15 % EK hat kein Angebot: gerundeter Mittelwert der beiden Nachbarstufen,
      // eine Modellannahme und keine Bankkondition (ASSUMPTIONS §4.22).
      10: { ek10: 4.17, ek15: 4.1, ek20: 4.02 },
      15: { ek10: 4.35, ek15: 4.26, ek20: 4.16 },
    },
    ratesNote:
      "Angebote 27.11.2026 (BauDarlehen24, Vorprüfung — verbindliche Zusage offen, gültig bis 02.12.2026 12 Uhr): " +
      "10 J.: 10 % EK Lloyds Bank 4,17 % (eff. 4,28 %), 20 % EK Commerzbank 4,02 % (eff. 4,09 %) · " +
      "15 J.: 10 % EK PSD Bank Nürnberg 4,35 % (eff. 4,46 %), 20 % EK OLB 4,16 % (eff. 4,27 %) · " +
      "15 % EK: kein Angebot, Modellannahme 4,10 % (10 J.) und 4,26 % (15 J.), gerundete Mittelwerte · " +
      "Modellrate 2.570,85 € = Variante 2a; die 10-%-Angebote laufen mit 2.571,50 € (+0,65 €)",
    // Für den Abgleich mit dem Bankangebot zunächst null; die Bankterminrechnung
    // steht als Referenz in der Notiz.
    annualSpecialRepayments: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    note:
      "Henriette-Lustig-Straße 13, 12555 Berlin-Köpenick (Wasserstadt Spindlersfeld). " +
      "Denkmal-Maisonette, 4 Zimmer auf EG + Galerie, Terrasse, ca. 52,20 m² Garten, Außenstellplatz P6 — Garten, Terrasse und P6 als Sondernutzungsrecht. " +
      "Wohnfläche 97,75 m² laut Teilungserklärung und WEG-Unterlagen, ca. 106 m² laut Exposé; aktuelle Wohnflächenberechnung offen. " +
      "Energieklasse B, Endenergiebedarf Gebäude 64 kWh/(m²·a), Fernwärme, Fußbodenheizung. " +
      "Kaufpreis 499.000 € inkl. P6; Kaufbereitschaft telefonisch erklärt, Verkäuferbestätigung offen, Inklusivpreis für P6 schriftlich zu bestätigen. " +
      "Kaufnebenkosten 57.734,30 € (29.940 € Grunderwerbsteuer, 9.980 € Notar/Grundbuch, 17.814,30 € Käufercourtage). " +
      "Renovierung 15.000 € Planwert = 12.000 € Küche + 3.000 € Aufarbeitung EG-Parkett. Hausgeld 428 € laut Wirtschaftsplan 2026. " +
      "ANGEBOTE BauDarlehen24 vom 27.11.2026, alle mit 5 % Sondertilgung p.a. und sechs bereitstellungszinsfreien Monaten: " +
      "1a Lloyds Bank 444.000 € zu 4,17 %, 10 J., Rate 2.571,50 €, Tilgung 2,78 %, Restschuld 291.173 €. " +
      "1b PSD Bank Nürnberg 444.000 € zu 4,35 %, 15 J., Rate 2.571,50 €, Tilgung 2,60 %, Restschuld nach 10 J. 299.700 €, zum Bindungsende 200.363 €. " +
      "2a Commerzbank (BEVORZUGT) 394.000 € zu 4,02 %, 10 J., Rate 2.570,85 €, Tilgung 3,81 %, Restschuld 209.603 €. " +
      "2b OLB 394.000 € zu 4,16 %, 15 J., Rate 2.570,85 €, Tilgung 3,67 %, Restschuld nach 10 J. 215.061 €, zum Bindungsende 93.554 €. " +
      "Eigenkapital der Angebote inkl. Kaufnebenkosten: 112.734,30 € (Variante 1) bzw. 162.734,30 € (Variante 2). " +
      "SONDERTILGUNG: Basisplan 0 €, damit die App gegen das Angebot abgleichbar bleibt. Der Bankterminplan rechnet mit 5 × 10.000 € jeweils zum 30.06. 2028–2032 " +
      "und kommt auf ca. 144.596 € Restschuld und ca. 15.007 € Zinsersparnis; die App tilgt zum Kreditjahresende und käme mit derselben Summe auf ca. 145.888 € " +
      "und ca. 13.716 €. Die Differenz ist Terminwirkung, kein Modellfehler. " +
      "NICHT IM BUDGET: Fenster oben auffällig (Schaden und Kosten offen), Wallbox P6 ca. 1.800 € (Kabel laut Makler vorhanden), " +
      "separate WEG-Ladeumlage rechnerisch ca. 4.178 € (Zahlungsstatus offen). Küche fehlt; Küchenpartner laut Makler ca. 3–5 Wochen, Rabattangabe 15 % oder 50 % unklar.",
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
      kfwAmount: 0,
      kfwRate: 0,
      kfwTermYears: 20,
      moveInMonths: 0,
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
      kfwAmount: 0,
      kfwRate: 0,
      kfwTermYears: 20,
      moveInMonths: 0,
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
      kfwAmount: 0,
      kfwRate: 0,
      kfwTermYears: 20,
      moveInMonths: 0,
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
  { id: "compare", number: 7, label: "Wohnungen vergleichen" },
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
