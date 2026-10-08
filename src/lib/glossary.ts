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
    "Alles, was ihr für den Kauf einsetzen könntet: Konto, Tagesgeld, Festgeld und ETFs, die ihr verkaufen würdet. ETFs mit dem Betrag nach Steuer eintragen: beim Verkauf geht auf die Kursgewinne Abgeltungsteuer ab. Die genaue Aufteilung pflegt ihr im EK-Tracker.",
  reserveTarget:
    "Was nach dem Kauf übrig bleiben soll — für Notfälle, Reparaturen, Autowechsel. Eure persönliche Grenze, keine Bankvorgabe.",
  renovation: "Was direkt nach dem Kauf gemacht werden muss, bevor ihr einzieht.",
  moving: "Umzug, Küche, Möbel — einmalige Kosten rund um den Einzug.",
  currentWarmRent:
    "Was ihr heute für die Miete zahlt, inklusive Nebenkosten und Heizung, ohne Strom. Gleiche Basis wie die Eigentumskosten, damit Miete und Eigentum vergleichbar sind.",
  monthlyOwnershipCosts:
    "Alles, was ihr als Eigentümer monatlich für die Wohnung zahlt außer der Kreditrate: das komplette Hausgeld (mit Heizung, Nebenkosten und Rücklage), Grundsteuer und was ihr selbst für die Wohnung zurücklegt. Gleiche Basis wie eure Warmmiete, ohne Strom. Bewusst grob.",

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
  etfTaxRate:
    "Was vom ETF-Gewinn beim Verkauf an Steuer abgeht. 18,46% gilt für Aktien-ETFs: 25% Abgeltungsteuer plus Soli, aber nur auf 70% des Gewinns (Teilfreistellung). Mit Kirchensteuer etwas mehr, mit ungenutztem Sparerpauschbetrag weniger. Die Zinsen, die ihr durch mehr Eigenkapital spart, sind steuerfrei. Deshalb gehört die Steuer in den Vergleich.",
  refiStressShift:
    "Um wie viele Prozentpunkte der Zins nach der Zinsbindung höher liegen könnte als heute. Kein Forecast, sondern ein Stresstest: Wie viel länger würde dieselbe Monatsrate dann brauchen, bis ihr schuldenfrei seid? Weniger Restschuld heißt weniger Risiko an dieser Stelle.",
  maxRuntimeYears:
    "Spätestens nach so vielen Jahren soll das Darlehen abbezahlt sein, zum Beispiel bis zum Renteneintritt des Älteren von euch. Varianten, die länger laufen, bleiben tragbar, werden aber gelb markiert: die Laufzeit hängt am heutigen Zins und ist deshalb eine Schätzung.",
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
    "Was am Ende der Zinsbindung noch offen ist und neu finanziert werden muss. Die wichtigste Zahl für das Zinsänderungsrisiko. Darunter steht, wie viel länger dieselbe Monatsrate bräuchte, wenn der Anschlusszins um den Stresswert (unter Markt einstellbar) höher liegt als heute, oder ob sie dann nicht einmal mehr die Zinsen deckt.",
  wealthAtHorizon:
    "Was euch am Ende der Zinsbindung gehört: der Wert der Wohnung minus Restschuld, plus euer freies Kapital nach Steuer. Für jede EK-Stufe am selben Stichtag gerechnet und deshalb direkt vergleichbar. Enthält, was ihr monatlich übrig habt (Netto-Sparrate plus Miete, minus Rate und Eigentumskosten), angelegt zur ETF-Annahme.",
  liquidAtHorizon:
    "Der Teil davon, an den ihr ohne Verkauf der Wohnung kommt: was nach dem Kauf übrig bleibt, plus das laufende Sparen, minus Sondertilgungen, angelegt zur ETF-Annahme und nach Steuer.",
  specialRepayment:
    "Zusätzliche Zahlung ans Darlehen, meist einmal im Jahr möglich. Sie geht komplett in die Tilgung und verkürzt die Laufzeit spürbar.",

  // --- Regeln ---
  cleanScenario:
    "Ein Weg gilt als tragbar, wenn drei Dinge gleichzeitig stimmen: die Monatsrate zahlt das Darlehen in einem Leben ab, nach dem Kauf bleibt mindestens eure Reserve übrig, und die Monatsbelastung bleibt unter eurer selbstgesetzten Grenze. „Gerade so tragbar“ heißt: tragbar, aber es bleibt weniger als das Anderthalbfache eurer Reserve übrig.",
  waitSavings:
    "Was monatlich wirklich zusätzlich aufs Konto wandert — nach Miete und normalen Ausgaben. Die Miete wird separat ausgewiesen und nicht noch einmal abgezogen.",
} as const;

export type GlossaryKey = keyof typeof GLOSSARY;
