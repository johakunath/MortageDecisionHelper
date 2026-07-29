import { useState } from "react";
import { Button } from "./ui";

type SavePanelProps = {
  saves: string[];
  storageWorks: boolean;
  onSave: (name: string) => void;
  onLoad: (name: string) => void;
  onDelete: (name: string) => void;
};

/**
 * Named snapshots in the browser's localStorage. Everything stays on this machine —
 * there is no backend and nothing is transmitted, which is also why a cleared browser
 * profile loses the saves.
 */
export default function SavePanel({
  saves,
  storageWorks,
  onSave,
  onLoad,
  onDelete,
}: SavePanelProps) {
  const [name, setName] = useState("");
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  function submit() {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSave(trimmed);
    setName("");
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
      <div className="save-row">
        <label className="save-field">
          <span>Datensatz speichern</span>
          <input
            type="text"
            value={name}
            placeholder="z.B. Immowelt 600k 04/2026"
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") submit();
            }}
          />
        </label>
        <Button variant="action" onClick={submit}>Speichern</Button>
      </div>

      {saves.length > 0 ? (
        <div className="save-list">
          {saves.map((entry) => (
            <span key={entry} className="save-chip">
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
