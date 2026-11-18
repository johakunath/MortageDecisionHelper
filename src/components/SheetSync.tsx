import { useState } from "react";
import { formatTimestamp } from "../lib/format";
import type { Bundle } from "../lib/storage";
import {
  isValidSyncUrl,
  loadSyncConfig,
  pullFromSheet,
  pushToSheet,
  saveSyncConfig,
  type SyncConfig,
} from "../lib/sync";
import { Button } from "./ui";

type SheetSyncProps = {
  buildExport: () => Bundle;
  onImport: (bundle: Bundle) => void;
};

/**
 * Manual load / save against the couple's Google Sheet (D38). Manual on purpose: an
 * automatic pull would replace the numbers on screen while someone is reading them,
 * and an automatic push would make the conflict guard fire on every keystroke.
 */
export default function SheetSync({ buildExport, onImport }: SheetSyncProps) {
  const [config, setConfig] = useState<SyncConfig | null>(() => loadSyncConfig());
  const [draftUrl, setDraftUrl] = useState("");
  const [draftToken, setDraftToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState<Bundle | null>(null);
  const [conflictAt, setConflictAt] = useState<string | null>(null);

  function remember(next: SyncConfig | null) {
    saveSyncConfig(next);
    setConfig(next);
  }

  async function load(target: SyncConfig) {
    setBusy(true);
    setConflictAt(null);
    const result = await pullFromSheet(target);
    setBusy(false);
    if (result.kind === "error") {
      setMessage(result.message);
    } else if (!result.bundle) {
      setMessage("Verbunden. Im Sheet liegt noch nichts. Speichere den aktuellen Stand hinein.");
    } else {
      setMessage(null);
      setPending(result.bundle);
    }
  }

  async function save(force: boolean) {
    if (!config) return;
    setBusy(true);
    const result = await pushToSheet(config, buildExport(), force);
    setBusy(false);
    if (result.kind === "ok") {
      remember({ ...config, lastSyncedAt: result.savedAt });
      setConflictAt(null);
      setMessage(`Ins Sheet gespeichert (${formatTimestamp(result.savedAt)}).`);
    } else if (result.kind === "conflict") {
      setConflictAt(result.savedAt);
      setMessage(null);
    } else {
      setMessage(result.message);
    }
  }

  if (!config) {
    const urlOk = isValidSyncUrl(draftUrl);
    return (
      <details className="sheet-sync">
        <summary>Mit Google Sheet abgleichen (Handy und PC)</summary>
        <p className="save-empty">
          Einmal pro Gerät einrichten. Anleitung: docs/google-sheet-sync/README.md im Repository.
        </p>
        <div className="save-row">
          <label className="save-field">
            <span>Web-App-URL</span>
            <input
              type="url"
              value={draftUrl}
              placeholder="https://script.google.com/macros/s/…/exec"
              onChange={(event) => setDraftUrl(event.target.value)}
            />
          </label>
          <label className="save-field">
            <span>Token</span>
            <input type="password" value={draftToken} onChange={(event) => setDraftToken(event.target.value)} />
          </label>
          <Button
            variant="action"
            onClick={() => {
              if (!urlOk || !draftToken.trim()) {
                setMessage("Bitte die URL der Web-App (endet auf /exec) und den Token eintragen.");
                return;
              }
              const next = { url: draftUrl.trim(), token: draftToken.trim(), lastSyncedAt: "" };
              remember(next);
              void load(next);
            }}
          >
            Verbinden
          </Button>
        </div>
        {message ? <p className="save-empty">{message}</p> : null}
      </details>
    );
  }

  return (
    <div className="sheet-sync">
      <div className="sheet-sync-head">
        <strong>Google Sheet</strong>
        <span className="save-empty">
          {config.lastSyncedAt ? `Zuletzt abgeglichen: ${formatTimestamp(config.lastSyncedAt)}` : "Noch nicht abgeglichen"}
        </span>
      </div>
      <div className="button-row">
        <Button variant="action" onClick={() => void load(config)}>
          {busy ? "…" : "Aus Sheet laden"}
        </Button>
        <Button variant="action" onClick={() => void save(false)}>
          {busy ? "…" : "Ins Sheet speichern"}
        </Button>
        <button type="button" className="sheet-sync-disconnect" onClick={() => remember(null)}>
          Verbindung auf diesem Gerät trennen
        </button>
      </div>

      {pending ? (
        <div className="save-transfer-confirm">
          <p>
            Stand im Sheet vom <strong>{formatTimestamp(pending.savedAt)}</strong> mit{" "}
            {Object.keys(pending.saves).length} gespeicherten Datensätzen. Übernehmen ersetzt den
            aktuellen Stand auf diesem Gerät.
          </p>
          <div className="button-row">
            <Button
              variant="action"
              onClick={() => {
                onImport(pending);
                remember({ ...config, lastSyncedAt: pending.savedAt });
                setPending(null);
                setMessage("Aus dem Sheet übernommen.");
              }}
            >
              Übernehmen
            </Button>
            <Button variant="action" onClick={() => setPending(null)}>
              Abbrechen
            </Button>
          </div>
        </div>
      ) : null}

      {conflictAt ? (
        <div className="save-transfer-confirm">
          <p>
            Im Sheet liegt ein neuerer Stand vom <strong>{formatTimestamp(conflictAt)}</strong>,
            wahrscheinlich vom anderen Gerät. Speichern würde ihn überschreiben.
          </p>
          <div className="button-row">
            <Button variant="action" onClick={() => void load(config)}>
              Erst laden
            </Button>
            <Button variant="action" onClick={() => void save(true)}>
              Trotzdem überschreiben
            </Button>
          </div>
        </div>
      ) : null}

      {message ? <p className="save-empty">{message}</p> : null}
    </div>
  );
}
