import type { CollectedMap } from "@/lib/collection";
import type { Locale } from "@/lib/i18n";
import dict from "./collection-i18n.json";

/** Dictionnaire trilingue des fiches cartes (chantier 4c, finitions 01/11).
 *  Généré par scripts/gen-collection-i18n.mjs depuis les relevés d'origine :
 *   - `fr` : traduction française (noms propres universels conservés) ;
 *   - `en` : CORRECTIONS uniquement — titres EN qui n'étaient pas de l'anglais
 *     (titres zh/ru/pl) et nettoyage public des mentions « unconfirmed »
 *     (association de code douteuse) ; les réserves factuelles des notes
 *     (« player count unconfirmed ») restent affichées — elles sont honnêtes.
 *  Les données sources (lib/collection.ts) ne sont JAMAIS modifiées : le
 *  dictionnaire ne sert qu'au rendu public ; l'édition admin voit les champs
 *  bruts. Repli : langue d'origine si l'entrée manque.
 */
type MapI18nEntry = {
  en?: { name?: string; note?: string };
  fr?: { name?: string; note?: string };
};
const entries = dict as Record<string, MapI18nEntry>;
const entry = (id: string) => entries[id];

/** Défaut propre pour une fiche sans nom : « Carte map-xxx » localisé. */
export function defaultMapName(locale: Locale, map_code: string): string {
  return locale === "zh" ? `地图 ${map_code}` : locale === "fr" ? `Carte ${map_code}` : `Map ${map_code}`;
}

/** Nom public de la fiche dans la locale : dictionnaire → données → défaut. */
export function mapName(m: CollectedMap, locale: Locale): string {
  const e = entry(m.id);
  if (locale === "zh") return m.title || defaultMapName(locale, m.map_code);
  if (locale === "fr") {
    return e?.fr?.name ?? englishName(m) ?? defaultMapName(locale, m.map_code);
  }
  return englishName(m) ?? defaultMapName(locale, m.map_code);
}

/** Nom anglais public : correction du dictionnaire, sinon données (title_en
 *  puis title — certains title_en contiennent du chinois : repli propre),
 *  sinon null (le défaut localisé prendra le relais). Les champs vides
 *  comptent comme absents. */
function englishName(m: CollectedMap): string | null {
  const e = entry(m.id);
  return e?.en?.name || m.title_en || m.title || null;
}

/** Note courte publique (résumé de carte) : dictionnaire → données
 *  (summary_en puis summary) → null (l'appelant garde son repli existant).
 *  Les champs vides comptent comme absents. */
export function mapNote(m: CollectedMap, locale: Locale): string | null {
  const e = entry(m.id);
  if (locale === "zh") return m.summary || null;
  if (locale === "fr") return e?.fr?.note || m.summary_en || m.summary || null;
  return e?.en?.note || m.summary_en || m.summary || null;
}

/** Texte de recherche additionnel par fiche : les champs FR du dictionnaire
 *  (nom + note) et les corrections EN — la recherche de collected-maps doit
 *  matcher zh/en/fr indifféremment. */
export function mapSearchExtra(m: CollectedMap): string {
  const e = entry(m.id);
  return [e?.fr?.name, e?.fr?.note, e?.en?.name, e?.en?.note].filter(Boolean).join(" ");
}

export const collectionI18nSize = Object.keys(entries).length;
