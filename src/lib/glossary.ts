/**
 * One place for every explanation shown in a tooltip.
 *
 * Central rather than inline so the same term is never explained two different ways
 * in two different corners of the app — and so the wording can be reviewed as a set,
 * in the calm, non-salesy voice the product requires.
 */
export const GLOSSARY = {
  // --- Kauf & Cash ---
  purchasePrice:
    "Der reine Kaufpreis der Wohnung. Kaufnebenkosten kommen obendrauf und werden nie mitfinanziert.",
  closingCostRate:
    "Grunderwerbsteuer, Notar, Grundbuch und ggf. Maklerprovision — als Prozentsatz vom Kaufpreis. Diese Kosten musst du immer aus Eigenkapital bezahlen; keine Bank finanziert sie mit.",
  availableCapital:
    "Alles, was ihr für den Kauf einsetzen könntet: Konto, Tagesgeld, Festgeld und ETFs, die ihr verkaufen würdet. Die genaue Aufteilung pflegt ihr im EK-Tracker.",
  reserveTarget:
    "Was nach dem Kauf übrig bleiben soll — für Notfälle, Reparaturen, Autowechsel. Eure persönliche Grenze, keine Bankvorgabe.",
  renovation: "Was direkt nach dem Kauf gemacht werden muss, bevor ihr einzieht.",
  moving: "Umzug, Küche, Möbel — einmalige Kosten rund um den Einzug.",
  currentWarmRent:
    "Was ihr heute inklusive Nebenkosten für die Miete zahlt. Dient nur dem monatlichen Cashflow-Vergleich, nicht einer vollen Mieten-oder-Kaufen-Rechnung.",
  monthlyOwnershipCosts:
    "Grobe Schätzung: nicht umlagefähiges Hausgeld, Instandhaltungsrücklage, Grundsteuer, Versicherung. Bewusst grob gehalten.",

  // --- Finanzierung ---
  householdNetIncome: "Was monatlich nach Steuern und Sozialabgaben bei euch beiden zusammen ankommt.",
  monthlyPayment:
    "Was ihr monatlich ans Darlehen zahlt — für jede Eigenkapitalstufe gleich, weil euer Budget sich durch mehr Eigenkapital nicht ändert. Bei mehr Eigenkapital ist das Darlehen kleiner, also steckt mehr von derselben Rate in der Tilgung und ihr seid früher schuldenfrei. Genauso rechnet auch die Bank in ihren Angeboten.",
  repaymentRate:
    "Wie viel Prozent des Darlehens ihr im ersten Jahr tilgt. Ergibt sich hier aus der Monatsrate und dem Zins und ist deshalb je Eigenkapitalstufe verschieden. Monatsrate, Tilgungssatz und Laufzeit sind dasselbe, nur anders ausgedrückt.",
  fixedRateYears:
    "Wie lange der Zinssatz vertraglich garantiert ist. Danach braucht ihr eine Anschlussfinanzierung zu dann unbekannten Konditionen. Längere Bindung heißt meist etwas höherer Zins, aber mehr Sicherheit.",
  interestRate:
    "Der Sollzins, den die Bank für diese Eigenkapitalstufe verlangt. Mehr Eigenkapital heißt in der Regel weniger Risiko für die Bank und damit einen niedrigeren Zins. Eigene Angebote hier eintragen.",
  specialRepaymentLimitRate:
    "Wie viel Sondertilgung euer Vertrag pro Jahr erlaubt — üblich sind 5% der ursprünglichen Darlehenssumme. Steht im Bankangebot.",
  annualSpecialRepayment:
    "Der Durchschnitt aus eurem Jahresplan weiter unten. Wird berechnet, nicht eingegeben.",

  // --- Erweitert ---
  etfReturnRate:
    "Womit ihr rechnet, wenn das Geld statt in die Immobilie im ETF bliebe. Reine Annahme — sie entscheidet mit darüber, ob mehr Eigenkapital sich lohnt.",
  maxBurdenRate:
    "Wie viel eures Haushaltsnettos maximal in die Wohnung fließen darf. 40% ist eine verbreitete Faustregel, keine Bankregel — ihr könnt sie anpassen.",
  propertyGrowthRate: "Angenommene jährliche Wertsteigerung der Immobilie. Bewusst konservativ setzen.",
  inflationRate:
    "Angenommene allgemeine Teuerung. Zusammen mit der Wertsteigerung ergibt sich daraus die Realrendite — was nach Inflation übrig bleibt.",

  // --- Ergebnisse ---
  cashNeeded:
    "Was ihr am Tag des Kaufs tatsächlich überweisen müsst: Anzahlung + Kaufnebenkosten + Renovierung + Umzug.",
  cashLeft: "Was vom verfügbaren Eigenkapital nach dem Kauf übrig bleibt.",
  loan:
    "Die Darlehenssumme: Kaufpreis minus Anzahlung. Die Kaufnebenkosten sind NICHT enthalten — die zahlt ihr zusätzlich aus Eigenkapital, keine Bank finanziert sie mit.",
  runtimeYears:
    "Wann das Darlehen vollständig abbezahlt wäre, wenn der heutige Zins bis zum Ende gilt und ihr den Sondertilgungsplan durchhaltet. Bei gleicher Monatsrate ist das die Größe, die mehr Eigenkapital wirklich verändert.",
  reserveGap:
    "Abstand zwischen dem, was übrig bleibt, und eurem Reserve-Ziel. Negativ heißt: ihr unterschreitet euer eigenes Polster.",
  allInMonthly:
    "Monatsrate ans Darlehen plus laufende Eigentumskosten. Das ist die Zahl, die jeden Monat wirklich vom Konto geht.",
  burdenRatio: "Anteil des Haushaltsnettos, der monatlich in die Wohnung geht.",
  interestFixed:
    "Zinsen während der Zinsbindung. Diese Zahl ist belastbar — der Zinssatz ist so lange vertraglich fest.",
  interestTotal:
    "Zinsen über die gesamte Laufzeit, unter der Annahme, dass der heutige Zins für immer gilt. Das ist eine Illustration, keine Prognose: den Zins der Anschlussfinanzierung kennt heute niemand.",
  remainingAfterFixed:
    "Was am Ende der Zinsbindung noch offen ist und neu finanziert werden muss. Die wichtigste Zahl für das Zinsänderungsrisiko.",
  propertyValueAtPayoff:
    "Was die Wohnung bei vollständiger Abzahlung wert wäre, wenn die angenommene Wertsteigerung eintritt. Illustrativ.",
  netWorthAtPayoff:
    "Immobilienwert minus eingesetztem Cash minus allen gezahlten Zinsen. Grobe Orientierung, keine Vermögensrechnung.",
  specialRepayment:
    "Zusätzliche Zahlung ans Darlehen, meist einmal im Jahr möglich. Sie geht komplett in die Tilgung und verkürzt die Laufzeit spürbar.",

  // --- Regeln ---
  cleanScenario:
    "Ein Weg gilt als tragbar, wenn beides gleichzeitig stimmt: nach dem Kauf bleibt mindestens eure Reserve übrig, und die Monatsbelastung bleibt unter eurer selbstgesetzten Grenze.",
  waitSavings:
    "Was monatlich wirklich zusätzlich aufs Konto wandert — nach Miete und normalen Ausgaben. Die Miete wird separat ausgewiesen und nicht noch einmal abgezogen.",
} as const;

export type GlossaryKey = keyof typeof GLOSSARY;
