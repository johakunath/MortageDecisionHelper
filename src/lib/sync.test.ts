import { describe, expect, it } from "vitest";
import { buildBundle, defaultState } from "./storage";
import { isValidSyncUrl, pullFromSheet, pushToSheet, stableStringify, type SyncConfig } from "./sync";

globalThis.window = { localStorage: { length: 0, key: () => null, getItem: () => null } } as unknown as Window &
  typeof globalThis;

/** Mirrors docs/google-sheet-sync/Code.gs: token check, load, save with conflict guard. */
function fakeSheet(token = "geheim") {
  let stored: Record<string, unknown> | null = null;
  const fetchImpl = (async (_url: string, init: RequestInit) => {
    const request = JSON.parse(String(init.body));
    const respond = (body: unknown) => ({ ok: true, json: async () => body }) as Response;
    if (request.token !== token) return respond({ ok: false, error: "unauthorized" });
    if (request.action === "load") return respond({ ok: true, bundle: stored });
    const storedAt = stored ? String(stored.savedAt) : "";
    if (storedAt && request.baseSavedAt !== storedAt && !request.force) {
      return respond({ ok: false, error: "conflict", savedAt: storedAt });
    }
    stored = request.bundle;
    return respond({ ok: true, savedAt: request.bundle.savedAt });
  }) as unknown as typeof fetch;
  return { fetchImpl };
}

const URL_OK = "https://script.google.com/macros/s/AKfycbx_abc-123/exec";

describe("sheet sync", () => {
  it("accepts only an Apps Script deployment URL", () => {
    expect(isValidSyncUrl(URL_OK)).toBe(true);
    expect(isValidSyncUrl("https://example.com/macros/s/x/exec")).toBe(false);
    expect(isValidSyncUrl("http://script.google.com/macros/s/x/exec")).toBe(false);
  });

  it("round-trips a bundle and starts empty", async () => {
    const { fetchImpl } = fakeSheet();
    const config: SyncConfig = { url: URL_OK, token: "geheim", lastSyncedAt: "" };
    expect(await pullFromSheet(config, fetchImpl)).toEqual({ kind: "ok", bundle: null });

    const state = { ...defaultState(), ratesNote: "Interhyp vom 18.11.26" };
    const pushed = await pushToSheet(config, buildBundle(state, new Date("2026-11-18T12:00:00Z")), false, fetchImpl);
    expect(pushed).toEqual({ kind: "ok", savedAt: "2026-11-18T12:00:00.000Z" });

    const pulled = await pullFromSheet(config, fetchImpl);
    expect(pulled.kind === "ok" && pulled.bundle?.current.ratesNote).toBe("Interhyp vom 18.11.26");
  });

  it("refuses to overwrite a newer save from the other device unless forced", async () => {
    const { fetchImpl } = fakeSheet();
    const phone: SyncConfig = { url: URL_OK, token: "geheim", lastSyncedAt: "" };
    await pushToSheet(phone, buildBundle(defaultState(), new Date("2026-11-18T20:00:00Z")), false, fetchImpl);

    // The PC last synced before the phone's save.
    const pc: SyncConfig = { url: URL_OK, token: "geheim", lastSyncedAt: "2026-11-17T10:00:00.000Z" };
    const bundle = buildBundle(defaultState(), new Date("2026-11-18T21:00:00Z"));
    expect(await pushToSheet(pc, bundle, false, fetchImpl)).toEqual({
      kind: "conflict",
      savedAt: "2026-11-18T20:00:00.000Z",
    });
    expect((await pushToSheet(pc, bundle, true, fetchImpl)).kind).toBe("ok");
  });

  it("names a wrong token and an unreachable sheet in plain words", async () => {
    const { fetchImpl } = fakeSheet();
    const wrong: SyncConfig = { url: URL_OK, token: "falsch", lastSyncedAt: "" };
    expect(await pullFromSheet(wrong, fetchImpl)).toEqual({
      kind: "error",
      message: "Der Token passt nicht zu diesem Sheet.",
    });

    const offline = (async () => {
      throw new Error("Failed to fetch");
    }) as unknown as typeof fetch;
    const result = await pullFromSheet(wrong, offline);
    expect(result.kind === "error" && result.message).toContain("nicht erreichbar");
  });

  it("serialises equal states alike whatever their key order", () => {
    expect(stableStringify({ b: 1, a: [{ d: 2, c: 3 }] })).toBe(stableStringify({ a: [{ c: 3, d: 2 }], b: 1 }));
    expect(stableStringify({ a: 1, gone: undefined })).toBe('{"a":1}');
  });
});
