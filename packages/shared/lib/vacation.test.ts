import { describe, expect, it } from "vitest";
import { isRevolutVacationPocket, isVacationSpend } from "./vacation";

describe("isVacationSpend", () => {
  it("detects Valencia trip merchants", () => {
    expect(isVacationSpend("Bioparc Valencia · Risparmi")).toBe(true);
    expect(isVacationSpend("La Tasqueta Valencia · Risparmi")).toBe(true);
    expect(isVacationSpend("Casa BALDO · Risparmi")).toBe(true);
    expect(isVacationSpend("Headout · Risparmi")).toBe(true);
  });

  it("treats Revolut Risparmi card spend as vacation (except fuel and pocket moves)", () => {
    expect(isVacationSpend("Five Guys · Risparmi")).toBe(true);
    expect(isVacationSpend("Dia · Risparmi")).toBe(true);
    expect(isVacationSpend("Uber · Risparmi")).toBe(true);
    expect(isVacationSpend("Lefties · Risparmi")).toBe(true);
    expect(isVacationSpend("Autogrill · Risparmi")).toBe(true);
    expect(isVacationSpend("Eni · Risparmi")).toBe(false);
    expect(isVacationSpend("Prelievo da Pocket · Risparmi")).toBe(false);
    expect(isVacationSpend("Accredita EUR Viaggio Novembre/Gennaio da EUR · Risparmi")).toBe(false);
  });

  it("does not tag normal local spend as vacation", () => {
    expect(isVacationSpend("OLD WILD WEST TERNI")).toBe(false);
    expect(isVacationSpend("Esselunga")).toBe(false);
    expect(isVacationSpend("Five Guys")).toBe(false);
  });
});

describe("isRevolutVacationPocket", () => {
  it("requires Risparmi pocket suffix", () => {
    expect(isRevolutVacationPocket("Five Guys · Risparmi")).toBe(true);
    expect(isRevolutVacationPocket("Five Guys")).toBe(false);
  });
});
