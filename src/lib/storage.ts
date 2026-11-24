import { normaliseFixedPeriod, type ApartmentCase, type InterestRates, type MortgageInputs, type ScenarioId } from "./calculations";
import {
  DEFAULT_APARTMENT_CASES,
  DEFAULT_INPUTS,
  DEFAULT_RATES,
  DEFAULT_RATES_NOTE,
  EK_SCENARIOS,
  OFFER_RATES,
  OFFER_RATES_NOTE,
  SHORTLIST_APARTMENT_CASES,
  SHORTLIST_REVISION,
  SUPERSEDED_SHORTLIST,
} from "./defaults";

/**
 * Everything the user can change, in one serialisable shape.
 * `version` exists so a shape change can be detected and migrated rather than
 * silently loaded as garbage.
 */
export type PersistedState = {
  version: 2;
  inputs: MortgageInputs;
  rates: InterestRates;
  /** Stand und Quelle der Sollzinsen, free text (D36). */
  ratesNote: string;
  apartmentCases: ApartmentCase[];
  activeApartmentId: string;
  selectedId: ScenarioId;
  /**
   * Which shipped data the Shortlist flats were last refreshed to (D45). A state below
   * `SHORTLIST_REVISION` gets untouched Shortlist flats replaced by the current ones.
   */
  shortlistRevision: number;
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
type NumericInputKey = Exclude<keyof MortgageInputs, "annualSpecialRepayments" | "offerLoans">;

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
type ApartmentFallbacks = {
  ownerExtra: number;
  closingCostRate: number;
  monthlyPayment: number;
  rates: InterestRates;
  ratesNote: string;
};

function reviveOfferLoans(stored: unknown): Partial<Record<ScenarioId, number>> | undefined {
  if (!stored || typeof stored !== "object") return undefined;
  const raw = stored as Record<string, unknown>;
  const loans: Partial<Record<ScenarioId, number>> = {};
  for (const scenario of EK_SCENARIOS) {
    const value = Number(raw[scenario.id]);
    if (Number.isFinite(value) && value > 0) loans[scenario.id] = value;
  }
  return Object.keys(loans).length > 0 ? loans : undefined;
}

function reviveApartment(stored: unknown, index: number, fallbacks: ApartmentFallbacks): ApartmentCase {
  const raw = (stored ?? {}) as Record<string, unknown>;
  const fallback =
    DEFAULT_APARTMENT_CASES[Math.min(index, DEFAULT_APARTMENT_CASES.length - 1)];
  // Fields added in D42 fall back to the shipped flat with the same id, else to "none":
  // borrowing a KfW loan or a Neubau delay from whichever flat sits at the same index
  // would invent facts about a flat the couple entered themselves.
  const sameId = DEFAULT_APARTMENT_CASES.find((apartment) => apartment.id === raw.id);

  return {
    id: typeof raw.id === "string" && raw.id.length > 0 ? raw.id : `flat-${index + 1}`,
    label: typeof raw.label === "string" && raw.label.length > 0 ? raw.label : fallback.label,
    purchasePrice: reviveNumber(raw.purchasePrice, fallback.purchasePrice),
    renovation: reviveNumber(raw.renovation, fallback.renovation),
    hausgeld: reviveHausgeld(raw, fallback.hausgeld, fallbacks.ownerExtra),
    // Saves before D40 had one global KNK rate and Monatsrate, before D45 one global
    // rate grid; they were what every apartment used, so they stay what each one uses.
    closingCostRate: Math.max(0, reviveNumber(raw.closingCostRate, fallbacks.closingCostRate)),
    monthlyPayment: Math.max(1, reviveNumber(raw.monthlyPayment, fallbacks.monthlyPayment)),
    rates: reviveRates(raw.rates, fallbacks.rates),
    ratesNote: typeof raw.ratesNote === "string" ? raw.ratesNote : fallbacks.ratesNote,
    kfwAmount: Math.max(0, reviveNumber(raw.kfwAmount, sameId?.kfwAmount ?? 0)),
    kfwRate: Math.max(0, reviveNumber(raw.kfwRate, sameId?.kfwRate ?? 0)),
    kfwTermYears: Math.max(2, reviveNumber(raw.kfwTermYears, sameId?.kfwTermYears ?? 20)),
    moveInMonths: Math.max(0, Math.round(reviveNumber(raw.moveInMonths, sameId?.moveInMonths ?? 0))),
    parkingPrice: Math.max(0, reviveNumber(raw.parkingPrice, sameId?.parkingPrice ?? 0)),
    annualSpecialRepayments: reviveAmounts(raw.annualSpecialRepayments),
    ...(reviveOfferLoans(raw.offerLoans) ? { offerLoans: reviveOfferLoans(raw.offerLoans) } : {}),
    ...(typeof raw.note === "string" && raw.note.length > 0 ? { note: raw.note } : {}),
  };
}

function reviveRates(stored: unknown, fallback: InterestRates): InterestRates {
  const raw = (stored ?? {}) as Partial<Record<10 | 15, unknown>>;
  return {
    10: reviveRateRow(raw[10], fallback[10]),
    15: reviveRateRow(raw[15], fallback[15]),
  };
}

function cloneApartment(apartment: ApartmentCase): ApartmentCase {
  return {
    ...apartment,
    rates: { 10: { ...apartment.rates[10] }, 15: { ...apartment.rates[15] } },
    annualSpecialRepayments: [...apartment.annualSpecialRepayments],
    ...(apartment.offerLoans ? { offerLoans: { ...apartment.offerLoans } } : {}),
  };
}

/**
 * Shipped Shortlist data the couple never touched is replaced when newer data ships
 * (D45: the bank offers of 24.11.2026). "Untouched" means price and Monatsrate still
 * equal one of the values shipped before; a flat they edited is left exactly as it is.
 */
function refreshShortlist(cases: ApartmentCase[], revision: number): ApartmentCase[] {
  if (revision >= SHORTLIST_REVISION) return cases;
  return cases.map((apartment) => {
    const superseded = SUPERSEDED_SHORTLIST[apartment.id];
    const current = SHORTLIST_APARTMENT_CASES.find((entry) => entry.id === apartment.id);
    if (!superseded || !current) return apartment;
    const untouched =
      apartment.purchasePrice === superseded.purchasePrice &&
      superseded.monthlyPayments.includes(apartment.monthlyPayment);
    return untouched ? { ...cloneApartment(current), annualSpecialRepayments: [...apartment.annualSpecialRepayments] } : apartment;
  });
}

/**
 * Saves before D35 stored a total "monthlyOwnershipCosts" per apartment. It becomes the
 * Hausgeld minus the extra that is now added on top, so the total the couple saw, and
 * every figure built on it, stays exactly what it was.
 */
function reviveHausgeld(raw: Record<string, unknown>, fallback: number, ownerExtra: number): number {
  if (raw.hausgeld !== undefined) return Math.max(0, reviveNumber(raw.hausgeld, fallback));
  if (raw.monthlyOwnershipCosts !== undefined) {
    return Math.max(0, reviveNumber(raw.monthlyOwnershipCosts, fallback + ownerExtra) - ownerExtra);
  }
  return fallback;
}

function ratesEqual(a: InterestRates, b: InterestRates): boolean {
  return ([10, 15] as const).every((period) =>
    EK_SCENARIOS.every((scenario) => a[period][scenario.id] === b[period][scenario.id]),
  );
}

/**
 * Saves from before D36 carry no note. If their rates are still the shipped defaults,
 * the default provenance is true for them; otherwise nobody knows where they came
 * from, and the screen says so rather than inventing a source.
 */
function reviveRatesNote(stored: unknown, rates: InterestRates): string {
  if (typeof stored === "string") return stored;
  if (ratesEqual(rates, DEFAULT_RATES)) return DEFAULT_RATES_NOTE;
  return ratesEqual(rates, OFFER_RATES) ? OFFER_RATES_NOTE : "";
}

/**
 * The working state still holding the August offer, untouched, moves to the current
 * rate assumption (D41). Only the screen's own state (autosave, the Sheet's current
 * state): a named save holding the offer may hold it on purpose, so it is left alone.
 * A note the couple wrote themselves means they chose these rates, so it is kept too.
 */
export function upgradeShippedRates(state: PersistedState): PersistedState {
  const untouched = (rates: InterestRates, note: string) =>
    ratesEqual(rates, OFFER_RATES) && (note === OFFER_RATES_NOTE || note === "");
  const fresh = () => ({ 10: { ...DEFAULT_RATES[10] }, 15: { ...DEFAULT_RATES[15] } });
  const anything =
    untouched(state.rates, state.ratesNote) ||
    state.apartmentCases.some((apartment) => untouched(apartment.rates, apartment.ratesNote));
  if (!anything) return state;
  return {
    ...state,
    ...(untouched(state.rates, state.ratesNote) ? { rates: fresh(), ratesNote: DEFAULT_RATES_NOTE } : {}),
    apartmentCases: state.apartmentCases.map((apartment) =>
      untouched(apartment.rates, apartment.ratesNote)
        ? { ...apartment, rates: fresh(), ratesNote: DEFAULT_RATES_NOTE }
        : apartment,
    ),
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
 * The Shortlist flats (D40) are appended to any state that lacks them, so they appear
 * in an existing autosave, a named save or the Sheet without retyping. Matched by id:
 * once present, a flat the couple has edited is never overwritten or added again.
 */
function withShortlistApartments(cases: ApartmentCase[]): ApartmentCase[] {
  const missing = SHORTLIST_APARTMENT_CASES.filter(
    (shortlisted) => !cases.some((apartment) => apartment.id === shortlisted.id),
  );
  return [
    ...cases,
    ...missing.map(cloneApartment),
  ];
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

    const inputs = reviveInputs(parsed.inputs);
    const rates = reviveRates(parsed.rates, DEFAULT_RATES);
    const ratesNote = reviveRatesNote(parsed.ratesNote, rates);
    const fallbacks: ApartmentFallbacks = {
      ownerExtra: inputs.ownerExtraMonthly,
      closingCostRate: inputs.closingCostRate,
      monthlyPayment: inputs.monthlyPayment,
      rates,
      ratesNote,
    };
    const revision = typeof parsed.shortlistRevision === "number" ? parsed.shortlistRevision : 0;
    const apartmentCases: ApartmentCase[] = withShortlistApartments(
      refreshShortlist(
        storedCases.map((stored, index) => reviveApartment(stored, index, fallbacks)),
        revision,
      ),
    );
    const activeApartmentId = apartmentCases.some((a) => a.id === parsed.activeApartmentId)
      ? (parsed.activeApartmentId as string)
      : apartmentCases[0].id;

    return {
      version: CURRENT_VERSION,
      inputs,
      rates,
      ratesNote,
      apartmentCases,
      activeApartmentId,
      selectedId: reviveScenarioId(parsed.selectedId),
      shortlistRevision: SHORTLIST_REVISION,
    };
  } catch {
    return null;
  }
}

export function loadAutosave(): PersistedState | null {
  const raw = safeGet(AUTOSAVE_KEY);
  const state = raw ? reviveState(raw) : null;
  return state ? upgradeShippedRates(state) : null;
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
    ratesNote: DEFAULT_RATES_NOTE,
    apartmentCases: DEFAULT_APARTMENT_CASES.map(cloneApartment),
    activeApartmentId: DEFAULT_APARTMENT_CASES[0].id,
    selectedId: "ek10",
    shortlistRevision: SHORTLIST_REVISION,
  };
}

/**
 * Everything the app knows, in one file: the screen as it stands plus every named
 * save. Used for the JSON export and, unchanged, as the payload of the Sheet sync,
 * so both carry the same shape and pass through the same `reviveState`.
 */
export type Bundle = {
  app: "mortgage-decision-helper";
  bundleVersion: 1;
  /** ISO timestamp of when the bundle was built. The sync compares these. */
  savedAt: string;
  current: PersistedState;
  saves: Record<string, PersistedState>;
};

export function buildBundle(current: PersistedState, now: Date = new Date()): Bundle {
  const saves: Record<string, PersistedState> = {};
  for (const name of listSaves()) {
    const loaded = loadNamed(name);
    if (loaded) saves[name] = loaded;
  }
  return { app: "mortgage-decision-helper", bundleVersion: 1, savedAt: now.toISOString(), current, saves };
}

/**
 * Reads a bundle from text. Every state inside is revived like a localStorage entry,
 * so an edited or older file can only ever produce defaults, never NaN. A broken named
 * save is skipped rather than failing the whole import; a broken `current` fails it.
 */
export function parseBundle(text: string): Omit<Bundle, "current"> & { current: PersistedState } | null {
  try {
    const parsed = JSON.parse(text) as Record<string, unknown> | null;
    if (!parsed || parsed.app !== "mortgage-decision-helper" || parsed.bundleVersion !== 1) return null;
    const revivedCurrent = reviveState(JSON.stringify(parsed.current ?? null));
    if (!revivedCurrent) return null;
    const current = upgradeShippedRates(revivedCurrent);

    const saves: Record<string, PersistedState> = {};
    const storedSaves = (parsed.saves ?? {}) as Record<string, unknown>;
    if (typeof storedSaves === "object") {
      for (const [name, state] of Object.entries(storedSaves)) {
        const revived = reviveState(JSON.stringify(state));
        if (revived && name.trim()) saves[name.trim()] = revived;
      }
    }
    const savedAt = typeof parsed.savedAt === "string" ? parsed.savedAt : "";
    return { app: "mortgage-decision-helper", bundleVersion: 1, savedAt, current, saves };
  } catch {
    return null;
  }
}

/** Writes a bundle's named saves; a save with the same name is replaced. Returns how many. */
export function writeBundleSaves(saves: Record<string, PersistedState>): number {
  let written = 0;
  for (const [name, state] of Object.entries(saves)) {
    if (saveNamed(name, state)) written += 1;
  }
  return written;
}
