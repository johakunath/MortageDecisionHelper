import { normaliseFixedPeriod, type ApartmentCase, type InterestRates, type MortgageInputs, type ScenarioId } from "./calculations";
import { DEFAULT_APARTMENT_CASES, DEFAULT_INPUTS, DEFAULT_RATES, EK_SCENARIOS } from "./defaults";

/**
 * Everything the user can change, in one serialisable shape.
 * `version` exists so a shape change can be detected and migrated rather than
 * silently loaded as garbage.
 */
export type PersistedState = {
  version: 2;
  inputs: MortgageInputs;
  rates: InterestRates;
  apartmentCases: ApartmentCase[];
  activeApartmentId: string;
  selectedId: ScenarioId;
};

const CURRENT_VERSION = 2;

const AUTOSAVE_KEY = "mdh:autosave";
const SAVE_PREFIX = "mdh:save:";

/**
 * localStorage is unavailable in some contexts the standalone build legitimately
 * runs in — notably `file://` in browsers that treat it as an opaque origin, and
 * private-browsing modes that throw on write. Every call is guarded so the app
 * degrades to "works but doesn't remember" instead of failing to render.
 */
function safeGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): boolean {
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function safeRemove(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Nothing to do — storage is unavailable, so there is nothing to remove.
  }
}

export function storageAvailable(): boolean {
  try {
    const probe = "mdh:probe";
    window.localStorage.setItem(probe, "1");
    window.localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

/**
 * Merges over the current defaults rather than trusting the stored object.
 * A save written before a new input field existed would otherwise load that field
 * as `undefined` and produce NaN throughout the model.
 */
/** A stored id is only usable if the scenario set still contains it. */
function reviveScenarioId(value: unknown): ScenarioId {
  const known = EK_SCENARIOS.find((scenario) => scenario.id === value);
  return known ? known.id : EK_SCENARIOS[0].id;
}

/**
 * v1 → v2. The EK levels moved from 5/10/15 to 10/15/20, the rates became a matrix
 * over the two Sollzinsbindungen, and the contract input changed from Tilgungssatz to
 * Monatsrate.
 *
 * The stored rates are dropped rather than mapped: a flat v1 rate carries no record
 * of which binding it belonged to, so any placement would be a guess dressed up as
 * data. The new defaults come from an actual offer, which beats a guess.
 */
function migrateV1(parsed: Record<string, unknown>): Record<string, unknown> {
  const inputs = { ...(parsed.inputs as Record<string, unknown> | undefined) };
  const price = Number(inputs.purchasePrice) || DEFAULT_INPUTS.purchasePrice;
  const repaymentRate = Number(inputs.repaymentRate);

  if (Number.isFinite(repaymentRate) && repaymentRate > 0) {
    // Same contract, expressed the way the model now stores it: what that Tilgungssatz
    // would have cost per month on the 90% loan the old default assumed.
    const referenceLoan = price * 0.9;
    inputs.monthlyPayment =
      Math.round((referenceLoan * ((DEFAULT_RATES[10].ek10 + repaymentRate) / 100)) / 12 / 10) * 10;
  }
  delete inputs.repaymentRate;
  inputs.fixedRateYears = normaliseFixedPeriod(Number(inputs.fixedRateYears) || DEFAULT_INPUTS.fixedRateYears);

  return { ...parsed, version: CURRENT_VERSION, inputs, rates: undefined };
}

/**
 * Merges over the current defaults rather than trusting the stored object.
 * A save written before a new input field existed would otherwise load that field
 * as `undefined` and produce NaN throughout the model.
 */
function reviveState(raw: string): PersistedState | null {
  try {
    let parsed = JSON.parse(raw) as Record<string, unknown> | null;
    if (!parsed) return null;
    if (parsed.version === 1) parsed = migrateV1(parsed);
    if (parsed.version !== CURRENT_VERSION) return null;

    const storedCases = parsed.apartmentCases;
    if (!Array.isArray(storedCases) || storedCases.length === 0) return null;

    const apartmentCases: ApartmentCase[] = storedCases.map((apartment: ApartmentCase) => ({
      ...apartment,
      selectedScenarioId: reviveScenarioId(apartment.selectedScenarioId),
      annualSpecialRepayments: Array.isArray(apartment.annualSpecialRepayments)
        ? apartment.annualSpecialRepayments.map((amount) => (Number.isFinite(amount) ? amount : 0))
        : [],
    }));
    const activeApartmentId = apartmentCases.some((a) => a.id === parsed.activeApartmentId)
      ? (parsed.activeApartmentId as string)
      : apartmentCases[0].id;
    const storedRates = parsed.rates as InterestRates | undefined;

    return {
      version: CURRENT_VERSION,
      inputs: { ...DEFAULT_INPUTS, ...(parsed.inputs as Partial<MortgageInputs>) },
      rates: {
        10: { ...DEFAULT_RATES[10], ...storedRates?.[10] },
        15: { ...DEFAULT_RATES[15], ...storedRates?.[15] },
      },
      apartmentCases,
      activeApartmentId,
      selectedId: reviveScenarioId(parsed.selectedId),
    };
  } catch {
    return null;
  }
}

export function loadAutosave(): PersistedState | null {
  const raw = safeGet(AUTOSAVE_KEY);
  return raw ? reviveState(raw) : null;
}

export function writeAutosave(state: PersistedState): void {
  safeSet(AUTOSAVE_KEY, JSON.stringify(state));
}

export function listSaves(): string[] {
  try {
    const names: string[] = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith(SAVE_PREFIX)) {
        names.push(key.slice(SAVE_PREFIX.length));
      }
    }
    return names.sort((a, b) => a.localeCompare(b, "de"));
  } catch {
    return [];
  }
}

export function saveNamed(name: string, state: PersistedState): boolean {
  const trimmed = name.trim();
  if (!trimmed) return false;
  return safeSet(SAVE_PREFIX + trimmed, JSON.stringify(state));
}

/** Whether saving under this name would overwrite something. */
export function saveExists(name: string): boolean {
  const trimmed = name.trim();
  return trimmed.length > 0 && safeGet(SAVE_PREFIX + trimmed) !== null;
}

export function loadNamed(name: string): PersistedState | null {
  const raw = safeGet(SAVE_PREFIX + name);
  return raw ? reviveState(raw) : null;
}

export function deleteNamed(name: string): void {
  safeRemove(SAVE_PREFIX + name);
}

export function defaultState(): PersistedState {
  return {
    version: CURRENT_VERSION,
    inputs: { ...DEFAULT_INPUTS },
    rates: { 10: { ...DEFAULT_RATES[10] }, 15: { ...DEFAULT_RATES[15] } },
    apartmentCases: DEFAULT_APARTMENT_CASES.map((apartment) => ({
      ...apartment,
      annualSpecialRepayments: [...apartment.annualSpecialRepayments],
    })),
    activeApartmentId: DEFAULT_APARTMENT_CASES[0].id,
    selectedId: "ek10",
  };
}
