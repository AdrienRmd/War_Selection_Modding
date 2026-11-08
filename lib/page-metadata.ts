import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { resolveDisplayLocale } from "./locale-negotiate";
import { localizePageMeta, pageRoutes } from "./page-titles";

export const SITE_ORIGIN = "https://ws.aremond.ovh";
import type { Locale } from "./i18n";

/**
 * Locale d'affichage de la requête (serveur) — priorité SB2 :
 * cookie atlas_locale > préférence du compte connecté (nouvel appareil) >
 * Accept-Language > fr. Le mécanisme zh-source des clés internes n'est pas
 * concerné : seule la locale d'affichage est négociée. La session n'est
 * consultée QUE si le cookie est absent : sur l'appareil courant le cookie
 * prime et aucune requête D1 supplémentaire n'est faite.
 */
export async function requestLocale(): Promise<Locale> {
  const jar = await cookies();
  const stored = jar.get("atlas_locale")?.value;
  if (stored === "en" || stored === "fr" || stored === "zh") return stored;
  if (jar.get("atlas_session")?.value) {
    const { getSessionUser } = await import("./auth-server");
    const user = await getSessionUser();
    if (user?.locale) return resolveDisplayLocale({ accountLocale: user.locale });
  }
  return resolveDisplayLocale({ acceptLanguage: (await headers()).get("accept-language") });
}

/** Metadata Next localisée pour une page du registre lib/page-titles.
 *  SEO (mission 08/11, quick wins de l'audit 01/11) : chaque page publique
 *  porte son canonical absolu, og:url et og:locale — la locale étant
 *  négociée par cookie sur une MÊME URL (pas de variantes hreflang
 *  possibles, cf. audit §1.3), le canonical pointe l'URL canonique unique.
 *  `canonicalPath` surcharge le chemin pour les pages dynamiques
 *  (ex. /createurs/<id>), sinon la clé du registre désigne la page. */
export async function pageMetadata(
  key: keyof typeof pageRoutes,
  canonicalPath?: string,
): Promise<Metadata> {
  const locale = await requestLocale();
  const meta = localizePageMeta(pageRoutes[key].meta, locale);
  const canonical =
    SITE_ORIGIN + (canonicalPath ?? pageRoutes[key].canonical ?? "");
  // Image OG partagée (générée par scripts/optimize-public-images.mjs) : les
  // pages enfants qui définissent leur propre metadata héritent quand même
  // du openGraph du layout racine, on l'explicite ici pour toutes les routes.
  return {
    ...meta,
    alternates: { canonical },
    openGraph: {
      title: meta.title,
      description: meta.description,
      url: canonical,
      locale: locale === "zh" ? "zh_CN" : locale === "en" ? "en_US" : "fr_FR",
      images: [{ url: "/og-cover.jpg", width: 1200, height: 630, alt: "WS ATLAS" }],
    },
  };
}
