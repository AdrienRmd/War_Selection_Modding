import type { Metadata } from "next";
import { LocaleProvider } from "@/components/i18n";
import { UpdateBanner } from "@/components/update-banner";
import { pageMetadata, requestLocale } from "@/lib/page-metadata";
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
// SEO 08/11 : la racine passe par pageMetadata("home") → title ciblé
// « War Selection — … » + canonical/og:url/og:locale.
export async function generateMetadata(): Promise<Metadata> {
  const meta = await pageMetadata("home");
  return {
    ...meta,
    icons: {
      icon: [
        { url: "/atlas-emblem-192.png", type: "image/png", sizes: "192x192" },
        { url: "/favicon.svg", type: "image/svg+xml" },
      ],
      shortcut: "/favicon.svg",
      apple: "/atlas-emblem-192.png",
    },
    openGraph: {
      // SEO 08/11 : pageMetadata fournit title/description/url/locale/images
      // localisés — le layout ne garde que les champs de site.
      ...meta.openGraph,
      siteName: "WS ATLAS",
      type: "website",
    },
    twitter: { card: "summary_large_image" },
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
        <LocaleProvider initial={locale}>
          {children}
          {/* HOTFIX 31/10 : bandeau « nouvelle version disponible » — monté
              dans le layout racine donc présent sur toutes les pages. */}
          <UpdateBanner />
        </LocaleProvider>
      </body>
    </html>
  );
}
