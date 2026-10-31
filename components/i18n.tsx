"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { Languages } from "lucide-react";
import { usePathname } from "next/navigation";
import { translate, type Locale } from "@/lib/i18n";
import { localizePageMeta, resolvePageMeta } from "@/lib/page-titles";
const htmlLang: Record<Locale, string> = { zh: "zh-CN", en: "en", fr: "fr" };
const Context = createContext<{ locale: Locale; setLocale: (l: Locale) => void }>({
  locale: "zh",
  setLocale: () => {},
});
// SB2 : resauvegarde la préférence sur le compte (si session active) après
// chaque choix explicite — « dernier choix gagne ». Fire-and-forget : un
// visiteur anonyme reçoit un 401 silencieux, la locale device reste le
// mécanisme premier. Le même endpoint sert le sélecteur de /account.
//
// V3-P2 #7 : ce PATCH partage le budget profil (10/min/compte, cf.
// PROFILE_PATCH_BUDGET) — un clic rapide sur le sélecteur ne doit pas
// l'épuiser (l'utilisateur se verrait alors refuser l'édition de profil
// pendant 60 s). D'où, sans nouvelle surface d'API :
//   - débounce court : une rafale de changements = UN seul PATCH (le
//     dernier choix, éventuellement envoyé avec keepalive) ;
//   - doublon ignoré : re-choisir la locale déjà envoyée ne re-PATCH pas ;
//   - grâce au 429 : plus aucune tentative tant que la fenêtre du throttle
//     n'est pas passée (le cookie atlas_locale, prioritaire côté serveur,
//     porte déjà le choix de cet appareil).
const SAVE_LOCALE_DEBOUNCE_MS = 1500;
let pendingLocale: Locale | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let lastSent: Locale | null = null;
let skipUntil = 0;

function flushLocalePreference() {
  saveTimer = null;
  const locale = pendingLocale;
  pendingLocale = null;
  if (!locale || locale === lastSent || Date.now() < skipUntil) return;
  lastSent = locale;
  void fetch("/api/account/profile", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ locale }),
    keepalive: true,
  })
    .then((res) => {
      if (res.status === 429) {
        const retry = Number.parseInt(res.headers.get("Retry-After") ?? "", 10);
        skipUntil = Date.now() + (retry > 0 ? retry : 60) * 1000;
        lastSent = null; // non enregistré : resauvegardable après la fenêtre
      }
    })
    .catch(() => undefined);
}

export function saveLocalePreference(locale: Locale) {
  pendingLocale = locale;
  if (saveTimer !== null) return;
  saveTimer = setTimeout(flushLocalePreference, SAVE_LOCALE_DEBOUNCE_MS);
}
export function LocaleProvider({ initial, children }: { initial: Locale; children: ReactNode }) {
  const [locale, setLocaleState] = useState(initial);
  const pathname = usePathname();
  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    saveLocalePreference(l);
  }, []);
  useEffect(() => {
    document.documentElement.lang = htmlLang[locale];
    document.cookie = `atlas_locale=${locale}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
    // <title> / meta description sont rendus côté serveur dans la locale de
    // la requête : après un changement de langue (ou de route) côté client,
    // on resynchronise via le registre partagé lib/page-titles. Route
    // absente du registre → on laisse le titre posé par Next.
    const meta = resolvePageMeta(pathname);
    if (meta) {
      const localized = localizePageMeta(meta, locale);
      document.title = localized.title;
      if (localized.description) {
        document
          .querySelector('meta[name="description"]')
          ?.setAttribute("content", localized.description);
      }
    }
  }, [locale, pathname]);
  return <Context.Provider value={{ locale, setLocale }}>{children}</Context.Provider>;
}
export function useI18n() {
  const { locale, setLocale } = useContext(Context);
  const t = useCallback((s: string) => translate(s, locale), [locale]);
  return { locale, setLocale, t };
}
// Bilingual helper for UI strings authored as (zh, en) pairs. zh keeps the
// source text, en keeps the English literal, and fr resolves through the
// dictionary: first the zh key, then the English text as key, else English.
// Memoized so the helper is a stable effect dependency.
export function useBilingual() {
  const { locale, t } = useI18n();
  return useCallback(
    (zh: string, en: string): string => {
      if (locale === "zh") return zh;
      if (locale === "en") return en;
      const direct = translate(zh, locale);
      return direct === zh || direct === en ? t(en) : direct;
    },
    [locale, t],
  );
}
export function T({ text }: { text: ReactNode }) {
  const { locale } = useContext(Context);
  return typeof text === "string" ? translate(text, locale) : text;
}
export function Bilingual({ zh, en }: { zh: string; en?: string }) {
  const { locale, t } = useI18n();
  return locale !== "zh" && en ? en : t(zh);
}
export function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n();
  return (
    <div className="language-bar">
      <div className="language-control" aria-label={t("Language / 语言")}>
        <Languages size={14} />
        <button
          type="button"
          aria-pressed={locale === "zh"}
          lang="zh-CN"
          onClick={() => setLocale("zh")}
        >
          中文
        </button>
        <span aria-hidden="true">/</span>
        <button
          type="button"
          aria-pressed={locale === "en"}
          lang="en"
          onClick={() => setLocale("en")}
        >
          ENGLISH
        </button>
        <span aria-hidden="true">/</span>
        <button
          type="button"
          aria-pressed={locale === "fr"}
          lang="fr"
          onClick={() => setLocale("fr")}
        >
          FRANÇAIS
        </button>
      </div>
      <span className="language-caption">WAR SELECTION · MAPS & MODS</span>
    </div>
  );
}
