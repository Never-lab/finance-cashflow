import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  deletePayslipPdf,
  payslipPdfPath,
  readPayslipPdf,
  savePayslipPdf,
} from "./payslipStorage";

describe("payslipStorage", () => {
  let dir: string;
  let prev: string | undefined;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "payslip-storage-"));
    prev = process.env.PAYSLIPS_DIR;
    process.env.PAYSLIPS_DIR = dir;
  });

  afterEach(() => {
    if (prev === undefined) delete process.env.PAYSLIPS_DIR;
    else process.env.PAYSLIPS_DIR = prev;
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("saves, reads, and deletes PDF under user folder", () => {
    const buf = Buffer.from("%PDF-1.4 fake");
    const dest = savePayslipPdf(1, "osra-2026-07-luglio", buf);
    expect(dest).toBe(payslipPdfPath(1, "osra-2026-07-luglio"));
    expect(readPayslipPdf(1, "osra-2026-07-luglio")?.equals(buf)).toBe(true);
    deletePayslipPdf(1, "osra-2026-07-luglio");
    expect(readPayslipPdf(1, "osra-2026-07-luglio")).toBeNull();
  });
});
