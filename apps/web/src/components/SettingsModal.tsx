/**
 * Modale Dati e backup: chiave Finnhub, ricalcolo globale, export/import JSON stato,
 * svuotamento dati e logout sessione quando l'auth è attiva.
 */
import { useEffect, useRef, useState } from "react";
import type { AppState } from "@shared/types";
import { emptyState, exportStateJson, parseStateJson } from "../db";
import { api, type Settings } from "../api";
import { useDialogA11y } from "../hooks/useDialogA11y";

type Props = {
  open: boolean;
  state: AppState;
  authRequired: boolean;
  onClose: () => void;
  onReplace: (next: AppState) => void;
  onRecompute: () => Promise<string | null>;
  onLogout: () => void;
};

export function SettingsModal({ open, state, authRequired, onClose, onReplace, onRecompute, onLogout }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [recomputeMsg, setRecomputeMsg] = useState<string | null>(null);
  const [recomputing, setRecomputing] = useState(false);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [savingKey, setSavingKey] = useState(false);
  const [keyError, setKeyError] = useState<string | null>(null);
  const [bankConfigured, setBankConfigured] = useState(false);
  const [bankLinks, setBankLinks] = useState<
    {
      source: "mediolanum" | "revolut";
      status: string;
      consentExpiresAt: string | null;
      lastSyncAt: string | null;
      lastError: string | null;
      accountCount: number;
    }[]
  >([]);
  const [bankBusy, setBankBusy] = useState(false);
  const [bankMsg, setBankMsg] = useState<string | null>(null);

  useDialogA11y(open, onClose, panelRef);

  async function refreshBankStatus() {
    try {
      const s = await api.getBankSyncStatus();
      setBankConfigured(s.configured);
      setBankLinks(s.links);
    } catch {
      setBankConfigured(false);
      setBankLinks([]);
    }
  }

  useEffect(() => {
    if (!open) return;
    setApiKeyInput("");
    setKeyError(null);
    setRecomputeMsg(null);
    setBankMsg(null);
    api.getSettings().then(setSettings).catch(() => setSettings(null));
    void refreshBankStatus();
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

  async function linkBank(source: "mediolanum" | "revolut") {
    setBankBusy(true);
    setBankMsg(null);
    setError(null);
    try {
      const { url } = await api.startBankLink(source);
      window.location.href = url;
    } catch (e) {
      setBankMsg(e instanceof Error ? e.message : "Errore collegamento");
      setBankBusy(false);
    }
  }

  async function runBankSync() {
    setBankBusy(true);
    setBankMsg(null);
    setError(null);
    try {
      const { results } = await api.runBankSync();
      const parts = results.map((r) =>
        r.error
          ? `${r.source}: ${r.error}`
          : `${r.source}: +${r.added} / ~${r.updated}`,
      );
      setBankMsg(parts.join(" · ") || "Nessun conto collegato");
      await refreshBankStatus();
      const next = await api.getState();
      onReplace(next);
    } catch (e) {
      setBankMsg(e instanceof Error ? e.message : "Errore sync");
    } finally {
      setBankBusy(false);
    }
  }

  function bankLabel(source: string): string {
    return source === "mediolanum" ? "Mediolanum" : "Revolut";
  }

  function bankStatusLabel(status: string): string {
    if (status === "linked") return "collegato";
    if (status === "pending") return "in corso…";
    if (status === "needs_reauth") return "ricollega";
    if (status === "error") return "errore";
    return status;
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

  /** Delega ad App.onRecompute: POST /api/recompute con conferma utente. */
  async function recomputeAll() {
    if (
      !confirm(
        "Ricalcolare categorie, trasferimenti interni, investimenti e cedolini (PDF sul volume)? Gli override manuali restano.",
      )
    ) {
      return;
    }
    setRecomputing(true);
    setRecomputeMsg(null);
    setError(null);
    try {
      const msg = await onRecompute();
      setRecomputeMsg(msg);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore ricalcolo");
    } finally {
      setRecomputing(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        ref={panelRef}
        className="modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
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

        <h3>Banche (Open Banking)</h3>
        <p className="muted">
          Sync automatica via GoCardless (PSD2). CSV resta disponibile come emergenza. Consenso ~90
          giorni, poi ricollega.
        </p>
        {!bankConfigured ? (
          <p className="muted">
            Non configurato sul server (`GOCARDLESS_SECRET_*` + `BANK_SYNC_REDIRECT_URL`).
          </p>
        ) : (
          <>
            <ul className="muted" style={{ margin: "0.5rem 0", paddingLeft: "1.2rem" }}>
              {(["mediolanum", "revolut"] as const).map((source) => {
                const row = bankLinks.find((l) => l.source === source);
                return (
                  <li key={source}>
                    {bankLabel(source)}:{" "}
                    {row
                      ? `${bankStatusLabel(row.status)}${
                          row.lastSyncAt
                            ? ` · sync ${row.lastSyncAt.slice(0, 16).replace("T", " ")}`
                            : ""
                        }${row.lastError ? ` · ${row.lastError}` : ""}`
                      : "non collegato"}
                  </li>
                );
              })}
            </ul>
            <div className="settings-actions">
              <button
                type="button"
                className="btn"
                disabled={bankBusy}
                onClick={() => void linkBank("mediolanum")}
              >
                Collega Mediolanum
              </button>
              <button
                type="button"
                className="btn"
                disabled={bankBusy}
                onClick={() => void linkBank("revolut")}
              >
                Collega Revolut
              </button>
              <button
                type="button"
                className="btn primary"
                disabled={bankBusy || bankLinks.every((l) => l.status !== "linked")}
                onClick={() => void runBankSync()}
              >
                {bankBusy ? "Sync…" : "Sincronizza ora"}
              </button>
            </div>
            {bankMsg && <p className="muted">{bankMsg}</p>}
          </>
        )}

        <p className="muted">
          Dati su SQLite locale (`data/finance.db`). Il JSON di backup copre i movimenti; per il portafoglio copia anche il file `.db`.
        </p>

        <h3>Manutenzione</h3>
        <p className="muted">
          Riallinea DB e dashboard: riapplica regole categorie e flag «interno», ricalcola cost basis
          investimenti, ri-parsa i PDF cedolini sul volume e ricarica mutui/abbonamenti/PayPal. Non
          tocca override manuali né segnalazioni abbonamenti. Cedolini senza PDF sul volume: ri-importa
          una volta da Buste paga.
        </p>
        <div className="settings-actions">
          <button
            type="button"
            className="btn primary"
            onClick={() => void recomputeAll()}
            disabled={recomputing || state.transactions.length === 0}
          >
            {recomputing ? "Ricalcolo…" : "Ricalcola tutto"}
          </button>
        </div>
        {recomputeMsg && <p className="muted">{recomputeMsg}</p>}

        <h3>Backup</h3>
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

        {authRequired && (
          <>
            <h3>Sessione</h3>
            <p className="muted">Esci da questo browser (sessione locale).</p>
            <div className="settings-actions">
              <button type="button" className="btn danger" onClick={onLogout}>
                Esci
              </button>
            </div>
          </>
        )}

        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
}
