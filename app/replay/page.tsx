import { identity } from "@/lib/atlas-server";
import type { Metadata } from "next";
import { pageMetadata } from "@/lib/page-metadata";
import { AtlasHeader, AtlasFooter } from "@/components/atlas-shell";
import { ReplayPortal } from "@/components/replay/replay-portal";
import "../wsva.css"; // Design-system wsva scopé .rp (page résultat, V2 01/11)

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("replay");
}

/** Page /replay — portail « façon wsva » : accueil éditorial (titre, code,
 *  aide, replays récemment soumis) puis page résultat complète. Le thème
 *  clair est scopé à main.replay-page (replay.css), le reste du site ATLAS
 *  reste inchangé. */
export default async function Replay({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const params = await searchParams;
  const initialCode = typeof params.code === "string" ? params.code.slice(0, 20) : "";
  const { user } = await identity();
  return (
    <>
      <AtlasHeader />
      <main className="shell replay-page">
        <ReplayPortal initialCode={initialCode} signedIn={!!user} />
      </main>
      <AtlasFooter />
    </>
  );
}
