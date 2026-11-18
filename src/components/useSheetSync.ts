import { useState } from "react";
import type { Bundle } from "../lib/storage";
import {
  loadSyncConfig,
  pullFromSheet,
  pushToSheet,
  saveSyncConfig,
  stableStringify,
  type SyncConfig,
} from "../lib/sync";
import { formatTimestamp } from "../lib/format";

/**
 * The Sheet sync's state, shared by the header buttons and the settings in §2 (D39).
 * `fingerprint` is the serialised screen state at the last load or save, so the
 * header can say when something has changed that the Sheet does not have yet.
 */
export type SheetSync = ReturnType<typeof useSheetSync>;

type Options = {
  buildExport: () => Bundle;
  onImport: (bundle: Bundle) => void;
  /** The current screen state through `stableStringify`. Compared with the last synced one. */
  fingerprint: string;
};

const FINGERPRINT_KEY = "mdh:sync-fingerprint";

function readFingerprint(): string {
  try {
    return window.localStorage.getItem(FINGERPRINT_KEY) ?? "";
  } catch {
    return "";
  }
}

function writeFingerprint(value: string) {
  try {
    window.localStorage.setItem(FINGERPRINT_KEY, value);
  } catch {
    // Storage unavailable: the "ungespeichert" hint then lasts for this session only.
  }
}

/** What a bundle holds, minus its timestamp: the screen and every named save. */
export function fingerprintOf(bundle: Bundle): string {
  return stableStringify({ current: bundle.current, saves: bundle.saves });
}

export function useSheetSync({ buildExport, onImport, fingerprint }: Options) {
  const [config, setConfig] = useState<SyncConfig | null>(() => loadSyncConfig());
  const [syncedFingerprint, setSyncedFingerprint] = useState<string>(() => readFingerprint());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState<Bundle | null>(null);
  const [conflictAt, setConflictAt] = useState<string | null>(null);

  function remember(next: SyncConfig | null) {
    saveSyncConfig(next);
    setConfig(next);
  }

  function markSynced(bundle: Bundle) {
    const value = fingerprintOf(bundle);
    writeFingerprint(value);
    setSyncedFingerprint(value);
  }

  async function load(target: SyncConfig | null = config) {
    if (!target) return;
    setBusy(true);
    setConflictAt(null);
    setMessage(null);
    const result = await pullFromSheet(target);
    setBusy(false);
    if (result.kind === "error") setMessage(result.message);
    else if (!result.bundle) setMessage("Verbunden. Im Sheet liegt noch nichts. Speichere den aktuellen Stand hinein.");
    else setPending(result.bundle);
  }

  async function save(force = false) {
    if (!config) return;
    setBusy(true);
    setMessage(null);
    const bundle = buildExport();
    const result = await pushToSheet(config, bundle, force);
    setBusy(false);
    if (result.kind === "ok") {
      remember({ ...config, lastSyncedAt: result.savedAt });
      markSynced(bundle);
      setConflictAt(null);
      setMessage(`Ins Sheet gespeichert (${formatTimestamp(result.savedAt)}).`);
    } else if (result.kind === "conflict") {
      setConflictAt(result.savedAt);
    } else {
      setMessage(result.message);
    }
  }

  function acceptPending() {
    if (!pending || !config) return;
    onImport(pending);
    remember({ ...config, lastSyncedAt: pending.savedAt });
    markSynced(pending);
    setPending(null);
    setMessage("Aus dem Sheet übernommen.");
  }

  function connect(url: string, token: string) {
    const next = { url: url.trim(), token: token.trim(), lastSyncedAt: "" };
    remember(next);
    void load(next);
  }

  return {
    config,
    busy,
    message,
    pending,
    conflictAt,
    /** Something on screen differs from what was last loaded from or saved to the Sheet. */
    unsaved: config !== null && fingerprint !== syncedFingerprint,
    load: () => void load(),
    save: (force = false) => void save(force),
    acceptPending,
    dismiss: () => {
      setPending(null);
      setConflictAt(null);
      setMessage(null);
    },
    connect,
    disconnect: () => remember(null),
  };
}
