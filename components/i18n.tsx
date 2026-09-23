"use client";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { Languages } from "lucide-react";
import { translate, type Locale } from "@/lib/i18n";
const htmlLang: Record<Locale, string> = { zh: "zh-CN", en: "en", fr: "fr" };
const Context = createContext<{ locale: Locale; setLocale: (l: Locale) => void }>({
  locale: "zh",
  setLocale: () => {},
});
export function LocaleProvider({ initial, children }: { initial: Locale; children: ReactNode }) {
  const [locale, setLocale] = useState(initial);
  useEffect(() => {
    document.documentElement.lang = htmlLang[locale];
    document.cookie = `atlas_locale=${locale}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
  }, [locale]);
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
