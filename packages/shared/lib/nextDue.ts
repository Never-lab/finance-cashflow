/** Date-only ISO helpers for next installment / subscription due dates. */

/** Add calendar months to YYYY-MM-DD (UTC, clamps day to month length). */
export function addMonthsIso(date: string, months: number): string {
  const [ys, ms, ds] = date.split("-");
  const y = Number(ys);
  const m = Number(ms);
  const d = Number(ds);
  if (!y || !m || !d) return date;
  const total = y * 12 + (m - 1) + months;
  const ny = Math.floor(total / 12);
  const nm = ((total % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate();
  const nd = Math.min(d, lastDay);
  return `${ny}-${String(nm + 1).padStart(2, "0")}-${String(nd).padStart(2, "0")}`;
}

function addDaysIso(date: string, days: number): string {
  const [ys, ms, ds] = date.split("-");
  const y = Number(ys);
  const m = Number(ms);
  const d = Number(ds);
  if (!y || !m || !d) return date;
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

/** Local calendar YYYY-MM-DD (matches budget/scadenzario; not UTC). */
export function localIsoDay(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Next due after last payment / known snapshot.
 * Prefer future knownNext; else roll cadenceDays (default 30) from lastDate
 * (or past knownNext if no lastDate) until strictly after today.
 */
export function deriveNextDue(opts: {
  lastDate: string | null;
  cadenceDays?: number;
  knownNext?: string | null;
  today?: string;
}): string | null {
  const today = opts.today ?? localIsoDay();
  const cadence = opts.cadenceDays && opts.cadenceDays > 0 ? opts.cadenceDays : 30;
  const knownNext = opts.knownNext?.trim() || null;
  const lastDate = opts.lastDate?.trim() || null;

  if (!lastDate && !knownNext) return null;
  if (knownNext && knownNext >= today) return knownNext;

  let cursor = lastDate ?? knownNext!;
  for (let i = 0; i < 36; i++) {
    cursor = addDaysIso(cursor, cadence);
    if (cursor > today) return cursor;
  }
  return cursor;
}
