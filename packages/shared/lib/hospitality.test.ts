import { describe, expect, it } from "vitest";
import { isHospitalityVenue } from "./hospitality";

describe("isHospitalityVenue", () => {
  it("detects Terni bars and restaurants from real card labels", () => {
    expect(isHospitalityVenue("OLD WILD WEST TERNI")).toBe(true);
    expect(isHospitalityVenue("OFFICINA 41 TERNI (BAR)")).toBe(true);
    expect(isHospitalityVenue("POSCARGANO DAL1890 TERNI (BAR)")).toBe(true);
    expect(isHospitalityVenue("BAR LUME TERNI (BAR)")).toBe(true);
  });

  it("does not match fuel or subscriptions", () => {
    expect(isHospitalityVenue("C/O IS TERNI")).toBe(false);
    expect(isHospitalityVenue("Netflix")).toBe(false);
  });
});
