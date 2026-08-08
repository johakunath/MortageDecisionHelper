import { useState } from "react";
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
};

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
    </div>
  );
}
