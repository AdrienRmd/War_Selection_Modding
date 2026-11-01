import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { UpdateBanner } from "@/components/update-banner";
import { translate } from "@/lib/i18n";
import { CHECK_INTERVAL_MS, isNewerBuild, readBuildId, shouldCheckNow } from "@/lib/version-check";

// HOTFIX 31/10/2026 — détecteur « nouvelle version disponible ».
// La logique de détection vit dans lib/version-check.ts (pure, testée ici) ;
// le composant components/update-banner.tsx ne fait que l'exploiter. Le
// comportement bout-en-bout (bandeau affiché après changement de buildId
// servi, rechargement au clic) est couvert par scripts/test-update-banner-e2e.mjs
// contre un build réel avec /version.json mocké.

describe("lib/version-check — lecture du buildId servi", () => {
  it("extrait un buildId valide", () => {
    expect(readBuildId({ buildId: "2acbbc1b-f613-4725-b711-9e4043f84f1a" })).toBe(
      "2acbbc1b-f613-4725-b711-9e4043f84f1a",
    );
  });

  it("rejette les payloads malformés sans lever", () => {
    expect(readBuildId(null)).toBeNull();
    expect(readBuildId(undefined)).toBeNull();
    expect(readBuildId({})).toBeNull();
    expect(readBuildId({ buildId: 42 })).toBeNull();
    expect(readBuildId({ buildId: "" })).toBeNull();
    expect(readBuildId({ buildId: "   " })).toBeNull();
  });
});

describe("lib/version-check — comparaison baseline / frais", () => {
  it("signale un buildId différent du relevé de référence", () => {
    expect(isNewerBuild("build-ancien", "build-nouveau")).toBe(true);
  });

  it("ignore l'identité et l'absence de référence", () => {
    // Même buildId → rien à proposer (pas de boucle de bandeau après reload).
    expect(isNewerBuild("build-x", "build-x")).toBe(false);
    // Pas encore de relevé de référence (premier chargement, hors-ligne…) →
    // jamais de bandeau sur un simple échec de premier relevé.
    expect(isNewerBuild(null, "build-nouveau")).toBe(false);
    // Relevé frais inexploitable → silence.
    expect(isNewerBuild("build-ancien", null)).toBe(false);
    expect(isNewerBuild(null, null)).toBe(false);
  });
});

describe("lib/version-check — déclencheurs", () => {
  it("ne contrôle que l'onglet visible", () => {
    expect(shouldCheckNow("visible")).toBe(true);
    expect(shouldCheckNow("hidden")).toBe(false);
    expect(shouldCheckNow(undefined)).toBe(false);
  });

  it("contrôle périodiquement toutes les 15 minutes", () => {
    expect(CHECK_INTERVAL_MS).toBe(15 * 60 * 1000);
  });
});

describe("components/update-banner — i18n FR/EN/ZH", () => {
  it("traduit le message et le bouton dans les trois locales du site", () => {
    // Locale fr (défaut du site).
    expect(translate("有新版本可用。", "fr")).toBe("Une nouvelle version est disponible");
    expect(translate("重新加载", "fr")).toBe("Recharger");
    // Locale en.
    expect(translate("有新版本可用。", "en")).toBe("A new version is available");
    expect(translate("重新加载", "en")).toBe("Reload");
    // Locale zh : la clé canonique est le texte affiché.
    expect(translate("有新版本可用。", "zh")).toBe("有新版本可用。");
    expect(translate("重新加载", "zh")).toBe("重新加载");
  });
});

describe("components/update-banner — rendu initial", () => {
  it("ne rend rien côté serveur (pas de flash, pas d'hydratation divergente)", () => {
    expect(renderToString(createElement(UpdateBanner))).toBe("");
  });
});
