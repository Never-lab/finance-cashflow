import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { formatEur } from "@shared/lib/stats";
import {
  formatCompactNumber,
  formatEurDisplay,
  loadPrivacyAmounts,
  MASKED_EUR,
  PRIVACY_AMOUNTS_KEY,
  setPrivacyAmounts,
} from "./privacyAmounts";

const store = new Map<string, string>();

beforeEach(() => {
  store.clear();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
      removeItem: (k: string) => {
        store.delete(k);
      },
    },
  });
  setPrivacyAmounts(false);
});

afterEach(() => {
  setPrivacyAmounts(false);
  store.clear();
});

describe("privacyAmounts", () => {
  it("masks euro when privacy on", () => {
    setPrivacyAmounts(true);
    expect(formatEurDisplay(1234.5)).toBe(MASKED_EUR);
    expect(formatCompactNumber(1200)).toBe("••••");
  });

  it("shows real euro when privacy off", () => {
    setPrivacyAmounts(false);
    expect(formatEurDisplay(1234.5)).toBe(formatEur(1234.5));
  });

  it("persists to localStorage and reloads", () => {
    setPrivacyAmounts(true);
    expect(store.get(PRIVACY_AMOUNTS_KEY)).toBe("1");
    setPrivacyAmounts(false);
    expect(loadPrivacyAmounts()).toBe(false);
    setPrivacyAmounts(true);
    expect(loadPrivacyAmounts()).toBe(true);
  });
});
