import { describe, expect, it } from "vitest";
import { romeParts, romeYmd } from "./romeTime";

describe("romeTime", () => {
  it("returns YYYY-MM-DD and hour parts for a fixed UTC instant", () => {
    // 2026-03-15 05:30 UTC = 06:30 Europe/Rome (CET)
    const d = new Date("2026-03-15T05:30:00.000Z");
    const p = romeParts(d);
    expect(romeYmd(d)).toBe("2026-03-15");
    expect(p.hour).toBe(6);
    expect(p.year).toBe("2026");
    expect(p.month).toBe("03");
    expect(p.day).toBe("15");
  });
});
