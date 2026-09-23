import { describe, expect, it } from "vitest";
import { safeReturnTo, validateSigninFields, validateSignupFields } from "@/components/auth/shared";

describe("validateSigninFields", () => {
  it("accepte un couple email + mot de passe valides", () => {
    expect(validateSigninFields({ email: "user@example.com", password: "mot-de-passe-1" })).toBe(
      undefined,
    );
  });

  it("exige un email non vide", () => {
    expect(validateSigninFields({ email: "", password: "x" })).toBe("请输入邮箱。");
  });

  it("rejette les emails invalides", () => {
    for (const email of ["user", "user@", "user@example", "user@example.", "user name@example.com"])
      expect(validateSigninFields({ email, password: "x" })).toBe("请输入有效的邮箱地址。");
  });

  it("borne la longueur de l'email à 254 caractères", () => {
    const ok = "a".repeat(242) + "@example.com";
    expect(ok).toHaveLength(254);
    expect(validateSigninFields({ email: ok, password: "x" })).toBe(undefined);
    const tooLong = "a".repeat(243) + "@example.com";
    expect(validateSigninFields({ email: tooLong, password: "x" })).toBe("请输入有效的邮箱地址。");
  });

  it("n'impose pas de minuscules côté client (le serveur normalise)", () => {
    expect(validateSigninFields({ email: "User@Example.COM", password: "x" })).toBe(undefined);
  });

  it("exige un mot de passe et le borne à 128 caractères", () => {
    expect(validateSigninFields({ email: "user@example.com", password: "" })).toBe("请输入密码。");
    expect(validateSigninFields({ email: "user@example.com", password: "a".repeat(129) })).toBe(
      "密码最多 128 个字符。",
    );
  });

  it("tolère un mot de passe court à la connexion (contrairement à l'inscription)", () => {
    expect(validateSigninFields({ email: "user@example.com", password: "a".repeat(128) })).toBe(
      undefined,
    );
    expect(validateSigninFields({ email: "user@example.com", password: "a" })).toBe(undefined);
  });
});

describe("validateSignupFields", () => {
  const base = { email: "user@example.com", password: "long-enough-pw", displayName: "Ada" };

  it("accepte des champs d'inscription valides", () => {
    expect(validateSignupFields(base)).toBe(undefined);
  });

  it("exige un mot de passe d'au moins 10 caractères", () => {
    expect(validateSignupFields({ ...base, password: "a".repeat(10) })).toBe(undefined);
    expect(validateSignupFields({ ...base, password: "a".repeat(9) })).toBe("密码至少 10 个字符。");
  });

  it("applique d'abord les règles communes (email avant mot de passe)", () => {
    expect(validateSignupFields({ ...base, email: "nope", password: "court" })).toBe(
      "请输入有效的邮箱地址。",
    );
  });

  it("exige un displayName non vide", () => {
    expect(validateSignupFields({ ...base, displayName: "" })).toBe("请输入显示名称。");
    expect(validateSignupFields({ ...base, displayName: undefined })).toBe("请输入显示名称。");
  });

  it("borne le displayName à 40 caractères", () => {
    expect(validateSignupFields({ ...base, displayName: "x".repeat(40) })).toBe(undefined);
    expect(validateSignupFields({ ...base, displayName: "x".repeat(41) })).toBe(
      "显示名称最多 40 个字符。",
    );
  });

  it("ne rogne pas les espaces du displayName côté client (le serveur trim via zod)", () => {
    expect(validateSignupFields({ ...base, displayName: "   " })).toBe(undefined);
  });
});

describe("safeReturnTo", () => {
  it("renvoie / pour une valeur absente ou vide", () => {
    expect(safeReturnTo(undefined)).toBe("/");
    expect(safeReturnTo("")).toBe("/");
  });

  it("renvoie / pour toute valeur qui ne commence pas par /", () => {
    expect(safeReturnTo("maps")).toBe("/");
    expect(safeReturnTo("https://evil.example/phish")).toBe("/");
    expect(safeReturnTo("\\\\evil.example")).toBe("/");
  });

  it("bloque les URLs protocol-relative //host", () => {
    expect(safeReturnTo("//evil.example")).toBe("/");
    expect(safeReturnTo("///triple")).toBe("/");
  });

  it("conserve un chemin interne avec query et fragment", () => {
    expect(safeReturnTo("/maps")).toBe("/maps");
    expect(safeReturnTo("/workbench/mods?tab=export#top")).toBe("/workbench/mods?tab=export#top");
  });

  it("bloque les chemins réservés à l'authentification", () => {
    for (const path of ["/signin", "/signup", "/signout", "/callback"])
      expect(safeReturnTo(path)).toBe("/");
  });

  it("bloque les chemins réservés même avec query ou fragment", () => {
    expect(safeReturnTo("/signin?next=/maps")).toBe("/");
    expect(safeReturnTo("/callback#done")).toBe("/");
  });

  it("conserve un path encodé inoffensif (pas de traversée d'origine possible)", () => {
    expect(safeReturnTo("/%2F%2Fevil.example")).toBe("/%2F%2Fevil.example");
  });

  it("conserve une query externe sur un path interne (l'origine reste la nôtre)", () => {
    expect(safeReturnTo("/nono?u=https://evil.example")).toBe("/nono?u=https://evil.example");
  });
});
