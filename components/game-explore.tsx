"use client";
import { useEffect, useState } from "react";
import { ChevronRight, Crosshair, FlaskConical, Network, SlidersHorizontal } from "lucide-react";
import Link from "@/components/site-link";
import { useI18n } from "@/components/i18n";
import {
  EXPLORE_UPDATED_AT_URL,
  datasetImageUrl,
  formatExploreDate,
  type ExploreSampleUnit,
  type ExploreStats,
} from "@/lib/explore";

// Vitrine « Explorer le jeu » de l'accueil (V3-P1) : les 4 sections de
// données (unités, recherches, arbre modding, atelier) avec compteurs RÉELS.
// Les compteurs arrivent côté serveur depuis les index embarqués (jamais codés
// en dur) ; à l'exécution, le manifeste /wus-data/updated-at.json est préféré
// quand il répond (comptes frais + date de mise à jour), exactement comme les
// badges des pages /units, /researches et /modding.

interface DatasetMeta {
  publishedAt?: string;
  counts?: { units?: number; researches?: number; treeFiles?: number };
}

export function GameExplore({
  stats,
  samples,
  researchIcons = [],
}: {
  stats: ExploreStats;
  samples: ExploreSampleUnit[];
  /** Icônes de recherches du dataset (sélection serveur déterministe). */
  researchIcons?: string[];
}) {
  const { locale, t } = useI18n();
  const [meta, setMeta] = useState<DatasetMeta | null>(null);
  const [metaFailed, setMetaFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch(EXPLORE_UPDATED_AT_URL)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((data) => {
        if (!alive) return;
        if (typeof data !== "object" || data === null) throw new Error("bad meta");
        setMeta(data as DatasetMeta);
      })
      .catch(() => alive && setMetaFailed(true));
    return () => {
      alive = false;
    };
  }, []);

  // Compteurs frais si le manifeste répond, sinon repli sur l'index embarqué.
  const unitsCount = meta?.counts?.units ?? stats.unitsCount;
  const researchesCount = meta?.counts?.researches ?? stats.researchesCount;
  const parameterNodes = meta?.counts?.treeFiles ?? stats.parameterNodes;

  const badgeText = metaFailed
    ? t("数据版本暂时不可用")
    : meta?.publishedAt
      ? `${t("数据更新于")} ${formatExploreDate(meta.publishedAt, locale)}`
      : t("正在读取数据版本…");

  return (
    <section className="explore-section" aria-label={t("探索游戏数据")}>
      <div className="section-head compact">
        <div>
          <h2>{t("探索游戏数据")}</h2>
          <p className="caption">{t("单位、科技与参数档案同步自公开数据集，与游戏版本一致。")}</p>
        </div>
        <span
          className={meta || metaFailed ? "units-badge" : "units-badge units-badge-loading"}
          data-badge="explore-updated"
        >
          {badgeText}
        </span>
      </div>
      <div className="explore-grid">
        <Link href="/units" className="explore-card">
          <span className="explore-icon" aria-hidden="true">
            <Crosshair size={26} />
          </span>
          <span className="explore-body">
            <span className="eyebrow">{t("ARCHIVE / 01")}</span>
            <h3>{t("单位档案")}</h3>
            <p className="explore-count">{t(`共 ${unitsCount} 个单位`)}</p>
            <p className="explore-desc">
              {t("按时代浏览全部单位：原始数值、武器、护甲与官方名称。")}
            </p>
            {samples.length > 0 ? (
              <span className="explore-thumbs">
                {samples.map((sample) => (
                  <img
                    key={sample.id}
                    src={datasetImageUrl(sample.image)}
                    alt={sample.name}
                    width={44}
                    height={44}
                    loading="lazy"
                  />
                ))}
              </span>
            ) : null}
          </span>
          <ChevronRight size={20} className="explore-chevron" aria-hidden="true" />
        </Link>
        <Link href="/researches" className="explore-card">
          <span className="explore-icon" aria-hidden="true">
            <FlaskConical size={26} />
          </span>
          <span className="explore-body">
            <span className="eyebrow">{t("ARCHIVE / 02")}</span>
            <h3>{t("科技档案")}</h3>
            <p className="explore-count">{t(`共 ${researchesCount} 项研究`)}</p>
            <p className="explore-desc">
              {t("每项研究的官方名称、说明与解锁单位，直达单位档案。")}
            </p>
            {researchIcons.length > 0 ? (
              <span className="explore-thumbs" aria-hidden="true">
                {researchIcons.map((image) => (
                  <img
                    key={image}
                    src={datasetImageUrl(image)}
                    alt=""
                    width={44}
                    height={44}
                    loading="lazy"
                  />
                ))}
              </span>
            ) : null}
          </span>
          <ChevronRight size={20} className="explore-chevron" aria-hidden="true" />
        </Link>
        <Link href="/modding" className="explore-card">
          <span className="explore-icon" aria-hidden="true">
            <Network size={26} />
          </span>
          <span className="explore-body">
            <span className="eyebrow">{t("ARCHIVE / 03")}</span>
            <h3>{t("参数档案")}</h3>
            <p className="explore-count">{t(`共 ${parameterNodes} 个参数节点`)}</p>
            <p className="explore-desc">
              {t("逐节点展开游戏参数树：数值、字符串与函数签名，支持路径搜索。")}
            </p>
          </span>
          <ChevronRight size={20} className="explore-chevron" aria-hidden="true" />
        </Link>
        <div className="explore-card explore-card-tools">
          <span className="explore-icon" aria-hidden="true">
            <SlidersHorizontal size={26} />
          </span>
          <span className="explore-body">
            <span className="eyebrow">{t("WORKSHOP / 04")}</span>
            <h3>{t("Mod 工作台")}</h3>
            <p className="explore-desc">{t("选择基础单位，调整数值，导出 Lua。")}</p>
            <span className="explore-links">
              <Link href="/workbench" className="text-link">
                {t("打开 Mod 工作台")}
              </Link>
              <Link href="/workbench/simple" className="text-link">
                {t("简易模式（三步导出）")}
              </Link>
            </span>
          </span>
        </div>
      </div>
    </section>
  );
}
