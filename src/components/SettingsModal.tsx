import { useRef, useState } from "react";
import type { AppState } from "../types";
import { emptyState, exportStateJson, parseStateJson } from "../db";

type Props = {
  open: boolean;
  state: AppState;
  onClose: () => void;
  onReplace: (next: AppState) => void;
};

export function SettingsModal({ open, state, onClose, onReplace }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  function download() {
    const blob = new Blob([exportStateJson(state)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cashflow-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function onFile(file: File) {
    setError(null);
    try {
      const text = await file.text();
      const next = parseStateJson(text);
      if (
        !confirm(
          `Ripristinare backup con ${next.transactions.length} movimenti? Sostituisce i dati attuali.`,
        )
      ) {
        return;
      }
      onReplace(next);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Backup non valido");
    }
  }

  function wipe() {
    if (!confirm("Svuotare tutti i dati locali? Irreversibile senza backup.")) return;
    if (!confirm("Confermi davvero lo svuotamento?")) return;
    onReplace(emptyState());
    onClose();
  }

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="settings-title"
      >
        <h2 id="settings-title">Dati e backup</h2>
        <p className="muted">
          Tutto resta sul browser. Esporta un JSON prima di svuotare o cambiare PC.
        </p>

        <div className="settings-actions">
          <button type="button" className="btn primary" onClick={download}>
            Esporta backup JSON
          </button>
          <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
            Importa backup JSON
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onFile(f);
              e.target.value = "";
            }}
          />
          <button type="button" className="btn danger" onClick={wipe}>
            Svuota tutti i dati
          </button>
        </div>

        {error && <p className="error">{error}</p>}

        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
}
