"use client";
/** Détail d'un joueur d'un replay — fenêtre modale conservée de la version
 *  précédente de la page /replay : timeline de recherches, unités produites,
 *  tuées et perdues, avec noms localisés (recherches / unités). */
import { X } from "lucide-react";
import { useBilingual, useI18n } from "@/components/i18n";
import type { Player } from "@/lib/replay/structure";
import { localizedResearchName, researchImageUrl, researchesIndex } from "@/lib/researches";
import { localizedUnitName, unitsIndex, type UnitIndexEntry } from "@/lib/units";

function formatClock(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

const CATEGORY_LABELS: Record<string, { zh: string; en: string }> = {
  unitCategoryProdBuild: { zh: "生产建筑", en: "Production buildings" },
  unitCategoryUnit: { zh: "单位", en: "Units" },
  unitCategoryBuild: { zh: "建筑", en: "Buildings" },
  unitCategoryEnv: { zh: "环境", en: "Environment" },
  unitCategoryWonder: { zh: "奇观", en: "Wonder" },
  unknown: { zh: "其他", en: "Other" },
};

function categoryLabel(category: string): [string, string] {
  const label = CATEGORY_LABELS[category];
  return label ? [label.zh, label.en] : [category, category];
}

export function PlayerDetail({
  player,
  onClose,
}: {
  player: Player;
  onClose: () => void;
}) {
  const { locale } = useI18n();
  const l = useBilingual();

  const researchById = new Map<number, (typeof researchesIndex.researches)[number]>();
  for (const r of researchesIndex.researches) researchById.set(r.gameId, r);
  const unitsById = new Map<string, UnitIndexEntry>();
  for (const u of unitsIndex.units) unitsById.set(u.id, u);
  const researchName = (gameId: number): string => {
    const entry = researchById.get(gameId);
    return entry ? localizedResearchName(entry, locale) : `#${gameId}`;
  };
  const unitName = (unitPathId: string): string => {
    const entry = unitsById.get(unitPathId.replace(/^WarSelection\//, ""));
    return entry ? localizedUnitName(entry, locale) : unitPathId.split("/").pop() ?? unitPathId;
  };
  const formatInt = (value: number): string =>
    new Intl.NumberFormat(locale === "zh" ? "zh-CN" : locale, { maximumFractionDigits: 0 }).format(value);

  return (
    <div className="units-detail-backdrop" role="presentation" onClick={onClose}>
      <div
        className="units-detail"
        role="dialog"
        aria-modal="true"
        aria-label={player.nickname}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="units-detail-head">
          <div className="units-detail-title">
            <h3>
              <span className="replay-player-dot" style={{ background: player.color }} /> {player.nickname}
            </h3>
            {player.isMvp ? <span className="replay-flag-mvp">MVP</span> : null}
            {player.isWinner ? <span className="replay-flag-winner">{l("胜方", "Winner")}</span> : null}
          </div>
          <button type="button" className="units-close" onClick={onClose}>
            <X size={16} />
            <span>{l("关闭", "Close")}</span>
          </button>
        </div>

        <div className="units-fiche">
          {player.researches && player.researches.length > 0 ? (
            <div className="units-block">
              <h4>{l("研究时间线", "Research timeline")}</h4>
              <ul className="replay-detail-list">
                {[...player.researches]
                  .sort((a, b) => a.takenTime - b.takenTime)
                  .map((research) => {
                    const entry = researchById.get(research.id);
                    return (
                      <li key={`${research.id}-${research.takenTime}`}>
                        <span className="detail-time">{formatClock(research.takenTime)}</span>
                        {entry?.image ? (
                          <img
                            src={researchImageUrl(entry.image)}
                            alt=""
                            width={18}
                            height={18}
                            loading="lazy"
                          />
                        ) : null}
                        <span className="detail-name">{researchName(research.id)}</span>
                      </li>
                    );
                  })}
              </ul>
            </div>
          ) : null}

          {player.unitsCreated && player.unitsCreated.size > 0 ? (
            <div className="units-block">
              <h4>{l("生产单位（按类别）", "Units built (by category)")}</h4>
              <ul className="replay-detail-list">
                {Array.from(player.unitsCreated.entries()).map(([category, units]) => (
                  <li key={category}>
                    <span className="detail-name">
                      {l(...categoryLabel(category))} —{" "}
                      {units.map((u) => `${unitName(u.id)} ×${formatInt(u.number)}`).join(", ")}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {player.unitsKilledPlain && player.unitsKilledPlain.size > 0 ? (
            <div className="units-block">
              <h4>{l("击杀单位", "Units killed")}</h4>
              <ul className="replay-detail-list">
                {Array.from(player.unitsKilledPlain.entries()).map(([category, units]) => (
                  <li key={`k-${category}`}>
                    <span className="detail-name">
                      {l(...categoryLabel(category))} —{" "}
                      {units.map((u) => `${unitName(u.id)} ×${formatInt(u.number)}`).join(", ")}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {player.unitsLostPlain && player.unitsLostPlain.size > 0 ? (
            <div className="units-block">
              <h4>{l("损失单位", "Units lost")}</h4>
              <ul className="replay-detail-list">
                {Array.from(player.unitsLostPlain.entries()).map(([category, units]) => (
                  <li key={`l-${category}`}>
                    <span className="detail-name">
                      {l(...categoryLabel(category))} —{" "}
                      {units.map((u) => `${unitName(u.id)} ×${formatInt(u.number)}`).join(", ")}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
