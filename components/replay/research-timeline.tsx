"use client";
/** « Chronologie des recherches » — LISTE de données (mission 06/11,
 *  consigne utilisateur : « PAS un graphique/timeline ») : par joueur, un
 *  bloc repliable dont chaque ligne porte l'ICÔNE de la recherche, son nom
 *  localisé (FR via le dictionnaire wsunitstats) et l'heure d'obtention au
 *  format MM:SS, dans l'ordre chronologique (les transitions d'âge sont des
 *  recherches : elles apparaissent avec leur icône d'âge, ex. « L'âge du
 *  bronze en Europe 05:37 »). Remplace l'ancienne timeline verticale à
 *  puces ; les données restent player.researches (parser) — aucune nouvelle
 *  donnée, aucun fetch. */
import { useMemo, useState } from "react";
import { ChevronDown, FlaskConical } from "lucide-react";
import SiteLink from "@/components/site-link";
import { useBilingual, useI18n } from "@/components/i18n";
import type { Locale } from "@/lib/i18n";
import type { TeamImpact } from "@/lib/replay/analysis";
import { researchDisplayName, researchIconUrl } from "@/lib/replay/wsva-view";
import { formatMinutesSeconds } from "@/lib/replay/population";

/** Clé de bloc UNIQUE : équipe + index joueur + pseudo — deux homonymes
 *  d'une même équipe gardent des blocs repliables indépendants. */
const blockKey = (b: PlayerEntry, index: number) => `${b.side}-${index}-${b.name}`;

interface PlayerEntry {
  side: number;
  teamLabel: string;
  name: string;
  researches: Array<{ id: number; takenTime: number }>;
}

export function ResearchTimelineSection({ teams }: { teams: TeamImpact[] }) {
  const l = useBilingual();
  const players = useMemo(
    () =>
      teams.flatMap((team) =>
        team.players.map((p) => ({
          side: team.side,
          teamLabel: team.side === 0 ? l("蓝队", "Blue") : l("红队", "Red"),
          impact: p,
        })),
      ),
    [teams, l],
  );

  return (
    <div className="research-chronology" data-testid="research-chronology">
      <h3 className="heading-3 insight-heading">
        <FlaskConical className="icon icon-md" aria-hidden="true" />
        {l("研究列表", "Researches")}
      </h3>
      <p className="label-text">
        {l(
          "展开每位玩家，按完成时间先后查看其研究（图标 · 名称 · 时刻）。",
          "Expand a player to see their researches in chronological order (icon · name · time).",
        )}
      </p>
      <PlayerResearchLists players={players} />
    </div>
  );
}

/** Lien joueur coloré par équipe (même destination que les tables). */
function PlayerNameLink({ name, side }: { name: string; side: number }) {
  return (
    <SiteLink
      className={`name-link age-player ${side === 0 ? "team-name-blue" : "team-name-red"}`}
      href={`/player/${encodeURIComponent(name)}`}
      title={name}
    >
      {name}
    </SiteLink>
  );
}

function PlayerResearchLists({
  players,
}: {
  players: Array<{ side: number; teamLabel: string; impact: TeamImpact["players"][number] }>;
}) {
  const l = useBilingual();
  const { locale } = useI18n();
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());
  const blocks = useMemo<PlayerEntry[]>(
    () =>
      players.map((p) => ({
        side: p.side,
        teamLabel: p.teamLabel,
        name: p.impact.player.nickname,
        researches: [...(p.impact.player.researches ?? [])].sort((a, b) => a.takenTime - b.takenTime),
      })),
    [players],
  );
  const allOpen = open.size === blocks.length && blocks.length > 0;
  const toggleAll = () => setOpen(allOpen ? new Set() : new Set(blocks.map((b, i) => blockKey(b, i))));
  const toggle = (key: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  return (
    <>
      <div className="research-lists-tools">
        <span className="label-text">
          {l("每位玩家一节，可展开。", "One section per player, expandable.")}
        </span>
        <button type="button" className="chip" onClick={toggleAll} aria-expanded={allOpen}>
          {allOpen ? l("全部收起", "Collapse all") : l("全部展开", "Expand all")}
        </button>
      </div>
      <div className="research-lists">
        {blocks.map((b, blockIndex) => {
          const key = blockKey(b, blockIndex);
          const isOpen = open.has(key);
          return (
            <section className={`research-block panel${isOpen ? " research-block-open" : ""}`} key={key}>
              <button
                type="button"
                className="research-block-toggle"
                aria-expanded={isOpen}
                onClick={() => toggle(key)}
              >
                <ChevronDown
                  className={`rp-section-chevron${isOpen ? " rp-section-chevron-open" : ""}`}
                  aria-hidden="true"
                />
                <PlayerNameLink name={b.name} side={b.side} />
                <span className="tag label-text">{b.teamLabel}</span>
                <span className="label-text research-block-count">
                  {l("研究 ${n} 项", "${n} researches").replace("${n}", String(b.researches.length))}
                </span>
              </button>
              {isOpen ? (
                b.researches.length > 0 ? (
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
                )
              ) : null}
            </section>
          );
        })}
      </div>
    </>
  );
}
