import fs from "node:fs";

export const SAMPLE_MED = "fixtures/mediolanum-sample.csv";
export const SAMPLE_REV = "fixtures/revolut-sample.csv";

export const REAL_MED =
  "fixtures/Elenco movimenti dal 28-08-2025 al 28-08-2026.csv";
export const REAL_REV =
  "fixtures/account-statement_2025-07-29_2026-08-28_it-it_50d25d.csv";

export const PAYSLIP_TEXT_SAMPLE = "fixtures/payslip-osra-sample.txt";

export function hasRealBankFixtures(): boolean {
  return fs.existsSync(REAL_MED) && fs.existsSync(REAL_REV);
}

export function hasPayslipPdfs(): boolean {
  try {
    return fs.readdirSync("fixtures").some((f) => f.endsWith(".pdf"));
  } catch {
    return false;
  }
}

export function readUtf8(path: string): string {
  return fs.readFileSync(path, "utf8");
}
