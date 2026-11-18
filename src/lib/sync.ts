import { parseBundle, type Bundle } from "./storage";

/**
 * Optional sync with a Google Sheet through an Apps Script web app (D38).
 *
 * The app works without it exactly as before: localStorage stays the working copy and
 * nothing is sent anywhere until the couple presses a button. The URL and token live
 * in this browser only, never in a bundle or the repository, so an exported file
 * cannot leak them.
 */
export type SyncConfig = {
  url: string;
  token: string;
  /** `savedAt` of the bundle last loaded from or written to the Sheet. */
  lastSyncedAt: string;
};

const SYNC_KEY = "mdh:sync";

export function loadSyncConfig(): SyncConfig | null {
  try {
    const raw = window.localStorage.getItem(SYNC_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SyncConfig>;
    if (typeof parsed.url !== "string" || typeof parsed.token !== "string") return null;
    return {
      url: parsed.url,
      token: parsed.token,
      lastSyncedAt: typeof parsed.lastSyncedAt === "string" ? parsed.lastSyncedAt : "",
    };
  } catch {
    return null;
  }
}

export function saveSyncConfig(config: SyncConfig | null): void {
  try {
    if (config) window.localStorage.setItem(SYNC_KEY, JSON.stringify(config));
    else window.localStorage.removeItem(SYNC_KEY);
  } catch {
    // Storage unavailable: the sync then works for this session only.
  }
}

/**
 * Only an Apps Script deployment is accepted. Anything else would send the couple's
 * finances to a host they did not mean to type.
 */
export function isValidSyncUrl(url: string): boolean {
  return /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(url.trim());
}

export type PullResult =
  | { kind: "ok"; bundle: Bundle | null }
  | { kind: "error"; message: string };

export type PushResult =
  | { kind: "ok"; savedAt: string }
  | { kind: "conflict"; savedAt: string }
  | { kind: "error"; message: string };

type Fetch = typeof fetch;

const ERROR_TEXT: Record<string, string> = {
  unauthorized: "Der Token passt nicht zu diesem Sheet.",
  "bad-request": "Das Sheet hat die Anfrage nicht verstanden. Ist das Skript aktuell?",
};

async function call(config: SyncConfig, body: Record<string, unknown>, fetchImpl: Fetch) {
  // text/plain keeps this a "simple" request: Apps Script answers no CORS preflight.
  const response = await fetchImpl(config.url.trim(), {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ ...body, token: config.token.trim() }),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return (await response.json()) as Record<string, unknown>;
}

function describeFailure(error: unknown): string {
  return `Das Sheet ist nicht erreichbar (${error instanceof Error ? error.message : "unbekannter Fehler"}).`;
}

export async function pullFromSheet(config: SyncConfig, fetchImpl: Fetch = fetch): Promise<PullResult> {
  try {
    const reply = await call(config, { action: "load" }, fetchImpl);
    if (reply.ok !== true) return { kind: "error", message: ERROR_TEXT[String(reply.error)] ?? "Unbekannte Antwort." };
    if (reply.bundle === null || reply.bundle === undefined) return { kind: "ok", bundle: null };
    const bundle = parseBundle(JSON.stringify(reply.bundle));
    return bundle ? { kind: "ok", bundle } : { kind: "error", message: "Der Stand im Sheet ist beschädigt." };
  } catch (error) {
    return { kind: "error", message: describeFailure(error) };
  }
}

/**
 * Writes the bundle. The Sheet refuses if someone saved there since this device last
 * synced (`baseSavedAt`), so one phone cannot silently erase the other's evening of
 * input. `force` overrides that after the couple has been asked.
 */
export async function pushToSheet(
  config: SyncConfig,
  bundle: Bundle,
  force = false,
  fetchImpl: Fetch = fetch,
): Promise<PushResult> {
  try {
    const reply = await call(
      config,
      { action: "save", bundle, baseSavedAt: config.lastSyncedAt, force },
      fetchImpl,
    );
    if (reply.ok === true) return { kind: "ok", savedAt: String(reply.savedAt ?? bundle.savedAt) };
    if (reply.error === "conflict") return { kind: "conflict", savedAt: String(reply.savedAt ?? "") };
    return { kind: "error", message: ERROR_TEXT[String(reply.error)] ?? "Unbekannte Antwort." };
  } catch (error) {
    return { kind: "error", message: describeFailure(error) };
  }
}
