import { beforeEach, describe, expect, it } from "vitest";
import {
  buildBundle,
  defaultState,
  listSaves,
  loadNamed,
  parseBundle,
  saveExists,
  saveNamed,
  storageAvailable,
  textHash,
  upgradeShippedRates,
  writeBundleSaves,
} from "./storage";
import {
  DEFAULT_INPUTS,
  DEFAULT_RATES,
  DEFAULT_RATES_NOTE,
  EK_SCENARIOS,
  OFFER_RATES,
  OFFER_RATES_NOTE,
  SHORTLIST_APARTMENT_CASES,
} from "./defaults";

/** Minimal in-memory localStorage — the module guards every access, so this is enough. */
function installStorage() {
  const data = new Map<string, string>();
  const store = {
    get length() {
      return data.size;
    },
    key: (index: number) => Array.from(data.keys())[index] ?? null,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
    clear: () => data.clear(),
  };
  globalThis.window = { localStorage: store } as unknown as Window & typeof globalThis;
  return store;
}

describe("persistence", () => {
  beforeEach(() => {
    installStorage();
  });

  it("round-trips the current shape", () => {
    expect(storageAvailable()).toBe(true);
    expect(saveNamed("Angebot 1A", defaultState())).toBe(true);
    expect(saveExists("Angebot 1A")).toBe(true);
    expect(saveExists("gibt es nicht")).toBe(false);

    const loaded = loadNamed("Angebot 1A")!;
    expect(loaded.version).toBe(2);
    expect(loaded.rates[10].ek10).toBe(DEFAULT_RATES[10].ek10);
  });

  it("migrates a v1 save instead of discarding it", () => {
    // What the app wrote before the EK levels and the rate shape changed.
    const legacy = {
      version: 1,
      inputs: { purchasePrice: 500000, repaymentRate: 2.4, fixedRateYears: 20, reserveTarget: 31000 },
      rates: { ek5: 4.15, ek10: 3.85, ek15: 3.65 },
      apartmentCases: [
        {
          id: "flat-a",
          label: "Wohnung A",
          purchasePrice: 500000,
          renovation: 0,
          monthlyOwnershipCosts: 700,
          selectedScenarioId: "ek5",
          annualSpecialRepayments: [6000, 6000],
        },
      ],
      activeApartmentId: "flat-a",
      selectedId: "ek5",
    };
    window.localStorage.setItem("mdh:save:alt", JSON.stringify(legacy));

    const loaded = loadNamed("alt")!;
    expect(loaded).not.toBeNull();
    expect(loaded.version).toBe(2);

    // The user's own numbers survive.
    expect(loaded.inputs.purchasePrice).toBe(500000);
    expect(loaded.inputs.reserveTarget).toBe(31000);

    // "ek5" no longer exists and must not survive as a dangling id.
    const knownIds = EK_SCENARIOS.map((scenario) => scenario.id);
    expect(knownIds).toContain(loaded.selectedId);

    // The apartment is rebuilt field by field, so a key from an older shape cannot
    // ride along into live state.
    expect(loaded.apartmentCases[0]).not.toHaveProperty("selectedScenarioId");

    // 20 years is no longer an offered binding.
    expect([10, 15]).toContain(loaded.inputs.fixedRateYears);

    // The Tilgungssatz became a monthly rate; the flat rates were dropped for the
    // offer's matrix, because a v1 rate carries no record of which binding it was for.
    expect(loaded.inputs).not.toHaveProperty("repaymentRate");
    expect(loaded.inputs.monthlyPayment).toBeGreaterThan(0);
    expect(loaded.rates[10].ek10).toBe(DEFAULT_RATES[10].ek10);
    expect(loaded.rates[15].ek20).toBe(DEFAULT_RATES[15].ek20);
  });

  it("falls back to defaults for stored values that are present but unusable", () => {
    // A spread over the defaults only guards MISSING fields. These are all present,
    // and every one of them used to reach the model and turn its output into NaN.
    const corrupt = {
      ...defaultState(),
      inputs: {
        ...defaultState().inputs,
        purchasePrice: null,
        monthlyPayment: "1.900,00",
        reserveTarget: Number.NaN,
        householdNetIncome: 9100,
        annualSpecialRepayments: [6000, "nope", -500, null],
      },
      rates: { 10: { ek10: "drei", ek15: 3.86, ek20: 3.76 }, 15: DEFAULT_RATES[15] },
      apartmentCases: [
        { id: "flat-a", label: "Wohnung A", purchasePrice: undefined, renovation: "x" },
      ],
    };
    window.localStorage.setItem("mdh:save:kaputt", JSON.stringify(corrupt));

    const loaded = loadNamed("kaputt")!;
    expect(loaded).not.toBeNull();

    for (const value of Object.values(loaded.inputs)) {
      if (typeof value === "number") expect(Number.isFinite(value)).toBe(true);
    }
    expect(loaded.inputs.purchasePrice).toBe(DEFAULT_INPUTS.purchasePrice);
    expect(loaded.inputs.monthlyPayment).toBe(DEFAULT_INPUTS.monthlyPayment);
    expect(loaded.inputs.reserveTarget).toBe(DEFAULT_INPUTS.reserveTarget);
    // A usable stored value is still the user's, not the default.
    expect(loaded.inputs.householdNetIncome).toBe(9100);
    // Unusable amounts become 0; negative Sondertilgung is not a thing.
    expect(loaded.inputs.annualSpecialRepayments).toEqual([6000, 0, 0, 0]);

    expect(loaded.rates[10].ek10).toBe(DEFAULT_RATES[10].ek10);
    expect(loaded.rates[10].ek15).toBe(3.86);

    const apartment = loaded.apartmentCases[0];
    expect(Number.isFinite(apartment.purchasePrice)).toBe(true);
    expect(Number.isFinite(apartment.renovation)).toBe(true);
    expect(Number.isFinite(apartment.hausgeld)).toBe(true);
    expect(apartment.annualSpecialRepayments).toEqual([]);
  });

  it("rebuilds a v1 Monatsrate from the contract that save actually held (K16)", () => {
    // The global inputs.purchasePrice is stale; every v1 figure came from the ACTIVE
    // apartment, at the EK level the save was on, priced with the rate it stored.
    const legacy = {
      version: 1,
      inputs: { purchasePrice: 720000, repaymentRate: 2.4, fixedRateYears: 10 },
      rates: { ek5: 4.15, ek10: 3.85, ek15: 3.65 },
      apartmentCases: [
        {
          id: "flat-a",
          label: "Wohnung A",
          purchasePrice: 600000,
          renovation: 0,
          monthlyOwnershipCosts: 700,
          selectedScenarioId: "ek5",
          annualSpecialRepayments: [],
        },
      ],
      activeApartmentId: "flat-a",
      selectedId: "ek5",
    };
    window.localStorage.setItem("mdh:save:v1-active", JSON.stringify(legacy));

    const loaded = loadNamed("v1-active")!;
    // 5% EK on the 600k flat at the stored 4,15% plus 2,4% Tilgung.
    const expected = (600000 * 0.95 * ((4.15 + 2.4) / 100)) / 12;
    expect(loaded.inputs.monthlyPayment).toBeCloseTo(expected, -1);

    // Deriving it from the stale 720k, a hardcoded 90% loan and today's default rate
    // produced 3.390 € — 279 €/Monat of silently added burden.
    expect(loaded.inputs.monthlyPayment).toBeLessThan(3300);
  });

  it("rejects a save from an unknown future version", () => {
    window.localStorage.setItem("mdh:save:future", JSON.stringify({ version: 99, apartmentCases: [] }));
    expect(loadNamed("future")).toBeNull();
  });

  it("turns a stored total 'Eigentumskosten' into Hausgeld without moving the total (D35)", () => {
    const state = defaultState();
    const stored = {
      ...state,
      apartmentCases: state.apartmentCases.map(({ hausgeld: _hausgeld, ...rest }, index) => ({
        ...rest,
        monthlyOwnershipCosts: [700, 50, 640][index],
      })),
    };
    window.localStorage.setItem("mdh:save:pre-d35", JSON.stringify(stored));

    const loaded = loadNamed("pre-d35")!;
    const extra = loaded.inputs.ownerExtraMonthly;
    expect(loaded.apartmentCases[0].hausgeld + extra).toBe(700);
    // Never a negative Hausgeld, even if the old total was below the new extra.
    expect(loaded.apartmentCases[1].hausgeld).toBe(0);
    expect(loaded.apartmentCases[2].hausgeld).toBe(550);
  });

  it("keeps the free-text Stand und Quelle of the rates (D36)", () => {
    const note = "10 J.: Interhyp vom 18.11.26 · 15 J.: Hausbank vom 20.11.26";
    saveNamed("neu", { ...defaultState(), ratesNote: note });
    expect(loadNamed("neu")!.ratesNote).toBe(note);
  });

  it("gives an undated save the default note only if its rates are the defaults (D36)", () => {
    const { ratesNote: _note, ...untouched } = defaultState();
    window.localStorage.setItem("mdh:save:alt-default", JSON.stringify(untouched));
    expect(loadNamed("alt-default")!.ratesNote).toBe(DEFAULT_RATES_NOTE);

    const edited = { ...untouched, rates: { ...untouched.rates, 10: { ...untouched.rates[10], ek10: 4.2 } } };
    window.localStorage.setItem("mdh:save:alt-edited", JSON.stringify(edited));
    // Nobody recorded where 4,2% came from; inventing a source would be worse than none.
    expect(loadNamed("alt-edited")!.ratesNote).toBe("");
  });

  it("keeps an apartment's name and note", () => {
    const state = defaultState();
    state.apartmentCases[0] = { ...state.apartmentCases[0], label: "Altbau Lindenstraße", note: "3. OG, Makler Weber" };
    saveNamed("namen", state);
    const loaded = loadNamed("namen")!;
    expect(loaded.apartmentCases[0].label).toBe("Altbau Lindenstraße");
    expect(loaded.apartmentCases[0].note).toBe("3. OG, Makler Weber");
  });

  it("exports and re-imports the screen and every named save", () => {
    const current = { ...defaultState(), ratesNote: "Interhyp vom 18.11.26" };
    current.inputs = { ...current.inputs, householdNetIncome: 9100 };
    saveNamed("Angebot 1A", defaultState());
    saveNamed("Wohnung B neu", current);

    const text = JSON.stringify(buildBundle(current, new Date("2026-11-18T12:00:00Z")));
    installStorage();
    const bundle = parseBundle(text)!;
    expect(bundle.savedAt).toBe("2026-11-18T12:00:00.000Z");
    expect(bundle.current.inputs.householdNetIncome).toBe(9100);
    expect(bundle.current.ratesNote).toBe("Interhyp vom 18.11.26");
    expect(writeBundleSaves(bundle.saves)).toBe(2);
    expect(listSaves()).toEqual(["Angebot 1A", "Wohnung B neu"]);
  });

  it("refuses a file that is not a bundle, and skips a broken save inside one", () => {
    expect(parseBundle("kein json")).toBeNull();
    expect(parseBundle(JSON.stringify({ app: "other", bundleVersion: 1 }))).toBeNull();

    const bundle = { ...buildBundle(defaultState()), saves: { gut: defaultState(), kaputt: { version: 2 } } };
    const parsed = parseBundle(JSON.stringify(bundle))!;
    expect(Object.keys(parsed.saves)).toEqual(["gut"]);
  });

  it("adds the Shortlist flats to older saves once, and keeps their global KNK (D40)", () => {
    const state = defaultState();
    const shortlistIds = SHORTLIST_APARTMENT_CASES.map((apartment) => apartment.id);
    const stored = {
      ...state,
      inputs: { ...state.inputs, closingCostRate: 8 },
      apartmentCases: state.apartmentCases
        .filter((apartment) => !shortlistIds.includes(apartment.id))
        .map(({ closingCostRate: _rate, ...rest }) => rest),
    };
    window.localStorage.setItem("mdh:save:pre-d40", JSON.stringify(stored));

    const loaded = loadNamed("pre-d40")!;
    expect(loaded.apartmentCases.map((apartment) => apartment.id)).toEqual([
      "flat-a",
      "flat-b",
      "flat-c",
      ...shortlistIds,
    ]);
    // The old global rate was what every stored apartment used.
    expect(loaded.apartmentCases[0].closingCostRate).toBe(8);
    expect(loaded.apartmentCases.find((a) => a.id === "buwog-arbor-h2-we08")!.closingCostRate).toBe(8);
    expect(loaded.apartmentCases.find((a) => a.id === "lindenstrasse-31g-we49")!.closingCostRate).toBe(11.57);

    // An edited Shortlist flat survives a round trip and is not added a second time.
    const edited = {
      ...loaded,
      apartmentCases: loaded.apartmentCases.map((apartment) =>
        apartment.id === "lindenstrasse-31g-we49" ? { ...apartment, purchasePrice: 505000 } : apartment,
      ),
    };
    saveNamed("edited", edited);
    const again = loadNamed("edited")!;
    expect(again.apartmentCases).toHaveLength(5);
    expect(again.apartmentCases.find((a) => a.id === "lindenstrasse-31g-we49")!.purchasePrice).toBe(505000);
  });

  it("moves an untouched offer grid to the current assumption, but never a chosen one (D41)", () => {
    const offer = { ...defaultState(), rates: OFFER_RATES, ratesNote: OFFER_RATES_NOTE };
    expect(upgradeShippedRates(offer).rates).toEqual(DEFAULT_RATES);
    expect(upgradeShippedRates(offer).ratesNote).toBe(DEFAULT_RATES_NOTE);

    // Their own note means they chose these rates.
    const chosen = { ...offer, ratesNote: "Angebot Baudarlehen24 nochmal geprüft" };
    expect(upgradeShippedRates(chosen)).toBe(chosen);

    // One edited rate means it is no longer the shipped grid.
    const edited = { ...offer, rates: { ...OFFER_RATES, 10: { ...OFFER_RATES[10], ek10: 3.9 } } };
    expect(upgradeShippedRates(edited)).toBe(edited);

    // Named saves are not upgraded: one may hold the offer on purpose.
    saveNamed("Angebot August", offer);
    expect(loadNamed("Angebot August")!.rates).toEqual(OFFER_RATES);
  });

  it("never borrows KfW, handover delay or parking from another flat (D42)", () => {
    const state = defaultState();
    const strip = ({ kfwAmount: _k, kfwRate: _r, moveInMonths: _m, parkingPrice: _p, ...rest }: (typeof state.apartmentCases)[number]) => rest;
    const own = { ...strip(state.apartmentCases[0]), id: "flat-own", label: "Eigene" };
    const stored = {
      ...state,
      // A flat of their own at index 4, where BUWOG sits in the defaults, and BUWOG
      // stored before these fields existed.
      apartmentCases: [...state.apartmentCases.slice(0, 3).map(strip), strip(state.apartmentCases[3]), own, strip(state.apartmentCases[4])],
    };
    window.localStorage.setItem("mdh:save:pre-d42", JSON.stringify(stored));

    const loaded = loadNamed("pre-d42")!;
    const byId = (id: string) => loaded.apartmentCases.find((a) => a.id === id)!;
    expect(byId("flat-own")).toMatchObject({ kfwAmount: 0, kfwRate: 0, moveInMonths: 0, parkingPrice: 0 });
    const shipped = SHORTLIST_APARTMENT_CASES.find((a) => a.id === "buwog-arbor-h2-we08")!;
    expect(byId("buwog-arbor-h2-we08")).toMatchObject({
      kfwAmount: shipped.kfwAmount,
      kfwRate: shipped.kfwRate,
      moveInMonths: shipped.moveInMonths,
      parkingPrice: shipped.parkingPrice,
    });
  });

  it("refreshes untouched Shortlist flats to the bank offers, never edited ones (D45)", () => {
    const state = defaultState();
    const old = (id: string, patch: Record<string, unknown>) => {
      const { rates: _rates, ratesNote: _note, offerLoans: _loans, ...rest } = state.apartmentCases.find((a) => a.id === id)!;
      return { ...rest, ...patch };
    };
    const stored = {
      ...state,
      shortlistRevision: undefined,
      rates: DEFAULT_RATES,
      ratesNote: DEFAULT_RATES_NOTE,
      apartmentCases: [
        // As shipped on 23.11.2026: untouched, so it takes the offers.
        old("lindenstrasse-31g-we49", { purchasePrice: 520000, monthlyPayment: 2500 }),
        // Edited by the couple: left exactly as it is.
        old("buwog-arbor-h2-we08", { purchasePrice: 640000, monthlyPayment: 2976, kfwRate: 1.3 }),
      ],
    };
    window.localStorage.setItem("mdh:save:pre-d45", JSON.stringify(stored));

    const loaded = loadNamed("pre-d45")!;
    const linden = loaded.apartmentCases.find((a) => a.id === "lindenstrasse-31g-we49")!;
    const buwog = loaded.apartmentCases.find((a) => a.id === "buwog-arbor-h2-we08")!;
    expect(linden.purchasePrice).toBe(500000);
    expect(linden.note).toBe(SHORTLIST_APARTMENT_CASES[0].note);
    expect(linden.offerLoans).toEqual({ ek10: 445000, ek15: 420850 });
    expect(linden.rates[10].ek10).toBe(4.11);
    expect(buwog.purchasePrice).toBe(640000);
    expect(buwog.kfwRate).toBe(1.3);
    // Stored before rates belonged to the apartment: it keeps the grid it was using.
    expect(buwog.rates).toEqual(DEFAULT_RATES);
    expect(loaded.shortlistRevision).toBeGreaterThan(0);

    // Shipped numbers but a different Hausgeld, or a note of their own (Codex, PR #13).
    const hausgeld = {
      ...stored,
      apartmentCases: [old("lindenstrasse-31g-we49", { purchasePrice: 520000, monthlyPayment: 2500, hausgeld: 900 })],
    };
    window.localStorage.setItem("mdh:save:hausgeld", JSON.stringify(hausgeld));
    const ownHausgeld = loadNamed("hausgeld")!.apartmentCases.find((a) => a.id === "lindenstrasse-31g-we49")!;
    expect(ownHausgeld.hausgeld).toBe(900);
    expect(ownHausgeld.purchasePrice).toBe(520000);

    const noted = {
      ...stored,
      apartmentCases: [old("lindenstrasse-31g-we49", { purchasePrice: 520000, monthlyPayment: 2500, note: "Makler sagt 490k möglich" })],
    };
    window.localStorage.setItem("mdh:save:noted", JSON.stringify(noted));
    const ownNote = loadNamed("noted")!.apartmentCases.find((a) => a.id === "lindenstrasse-31g-we49")!;
    expect(ownNote.purchasePrice).toBe(500000);
    expect(ownNote.note).toBe("Makler sagt 490k möglich");

    // Renamed but otherwise as shipped: an edit, so it is not replaced either.
    const renamed = {
      ...stored,
      apartmentCases: [old("lindenstrasse-31g-we49", { purchasePrice: 520000, monthlyPayment: 2500, label: "Unsere Linde" })],
    };
    window.localStorage.setItem("mdh:save:renamed", JSON.stringify(renamed));
    const kept = loadNamed("renamed")!.apartmentCases.find((a) => a.id === "lindenstrasse-31g-we49")!;
    expect(kept.label).toBe("Unsere Linde");
    expect(kept.purchasePrice).toBe(520000);

    // Refreshed once only: saved and loaded again, an edit to the refreshed flat stays.
    saveNamed("again", {
      ...loaded,
      apartmentCases: loaded.apartmentCases.map((a) => (a.id === linden.id ? { ...a, monthlyPayment: 2500 } : a)),
    });
    expect(loadNamed("again")!.apartmentCases.find((a) => a.id === linden.id)!.monthlyPayment).toBe(2500);
  });

  it("recognises the note shipped on 23.11.2026 by its hash (D45)", () => {
    const shipped = "Lindenstraße 31G, Haus 3 / WE49, 93,6 m², 4. OG rechts, Bj. 1998, Energie D. Kaufpreis = 495.000 € + 25.000 € TG. Mit Makler (3,57 %). Renovierung = Einbauküche 12k (Küchenöffnung 7–8k nicht enthalten). Hausgeld 630 € laut Exposé, evtl. später niedriger. Quelle: Shortlist-Sheet, Stand 23.11.2026.";
    expect(textHash(shipped)).toBe(1755963962);
    expect(textHash(shipped + " ")).not.toBe(1755963962);
  });
});
