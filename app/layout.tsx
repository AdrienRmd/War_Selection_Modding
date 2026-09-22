import type { Metadata } from "next";
import {cookies} from "next/headers";
import {LocaleProvider} from "@/components/i18n";
import "./globals.css";
import "./atlas.css";
import "./command.css";
import "./community.css";
import "./collection.css";
import "./workbench.css";

export const metadata: Metadata = {
  title: "WS ATLAS · 战场档案",
  description: "War Selection 玩家地图与 Mod 社区档案。探索斯大林格勒战场，查阅配置、平衡数值与审核后的社区地图。",
  icons: {
    icon: "/atlas-emblem-v4.png",
    shortcut: "/atlas-emblem-v4.png",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale=(await cookies()).get('atlas_locale')?.value==='en'?'en':'zh';
  return (
    <html lang={locale==='en'?'en':'zh-CN'}>
      <body className="antialiased"><LocaleProvider initial={locale}>{children}</LocaleProvider></body>
    </html>
  );
}
