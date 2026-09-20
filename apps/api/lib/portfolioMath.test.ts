import { describe, it, expect } from "vitest";
import { instrumentValue, buildSummary, buildHistory } from "./portfolioMath";
import type { Holding, Instrument } from "@shared/types";

function makeInstrument(overrides: Partial<Instrument> = {}): Instrument {
  return {
    id: "i1",
    name: "Test",
    type: "etf",
    ticker: null,
    isin: null,
    currency: "EUR",
    notes: null,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeHolding(overrides: Partial<Holding> = {}): Holding {
  return {
    instrumentId: "i1",
    quantity: null,
    cashBalance: null,
    costBasis: 0,
    asOf: null,
    ...overrides,
  };
}

describe("instrumentValue", () => {
  it("ETF con ticker e prezzo disponibile: quantity * price", () => {
    const h = makeHolding({ quantity: 10, costBasis: 200 });
    expect(instrumentValue(h, 25)).toBe(250);
  });

  it("ETF con ticker ma prezzo assente: fallback su cost_basis", () => {
    const h = makeHolding({ quantity: 10, costBasis: 200 });
    expect(instrumentValue(h, null)).toBe(200);
  });

  it("fondo/cash senza quantity: usa cash_balance ?? 0, ignora price", () => {
    const h = makeHolding({ quantity: null, cashBalance: 1000, costBasis: 900 });
    expect(instrumentValue(h, 25)).toBe(1000);
    expect(instrumentValue(h, null)).toBe(1000);
  });

  it("cash senza cash_balance valorizzato: fallback 0", () => {
    const h = makeHolding({ quantity: null, cashBalance: null, costBasis: 0 });
    expect(instrumentValue(h, null)).toBe(0);
  });
});

describe("buildSummary", () => {
  it("ETF con prezzo: value/contributed/pnl per riga", () => {
    const rows = [
      {
        instrument: makeInstrument({ id: "etf1", name: "VWCE", type: "etf", ticker: "VWCE.DE" }),
        holding: makeHolding({ instrumentId: "etf1", quantity: 10, costBasis: 200 }),
        price: 25,
      },
    ];
    const summary = buildSummary(rows);
    expect(summary.lines).toHaveLength(1);
    expect(summary.lines[0].value).toBe(250);
    expect(summary.lines[0].contributed).toBe(200);
    expect(summary.lines[0].pnl).toBe(50);
    expect(summary.totalValue).toBe(250);
    expect(summary.totalContributed).toBe(200);
    expect(summary.pnl).toBe(50);
    expect(summary.pnlPct).toBe(25);
  });

  it("fondo solo cash: value = cash_balance, ignora price", () => {
    const rows = [
      {
        instrument: makeInstrument({ id: "f1", name: "Conto deposito", type: "deposito", ticker: null }),
        holding: makeHolding({ instrumentId: "f1", cashBalance: 500, costBasis: 500 }),
        price: null,
      },
    ];
    const summary = buildSummary(rows);
    expect(summary.lines[0].value).toBe(500);
    expect(summary.cashLiquidity).toBe(500);
  });

  it("cashLiquidity somma solo risparmio|deposito, non etf/fondo", () => {
    const rows = [
      {
        instrument: makeInstrument({ id: "etf1", type: "etf" }),
        holding: makeHolding({ instrumentId: "etf1", quantity: 10, costBasis: 200 }),
        price: 25,
      },
      {
        instrument: makeInstrument({ id: "r1", type: "risparmio" }),
        holding: makeHolding({ instrumentId: "r1", cashBalance: 300, costBasis: 300 }),
        price: null,
      },
      {
        instrument: makeInstrument({ id: "d1", type: "deposito" }),
        holding: makeHolding({ instrumentId: "d1", cashBalance: 200, costBasis: 200 }),
        price: null,
      },
    ];
    const summary = buildSummary(rows);
    expect(summary.cashLiquidity).toBe(500);
  });

  it("allocation: raggruppa per type e calcola pct sul totale", () => {
    const rows = [
      {
        instrument: makeInstrument({ id: "etf1", type: "etf" }),
        holding: makeHolding({ instrumentId: "etf1", quantity: 10, costBasis: 700 }),
        price: 70,
      },
      {
        instrument: makeInstrument({ id: "f1", type: "fondo" }),
        holding: makeHolding({ instrumentId: "f1", cashBalance: 300, costBasis: 300 }),
        price: null,
      },
    ];
    const summary = buildSummary(rows);
    expect(summary.totalValue).toBe(1000);
    const etfAlloc = summary.allocation.find((a) => a.type === "etf");
    const fondoAlloc = summary.allocation.find((a) => a.type === "fondo");
    expect(etfAlloc?.value).toBe(700);
    expect(etfAlloc?.pct).toBe(70);
    expect(fondoAlloc?.value).toBe(300);
    expect(fondoAlloc?.pct).toBe(30);
  });

  it("pnlPct null quando totalContributed è 0", () => {
    const rows = [
      {
        instrument: makeInstrument({ id: "etf1", type: "etf" }),
        holding: makeHolding({ instrumentId: "etf1", quantity: 10, costBasis: 0 }),
        price: 25,
      },
    ];
    const summary = buildSummary(rows);
    expect(summary.pnlPct).toBeNull();
  });

  it("buildSummary di lista vuota", () => {
    const summary = buildSummary([]);
    expect(summary.totalValue).toBe(0);
    expect(summary.totalContributed).toBe(0);
    expect(summary.pnl).toBe(0);
    expect(summary.pnlPct).toBeNull();
    expect(summary.cashLiquidity).toBe(0);
    expect(summary.allocation).toHaveLength(0);
    expect(summary.lines).toHaveLength(0);
  });
});

describe("buildHistory", () => {
  it("quantity fissa x closes: value = qty * close per ogni data", () => {
    const lines = [
      {
        quantity: 10,
        cashBalance: null,
        closes: [
          { asOf: "2026-01-01", close: 10 },
          { asOf: "2026-01-02", close: 12 },
        ],
      },
    ];
    const history = buildHistory(lines, ["2026-01-01", "2026-01-02"]);
    expect(history).toEqual([
      { date: "2026-01-01", value: 100 },
      { date: "2026-01-02", value: 120 },
    ]);
  });

  it("data senza close disponibile (prima della prima quotazione): valore 0 per la quota a quantity", () => {
    const lines = [
      {
        quantity: 10,
        cashBalance: null,
        closes: [{ asOf: "2026-01-05", close: 10 }],
      },
    ];
    const history = buildHistory(lines, ["2026-01-01"]);
    expect(history).toEqual([{ date: "2026-01-01", value: 0 }]);
  });

  it("carry-forward: usa l'ultimo close <= data, non quello successivo", () => {
    const lines = [
      {
        quantity: 5,
        cashBalance: null,
        closes: [
          { asOf: "2026-01-01", close: 10 },
          { asOf: "2026-01-10", close: 20 },
        ],
      },
    ];
    const history = buildHistory(lines, ["2026-01-05"]);
    expect(history).toEqual([{ date: "2026-01-05", value: 50 }]);
  });

  it("somma piu' righe (etf + cash) per la stessa data", () => {
    const lines = [
      {
        quantity: 10,
        cashBalance: null,
        closes: [{ asOf: "2026-01-01", close: 25 }],
      },
      {
        quantity: null,
        cashBalance: 500,
        closes: [],
      },
    ];
    const history = buildHistory(lines, ["2026-01-01"]);
    expect(history).toEqual([{ date: "2026-01-01", value: 750 }]);
  });

  it("cashBalance senza quantity ignora closes ed e' costante nel tempo", () => {
    const lines = [{ quantity: null, cashBalance: 300, closes: [] }];
    const history = buildHistory(lines, ["2026-01-01", "2026-06-01"]);
    expect(history).toEqual([
      { date: "2026-01-01", value: 300 },
      { date: "2026-06-01", value: 300 },
    ]);
  });

  it("lista di righe o date vuota", () => {
    expect(buildHistory([], ["2026-01-01"])).toEqual([{ date: "2026-01-01", value: 0 }]);
    expect(
      buildHistory([{ quantity: 10, cashBalance: null, closes: [] }], []),
    ).toEqual([]);
  });
});
