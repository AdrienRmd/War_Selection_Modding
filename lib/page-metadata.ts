import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { negotiateLocale } from "./locale-negotiate";
import { localizePageMeta, pageRoutes } from "./page-titles";
import type { Locale } from "./i18n";

/**
 * Locale d'affichage de la requête (serveur) — priorité D2 :
 * cookie atlas_locale > en-tête Accept-Language (fr → fr, zh-CN/cn → zh,
 * en → en) > fr (langue par défaut du site). Le mécanisme zh-source des
 * clés internes n'est pas concerné : seule la locale d'affichage est
 * négociée.
 */
export async function requestLocale(): Promise<Locale> {
  const stored = (await cookies()).get("atlas_locale")?.value;
  if (stored === "en" || stored === "fr" || stored === "zh") return stored;
  return negotiateLocale((await headers()).get("accept-language"));
}

/** Metadata Next localisée pour une page du registre lib/page-titles. */
export async function pageMetadata(key: keyof typeof pageRoutes): Promise<Metadata> {
  const locale = await requestLocale();
  return localizePageMeta(pageRoutes[key].meta, locale);
}
