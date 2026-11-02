"use client";
import { MapProvenance } from "@/components/map-provenance";
import { MapCaptures } from "@/components/map-captures";
import Link from "@/components/site-link";
import { T, useBilingual, useI18n } from "@/components/i18n";
import { CopyMapCode } from "@/components/collected-maps";
import { collectionLabels, type CollectedMap } from "@/lib/collection";
import { mapName, mapNote } from "@/lib/collection-i18n";
import { ArrowLeft, Pencil, ClipboardList } from "lucide-react";
export function CollectedMapDetail({
  map: m,
  admin,
  signedIn = false,
}: {
  map: CollectedMap;
  admin: boolean;
  /** Connecté ? (formulaire d'upload des captures en jeu, chantier 7). */
  signedIn?: boolean;
}) {
  const { locale } = useI18n();
  const l = useBilingual();
  const en = locale !== "zh";
  // Nom et note publics trilingues (chantier 4c) : dictionnaire → données →
  // défaut propre « Carte <code> » ; les mentions « unconfirmed » du titre
  // sont retirées du rendu public (conservées dans les données et l'admin).
  const title = mapName(m, locale);
  return (
    <>
      <Link href="/maps#collection" className="back-link">
        <ArrowLeft size={16} />
        {l("返回地图收藏", "Back to saved maps")}
      </Link>
      <div className="collection-detail-heading">
        <div>
          <p className="eyebrow">
            <T text="SAVED MAP /" /> {m.map_code}
          </p>
          <h1>{title}</h1>
          <p>{mapNote(m, locale)}</p>
        </div>
        <span className={`collection-state state-${m.test_status}`}>
          {collectionLabels[m.test_status] &&
            (locale === "zh"
              ? collectionLabels[m.test_status][0]
              : l(collectionLabels[m.test_status][0], collectionLabels[m.test_status][1]))}
        </span>
      </div>
      {admin && (
        <div className="editor-banner">
          <span>
            {l("这是收藏档案，你可以补充资料并记录实测结果。", "Curated entry: you can complete the details and record test results.")}
          </span>
          <Link className="button primary" href={`/maps/${m.id}/edit`}>
            <Pencil size={16} />
            {l("编辑地图档案", "Edit archive")}
          </Link>
        </div>
      )}
      {m.visibility === "hidden" && (
        <p className="notice">{l("此档案已从公开收藏中隐藏。", "Hidden from the public collection.")}</p>
      )}
      <MapProvenance map={m} />
      {/* Chantier 7 — captures en jeu soumises par les testeurs (modérées).
          Badge « testée » lié : la section affiche le statut de test de la
          fiche à côté des captures, pour distinguer capture ≠ test officiel. */}
      <section className="map-captures-anchor">
        <span className={`collection-state state-${m.test_status}`}>
          {collectionLabels[m.test_status] &&
            (locale === "zh"
              ? collectionLabels[m.test_status][0]
              : l(collectionLabels[m.test_status][0], collectionLabels[m.test_status][1]))}
        </span>
      </section>
      <MapCaptures mapId={m.id} signedIn={signedIn} />
      <div className="overview-grid">
        <article className="panel">
          <h2>{l("原记录中的玩法", "Source description")}</h2>
          <p className="preserve-text">
            {(en ? m.description_en || m.description : m.description) ||
              l(
                "原收藏未提供玩法介绍，等待实测和补充。",
                "No gameplay description was supplied. Please test before relying on this map.",
              )}
          </p>
          <h2 className="mt-8">{l("所需 Mod", "Required mods")}</h2>
          <p className="preserve-text">
            {(en ? m.mods_en || m.mods : m.mods) ||
              l("原文未记录，不代表不需要 Mod。", "Not recorded; this does not mean no mods are required.")}
          </p>
          <h2 className="mt-8">{l("实测记录", "Test notes")}</h2>
          <p className="preserve-text">
            {(en ? m.test_notes_en || m.test_notes : m.test_notes) ||
              l("暂无实测记录。", "No test results recorded.")}
          </p>
        </article>
        <aside className="panel download-panel">
          <ClipboardList size={28} />
          <h2>{l("已收录，不等于已验证", "Saved, not certified")}</h2>
          <CopyMapCode code={m.map_code} />
          <dl className="key-values">
            <div>
              <dt>{l("作者", "Author")}</dt>
              <dd>{m.author || l("待确认", "Unknown")}</dd>
            </div>
            <div>
              <dt>{l("人数（原记录）", "Players (source)")}</dt>
              <dd>{m.players ?? l("待确认", "Unknown")}</dd>
            </div>
            <div>
              <dt>{l("类型", "Type")}</dt>
              <dd>
                {collectionLabels[m.category] &&
                  (locale === "zh"
                    ? collectionLabels[m.category][0]
                    : l(collectionLabels[m.category][0], collectionLabels[m.category][1]))}
              </dd>
            </div>
            <div>
              <dt>{l("实测游戏版本", "Game version tested")}</dt>
              <dd>{m.game_version || l("未测试", "Not tested")}</dd>
            </div>
            <div>
              <dt>{l("最后测试日期", "Last test date")}</dt>
              <dd>{m.tested_at || l("未记录", "Not recorded")}</dd>
            </div>
            <div>
              <dt>{l("收录日期", "Collected")}</dt>
              <dd>{m.collected_at}</dd>
            </div>
          </dl>
          <p className="caption">
            {l(
              "复制地图码后，在游戏的地图分享入口中打开。本站此档案未托管地图 ZIP 包。",
              "Copy the map code, then open it through the game’s map-sharing interface. This archive does not host a map ZIP.",
            )}
          </p>
        </aside>
      </div>
      <section className="panel collection-original">
        <h2>{l("原收藏预览", "Original saved previews")}</h2>
        <p className="caption">{en ? m.source_note_en : m.source_note}</p>
        {m.preview_note && (
          <p className="notice subtle">
            {en ? m.preview_note_en || m.preview_note : m.preview_note}
            {m.image_source_url && (
              <>
                {" "}
                <a className="text-link" href={m.image_source_url} target="_blank" rel="noreferrer">
                  {l("图片来源 ↗", "Image source ↗")}
                </a>
              </>
            )}
          </p>
        )}
        {m.images.length ? (
          <div className="collection-image-grid">
            {m.images.map((url, i) => (
              <a href={url} key={url} target="_blank" rel="noreferrer">
                <img
                  src={url}
                  alt={`${m.map_code} ${locale === "zh" ? "原始预览" : l("原始预览", "saved preview")} ${i + 1}`}
                  loading="lazy"
                />
              </a>
            ))}
          </div>
        ) : (
          <p>
            {l(
              "本站尚未归档此地图的预览图，可通过上方原帖查看。",
              "No preview has been archived here. Check the source post for available images.",
            )}
          </p>
        )}
      </section>
      {/* Finitions 01/11, chantier 8 — procédure correction/retrait pour les
          auteurs (MVP mailto assumé : pas de système de tickets en base dans
          ce lot). Sujet et corps pré-remplis avec le code et le nom affiché. */}
      <p className="map-author-rights">
        <a
          className="text-link"
          href={`mailto:adrien.remond@protonmail.com?subject=${encodeURIComponent(
            l("更正/下架地图 ${code}", "Map correction/removal — ${code}").replaceAll(
              "${code}",
              m.map_code,
            ),
          )}&body=${encodeURIComponent(
            l(
              "地图码：${code}\n名称：${name}\n请说明需要更正或下架的原因：",
              "Map code: ${code}\nName: ${name}\nPlease describe what should be corrected or removed:",
            )
              .replaceAll("${code}", m.map_code)
              .replaceAll("${name}", title),
          )}`}
        >
          {l("报告 / 申请更正或下架", "Report / request a correction or removal")}
        </a>
      </p>
    </>
  );
}
