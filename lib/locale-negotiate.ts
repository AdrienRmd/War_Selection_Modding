import type { Locale } from "./i18n";

// D2 (décision orchestrée) : le français est la langue par défaut du site.
// Sans cookie atlas_locale, la locale affichée se négocie depuis l'en-tête
// Accept-Language du navigateur : première langue soutenue dans l'ordre des
// q-values (fr* → fr, en* → en, zh*/cn → zh), sinon fr.
export const DEFAULT_LOCALE: Locale = "fr";

/** Mappe un tag de langue (« fr-CA », « zh-Hant-TW », « cn ») à une locale. */
export function tagToLocale(tag: string): Locale | undefined {
  const primary = tag.trim().toLowerCase().split(/[-_]/)[0];
  if (primary === "fr") return "fr";
  if (primary === "en") return "en";
  if (primary === "zh" || primary === "cn") return "zh";
  return undefined;
}

interface LanguageEntry {
  tag: string;
  quality: number;
}

/** Découpe « fr-CH, fr;q=0.9, en;q=0.8 » en entrées triées par q décroissante. */
function parseAcceptLanguage(header: string): LanguageEntry[] {
  return header
    .split(",")
    .map((part) => {
      const [rawTag, ...params] = part.trim().split(";");
      let quality = 1;
      for (const param of params) {
        const match = /^\s*q\s*=\s*([0-9.]+)\s*$/i.exec(param);
        if (match) {
          const parsed = Number.parseFloat(match[1]);
          quality = Number.isFinite(parsed) ? parsed : 0;
        }
      }
      return { tag: (rawTag ?? "").trim(), quality };
    })
    .filter((entry) => entry.tag !== "" && entry.tag !== "*" && entry.quality > 0)
    .sort((a, b) => b.quality - a.quality);
}

/**
 * Négocie la locale d'affichage depuis l'en-tête Accept-Language.
 * Première langue soutenue (par ordre de préférence q) gagne ; aucune
 * correspondance (en-tête absent, « * », langues non soutenues comme de-DE)
 * → fr, langue par défaut du site (D2).
 */
export function negotiateLocale(header: string | null | undefined): Locale {
  if (!header) return DEFAULT_LOCALE;
  for (const { tag } of parseAcceptLanguage(header)) {
    const locale = tagToLocale(tag);
    if (locale) return locale;
  }
  return DEFAULT_LOCALE;
}
