import { AtlasHeader, AtlasFooter } from "@/components/atlas-shell";
import type { Metadata } from "next";
import { pageMetadata, requestLocale } from "@/lib/page-metadata";
import { PlayerProfileView } from "@/components/replay/player-profile";
import { playerProfile } from "@/lib/player-profile";
import "../../wsva.css"; // Design-system wsva scopé .rp (profil joueur, V3 01/11)

export const dynamic = "force-dynamic";

/** vinext livre les params de PAGE sous forme ENCODÉE (canonicalisée) :
 *  seuls les route handlers reçoivent des params décodés (vinext
 *  routing/utils normalizeMatchedParamsForRoute → canonicalizeAppPageParams
 *  pour les pages, decodeMatchedParams pour les handlers). Un seul
 *  décodage ici — et robuste : une séquence « % » mal formée (préservée
 *  telle quelle par le repli de canonicalizeAppPageParam) replie sur le
 *  segment brut au lieu de lever URIError → jamais de 500, état vide.
 *  Vérifié empiriquement : /player/100%2525Man → profil « 100%25Man »,
 *  /player/Caf%C3%A9 → « Café » (un seul décodage, pas de double). */
function playerNameFromSegment(segment: string): string {
  try {
    return decodeURIComponent(segment).slice(0, 40);
  } catch {
    return segment.slice(0, 40);
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ name: string }>;
}): Promise<Metadata> {
  const { name } = await params;
  const locale = await requestLocale();
  const trimmed = playerNameFromSegment(name);
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
  const profile = await playerProfile(playerNameFromSegment(name), locale);
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
