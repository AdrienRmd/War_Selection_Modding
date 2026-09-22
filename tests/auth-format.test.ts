import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/auth-server";

// Node 20+ exposes crypto.subtle / crypto.getRandomValues as globals, so the
// WebCrypto-based helpers run unmocked in the vitest node environment.

describe("hashPassword / verifyPassword", () => {
  it("vérifie le bon mot de passe après round-trip", async () => {
    const stored = await hashPassword("correct horse battery staple");
    expect(await verifyPassword("correct horse battery staple", stored)).toBe(true);
  });

  it("rejette un mauvais mot de passe", async () => {
    const stored = await hashPassword("correct horse battery staple");
    expect(await verifyPassword("wrong horse battery staple", stored)).toBe(false);
  });

  it("produit le format pbkdf2$120000$<salt b64url>$<hash b64url>", async () => {
    const stored = await hashPassword("whatever-123456");
    const parts = stored.split("$");
    expect(parts).toHaveLength(4);
    expect(parts[0]).toBe("pbkdf2");
    expect(parts[1]).toBe("120000");
    expect(parts[2]).toMatch(/^[A-Za-z0-9_-]{22}$/); // 16 bytes base64url
    expect(parts[3]).toMatch(/^[A-Za-z0-9_-]{43}$/); // 32 bytes base64url
  });

  it("génère des sels uniques (deux hachages diffèrent)", async () => {
    const a = await hashPassword("same-password-123");
    const b = await hashPassword("same-password-123");
    expect(a).not.toBe(b);
    expect(a.split("$")[2]).not.toBe(b.split("$")[2]);
    // Both still verify against the same password.
    expect(await verifyPassword("same-password-123", a)).toBe(true);
    expect(await verifyPassword("same-password-123", b)).toBe(true);
  });

  it("rejette un hash malformé sans planter", async () => {
    expect(await verifyPassword("x-not-important-123", "")).toBe(false);
    expect(await verifyPassword("x-not-important-123", "pbkdf2$120000$!!!$###")).toBe(false);
    expect(await verifyPassword("x-not-important-123", "scrypt$120000$abc$def")).toBe(false);
    expect(await verifyPassword("x-not-important-123", "pbkdf2$notanumber$abc$def")).toBe(false);
  });
});
