import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { extractPdfText } from "../../server/lib/pdfExtract";
import {
  buildPayslipSummary,
  matchBankCredit,
  parseItalianAmount,
  parseOsraPayslipText,
} from "./payslip";

describe("parseItalianAmount", () => {
  it("parses Italian decimal format", () => {
    expect(parseItalianAmount("2.407,43")).toBe(2407.43);
    expect(parseItalianAmount("700,08")).toBe(700.08);
    expect(parseItalianAmount("—")).toBeNull();
  });
});

describe("parseOsraPayslipText", () => {
  it("parses June 2026 fixture PDF", async () => {
    const buffer = fs.readFileSync(path.join("fixtures", "06-2026.pdf"));
    const text = await extractPdfText(buffer);
    const parsed = parseOsraPayslipText(text, "06-2026.pdf");

    expect(parsed).not.toBeNull();
    expect(parsed!.periodYear).toBe(2026);
    expect(parsed!.periodMonth).toBe(6);
    expect(parsed!.periodLabel).toMatch(/Giugno/i);
    expect(parsed!.grossTotal).toBe(2615.5);
    expect(parsed!.netToAccount).toBe(700.08);
    expect(parsed!.payDate).toBe("2026-07-14");
    expect(parsed!.leaveFerie.residue).toBe(26.67);
    expect(parsed!.leaveFerie.spettanti).toBe(80);
    expect(parsed!.leaveFest.residue).toBe(0);
    expect(parsed!.leavePerm.residue).toBe(56);
  });

  it("parses tredicesima fixture", async () => {
    const buffer = fs.readFileSync(path.join("fixtures", "13-2025.pdf"));
    const text = await extractPdfText(buffer);
    const parsed = parseOsraPayslipText(text, "13-2025.pdf");

    expect(parsed).not.toBeNull();
    expect(parsed!.periodMonth).toBe(13);
    expect(parsed!.grossTotal).toBeGreaterThan(0);
  });

  it("parses all fixture PDFs with unique periods", async () => {
    const pdfs = fs
      .readdirSync("fixtures")
      .filter((f) => f.endsWith(".pdf"))
      .sort();

    expect(pdfs.length).toBeGreaterThan(1);

    const ids = new Set<string>();
    for (const file of pdfs) {
      const buffer = fs.readFileSync(path.join("fixtures", file));
      const parsed = parseOsraPayslipText(await extractPdfText(buffer), file);
      expect(parsed, file).not.toBeNull();
      ids.add(parsed!.id);
    }

    expect(ids.size).toBe(pdfs.length);
  });

  it("reads ferie from first leave column on Dec 2025 fixture", async () => {
    const buffer = fs.readFileSync(path.join("fixtures", "12-2025.pdf"));
    const parsed = parseOsraPayslipText(await extractPdfText(buffer), "12-2025.pdf");
    expect(parsed).not.toBeNull();
    expect(parsed!.leaveFerie.spettanti).toBe(160);
    expect(parsed!.leaveFerie.godute).toBe(136);
    expect(parsed!.leaveFerie.residue).toBe(2.67);
    expect(parsed!.leavePerm.residue).toBe(61.33);
  });
});

describe("matchBankCredit", () => {
  it("sums Mediolanum stipendio credits in period month", () => {
    const credit = matchBankCredit(
      [
        {
          id: "1",
          date: "2026-06-14",
          description: "EMOLUMENTI",
          amount: 2141.13,
          currency: "EUR",
          source: "mediolanum",
          category: "Stipendio",
        },
        {
          id: "2",
          date: "2026-06-01",
          description: "Spesa",
          amount: -50,
          currency: "EUR",
          source: "mediolanum",
          category: "Altro",
        },
      ],
      2026,
      6,
    );
    expect(credit).toBe(2141.13);
  });
});

describe("buildPayslipSummary", () => {
  it("prefers bank credit for net pay", async () => {
    const buffer = fs.readFileSync(path.join("fixtures", "06-2026.pdf"));
    const parsed = parseOsraPayslipText(await extractPdfText(buffer), "06-2026.pdf");
    expect(parsed).not.toBeNull();

    const summary = buildPayslipSummary([parsed!], [
      {
        id: "1",
        date: "2026-06-14",
        description: "EMOLUMENTI",
        amount: 2141.13,
        currency: "EUR",
        source: "mediolanum",
        category: "Stipendio",
      },
    ]);

    expect(summary.latest?.netPay).toBe(2141.13);
    expect(summary.latest?.bankCredit).toBe(2141.13);
    expect(summary.chartNet.at(-1)?.netPay).toBe(2141.13);
  });
});
