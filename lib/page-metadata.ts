import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { resolveDisplayLocale } from "./locale-negotiate";
import { localizePageMeta, pageRoutes } from "./page-titles";
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

/** Metadata Next localisée pour une page du registre lib/page-titles. */
export async function pageMetadata(key: keyof typeof pageRoutes): Promise<Metadata> {
  const locale = await requestLocale();
  return localizePageMeta(pageRoutes[key].meta, locale);
}
