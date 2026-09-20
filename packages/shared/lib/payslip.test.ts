import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { extractPdfText } from "../../../apps/api/lib/pdfExtract";
import {
  buildPayslipSummary,
  matchBankCredit,
  parseItalianAmount,
  parseOsraPayslipText,
  resolvePayslipNet,
} from "./payslip";
import { hasPayslipPdfs, PAYSLIP_TEXT_SAMPLE, readUtf8 } from "../test/fixtures";

const PAYSLIP_TEXT_APAC = "fixtures/payslip-osra-apac-sample.txt";

describe("parseItalianAmount", () => {
  it("parses Italian decimal format", () => {
    expect(parseItalianAmount("2.407,43")).toBe(2407.43);
    expect(parseItalianAmount("700,08")).toBe(700.08);
    expect(parseItalianAmount("—")).toBeNull();
  });
});

describe("resolvePayslipNet", () => {
  it("flags anomalous Acc. c.c. and uses computed net", () => {
    const r = resolvePayslipNet({
      netToAccount: 700.08,
      taxableIncome: 2407.43,
      taxWithheld: 550,
      socialWithheld: 350,
    });
    expect(r.payslipNet).toBe(1507.43);
    expect(r.accAnomalous).toBe(true);
  });

  it("keeps Acc. c.c. when close to computed", () => {
    const r = resolvePayslipNet({
      netToAccount: 1800,
      taxableIncome: 2500,
      taxWithheld: 400,
      socialWithheld: 300,
    });
    expect(r.payslipNet).toBe(1800);
    expect(r.accAnomalous).toBe(false);
  });
});

describe("parseOsraPayslipText", () => {
  it("parses anonymized OSRA text fixture with anomalous Acc", () => {
    const parsed = parseOsraPayslipText(readUtf8(PAYSLIP_TEXT_SAMPLE), "payslip-osra-sample.txt");

    expect(parsed).not.toBeNull();
    expect(parsed!.periodYear).toBe(2026);
    expect(parsed!.periodMonth).toBe(6);
    expect(parsed!.periodLabel).toMatch(/Giugno/i);
    expect(parsed!.grossTotal).toBe(2615.5);
    expect(parsed!.netToAccount).toBe(700.08);
    expect(parsed!.accAnomalous).toBe(true);
    expect(parsed!.payslipNet).toBe(1507.43);
    expect(parsed!.netPay).toBe(1507.43);
    expect(parsed!.payDate).toBe("2026-07-14");
    expect(parsed!.leaveFerie.residue).toBe(26.67);
    expect(parsed!.leaveFerie.ap.spettanti).toBe(80);
    expect(parsed!.leaveFerie.ap.godute).toBe(53.33);
    expect(parsed!.leaveFerie.ap.residue).toBe(26.67);
    expect(parsed!.leaveFest.residue).toBeNull();
    expect(parsed!.leavePerm.ap.residue).toBe(56);
    expect(parsed!.parserVersion).toBe("osra-oluit-3");
  });

  it("parses AP/AC leave grid and non-empty FEST from text fixture", () => {
    const parsed = parseOsraPayslipText(readUtf8(PAYSLIP_TEXT_APAC), "payslip-osra-apac-sample.txt");
    expect(parsed).not.toBeNull();
    expect(parsed!.periodMonth).toBe(7);
    expect(parsed!.accAnomalous).toBe(false);
    expect(parsed!.payslipNet).toBe(1800);
    expect(parsed!.leaveFerie.ap).toMatchObject({ spettanti: 60.67, godute: 0.27, residue: 56 });
    expect(parsed!.leaveFerie.ac).toMatchObject({ spettanti: 27.5, residue: 89.17 });
    expect(parsed!.leaveFest.ap).toMatchObject({ spettanti: 16, godute: 8, residue: 8 });
    expect(parsed!.leavePerm.ap).toMatchObject({ spettanti: 93.33, godute: 1, residue: 26.67 });
    expect(parsed!.leavePerm.ac).toMatchObject({ spettanti: 120 });
  });

  it.skipIf(!fs.existsSync(path.join("fixtures", "07-2026.pdf")))("parses July 2026 PDF with AP/AC split", async () => {
    const buffer = fs.readFileSync(path.join("fixtures", "07-2026.pdf"));
    const parsed = parseOsraPayslipText(await extractPdfText(buffer), "07-2026.pdf");

    expect(parsed).not.toBeNull();
    expect(parsed!.periodMonth).toBe(7);
    expect(parsed!.leaveFerie.ap.spettanti).toBeGreaterThan(0);
    expect(parsed!.leavePerm.ap.spettanti).toBeGreaterThan(0);
  });

  it.skipIf(!fs.existsSync(path.join("fixtures", "06-2026.pdf")))("parses June 2026 fixture PDF", async () => {
    const buffer = fs.readFileSync(path.join("fixtures", "06-2026.pdf"));
    const text = await extractPdfText(buffer);
    const parsed = parseOsraPayslipText(text, "06-2026.pdf");

    expect(parsed).not.toBeNull();
    expect(parsed!.periodYear).toBe(2026);
    expect(parsed!.periodMonth).toBe(6);
    expect(parsed!.periodLabel).toMatch(/Giugno/i);
    expect(parsed!.grossTotal).toBe(2615.5);
    expect(parsed!.payDate).toBe("2026-07-14");
    expect(parsed!.leaveFerie.residue).not.toBeNull();
  });

  it.skipIf(!fs.existsSync(path.join("fixtures", "13-2025.pdf")))("parses tredicesima fixture", async () => {
    const buffer = fs.readFileSync(path.join("fixtures", "13-2025.pdf"));
    const text = await extractPdfText(buffer);
    const parsed = parseOsraPayslipText(text, "13-2025.pdf");

    expect(parsed).not.toBeNull();
    expect(parsed!.periodMonth).toBe(13);
    expect(parsed!.grossTotal).toBeGreaterThan(0);
  });

  it.skipIf(!hasPayslipPdfs())("parses all fixture PDFs with unique periods", async () => {
    const pdfs = fs
      .readdirSync("fixtures")
      .filter((f) => f.endsWith(".pdf"))
      .sort();

    expect(pdfs.length).toBeGreaterThan(0);

    const ids = new Set<string>();
    for (const file of pdfs) {
      const buffer = fs.readFileSync(path.join("fixtures", file));
      const parsed = parseOsraPayslipText(await extractPdfText(buffer), file);
      expect(parsed, file).not.toBeNull();
      ids.add(parsed!.id);
    }

    expect(ids.size).toBe(pdfs.length);
  });
});

describe("matchBankCredit", () => {
  const stipend = {
    id: "1",
    date: "2026-07-14",
    description: "EMOLUMENTI",
    amount: 1507.43,
    currency: "EUR",
    source: "mediolanum" as const,
    category: "Stipendio",
  };

  it("matches within payDate ±5 days when amount close", () => {
    const r = matchBankCredit([stipend], {
      payDate: "2026-07-14",
      periodYear: 2026,
      periodMonth: 6,
      payslipNet: 1507.43,
    });
    expect(r.status).toBe("matched");
    expect(r.bankCredit).toBe(1507.43);
  });

  it("marks doubt when amount far from payslipNet", () => {
    const r = matchBankCredit([{ ...stipend, amount: 2141.13 }], {
      payDate: "2026-07-14",
      periodYear: 2026,
      periodMonth: 6,
      payslipNet: 1507.43,
    });
    expect(r.status).toBe("doubt");
    expect(r.bankCredit).toBe(2141.13);
  });

  it("is missing when no stipend in window", () => {
    const r = matchBankCredit(
      [{ ...stipend, date: "2026-06-01", amount: 100 }],
      {
        payDate: "2026-07-14",
        periodYear: 2026,
        periodMonth: 6,
        payslipNet: 1507.43,
      },
    );
    expect(r.status).toBe("missing");
    expect(r.bankCredit).toBeNull();
  });
});

describe("buildPayslipSummary", () => {
  it("uses bank credit for netPay only when matched", () => {
    const parsed = parseOsraPayslipText(readUtf8(PAYSLIP_TEXT_SAMPLE), "payslip-osra-sample.txt");
    expect(parsed).not.toBeNull();

    const matched = buildPayslipSummary([parsed!], [
      {
        id: "1",
        date: "2026-07-14",
        description: "EMOLUMENTI",
        amount: 1507.43,
        currency: "EUR",
        source: "mediolanum",
        category: "Stipendio",
      },
    ]);
    expect(matched.latest?.bankMatchStatus).toBe("matched");
    expect(matched.latest?.netPay).toBe(1507.43);

    const doubt = buildPayslipSummary([parsed!], [
      {
        id: "1",
        date: "2026-07-14",
        description: "EMOLUMENTI",
        amount: 2141.13,
        currency: "EUR",
        source: "mediolanum",
        category: "Stipendio",
      },
    ]);
    expect(doubt.latest?.bankMatchStatus).toBe("doubt");
    expect(doubt.latest?.netPay).toBe(1507.43);
    expect(doubt.latest?.bankCredit).toBe(2141.13);
  });
});
