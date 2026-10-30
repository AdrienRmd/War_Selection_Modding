import { describe, expect, it } from "vitest";
import { resolveDisplayLocale } from "@/lib/locale-negotiate";

// SB2 : la préférence de langue du compte s'applique sur un NOUVEL appareil
// (pas de cookie), le cookie device prime toujours sur l'appareil courant, et
// le comportement sans préférence reste strictement la négociation
// Accept-Language existante (locale-negotiate.test.ts).

describe("resolveDisplayLocale — priorités cookie > compte > négociation", () => {
  it("nouvel appareil sans cookie : la préférence du compte s'applique", () => {
    expect(
      resolveDisplayLocale({ cookie: null, accountLocale: "zh", acceptLanguage: "fr-FR,fr;q=0.9" }),
    ).toBe("zh");
    expect(
      resolveDisplayLocale({ cookie: undefined, accountLocale: "en", acceptLanguage: "fr" }),
    ).toBe("en");
  });

  it("appareil courant : le cookie device prime sur la préférence du compte", () => {
    expect(resolveDisplayLocale({ cookie: "fr", accountLocale: "zh" })).toBe("fr");
    expect(resolveDisplayLocale({ cookie: "en", accountLocale: "fr" })).toBe("en");
  });

  it("sans préférence de compte : négociation Accept-Language inchangée", () => {
    expect(resolveDisplayLocale({ cookie: null, accountLocale: null, acceptLanguage: "en-US,en;q=0.9" })).toBe("en");
    expect(resolveDisplayLocale({ cookie: null, accountLocale: null, acceptLanguage: "de-DE,de;q=0.9" })).toBe("fr");
    expect(resolveDisplayLocale({ cookie: null, accountLocale: null, acceptLanguage: null })).toBe("fr");
  });

  it("cookie ou préférence invalide : ignorés (pas de crash, repli négociation)", () => {
    expect(resolveDisplayLocale({ cookie: "de", accountLocale: "zz", acceptLanguage: "zh-CN,zh;q=0.9" })).toBe("zh");
    expect(resolveDisplayLocale({ cookie: "", accountLocale: "", acceptLanguage: null })).toBe("fr");
  });
});
