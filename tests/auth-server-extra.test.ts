import { describe, expect, it } from "vitest";
import {
  clearedSessionCookie,
  clientIp,
  emailAttemptKey,
  ipAttemptKey,
  isCommonPassword,
  readSessionToken,
  SESSION_TTL_SECONDS,
  sessionCookie,
  verifyPassword,
} from "@/lib/auth-server";

describe("clés de throttling et IP client", () => {
  it("normalise l'email en minuscules dans la clé de tentative", () => {
    expect(emailAttemptKey("User@Example.COM")).toBe("email:user@example.com");
    expect(emailAttemptKey("Éleen@Domaïne.fr")).toBe("email:éleen@domaïne.fr");
  });

  it("concatène l'IP sans la normaliser", () => {
    expect(ipAttemptKey("203.0.113.7")).toBe("ip:203.0.113.7");
    expect(ipAttemptKey("2001:db8:AbC::1")).toBe("ip:2001:db8:AbC::1");
  });

  it("clientIp garde le DERNIER maillon de X-Forwarded-For, sans espaces", () => {
    const req = new Request("http://x.test/", {
      headers: { "x-forwarded-for": " 203.0.113.7 , 70.41.3.18" },
    });
    // Le proxy de confiance réécrit le XFF ; le dernier maillon est le seul
    // ajouté par notre infrastructure, le premier peut être forgé.
    expect(clientIp(req)).toBe("70.41.3.18");
  });

  it("clientIp ignore une chaîne XFF multi-hops forgée par le client", () => {
    // Scénario d'attaque : le client s'attribue une IP arbitraire en tête de
    // chaîne ; seule la dernière (écrite par notre proxy) fait foi.
    const forged = new Request("http://x.test/", {
      headers: { "x-forwarded-for": "1.2.3.4, 10.0.0.1, 127.0.0.1, 198.51.100.23" },
    });
    expect(clientIp(forged)).toBe("198.51.100.23");
    const spoofedTrusted = new Request("http://x.test/", {
      headers: { "x-forwarded-for": "203.0.113.7, 70.41.3.18" },
    });
    expect(clientIp(spoofedTrusted)).toBe("70.41.3.18");
    expect(clientIp(new Request("http://x.test/"))).toBe("unknown");
  });

  it("clientIp plafonne le dernier maillon à 64 caractères", () => {
    const long = "2".repeat(100);
    const req = new Request("http://x.test/", { headers: { "x-forwarded-for": long } });
    expect(clientIp(req)).toHaveLength(64);
    expect(clientIp(req)).toBe(long.slice(0, 64));
    // Le plafond s'applique au dernier maillon, pas à la chaîne entière.
    const forged = new Request("http://x.test/", {
      headers: { "x-forwarded-for": `1.2.3.4, ${long}` },
    });
    expect(clientIp(forged)).toBe("2".repeat(64));
  });

  it("clientIp retombe sur « unknown » sans en-tête exploitable", () => {
    expect(clientIp(new Request("http://x.test/"))).toBe("unknown");
    const blank = new Request("http://x.test/", { headers: { "x-forwarded-for": "   " } });
    expect(clientIp(blank)).toBe("unknown");
  });
});

describe("isCommonPassword : cas limites", () => {
  it("détecte les entrées du dictionnaire quelle que soit la casse", () => {
    expect(isCommonPassword("PASSWORD")).toBe(true);
    expect(isCommonPassword("Password1234")).toBe(true);
    expect(isCommonPassword("AZERTYUIOP")).toBe(true);
    expect(isCommonPassword("LouLoute")).toBe(true);
  });

  it("ne normalise pas les accents (contrat : liste exacte, casse seule ignorée)", () => {
    expect(isCommonPassword("motdepassé")).toBe(false);
    expect(isCommonPassword("MOTDEPASSÉ")).toBe(false);
    expect(isCommonPassword("m0tdepasse")).toBe(false);
  });

  it("compare le mot de passe entier, jamais une sous-chaîne", () => {
    expect(isCommonPassword("password12345678")).toBe(false);
    expect(isCommonPassword("motdepasseux")).toBe(false);
    expect(isCommonPassword("x-password-x")).toBe(false);
  });

  it("détecte les répétitions d'un même caractère dès deux occurrences", () => {
    expect(isCommonPassword("xx")).toBe(true);
    expect(isCommonPassword("7777777777")).toBe(true);
    expect(isCommonPassword("AAAAAAAAAA")).toBe(true);
    expect(isCommonPassword("z")).toBe(false);
  });

  it("détecte les suites numériques monotones, y compris en bouclage", () => {
    expect(isCommonPassword("0123")).toBe(true);
    expect(isCommonPassword("8901234567")).toBe(true);
    expect(isCommonPassword("1098765432")).toBe(true);
  });

  it("laisse passer les chiffres non monotones ou trop courts", () => {
    expect(isCommonPassword("123")).toBe(false);
    expect(isCommonPassword("13579")).toBe(false);
    expect(isCommonPassword("2468")).toBe(false);
    expect(isCommonPassword("1234abcd")).toBe(false);
  });
});

describe("verifyPassword : garde-fous supplémentaires", () => {
  const b64url = (bytes: Uint8Array): string => {
    let raw = "";
    for (const b of bytes) raw += String.fromCharCode(b);
    return btoa(raw).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  };

  it("rejette un compteur d'itérations hors bornes (0 ou > 10M)", async () => {
    expect(await verifyPassword("x-not-important-1", "pbkdf2$0$aaa$bbb")).toBe(false);
    expect(await verifyPassword("x-not-important-2", "pbkdf2$10000001$aaa$bbb")).toBe(false);
  });

  it("rejette un sel vide ou un hash de longueur inattendue", async () => {
    expect(await verifyPassword("x-not-important-3", "pbkdf2$210000$$c2hvcnQ=")).toBe(false);
    const salt = new Uint8Array(new ArrayBuffer(16));
    crypto.getRandomValues(salt);
    const truncated = `pbkdf2$210000$${b64url(salt)}$${b64url(new Uint8Array(new ArrayBuffer(8)))}`;
    expect(await verifyPassword("x-not-important-4", truncated)).toBe(false);
  });

  it("vérifie un hash à une seule itération (borne basse acceptée)", async () => {
    const salt = new Uint8Array(new ArrayBuffer(16));
    crypto.getRandomValues(salt);
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode("weak-but-valid"),
      "PBKDF2",
      false,
      ["deriveBits"],
    );
    const bits = await crypto.subtle.deriveBits(
      { name: "PBKDF2", hash: "SHA-256", salt, iterations: 1 },
      key,
      256,
    );
    const stored = `pbkdf2$1$${b64url(salt)}$${b64url(new Uint8Array(bits))}`;
    expect(await verifyPassword("weak-but-valid", stored)).toBe(true);
    expect(await verifyPassword("weak-but-invalid", stored)).toBe(false);
  });
});

describe("cookies de session", () => {
  it("SESSION_TTL_SECONDS vaut 30 jours", () => {
    expect(SESSION_TTL_SECONDS).toBe(2592000);
  });

  it("sessionCookie produit l'attribut exact, Secure seulement en HTTPS", () => {
    expect(sessionCookie("tok", false)).toBe(
      "atlas_session=tok; Path=/; Max-Age=2592000; HttpOnly; SameSite=Lax",
    );
    expect(sessionCookie("tok", true)).toBe(
      "atlas_session=tok; Path=/; Max-Age=2592000; HttpOnly; SameSite=Lax; Secure",
    );
  });

  it("clearedSessionCookie expire le cookie immédiatement", () => {
    expect(clearedSessionCookie(false)).toBe(
      "atlas_session=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax",
    );
    expect(clearedSessionCookie(true)).toBe(
      "atlas_session=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax; Secure",
    );
  });

  it("readSessionToken isole la valeur du cookie de session", () => {
    const req = new Request("http://x.test/", {
      headers: { cookie: "a=1; atlas_session=tok123 ; b=2" },
    });
    expect(readSessionToken(req)).toBe("tok123");
    expect(readSessionToken(new Request("http://x.test/"))).toBeNull();
    const noCookie = new Request("http://x.test/", { headers: { cookie: "other=x" } });
    expect(readSessionToken(noCookie)).toBeNull();
    const empty = new Request("http://x.test/", { headers: { cookie: "atlas_session=" } });
    expect(readSessionToken(empty)).toBeNull();
  });
});
