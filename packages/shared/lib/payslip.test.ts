import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { extractPayslipContent } from "../../../apps/api/lib/pdfExtract";
import {
  buildLeave,
  buildPayslipSummary,
  matchBankCredit,
  parseItalianAmount,
  parseOsraPayslipMarkdown,
  parseOsraPayslipText,
  parsePayslipContent,
  resolvePayslipNet,
  splitLeaveTriple,
  stripMarkdownNoise,
} from "./payslip";
import { hasPayslipPdfs, PAYSLIP_TEXT_SAMPLE, readUtf8 } from "../test/fixtures";

const PAYSLIP_TEXT_APAC = "fixtures/payslip-osra-apac-sample.txt";
const PAYSLIP_MD_SAMPLE = "fixtures/payslip-osra-sample.md";
const PAYSLIP_MD_APAC = "fixtures/payslip-osra-apac-sample.md";

describe("parseItalianAmount", () => {
  it("parses Italian decimal format", () => {
    expect(parseItalianAmount("2.407,43")).toBe(2407.43);
    expect(parseItalianAmount("700,08")).toBe(700.08);
    expect(parseItalianAmount("—")).toBeNull();
  });

  it("parses trailing minus used by OSRA PDF extract", () => {
    expect(parseItalianAmount("18,67-")).toBe(-18.67);
    expect(parseItalianAmount("26,66-")).toBe(-26.66);
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
    expect(parsed!.parserVersion).toBe("osra-oluit-6-leave");
  });

  it("parses AP/AC leave grid and non-empty FEST from text fixture", () => {
    const parsed = parseOsraPayslipText(readUtf8(PAYSLIP_TEXT_APAC), "payslip-osra-apac-sample.txt");
    expect(parsed).not.toBeNull();
    expect(parsed!.periodMonth).toBe(7);
    expect(parsed!.accAnomalous).toBe(false);
    expect(parsed!.payslipNet).toBe(1800);
    expect(parsed!.leaveFerie.ap).toMatchObject({ spettanti: 60.67, godute: 0.27, residue: 56 });
    // c=89,17 è residuo totale → AC residue = 89,17 − 56
    expect(parsed!.leaveFerie.ac).toMatchObject({ spettanti: 27.5, residue: 33.17 });
    expect(parsed!.leaveFerie.residue).toBe(89.17);
    expect(parsed!.leaveFest.ap).toMatchObject({ spettanti: 16, godute: 8, residue: 8 });
    expect(parsed!.leavePerm.ap).toMatchObject({ spettanti: 93.33, godute: 1, residue: 26.67 });
    expect(parsed!.leavePerm.ac).toMatchObject({ spettanti: 120 });
    expect(parsed!.leavePerm.ac.residue).toBeNull();
  });
});

describe("splitLeaveTriple", () => {
  it("keeps classic spettanti − godute = residue", () => {
    const leave = splitLeaveTriple([80, 53.33, 26.67], 26.67, null);
    expect(leave.ap).toMatchObject({ spettanti: 80, godute: 53.33, residue: 26.67 });
    expect(leave.ac.spettanti).toBeNull();
  });

  it("splits AP/AC when third value is total residue", () => {
    const leave = splitLeaveTriple([60.67, 27.5, 89.17], 56, 0.27);
    expect(leave.ap).toMatchObject({ spettanti: 60.67, godute: 0.27, residue: 56 });
    expect(leave.ac).toMatchObject({ spettanti: 27.5, residue: 33.17 });
    expect(leave.residue).toBe(89.17);
  });

  it("treats third value as AC spettanti when middle is zero", () => {
    const leave = splitLeaveTriple([93.33, 0, 120], 26.67, 1);
    expect(leave.ap).toMatchObject({ spettanti: 93.33, godute: 1, residue: 26.67 });
    expect(leave.ac).toMatchObject({ spettanti: 120, residue: null });
    expect(leave.residue).toBe(26.67);
  });

  it("does not treat AC residue as total when below AP residue", () => {
    const leave = splitLeaveTriple([50, 20, 15], 40, null);
    expect(leave.ap).toMatchObject({ spettanti: 50, residue: 40 });
    expect(leave.ac).toMatchObject({ spettanti: 20, residue: 15 });
    expect(leave.residue).toBe(55);
  });
});

describe("buildLeave totals", () => {
  it("sums AP+AC without inventing zeros as null partners", () => {
    const leave = buildLeave(
      { spettanti: 10, godute: 2, residue: 8 },
      { spettanti: 5, godute: null, residue: null },
    );
    expect(leave.spettanti).toBe(15);
    expect(leave.godute).toBe(2);
    expect(leave.residue).toBe(8);
  });
});

describe("parseOsraPayslipMarkdown", () => {
  it("parses GFM fixture with same nets as plain sample", () => {
    const parsed = parseOsraPayslipMarkdown(readUtf8(PAYSLIP_MD_SAMPLE), "payslip-osra-sample.md");
    expect(parsed).not.toBeNull();
    expect(parsed!.periodMonth).toBe(6);
    expect(parsed!.grossTotal).toBe(2615.5);
    expect(parsed!.payslipNet).toBe(1507.43);
    expect(parsed!.leaveFerie.ap.spettanti).toBe(80);
    expect(parsed!.leaveFerie.ap.residue).toBe(26.67);
    expect(parsed!.leavePerm.ap.residue).toBe(56);
    expect(parsed!.parserVersion).toBe("osra-oluit-6-leave");
  });

  it("parses AP/AC leave from markdown table fixture", () => {
    const parsed = parseOsraPayslipMarkdown(readUtf8(PAYSLIP_MD_APAC), "payslip-osra-apac-sample.md");
    expect(parsed).not.toBeNull();
    expect(parsed!.payslipNet).toBe(1800);
    expect(parsed!.leaveFerie.ap).toMatchObject({ spettanti: 60.67, godute: 0.27, residue: 56 });
    expect(parsed!.leaveFerie.ac).toMatchObject({ spettanti: 27.5, residue: 33.17 });
    expect(parsed!.leaveFerie.residue).toBe(89.17);
    expect(parsed!.leaveFest.ap).toMatchObject({ spettanti: 16, godute: 8, residue: 8 });
    expect(parsed!.leavePerm.ap).toMatchObject({ spettanti: 93.33, godute: 1, residue: 26.67 });
  });

  it("stripMarkdownNoise keeps amount labels", () => {
    const plain = stripMarkdownNoise("| Imponibile Fiscale | 2.407,43 |");
    expect(plain).toMatch(/Imponibile Fiscale\s+2\.407,43/);
  });
});

describe("parsePayslipContent", () => {
  it("routes md and plain kinds", () => {
    const md = parsePayslipContent(readUtf8(PAYSLIP_MD_SAMPLE), "md", "x.md");
    const plain = parsePayslipContent(readUtf8(PAYSLIP_TEXT_SAMPLE), "plain", "x.txt");
    expect(md?.payslipNet).toBe(1507.43);
    expect(plain?.payslipNet).toBe(1507.43);
  });
});

describe("parseOsraPayslipText PDF fixtures", () => {
  it.skipIf(!fs.existsSync(path.join("fixtures", "07-2026.pdf")))("parses July 2026 PDF with AP/AC split", async () => {
    const buffer = fs.readFileSync(path.join("fixtures", "07-2026.pdf"));
    const extracted = await extractPayslipContent(buffer);
    const parsed = parsePayslipContent(extracted.content, extracted.kind, "07-2026.pdf");

    expect(parsed).not.toBeNull();
    expect(parsed!.periodMonth).toBe(7);
    expect(parsed!.leaveFerie.ap.spettanti).toBeGreaterThan(0);
    expect(parsed!.leavePerm.ap.spettanti).toBeGreaterThan(0);
  });

  it.skipIf(!fs.existsSync(path.join("fixtures", "06-2026.pdf")))("parses June 2026 fixture PDF", async () => {
    const buffer = fs.readFileSync(path.join("fixtures", "06-2026.pdf"));
    const extracted = await extractPayslipContent(buffer);
    const parsed = parsePayslipContent(extracted.content, extracted.kind, "06-2026.pdf");

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
    const extracted = await extractPayslipContent(buffer);
    const parsed = parsePayslipContent(extracted.content, extracted.kind, "13-2025.pdf");

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
      const extracted = await extractPayslipContent(buffer);
      const parsed = parsePayslipContent(extracted.content, extracted.kind, file);
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

  it("picks closest credit instead of summing unrelated hits", () => {
    const r = matchBankCredit(
      [
        stipend,
        { ...stipend, id: "2", amount: 2141.13 },
      ],
      {
        payDate: "2026-07-14",
        periodYear: 2026,
        periodMonth: 6,
        payslipNet: 1507.43,
      },
    );
    expect(r.status).toBe("matched");
    expect(r.bankCredit).toBe(1507.43);
  });

  it("sums hits only when total matches payslipNet", () => {
    const r = matchBankCredit(
      [
        { ...stipend, amount: 800 },
        { ...stipend, id: "2", amount: 707.43 },
      ],
      {
        payDate: "2026-07-14",
        periodYear: 2026,
        periodMonth: 6,
        payslipNet: 1507.43,
      },
    );
    expect(r.status).toBe("matched");
    expect(r.bankCredit).toBe(1507.43);
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

  it("exposes AP/AC leave residues on chart without mixing spettanti", () => {
    const parsed = parseOsraPayslipText(readUtf8(PAYSLIP_TEXT_APAC), "payslip-osra-apac-sample.txt");
    const summary = buildPayslipSummary([parsed!]);
    expect(summary.chartLeave[0]).toMatchObject({
      ferieResidueAp: 56,
      ferieResidueAc: 33.17,
      permResidueAp: 26.67,
      permResidueAc: null,
    });
  });
});

describe("AFEA FEST column carrying ferie", () => {
  it("promotes FEST column into ferie when FERIE is empty", () => {
    const text = `OSRA Wolters Kluwer OLUIT
07/2026 - Luglio
999 TOT.LORDO SOGG.CONTR 2.800,00
Imponibile Fiscale 2.500,00
Rit. Fis. mese lorda 400,00
Rit. Fis. mese netta 380,00
Tot. rit. sociali 300,00
Acc. c.c. n.: 12345678901 BANCA MEDIOLANUM 1.800,00 2.800,00
Data valuta : 14/08/2026
FEST. FERIE PERM.
Residuo : 26,67 Residuo : 0,00 Residuo : 56,00
80,00 53,33 26,67 0,00 0,00 0,00 0,00 0,00 56,00
`;
    const parsed = parseOsraPayslipText(text, "afea-fest.txt");
    expect(parsed).not.toBeNull();
    expect(parsed!.leaveFerie.ap.spettanti).toBe(80);
    expect(parsed!.leaveFerie.ap.residue).toBe(26.67);
    expect(parsed!.leaveFest.residue).toBeNull();
    expect(parsed!.leavePerm.ap.residue).toBe(56);
  });
});

describe("multi-page OSRA leave grid", () => {
  const header = `OSRA Wolters Kluwer OLUIT
08/2025 - Agosto
999 TOT.LORDO SOGG.CONTR 1.942,43
Imponibile Fiscale 1.823,19
Rit. Fis. mese lorda 419,33
Rit. Fis. mese netta 419,33
Tot. rit. sociali 119,24
FEST. FERIE PERM.
`;

  it("parses leave grid when PDF extract glues trailing minus (26,66-)", () => {
    const text = `${header}Ore Ore Ore
Residuo : 2,67 Residuo : 0,00 Residuo : 61,33
106,67 136,00 26,66- 0,00 0,00 0,00 69,33 8,00 122,66
`;
    const parsed = parseOsraPayslipText(text, "08-2025-hyphen.txt");
    expect(parsed).not.toBeNull();
    expect(parsed!.leaveFerie.residue).not.toBeNull();
    expect(parsed!.leavePerm.ap.residue).toBe(61.33);
  });

  it("uses last non-zero Residuo block when early pages are blank forms", () => {
    const text = `${header}Residuo : 0,00 Residuo : 0,00 Residuo : 0,00
0,00 0,00 0,00 0,00 0,00 0,00 0,00 0,00 0,00
Ore Ore Ore
Residuo : 2,67 Residuo : 0,00 Residuo : 61,33
106,67 136,00 26,66- 0,00 0,00 0,00 69,33 8,00 122,66
`;
    const parsed = parseOsraPayslipText(text, "08-2025-multipage.txt");
    expect(parsed).not.toBeNull();
    expect(parsed!.leaveFerie.residue).not.toBeNull();
    expect(parsed!.leavePerm.ap.residue).toBe(61.33);
  });

  it("keeps classic negative residue from trailing minus", () => {
    const leave = splitLeaveTriple([53.33, 72, -18.67], 0, null);
    expect(leave.ap).toMatchObject({ spettanti: 53.33, godute: 72, residue: -18.67 });
  });
});
