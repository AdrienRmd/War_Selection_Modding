import { describe, expect, it } from "vitest";
import {
  DUMMY_HASH,
  hashPassword,
  isCommonPassword,
  PBKDF2_ITERATIONS,
  verifyPassword,
} from "@/lib/auth-server";

// Node 20+ exposes crypto.subtle / crypto.getRandomValues as globals, so the
// WebCrypto-based helpers run unmocked in the vitest node environment.

// Local base64url encoder used to hand-craft legacy hashes.
function b64url(bytes: Uint8Array): string {
  let raw = "";
  for (const b of bytes) raw += String.fromCharCode(b);
  return btoa(raw).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Builds a pbkdf2$<iterations>$<salt>$<hash> string with raw WebCrypto, to
// simulate hashes stored by older deployments without using hashPassword().
async function craftHash(password: string, iterations: number): Promise<string> {
  const salt = new Uint8Array(new ArrayBuffer(16));
  crypto.getRandomValues(salt);
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    key,
    256,
  );
  return `pbkdf2$${iterations}$${b64url(salt)}$${b64url(new Uint8Array(bits))}`;
}

describe("hashPassword / verifyPassword", () => {
  it("vérifie le bon mot de passe après round-trip", async () => {
    const stored = await hashPassword("correct horse battery staple");
    expect(await verifyPassword("correct horse battery staple", stored)).toBe(true);
  });

  it("rejette un mauvais mot de passe", async () => {
    const stored = await hashPassword("correct horse battery staple");
    expect(await verifyPassword("wrong horse battery staple", stored)).toBe(false);
  });

  it("utilise la constante PBKDF2_ITERATIONS (210k)", () => {
    expect(PBKDF2_ITERATIONS).toBe(210000);
  });

  it("produit le format pbkdf2$210000$<salt b64url>$<hash b64url>", async () => {
    const stored = await hashPassword("whatever-123456");
    const parts = stored.split("$");
    expect(parts).toHaveLength(4);
    expect(parts[0]).toBe("pbkdf2");
    expect(parts[1]).toBe("210000");
    expect(parts[2]).toMatch(/^[A-Za-z0-9_-]{22}$/); // 16 bytes base64url
    expect(parts[3]).toMatch(/^[A-Za-z0-9_-]{43}$/); // 32 bytes base64url
  });

  it("brûle un hash factice au nombre d'itérations courant (210k)", async () => {
    // Le hash factice des emails inconnus suit le format complet et l'indice
    // d'itérations actuel : le temps de réponse ne fuit ni l'existence du
    // compte ni le niveau de durcissement. verifyPassword lit l'itération
    // stockée dans le hash, donc rétrocompatible avec les anciens comptes.
    const parts = DUMMY_HASH.split("$");
    expect(parts).toHaveLength(4);
    expect(parts[0]).toBe("pbkdf2");
    expect(parts[1]).toBe(String(PBKDF2_ITERATIONS));
    expect(parts[1]).toBe("210000");
    expect(parts[2]).toMatch(/^[A-Za-z0-9_-]{22}$/); // 16 bytes base64url
    expect(parts[3]).toMatch(/^[A-Za-z0-9_-]{43}$/); // 32 bytes base64url
    expect(await verifyPassword("whatever-password", DUMMY_HASH)).toBe(false);
  });

  it("rétrocompatible : vérifie un hash 120k forgé à la main", async () => {
    const legacy = await craftHash("legacy-account-password", 120000);
    expect(legacy).toMatch(/^pbkdf2\$120000\$/);
    expect(await verifyPassword("legacy-account-password", legacy)).toBe(true);
    expect(await verifyPassword("not-the-legacy-password", legacy)).toBe(false);
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

describe("isCommonPassword", () => {
  it("rejette les mots de passe du dictionnaire embarqué (insensible à la casse)", () => {
    expect(isCommonPassword("password")).toBe(true);
    expect(isCommonPassword("Password1")).toBe(true);
    expect(isCommonPassword("motdepasse")).toBe(true);
    expect(isCommonPassword("MOTDEPASSE123")).toBe(true);
    expect(isCommonPassword("azerty123")).toBe(true);
    expect(isCommonPassword("marseille")).toBe(true);
    expect(isCommonPassword("loulou")).toBe(true);
    expect(isCommonPassword("iloveyou")).toBe(true);
    expect(isCommonPassword("qsdfghjklm")).toBe(true);
  });

  it("rejette les suites numériques et les répétitions", () => {
    expect(isCommonPassword("1234567890")).toBe(true);
    expect(isCommonPassword("0123456789")).toBe(true);
    expect(isCommonPassword("9876543210")).toBe(true);
    expect(isCommonPassword("4567890123")).toBe(true);
    expect(isCommonPassword("1111111111")).toBe(true);
    expect(isCommonPassword("aaaaaaaaaa")).toBe(true);
  });

  it("accepte les mots de passe robustes", () => {
    expect(isCommonPassword("correct horse battery staple")).toBe(false);
    expect(isCommonPassword("Tr0ub4dor&3")).toBe(false);
    expect(isCommonPassword("X7#kQp2!vR9z")).toBe(false);
    expect(isCommonPassword("8472910375")).toBe(false); // chiffres non séquentiels
  });
});
