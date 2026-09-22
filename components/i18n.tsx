"use client";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
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
  return { locale, setLocale, t: (s: string) => translate(s, locale) };
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
  const { locale, setLocale } = useI18n();
  return (
    <div className="language-bar">
      <div className="language-control" aria-label="Language / 语言">
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
