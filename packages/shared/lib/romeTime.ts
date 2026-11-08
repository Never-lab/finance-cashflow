/**
 * Calendar helpers for Europe/Rome (cron / Italian day boundaries on UTC hosts).
 */

export type RomeParts = { year: string; month: string; day: string; hour: number };

/** Extract Y/M/D/hour in Europe/Rome from an instant. */
export function romeParts(d: Date = new Date()): RomeParts {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(d).filter((p) => p.type !== "literal").map((p) => [p.type, p.value]),
  ) as Record<string, string>;
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: Number(parts.hour),
  };
}

/** YYYY-MM-DD in Europe/Rome. */
export function romeYmd(d: Date = new Date()): string {
  const p = romeParts(d);
  return `${p.year}-${p.month}-${p.day}`;
}
