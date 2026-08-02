import { useEffect, useRef, useState } from "react";
import type { AppState } from "../types";
import { emptyState, exportStateJson, parseStateJson } from "../db";
import { api, type Settings } from "../api";

type Props = {
  open: boolean;
  state: AppState;
  onClose: () => void;
  onReplace: (next: AppState) => void;
};

export function SettingsModal({ open, state, onClose, onReplace }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [savingKey, setSavingKey] = useState(false);
  const [keyError, setKeyError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setApiKeyInput("");
    setKeyError(null);
    api.getSettings().then(setSettings).catch(() => setSettings(null));
  }, [open]);

  if (!open) return null;

  async function saveApiKey() {
    if (!apiKeyInput.trim()) return;
    setSavingKey(true);
    setKeyError(null);
    try {
      const next = await api.updateSettings({ marketApiKey: apiKeyInput });
      setSettings(next);
      setApiKeyInput("");
    } catch (e) {
      setKeyError(e instanceof Error ? e.message : "Errore salvataggio chiave");
    } finally {
      setSavingKey(false);
    }
  }

  async function clearApiKey() {
    setSavingKey(true);
    setKeyError(null);
    try {
      const next = await api.updateSettings({ clearApiKey: true });
      setSettings(next);
    } catch (e) {
      setKeyError(e instanceof Error ? e.message : "Errore rimozione chiave");
    } finally {
      setSavingKey(false);
    }
  }

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

        <h3>Quotazioni di mercato</h3>
        <p className="muted">
          Provider attivo: <strong>{settings?.marketProvider ?? "yahoo"}</strong>
          {settings?.hasApiKey
            ? " — chiave Finnhub impostata (mascherata)."
            : " — Yahoo Finance, nessuna chiave richiesta."}
        </p>
        <div className="settings-actions">
          <input
            type="password"
            placeholder={settings?.hasApiKey ? "•••••••• (sostituisci chiave)" : "Finnhub API key"}
            value={apiKeyInput}
            onChange={(e) => setApiKeyInput(e.target.value)}
            autoComplete="off"
          />
          <button
            type="button"
            className="btn"
            onClick={() => void saveApiKey()}
            disabled={savingKey || !apiKeyInput.trim()}
          >
            Salva chiave
          </button>
          {settings?.hasApiKey && (
            <button
              type="button"
              className="btn danger"
              onClick={() => void clearApiKey()}
              disabled={savingKey}
            >
              Rimuovi chiave (torna a Yahoo)
            </button>
          )}
        </div>
        {keyError && <p className="error">{keyError}</p>}

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
