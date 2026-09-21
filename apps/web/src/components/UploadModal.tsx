/**
 * Modale globale import CSV Mediolanum/Revolut: rilevamento banca, anteprima prime righe,
 * estrazione snapshot liquidità e merge sul server tramite callback App.onImport.
 */
import { useRef, useState } from "react";
import type { BankSource, Transaction } from "@shared/types";
import { detectBank } from "@shared/lib/detectBank";
import { importCsv } from "@shared/lib/importCsv";
import { extractLiquidityFromCsv, type LiquiditySnapshots } from "@shared/lib/liquidity";
import { formatEurDisplay } from "../lib/privacyAmounts";
import { useDialogA11y } from "../hooks/useDialogA11y";

type Props = {
  open: boolean;
  onClose: () => void;
  onImport: (rows: Transaction[], liquidity?: Partial<LiquiditySnapshots>) => void;
};

export function UploadModal({ open, onClose, onImport }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<Transaction[] | null>(null);
  const [source, setSource] = useState<BankSource | "auto">("auto");
  const [filename, setFilename] = useState("");
  const [raw, setRaw] = useState("");
  const [bank, setBank] = useState<BankSource | null>(null);

  useDialogA11y(open, onClose, panelRef);

  if (!open) return null;

  async function onFile(file: File) {
    setError(null);
    setPreview(null);
    setFilename(file.name);
    const text = await file.text();
    setRaw(text);
    const detected = detectBank(text, file.name);
    const bank = source === "auto" ? detected : source;
    if (!bank) {
      setError("Banca non riconosciuta: scegli Mediolanum o Revolut e riprova.");
      return;
    }
    setBank(bank);
    try {
      const rows = importCsv(text, { filename: file.name, source: bank });
      setPreview(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore di import");
    }
  }

  function reparse(nextSource: BankSource | "auto") {
    setSource(nextSource);
    setError(null);
    if (!raw) return;
    const bank = nextSource === "auto" ? detectBank(raw, filename) : nextSource;
    if (!bank) {
      setError("Banca non riconosciuta: scegli Mediolanum o Revolut.");
      setPreview(null);
      setBank(null);
      return;
    }
    setBank(bank);
    try {
      setPreview(importCsv(raw, { filename, source: bank }));
    } catch (e) {
      setPreview(null);
      setError(e instanceof Error ? e.message : "Errore di import");
    }
  }

  /** Invia movimenti e, se presenti nel CSV, patch snapshot saldi Mediolanum/Revolut. */
  function confirm() {
    if (!preview?.length || !bank) return;
    const liquidity = extractLiquidityFromCsv(raw, bank);
    onImport(preview, Object.keys(liquidity).length > 0 ? liquidity : undefined);
    setPreview(null);
    setRaw("");
    setFilename("");
    setBank(null);
    setError(null);
    onClose();
  }

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        ref={panelRef}
        className="modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="upload-title"
      >
        <h2 id="upload-title">Carica CSV</h2>
        <p className="muted">
          Esporta i movimenti da Mediolanum o Revolut Pocket e seleziona il file.
          Mediolanum: «Elenco movimenti». Revolut: account statement (anche IT: Data di completamento / COMPLETATO).
        </p>

        <label className="field">
          Banca
          <select
            value={source}
            onChange={(e) => reparse(e.target.value as BankSource | "auto")}
          >
            <option value="auto">Rilevamento automatico</option>
            <option value="mediolanum">Mediolanum</option>
            <option value="revolut">Revolut Pocket</option>
          </select>
        </label>

        <label className="file-btn">
          Scegli file
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onFile(f);
            }}
          />
        </label>
        {filename && <p className="muted">File: {filename}</p>}
        {error && <p className="error">{error}</p>}

        {preview && (
          <>
            <p>
              Anteprima: <strong>{preview.length}</strong> movimenti (prime 5)
            </p>
            <table className="preview">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Descrizione</th>
                  <th>Cat.</th>
                  <th className="num">Importo</th>
                </tr>
              </thead>
              <tbody>
                {preview.slice(0, 5).map((t) => (
                  <tr key={t.id}>
                    <td>{t.date}</td>
                    <td>{t.description}</td>
                    <td>{t.category}</td>
                    <td className="num">{formatEurDisplay(t.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>
            Annulla
          </button>
          <button
            type="button"
            className="btn primary"
            disabled={!preview?.length}
            onClick={confirm}
          >
            Conferma import
          </button>
        </div>
      </div>
    </div>
  );
}
