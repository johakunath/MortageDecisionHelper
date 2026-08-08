import { beforeEach, describe, expect, it } from "vitest";
import { defaultState, loadNamed, saveExists, saveNamed, storageAvailable } from "./storage";
import { DEFAULT_RATES, EK_SCENARIOS } from "./defaults";

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
    expect(knownIds).toContain(loaded.apartmentCases[0].selectedScenarioId);

    // 20 years is no longer an offered binding.
    expect([10, 15]).toContain(loaded.inputs.fixedRateYears);

    // The Tilgungssatz became a monthly rate; the flat rates were dropped for the
    // offer's matrix, because a v1 rate carries no record of which binding it was for.
    expect(loaded.inputs).not.toHaveProperty("repaymentRate");
    expect(loaded.inputs.monthlyPayment).toBeGreaterThan(0);
    expect(loaded.rates[10].ek10).toBe(DEFAULT_RATES[10].ek10);
    expect(loaded.rates[15].ek20).toBe(DEFAULT_RATES[15].ek20);
  });

  it("rejects a save from an unknown future version", () => {
    window.localStorage.setItem("mdh:save:future", JSON.stringify({ version: 99, apartmentCases: [] }));
    expect(loadNamed("future")).toBeNull();
  });
});
