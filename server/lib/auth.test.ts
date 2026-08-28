import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "./authPassword";
import {
  makeSessionToken,
  readSessionToken,
  refreshSessionToken,
  SESSION_IDLE_MS,
} from "./authSession";

describe("authPassword", () => {
  it("hashes and verifies password", () => {
    const hash = hashPassword("secret1234");
    expect(hash.startsWith("scrypt:")).toBe(true);
    expect(verifyPassword("secret1234", hash)).toBe(true);
    expect(verifyPassword("wrong", hash)).toBe(false);
  });
});

describe("authSession", () => {
  const secret = "test-secret-key-for-hmac-signing";

  it("round-trips session token", () => {
    const token = makeSessionToken("1", secret);
    const session = readSessionToken(token, secret);
    expect(session?.userId).toBe("1");
  });

  it("rejects tampered token", () => {
    const token = makeSessionToken("1", secret) + "ff";
    expect(readSessionToken(token, secret)).toBeNull();
  });

  it("rejects expired idle token", () => {
    const now = Date.now();
    const token = makeSessionToken("1", secret, now - SESSION_IDLE_MS - 1000);
    expect(readSessionToken(token, secret, now)).toBeNull();
  });

  it("refreshes valid session", () => {
    const token = makeSessionToken("1", secret);
    const session = readSessionToken(token, secret)!;
    const next = refreshSessionToken(session, secret);
    expect(next).toBeTruthy();
    expect(readSessionToken(next!, secret)).not.toBeNull();
  });
});
