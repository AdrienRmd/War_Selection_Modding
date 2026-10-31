import type { Metadata } from "next";
import { LocaleProvider } from "@/components/i18n";
import { requestLocale } from "@/lib/page-metadata";
import { localizePageMeta, pageRoutes } from "@/lib/page-titles";
import "./globals.css";
import "./atlas.css";
import "./command.css";
import "./community.css";
import "./collection.css";
import "./units.css";
import "./researches.css";
import "./replay.css";
import "./modding.css";
import "./workbench.css";
import "./simple.css";

// Title/description localisés (cookie > Accept-Language > fr, voir
// lib/page-metadata) pour l'accueil et toutes les pages sans metadata propre.
export async function generateMetadata(): Promise<Metadata> {
  const meta = localizePageMeta(pageRoutes.home.meta, await requestLocale());
  return {
    ...meta,
    icons: {
      icon: "/atlas-emblem-v4.png",
      shortcut: "/atlas-emblem-v4.png",
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Priorité D2 : cookie atlas_locale > en-tête Accept-Language > fr.
  const locale = await requestLocale();
  return (
    <html lang={locale === "zh" ? "zh-CN" : locale}>
      <body className="antialiased">
        <LocaleProvider initial={locale}>{children}</LocaleProvider>
      </body>
    </html>
  );
}
