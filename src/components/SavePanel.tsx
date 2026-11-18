import { useRef, useState } from "react";
import { formatTimestamp } from "../lib/format";
import { parseBundle, type Bundle } from "../lib/storage";
import { Button } from "./ui";

type SavePanelProps = {
  saves: string[];
  storageWorks: boolean;
  /** The save currently on screen, if any — the one "Aktualisieren" writes to. */
  activeSaveName: string | null;
  nameExists: (name: string) => boolean;
  onSave: (name: string) => void;
  onLoad: (name: string) => void;
  onDelete: (name: string) => void;
  /** The bundle to write into the export file. */
  buildExport: () => Bundle;
  onImport: (bundle: Bundle) => void;
};

/**
 * The export as a file download. A Blob URL works from `file://` as well, so the
 * standalone copy can export too — no server, no network.
 */
function downloadBundle(bundle: Bundle) {
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `hausrechner-${bundle.savedAt.slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/**
 * Export / import as a JSON file: the way to move the assumptions between the PC, the
 * phone and the standalone copy by hand, and a backup that survives a cleared browser.
 * Importing replaces the screen, so it shows what it is about to load and asks first.
 */
function FileTransfer({ buildExport, onImport }: Pick<SavePanelProps, "buildExport" | "onImport">) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<Bundle | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function readFile(file: File) {
    const bundle = parseBundle(await file.text());
    setMessage(bundle ? null : "Diese Datei ist kein Export des Hausrechners.");
    setPending(bundle);
  }

  return (
    <div className="save-transfer">
      <div className="button-row">
        <Button variant="action" onClick={() => downloadBundle(buildExport())}>
          Als Datei exportieren
        </Button>
        <Button variant="action" onClick={() => fileInput.current?.click()}>
          Datei importieren
        </Button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void readFile(file);
            event.target.value = "";
          }}
        />
      </div>
      {pending ? (
        <div className="save-transfer-confirm">
          <p>
            Export vom <strong>{formatTimestamp(pending.savedAt)}</strong> mit{" "}
            {Object.keys(pending.saves).length} gespeicherten Datensätzen. Übernehmen ersetzt
            den aktuellen Stand; gleichnamige Datensätze werden überschrieben.
          </p>
          <div className="button-row">
            <Button
              variant="action"
              onClick={() => {
                onImport(pending);
                setPending(null);
                setMessage("Import übernommen.");
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
      {message ? <p className="save-empty">{message}</p> : null}
    </div>
  );
}

/**
 * Named snapshots in the browser's localStorage. Everything stays on this machine —
 * there is no backend and nothing is transmitted, which is also why a cleared browser
 * profile loses the saves.
 *
 * Loading a save now makes it *active*, which is what makes "Aktualisieren" possible:
 * before, the only way back into a stored set was to retype its name exactly and hope
 * the silent overwrite hit the right one.
 */
export default function SavePanel({
  saves,
  storageWorks,
  activeSaveName,
  nameExists,
  onSave,
  onLoad,
  onDelete,
  buildExport,
  onImport,
}: SavePanelProps) {
  const [name, setName] = useState("");
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [pendingOverwrite, setPendingOverwrite] = useState(false);

  const trimmed = name.trim();
  // Overwriting somebody's saved set is not undoable, so it takes the same two-step
  // confirmation as deleting rather than happening silently on the first click.
  const wouldOverwrite = trimmed.length > 0 && nameExists(trimmed);

  function submit() {
    if (!trimmed) return;
    if (wouldOverwrite && !pendingOverwrite) {
      setPendingOverwrite(true);
      return;
    }
    onSave(trimmed);
    setName("");
    setPendingOverwrite(false);
  }

  if (!storageWorks) {
    return (
      <div className="save-panel save-panel-unavailable">
        Speichern ist hier nicht möglich — der Browser erlaubt in diesem Kontext keinen
        lokalen Speicher. Die Eingaben gelten nur für diese Sitzung.
      </div>
    );
  }

  return (
    <div className="save-panel">
      {activeSaveName ? (
        <div className="save-active">
          <span>
            Geladen: <strong>{activeSaveName}</strong>
          </span>
          <Button variant="action" onClick={() => onSave(activeSaveName)}>
            Aktualisieren
          </Button>
        </div>
      ) : null}

      <div className="save-row">
        <label className="save-field">
          <span>{activeSaveName ? "Als neuen Datensatz speichern" : "Datensatz speichern"}</span>
          <input
            type="text"
            value={name}
            placeholder="z.B. Angebot 1A 08/2026"
            onChange={(event) => {
              setName(event.target.value);
              setPendingOverwrite(false);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") submit();
            }}
          />
        </label>
        <Button variant="action" onClick={submit}>
          {pendingOverwrite ? "Wirklich überschreiben?" : wouldOverwrite ? "Überschreiben" : "Speichern"}
        </Button>
      </div>

      {saves.length > 0 ? (
        <div className="save-list">
          {saves.map((entry) => (
            <span key={entry} className={`save-chip ${entry === activeSaveName ? "is-active" : ""}`}>
              <button type="button" className="save-chip-load" onClick={() => onLoad(entry)}>
                {entry}
              </button>
              {pendingDelete === entry ? (
                <>
                  <button
                    type="button"
                    className="save-chip-confirm"
                    onClick={() => {
                      onDelete(entry);
                      setPendingDelete(null);
                    }}
                  >
                    löschen?
                  </button>
                  <button
                    type="button"
                    className="save-chip-cancel"
                    onClick={() => setPendingDelete(null)}
                  >
                    ✕
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="save-chip-delete"
                  aria-label={`${entry} löschen`}
                  onClick={() => setPendingDelete(entry)}
                >
                  ✕
                </button>
              )}
            </span>
          ))}
        </div>
      ) : (
        <p className="save-empty">
          Noch nichts gespeichert. Der aktuelle Stand bleibt trotzdem über einen Reload
          hinweg erhalten.
        </p>
      )}
      <FileTransfer buildExport={buildExport} onImport={onImport} />
    </div>
  );
}
