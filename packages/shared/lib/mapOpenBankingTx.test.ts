/**
 * Tests for Berlin Group (GoCardless AIS) → Transaction mapper.
 */
import { describe, expect, it } from "vitest";
import { mapBookedTransaction, mapBookedTransactions } from "./mapOpenBankingTx";
import type { OpenBankingBookedTx } from "./mapOpenBankingTx";

function booked(partial: Partial<OpenBankingBookedTx> & { amount: string }): OpenBankingBookedTx {
  const { amount, transactionAmount: _ta, ...rest } = partial;
  return {
    bookingDate: "2026-09-15",
    remittanceInformationUnstructured: "C/O SUPERMERCATO",
    ...rest,
    transactionAmount: {
      amount,
      currency: partial.transactionAmount?.currency ?? "EUR",
    },
  };
}

describe("mapBookedTransaction", () => {
  it("maps debit amount and description", () => {
    const t = mapBookedTransaction(
      booked({
        amount: "-42.50",
        transactionId: "TX-1",
        remittanceInformationUnstructured: "C/O ESSLUNGA",
      }),
      "mediolanum",
    );
    expect(t).not.toBeNull();
    expect(t!.amount).toBe(-42.5);
    expect(t!.date).toBe("2026-09-15");
    expect(t!.source).toBe("mediolanum");
    expect(t!.currency).toBe("EUR");
    expect(t!.id).toBe("ob|mediolanum|TX-1");
    expect(t!.description.length).toBeGreaterThan(0);
    expect(t!.category).toBeTruthy();
  });

  it("maps credit amount positive", () => {
    const t = mapBookedTransaction(
      booked({
        amount: "1507.43",
        transactionId: "STIP-1",
        remittanceInformationUnstructured: "ACCREDITO STIPENDIO",
      }),
      "mediolanum",
    );
    expect(t!.amount).toBe(1507.43);
    expect(t!.category).toBe("Stipendio");
  });

  it("falls back to entryReference for id", () => {
    const t = mapBookedTransaction(
      booked({ amount: "-10.00", entryReference: "ER-99", transactionId: undefined }),
      "revolut",
    );
    expect(t!.id).toBe("ob|revolut|ER-99");
  });

  it("falls back to hash id when no bank ref", () => {
    const t = mapBookedTransaction(
      booked({
        amount: "-5.00",
        remittanceInformationUnstructured: "Coffee Shop",
      }),
      "revolut",
    );
    expect(t!.id.startsWith("revolut|")).toBe(true);
    expect(t!.id).toContain("2026-09-15");
  });

  it("returns null when amount missing", () => {
    const raw: OpenBankingBookedTx = {
      bookingDate: "2026-09-15",
      transactionAmount: { amount: "", currency: "EUR" },
    };
    expect(mapBookedTransaction(raw, "revolut")).toBeNull();
  });

  it("returns null when date missing", () => {
    expect(
      mapBookedTransaction(
        {
          transactionAmount: { amount: "-1.00", currency: "EUR" },
          remittanceInformationUnstructured: "x",
        },
        "revolut",
      ),
    ).toBeNull();
  });

  it("uses valueDate when bookingDate absent", () => {
    const t = mapBookedTransaction(
      {
        valueDate: "2026-08-01",
        transactionAmount: { amount: "-3.00", currency: "EUR" },
        transactionId: "V1",
        remittanceInformationUnstructured: "Test",
      },
      "revolut",
    );
    expect(t!.date).toBe("2026-08-01");
  });

  it("joins remittance array", () => {
    const t = mapBookedTransaction(
      booked({
        amount: "-1.00",
        transactionId: "A1",
        remittanceInformationUnstructured: undefined,
        remittanceInformationUnstructuredArray: ["LINE1", "LINE2"],
      }),
      "revolut",
    );
    expect(t!.description).toContain("LINE1");
  });
});

describe("mapBookedTransactions", () => {
  it("skips nulls and keeps order of valid rows", () => {
    const out = mapBookedTransactions(
      [
        booked({ amount: "", transactionId: "bad" }),
        booked({ amount: "-1.00", transactionId: "ok1" }),
        booked({ amount: "2.00", transactionId: "ok2", remittanceInformationUnstructured: "IN" }),
      ],
      "mediolanum",
    );
    expect(out.map((t) => t.id)).toEqual(["ob|mediolanum|ok1", "ob|mediolanum|ok2"]);
  });
});
