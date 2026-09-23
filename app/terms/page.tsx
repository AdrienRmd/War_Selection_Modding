import type { Metadata } from "next";
import { cookies } from "next/headers";
import { AtlasHeader, AtlasFooter } from "@/components/atlas-shell";
import { LegalDocViewer } from "@/components/legal/legal-doc-viewer";
import { translate, type Locale } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const stored = (await cookies()).get("atlas_locale")?.value;
  const locale: Locale = stored === "en" || stored === "fr" ? stored : "zh";
  return { title: translate("使用条款 — WS ATLAS", locale) };
}

export default function TermsPage() {
  return (
    <>
      <AtlasHeader />
      <main className="shell">
        <LegalDocViewer docKey="terms" />
      </main>
      <AtlasFooter />
    </>
  );
}
