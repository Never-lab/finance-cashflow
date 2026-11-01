import { describe, expect, it } from "vitest";
import { addMonthsIso, deriveNextDue, localIsoDay } from "./nextDue";

describe("addMonthsIso", () => {
  it("adds months on date-only ISO without TZ drift", () => {
    expect(addMonthsIso("2026-01-15", 1)).toBe("2026-02-15");
    expect(addMonthsIso("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonthsIso("2024-01-31", 1)).toBe("2024-02-29");
    expect(addMonthsIso("2026-11-30", 1)).toBe("2026-12-30");
    expect(addMonthsIso("2026-07-31", 3)).toBe("2026-10-31");
  });
});

describe("localIsoDay", () => {
  it("uses local calendar components not UTC ISO", () => {
    const d = new Date(2026, 10, 1, 0, 30, 0); // 1 Nov local early morning
    expect(localIsoDay(d)).toBe("2026-11-01");
  });
});

describe("deriveNextDue", () => {
  it("returns null without lastDate and knownNext", () => {
    expect(deriveNextDue({ lastDate: null, today: "2026-11-01" })).toBeNull();
    expect(deriveNextDue({ lastDate: "", knownNext: null, today: "2026-11-01" })).toBeNull();
  });

  it("keeps knownNext when still in the future", () => {
    expect(
      deriveNextDue({
        lastDate: "2026-07-31",
        knownNext: "2026-11-15",
        today: "2026-11-01",
        cadenceDays: 30,
      }),
    ).toBe("2026-11-15");
  });

  it("keeps knownNext when equal to today", () => {
    expect(
      deriveNextDue({
        lastDate: "2026-10-01",
        knownNext: "2026-11-01",
        today: "2026-11-01",
      }),
    ).toBe("2026-11-01");
  });

  it("rolls from lastDate by cadence when knownNext is stale", () => {
    expect(
      deriveNextDue({
        lastDate: "2026-07-31",
        knownNext: "2026-08-31",
        today: "2026-11-01",
        cadenceDays: 30,
      }),
    ).toBe("2026-11-28");
  });

  it("rolls from lastDate alone with default cadence 30", () => {
    expect(
      deriveNextDue({
        lastDate: "2026-10-05",
        today: "2026-11-01",
      }),
    ).toBe("2026-11-04");
  });

  it("rolls from past knownNext when lastDate missing", () => {
    expect(
      deriveNextDue({
        lastDate: null,
        knownNext: "2026-08-15",
        today: "2026-11-01",
        cadenceDays: 30,
      }),
    ).toBe("2026-11-13");
  });

  it("uses median-style cadenceDays when provided", () => {
    expect(
      deriveNextDue({
        lastDate: "2026-06-01",
        today: "2026-11-01",
        cadenceDays: 182,
      }),
    ).toBe("2026-11-30");
  });
});
