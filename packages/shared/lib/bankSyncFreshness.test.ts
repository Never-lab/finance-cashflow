import { describe, expect, it } from "vitest";
import {
  BANK_LINK_STALE_DAYS,
  TXN_DATA_STALE_DAYS,
  bankLinkNeedsAttention,
  bankLinksStaleMessage,
  isTransactionDataStale,
} from "./bankSyncFreshness";

const NOW = new Date(2026, 10, 1, 12, 0, 0); // local Nov 1 2026

describe("bankLinkNeedsAttention", () => {
  it("ignores unlinked rows without sync", () => {
    expect(
      bankLinkNeedsAttention(
        { status: "pending", lastSyncAt: null, consentExpiresAt: null },
        NOW,
      ),
    ).toEqual({ staleSync: false, consentExpiring: false });
  });

  it("flags linked never synced", () => {
    expect(
      bankLinkNeedsAttention(
        { status: "linked", lastSyncAt: null, consentExpiresAt: "2027-01-01T00:00:00.000Z" },
        NOW,
      ).staleSync,
    ).toBe(true);
  });

  it("flags lastSync older than 14 days", () => {
    const a = bankLinkNeedsAttention(
      {
        status: "linked",
        lastSyncAt: "2026-10-10T12:00:00.000Z",
        consentExpiresAt: "2027-01-01T00:00:00.000Z",
      },
      NOW,
    );
    expect(a.staleSync).toBe(true);
    expect(a.consentExpiring).toBe(false);
  });

  it("flags consent within 14 days", () => {
    const a = bankLinkNeedsAttention(
      {
        status: "linked",
        lastSyncAt: "2026-10-28T12:00:00.000Z",
        consentExpiresAt: "2026-11-10T00:00:00.000Z",
      },
      NOW,
    );
    expect(a.staleSync).toBe(false);
    expect(a.consentExpiring).toBe(true);
  });

  it("fresh sync and far consent → ok", () => {
    expect(
      bankLinkNeedsAttention(
        {
          status: "linked",
          lastSyncAt: "2026-10-28T12:00:00.000Z",
          consentExpiresAt: "2027-01-01T00:00:00.000Z",
        },
        NOW,
      ),
    ).toEqual({ staleSync: false, consentExpiring: false });
  });
});

describe("bankLinksStaleMessage", () => {
  it("returns null when all fresh", () => {
    expect(
      bankLinksStaleMessage(
        [
          {
            status: "linked",
            lastSyncAt: "2026-10-28T12:00:00.000Z",
            consentExpiresAt: "2027-01-01T00:00:00.000Z",
          },
        ],
        NOW,
      ),
    ).toBeNull();
  });

  it("returns Italian warning when stale", () => {
    const msg = bankLinksStaleMessage(
      [
        {
          status: "linked",
          lastSyncAt: "2026-09-01T12:00:00.000Z",
          consentExpiresAt: "2027-01-01T00:00:00.000Z",
        },
      ],
      NOW,
    );
    expect(msg).toMatch(/14 giorni/);
  });
});

describe("isTransactionDataStale", () => {
  it("empty → stale", () => {
    expect(isTransactionDataStale([], NOW)).toBe(true);
  });

  it("newest within window → fresh", () => {
    expect(isTransactionDataStale(["2026-10-20", "2026-10-25"], NOW, TXN_DATA_STALE_DAYS)).toBe(
      false,
    );
  });

  it("newest older than 21 days → stale", () => {
    expect(isTransactionDataStale(["2026-09-01", "2026-10-01"], NOW, TXN_DATA_STALE_DAYS)).toBe(
      true,
    );
  });
});

describe("constants", () => {
  it("matches product thresholds", () => {
    expect(BANK_LINK_STALE_DAYS).toBe(14);
    expect(TXN_DATA_STALE_DAYS).toBe(21);
  });
});
