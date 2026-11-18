import { useState } from "react";
import { formatTimestamp } from "../lib/format";
import { isValidSyncUrl } from "../lib/sync";
import { Button, Icon } from "./ui";
import type { SheetSync } from "./useSheetSync";

/**
 * Load / save in the sticky header (D39). Every input the app has is in the bundle, so
 * the sync is about the whole screen, not one section, and belongs where the whole
 * screen's context lives. Fixed height by construction: two 26px buttons. Anything
 * that has to say more (a confirmation, a conflict, an error) goes to `SyncPopover`.
 */
export function SyncControls({ sync, onSetup }: { sync: SheetSync; onSetup: () => void }) {
  if (!sync.config) {
    return (
      <div className="sync-controls">
        <button type="button" className="sync-button" onClick={onSetup}>
          <Icon name="cloud" />
          <span className="sync-button-label">Sheet verbinden</span>
        </button>
      </div>
    );
  }

  const lastSynced = sync.config.lastSyncedAt ? formatTimestamp(sync.config.lastSyncedAt) : "noch nie";

  return (
    <div className="sync-controls">
      <button
        type="button"
        className="sync-button"
        onClick={sync.load}
        disabled={sync.busy}
        aria-label="Aus dem Sheet laden"
        title={`Aus dem Sheet laden · zuletzt abgeglichen: ${lastSynced}`}
      >
        <Icon name="load" />
        <span className="sync-button-label">Laden</span>
      </button>
      <button
        type="button"
        className={`sync-button ${sync.unsaved ? "is-unsaved" : ""}`}
        onClick={() => sync.save()}
        disabled={sync.busy}
        aria-label={sync.unsaved ? "Ins Sheet speichern, es gibt ungespeicherte Änderungen" : "Ins Sheet speichern"}
        title={`Ins Sheet speichern · zuletzt abgeglichen: ${lastSynced}`}
      >
        <Icon name="save" />
        <span className="sync-button-label">{sync.busy ? "…" : "Speichern"}</span>
        {/* A dot and a word, never the dot alone (rule 4). */}
        {sync.unsaved ? (
          <span className="sync-unsaved">
            <span aria-hidden="true">●</span>
            <span className="sync-unsaved-word"> neu</span>
          </span>
        ) : null}
      </button>
    </div>
  );
}

/**
 * Rendered next to the header, not inside it: the header's clip-path would cut it off,
 * and inside it any growth would threaten `--header-height`.
 */
export function SyncPopover({ sync }: { sync: SheetSync }) {
  if (sync.pending) {
    return (
      <div className="sync-popover" role="dialog" aria-label="Stand aus dem Sheet übernehmen">
        <p>
          Stand im Sheet vom <strong>{formatTimestamp(sync.pending.savedAt)}</strong> mit{" "}
          {Object.keys(sync.pending.saves).length} gespeicherten Datensätzen. Übernehmen ersetzt den
          aktuellen Stand auf diesem Gerät.
        </p>
        <div className="button-row">
          <Button variant="action" onClick={sync.acceptPending}>Übernehmen</Button>
          <Button variant="action" onClick={sync.dismiss}>Abbrechen</Button>
        </div>
      </div>
    );
  }
  if (sync.conflictAt) {
    return (
      <div className="sync-popover" role="dialog" aria-label="Neuerer Stand im Sheet">
        <p>
          Im Sheet liegt ein neuerer Stand vom <strong>{formatTimestamp(sync.conflictAt)}</strong>,
          wahrscheinlich vom anderen Gerät. Speichern würde ihn überschreiben.
        </p>
        <div className="button-row">
          <Button variant="action" onClick={sync.load}>Erst laden</Button>
          <Button variant="action" onClick={() => sync.save(true)}>Trotzdem überschreiben</Button>
        </div>
      </div>
    );
  }
  if (sync.message) {
    return (
      <div className="sync-popover" role="status">
        <p>{sync.message}</p>
        <div className="button-row">
          <Button variant="action" onClick={sync.dismiss}>OK</Button>
        </div>
      </div>
    );
  }
  return null;
}

/** A token field whose content can be shown, to read it off and type it on the other device. */
function TokenField({ value, onChange, readOnly = false }: { value: string; onChange?: (value: string) => void; readOnly?: boolean }) {
  const [visible, setVisible] = useState(false);
  return (
    <label className="save-field">
      <span>Token</span>
      <span className="token-field">
        <input
          type={visible ? "text" : "password"}
          value={value}
          readOnly={readOnly}
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => onChange?.(event.target.value)}
        />
        <button
          type="button"
          className="token-toggle"
          aria-label={visible ? "Token verbergen" : "Token anzeigen"}
          aria-pressed={visible}
          onClick={() => setVisible((current) => !current)}
        >
          <Icon name={visible ? "eye-off" : "eye"} />
        </button>
      </span>
    </label>
  );
}

/** Connecting this device, and reading URL and token back off it, in §2. */
export function SyncSettings({ sync }: { sync: SheetSync }) {
  const [draftUrl, setDraftUrl] = useState("");
  const [draftToken, setDraftToken] = useState("");
  const [hint, setHint] = useState<string | null>(null);

  if (sync.config) {
    return (
      <details className="sheet-sync" id="sheet-sync-settings">
        <summary>Google Sheet: verbunden</summary>
        <p className="save-empty">
          Laden und Speichern sitzen oben rechts in der Kopfzeile. Hier stehen URL und Token,
          um ein weiteres Gerät zu verbinden.
        </p>
        <div className="save-row">
          <label className="save-field">
            <span>Web-App-URL</span>
            <input type="url" value={sync.config.url} readOnly />
          </label>
          <TokenField value={sync.config.token} readOnly />
        </div>
        <button type="button" className="sheet-sync-disconnect" onClick={sync.disconnect}>
          Verbindung auf diesem Gerät trennen
        </button>
      </details>
    );
  }

  return (
    <details className="sheet-sync" id="sheet-sync-settings">
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
        <TokenField value={draftToken} onChange={setDraftToken} />
        <Button
          variant="action"
          onClick={() => {
            if (!isValidSyncUrl(draftUrl) || !draftToken.trim()) {
              setHint("Bitte die URL der Web-App (endet auf /exec) und den Token eintragen.");
              return;
            }
            setHint(null);
            sync.connect(draftUrl, draftToken);
          }}
        >
          Verbinden
        </Button>
      </div>
      {hint ? <p className="save-empty">{hint}</p> : null}
    </details>
  );
}
