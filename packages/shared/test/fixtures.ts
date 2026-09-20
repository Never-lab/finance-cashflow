/**
 * Percorsi e helper per fixture CSV/PDF usate nei test del pacchetto shared.
 *
 * Non fa parte del runtime produzione: abilita test di parser Mediolanum/Revolut e buste paga
 * quando i file reali sono presenti in `fixtures/` (opzionali per CI).
 */
import fs from "node:fs";

/** CSV Mediolanum di esempio ridotto per unit test. */
export const SAMPLE_MED = "fixtures/mediolanum-sample.csv";
/** CSV Revolut di esempio ridotto per unit test. */
export const SAMPLE_REV = "fixtures/revolut-sample.csv";

/** Export Mediolanum reale (anno rolling), se presente in workspace locale. */
export const REAL_MED =
  "fixtures/Elenco movimenti dal 28-08-2025 al 28-08-2026.csv";
/** Export Revolut reale IT, se presente in workspace locale. */
export const REAL_REV =
  "fixtures/account-statement_2025-07-29_2026-08-28_it-it_50d25d.csv";

/** Testo busta paga OSRA campione per parser payslip. */
export const PAYSLIP_TEXT_SAMPLE = "fixtures/payslip-osra-sample.txt";

/**
 * Verifica se entrambi gli export bancari “reali” sono disponibili su disco.
 * @returns true se esistono REAL_MED e REAL_REV
 */
export function hasRealBankFixtures(): boolean {
  return fs.existsSync(REAL_MED) && fs.existsSync(REAL_REV);
}

/**
 * Controlla se nella cartella fixtures c’è almeno un PDF (buste paga).
 * @returns false se la cartella non esiste o non contiene PDF
 */
export function hasPayslipPdfs(): boolean {
  try {
    return fs.readdirSync("fixtures").some((f) => f.endsWith(".pdf"));
  } catch {
    return false;
  }
}

/**
 * Legge un file testo UTF-8 (path relativo alla cwd del test).
 * @param path - Percorso file
 * @returns Contenuto del file
 */
export function readUtf8(path: string): string {
  return fs.readFileSync(path, "utf8");
}
