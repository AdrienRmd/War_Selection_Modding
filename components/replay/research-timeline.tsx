"use client";
/** « Recherches » — LISTE de données par joueur (mission 06/11 : « PAS un
 *  graphique/timeline » ; retour utilisateur 07/11 : « enlever les fenêtres
 *  de dépliage et le mettre de base ») : chaque joueur est un bloc avec son
 *  en-tête (pseudo · équipe · « N recherches ») dont la liste — icône de la
 *  recherche, nom localisé (FR via le dictionnaire wsunitstats) et heure
 *  d'obtention MM:SS — est rendue DIRECTEMENT, toujours visible. Aucun
 *  mécanisme repliable ici (les onglets unités/bâtiments du profil joueur
 *  gardent, eux, leurs groupes). Données : player.researches (parser) —
 *  aucune nouvelle donnée, aucun fetch. */
import { useMemo } from "react";
import SiteLink from "@/components/site-link";
import { useBilingual, useI18n } from "@/components/i18n";
import type { Locale } from "@/lib/i18n";
import type { TeamImpact } from "@/lib/replay/analysis";
import { researchDisplayName, researchIconUrl } from "@/lib/replay/wsva-view";
import { formatMinutesSeconds } from "@/lib/replay/population";

export function ResearchTimelineSection({ teams }: { teams: TeamImpact[] }) {
  const l = useBilingual();
  const { locale } = useI18n();
  const blocks = useMemo(
    () =>
      teams.flatMap((team, teamIndex) =>
        team.players.map((p, playerIndex) => ({
          key: `${team.side}-${teamIndex}-${playerIndex}`,
          side: team.side,
          teamLabel: team.side === 0 ? l("蓝队", "Blue") : l("红队", "Red"),
          name: p.player.nickname,
          researches: [...(p.player.researches ?? [])].sort(
            (a, b) => a.takenTime - b.takenTime,
          ),
        })),
      ),
    [teams, l],
  );

  return (
    <div className="research-chronology" data-testid="research-chronology">
      {/* Le titre « Recherches » est porté par la section repliable qui
          enveloppe ce composant (replay-result.tsx) — pas de h3 interne :
          la refonte « dépliée d'office » l'avait laissé et le titre
          apparaissait deux fois (fix 07/11). La description suit directement. */}
      <p className="label-text">
        {l(
          "每位玩家的研究，按完成时间先后（图标 · 名称 · 时刻）。",
          "Every player's researches, in chronological order (icon · name · time).",
        )}
      </p>
      <div className="research-lists">
        {blocks.map((b) => (
          <section className="research-block panel" key={b.key}>
            <header className="research-block-head">
              <SiteLink
                className={`name-link age-player ${b.side === 0 ? "team-name-blue" : "team-name-red"}`}
                href={`/player/${encodeURIComponent(b.name)}`}
                title={b.name}
              >
                {b.name}
              </SiteLink>
              <span className="tag label-text">{b.teamLabel}</span>
              <span className="label-text research-block-count">
                {l("研究 ${n} 项", "${n} researches").replace("${n}", String(b.researches.length))}
              </span>
            </header>
            {b.researches.length > 0 ? (
              <ul className="player-stats-rows research-rows">
                {b.researches.map((r, i) => {
                  const icon = researchIconUrl(r.id);
                  return (
                    <li className="player-stats-unit-row" key={`${r.id}-${i}`}>
                      <img
                        className="player-stats-unit-icon"
                        src={icon || "/icons/sparkles.png"}
                        alt=""
                        loading="lazy"
                        aria-hidden="true"
                      />
                      <span className="player-stats-unit-name">
                        {researchDisplayName(r.id, locale as Locale) || `#${r.id}`}
                      </span>
                      <span className="player-stats-unit-count cell-strong cell-mono">
                        {formatMinutesSeconds(r.takenTime / 1000)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="label-text research-block-empty">
                {l("本局没有完成研究。", "No research completed this game.")}
              </p>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
