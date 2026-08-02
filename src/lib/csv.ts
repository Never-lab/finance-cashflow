/** Stable id for dedup across re-imports. */
export function transactionId(
  source: string,
  date: string,
  amount: number,
  description: string,
): string {
  const desc = description.trim().toLowerCase().replace(/\s+/g, " ");
  return `${source}|${date}|${amount.toFixed(2)}|${desc}`;
}

/** Parse EU (1.234,56) or US (1,234.56) amounts. */
export function parseAmount(raw: string): number | null {
  const s = raw
    .trim()
    .replace(/[\s\u00a0\u202f]/g, "")
    .replace(/€/g, "")
    .replace(/EUR/gi, "");
  if (!s || s === "-") return null;

  const neg = s.startsWith("-") || s.startsWith("(");
  const cleaned = s.replace(/[()]/g, "");

  let n: number;
  if (cleaned.includes(",") && cleaned.includes(".")) {
    // Decide decimal by last separator
    if (cleaned.lastIndexOf(",") > cleaned.lastIndexOf(".")) {
      n = Number(cleaned.replace(/\./g, "").replace(",", "."));
    } else {
      n = Number(cleaned.replace(/,/g, ""));
    }
  } else if (cleaned.includes(",")) {
    n = Number(cleaned.replace(/\./g, "").replace(",", "."));
  } else {
    n = Number(cleaned);
  }

  if (Number.isNaN(n)) return null;
  return neg ? -Math.abs(n) : n;
}

/** Parse DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD, or ISO datetime. */
export function parseDate(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;

  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const dmy = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/);
  if (dmy) {
    const dd = dmy[1].padStart(2, "0");
    const mm = dmy[2].padStart(2, "0");
    return `${dmy[3]}-${mm}-${dd}`;
  }

  const t = Date.parse(s);
  if (!Number.isNaN(t)) {
    const d = new Date(t);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }
  return null;
}

function splitCsvLine(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === sep && !inQuotes) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((c) => c.trim());
}

export function detectSeparator(headerLine: string): "," | ";" {
  const semi = (headerLine.match(/;/g) || []).length;
  const comma = (headerLine.match(/,/g) || []).length;
  return semi > comma ? ";" : ",";
}

export type CsvTable = { headers: string[]; rows: string[][] };

function cleanCell(h: string): string {
  return h.replace(/^"|"$/g, "").trim();
}

/** Parse CSV; optionally skip preamble until a header row matches. */
export function parseCsvTable(
  text: string,
  opts?: { isHeader?: (headers: string[]) => boolean },
): CsvTable {
  const normalized = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalized
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && l !== '"');
  if (lines.length === 0) return { headers: [], rows: [] };

  let start = 0;
  if (opts?.isHeader) {
    start = -1;
    for (let i = 0; i < lines.length; i++) {
      const sep = detectSeparator(lines[i]);
      const headers = splitCsvLine(lines[i], sep).map(cleanCell);
      if (opts.isHeader(headers)) {
        start = i;
        break;
      }
    }
    if (start < 0) return { headers: [], rows: [] };
  }

  const sep = detectSeparator(lines[start]);
  const headers = splitCsvLine(lines[start], sep).map(cleanCell);
  const rows = lines.slice(start + 1).map((line) => splitCsvLine(line, sep));
  return { headers, rows };
}

export function headerIndex(headers: string[], candidates: string[]): number {
  const lower = headers.map((h) => h.toLowerCase().trim());
  for (const c of candidates) {
    const i = lower.indexOf(c.toLowerCase());
    if (i >= 0) return i;
  }
  // partial match
  for (const c of candidates) {
    const i = lower.findIndex((h) => h.includes(c.toLowerCase()));
    if (i >= 0) return i;
  }
  return -1;
}
