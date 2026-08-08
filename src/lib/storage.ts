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

/** A stored id is only usable if the scenario set still contains it. */
function reviveScenarioId(value: unknown): ScenarioId {
  const known = EK_SCENARIOS.find((scenario) => scenario.id === value);
  return known ? known.id : EK_SCENARIOS[0].id;
}

/**
 * Every number that comes back out of localStorage passes through here.
 *
 * Spreading the stored object over the defaults only guards fields that are *missing*.
 * A key that is present but holds `null`, a string or `NaN` — a hand-edited save, a
 * half-written autosave, a shape from a future build — survives the spread and turns
 * every downstream figure into NaN, which the UI then renders as "—" across the board
 * with no indication why.
 */
function reviveNumber(value: unknown, fallback: number): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : fallback;
  }

  // Deliberately NOT `Number(value)`: it maps null, "", [] and false to 0, so the
  // junk this function exists to catch would arrive as a plausible-looking zero —
  // a stored `purchasePrice: null` becoming a 0 € flat rather than the default.
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
}

function reviveAmounts(value: unknown, fallback: number[] = []): number[] {
  if (!Array.isArray(value)) {
    return [...fallback];
  }
  return value.map((amount) => Math.max(0, reviveNumber(amount, 0)));
}

/** Every `MortgageInputs` field is a number except the Sondertilgung path. */
type NumericInputKey = Exclude<keyof MortgageInputs, "annualSpecialRepayments">;

function reviveInputs(stored: unknown): MortgageInputs {
  const raw = (stored ?? {}) as Record<string, unknown>;
  const revived: MortgageInputs = {
    ...DEFAULT_INPUTS,
    annualSpecialRepayments: reviveAmounts(
      raw.annualSpecialRepayments,
      DEFAULT_INPUTS.annualSpecialRepayments,
    ),
  };

  for (const key of Object.keys(DEFAULT_INPUTS) as (keyof MortgageInputs)[]) {
    if (key === "annualSpecialRepayments") continue;
    const numericKey = key as NumericInputKey;
    revived[numericKey] = reviveNumber(raw[numericKey], DEFAULT_INPUTS[numericKey]);
  }

  return revived;
}

function reviveRateRow(
  stored: unknown,
  fallback: Record<ScenarioId, number>,
): Record<ScenarioId, number> {
  const raw = (stored ?? {}) as Record<string, unknown>;
  return {
    ek10: reviveNumber(raw.ek10, fallback.ek10),
    ek15: reviveNumber(raw.ek15, fallback.ek15),
    ek20: reviveNumber(raw.ek20, fallback.ek20),
  };
}

/**
 * Built field by field rather than spread, so a stored apartment can only contribute
 * the four values it is allowed to own — and keys from older shapes (`selectedScenarioId`)
 * do not ride along into the live state.
 */
function reviveApartment(stored: unknown, index: number): ApartmentCase {
  const raw = (stored ?? {}) as Record<string, unknown>;
  const fallback =
    DEFAULT_APARTMENT_CASES[Math.min(index, DEFAULT_APARTMENT_CASES.length - 1)];

  return {
    id: typeof raw.id === "string" && raw.id.length > 0 ? raw.id : `flat-${index + 1}`,
    label: typeof raw.label === "string" && raw.label.length > 0 ? raw.label : fallback.label,
    purchasePrice: reviveNumber(raw.purchasePrice, fallback.purchasePrice),
    renovation: reviveNumber(raw.renovation, fallback.renovation),
    monthlyOwnershipCosts: reviveNumber(
      raw.monthlyOwnershipCosts,
      fallback.monthlyOwnershipCosts,
    ),
    annualSpecialRepayments: reviveAmounts(raw.annualSpecialRepayments),
  };
}

/** The EK level a v1 save was sitting on, read off its legacy id ("ek5" → 5). */
function legacyEkRate(selectedId: unknown): number {
  const parsed = Number(String(selectedId ?? "").replace("ek", ""));
  return Number.isFinite(parsed) && parsed > 0 && parsed < 100 ? parsed : 10;
}

/** The price every v1 figure was really based on: the apartment that was active. */
function legacyActivePrice(parsed: Record<string, unknown>, fallback: number): number {
  const cases = Array.isArray(parsed.apartmentCases) ? parsed.apartmentCases : [];
  const active =
    cases.find((entry) => (entry as Record<string, unknown>)?.id === parsed.activeApartmentId) ??
    cases[0];
  const price = Number((active as Record<string, unknown> | undefined)?.purchasePrice);
  return Number.isFinite(price) && price > 0 ? price : fallback;
}

/**
 * v1 → v2. The EK levels moved from 5/10/15 to 10/15/20, the rates became a matrix
 * over the two Sollzinsbindungen, and the contract input changed from Tilgungssatz to
 * Monatsrate.
 *
 * The stored rates are dropped **as a rate matrix**: a flat v1 rate carries no record
 * of which Sollzinsbindung it belonged to, so placing it in a column would be a guess
 * dressed up as data. Reconstructing the monthly payment is a different question, and
 * there the legacy rate is the best evidence there is — it is the rate that produced
 * the annuity the couple was actually paying.
 *
 * So the replacement Monatsrate is rebuilt from the contract as it stood: the **active
 * apartment's** price, the EK level the save was on, and the rate stored for that level.
 * Deriving it from the stale global `inputs.purchasePrice`, a hardcoded 90% loan and
 * today's default rate silently moved the payment by 279 €/Monat on a 600k flat at the
 * old 5% EK level, and every affordability and interest figure moved with it. See
 * docs/ASSUMPTIONS.md K16.
 */
function migrateV1(parsed: Record<string, unknown>): Record<string, unknown> {
  const inputs = { ...(parsed.inputs as Record<string, unknown> | undefined) };
  const repaymentRate = Number(inputs.repaymentRate);

  if (Number.isFinite(repaymentRate) && repaymentRate > 0) {
    const globalPrice = Number(inputs.purchasePrice) || DEFAULT_INPUTS.purchasePrice;
    const price = legacyActivePrice(parsed, globalPrice);
    const ekRate = legacyEkRate(parsed.selectedId);
    const storedRates = (parsed.rates ?? {}) as Record<string, unknown>;
    const storedRate = Number(storedRates[String(parsed.selectedId)]);
    const interestRate =
      Number.isFinite(storedRate) && storedRate > 0 ? storedRate : DEFAULT_RATES[10].ek10;

    // Rounded to the nearest 10 € — this is a faithful reconstruction, not a figure
    // the save ever actually held.
    const loan = price * (1 - ekRate / 100);
    inputs.monthlyPayment =
      Math.round((loan * ((interestRate + repaymentRate) / 100)) / 12 / 10) * 10;
  }
  delete inputs.repaymentRate;
  inputs.fixedRateYears = normaliseFixedPeriod(Number(inputs.fixedRateYears) || DEFAULT_INPUTS.fixedRateYears);

  return { ...parsed, version: CURRENT_VERSION, inputs, rates: undefined };
}

/**
 * Rebuilds a usable state from stored text, or returns null.
 * Nothing is trusted: missing fields fall back to the defaults, and present-but-unusable
 * ones do too. See `reviveNumber`.
 */
function reviveState(raw: string): PersistedState | null {
  try {
    let parsed = JSON.parse(raw) as Record<string, unknown> | null;
    if (!parsed) return null;
    if (parsed.version === 1) parsed = migrateV1(parsed);
    if (parsed.version !== CURRENT_VERSION) return null;

    const storedCases = parsed.apartmentCases;
    if (!Array.isArray(storedCases) || storedCases.length === 0) return null;

    const apartmentCases: ApartmentCase[] = storedCases.map(reviveApartment);
    const activeApartmentId = apartmentCases.some((a) => a.id === parsed.activeApartmentId)
      ? (parsed.activeApartmentId as string)
      : apartmentCases[0].id;
    const storedRates = parsed.rates as InterestRates | undefined;

    return {
      version: CURRENT_VERSION,
      inputs: reviveInputs(parsed.inputs),
      rates: {
        10: reviveRateRow(storedRates?.[10], DEFAULT_RATES[10]),
        15: reviveRateRow(storedRates?.[15], DEFAULT_RATES[15]),
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
