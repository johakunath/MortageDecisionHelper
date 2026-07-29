import type { ApartmentCase, InterestRates, MortgageInputs, ScenarioId } from "./calculations";
import { DEFAULT_APARTMENT_CASES, DEFAULT_INPUTS, DEFAULT_RATES } from "./defaults";

/**
 * Everything the user can change, in one serialisable shape.
 * `version` exists so a future shape change can be detected and discarded rather
 * than silently loaded as garbage.
 */
export type PersistedState = {
  version: 1;
  inputs: MortgageInputs;
  rates: InterestRates;
  apartmentCases: ApartmentCase[];
  activeApartmentId: string;
  selectedId: ScenarioId;
};

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
function reviveState(raw: string): PersistedState | null {
  try {
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    if (!parsed || parsed.version !== 1) return null;
    if (!Array.isArray(parsed.apartmentCases) || parsed.apartmentCases.length === 0) return null;

    const apartmentCases = parsed.apartmentCases.map((apartment) => ({
      ...apartment,
      annualSpecialRepayments: Array.isArray(apartment.annualSpecialRepayments)
        ? apartment.annualSpecialRepayments.map((amount) => (Number.isFinite(amount) ? amount : 0))
        : [],
    }));
    const activeApartmentId = apartmentCases.some((a) => a.id === parsed.activeApartmentId)
      ? (parsed.activeApartmentId as string)
      : apartmentCases[0].id;

    return {
      version: 1,
      inputs: { ...DEFAULT_INPUTS, ...parsed.inputs },
      rates: { ...DEFAULT_RATES, ...parsed.rates },
      apartmentCases,
      activeApartmentId,
      selectedId: (parsed.selectedId as ScenarioId) ?? "ek10",
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

export function loadNamed(name: string): PersistedState | null {
  const raw = safeGet(SAVE_PREFIX + name);
  return raw ? reviveState(raw) : null;
}

export function deleteNamed(name: string): void {
  safeRemove(SAVE_PREFIX + name);
}

export function defaultState(): PersistedState {
  return {
    version: 1,
    inputs: { ...DEFAULT_INPUTS },
    rates: { ...DEFAULT_RATES },
    apartmentCases: DEFAULT_APARTMENT_CASES.map((apartment) => ({
      ...apartment,
      annualSpecialRepayments: [...apartment.annualSpecialRepayments],
    })),
    activeApartmentId: DEFAULT_APARTMENT_CASES[0].id,
    selectedId: "ek10",
  };
}
