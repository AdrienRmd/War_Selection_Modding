import { AtlasHeader, AtlasFooter } from "@/components/atlas-shell";
import type { Metadata } from "next";
import { pageMetadata, requestLocale } from "@/lib/page-metadata";
import { PlayerProfileView } from "@/components/replay/player-profile";
import { playerProfile } from "@/lib/player-profile";
import "../../wsva.css"; // Design-system wsva scopé .rp (profil joueur, V3 01/11)

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ name: string }>;
}): Promise<Metadata> {
  const { name } = await params;
  const trimmed = decodeURIComponent(name).slice(0, 40);
  return {
    ...pageMetadata("players"),
    title: `${trimmed} | WS ATLAS`,
    robots: { index: false, follow: true }, // V4 : autorisé quand la page a des données
  };
}

/** Page /player/[name] — profil joueur complet « façon wsva » (V3).
 *  Données : registre replay_player_games (migration 0013). Joueur inconnu →
 *  état vide gracieux (« aucun replay publié »). */
export default async function PlayerPage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const { name } = await params;
  const locale = await requestLocale();
  const profile = await playerProfile(decodeURIComponent(name), locale);
  return (
    <>
      <AtlasHeader />
      <main className="shell replay-page">
        <PlayerProfileView profile={profile} />
      </main>
      <AtlasFooter />
    </>
  );
}
