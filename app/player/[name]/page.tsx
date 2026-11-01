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
  const locale = await requestLocale();
  const trimmed = decodeURIComponent(name).slice(0, 40);
  const base = await pageMetadata("players");
  // OG riche quand le profil existe (points/parties), discret sinon — et
  // indexation réservée aux profils avec données (V4).
  const profile = await playerProfile(trimmed, locale);
  if (!profile.found) {
    return {
      ...base,
      title: `${trimmed} | WS ATLAS`,
      robots: { index: false, follow: true },
    };
  }
  const view = profile.views.find((v) => v.key === "all") ?? profile.views[0];
  return {
    ...base,
    title: `${trimmed} · ${view.points} pts | WS ATLAS`,
    description: `${trimmed} — ${view.games} games, ${view.winRatePct}% win rate, ${view.points} points, median impact ${view.medianImpactPct ?? "–"}%.`,
    openGraph: {
      ...base.openGraph,
      title: `${trimmed} · Player profile | WS ATLAS`,
      description: `${view.games} games · ${view.winRatePct}% wins · ${view.points} points`,
    },
    robots: { index: true, follow: true },
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
