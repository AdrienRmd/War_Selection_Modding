import type { Metadata } from "next";
import { AtlasHeader, AtlasFooter } from "@/components/atlas-shell";
import { LegalDocViewer } from "@/components/legal/legal-doc-viewer";
import { pageMetadata } from "@/lib/page-metadata";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("privacy");
}

export default function PrivacyPage() {
  return (
    <>
      <AtlasHeader />
      <main className="shell">
        <LegalDocViewer docKey="privacy" />
      </main>
      <AtlasFooter />
    </>
  );
}
