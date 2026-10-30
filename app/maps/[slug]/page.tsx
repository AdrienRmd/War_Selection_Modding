import { LocalizedImage } from "@/components/localized-media";
import type { Metadata } from "next";
import { pageMetadata } from "@/lib/page-metadata";

import { T } from "@/components/i18n";
import Link from "@/components/site-link";
import { notFound } from "next/navigation";
import { collectionSeed } from "@/lib/collection";
import { collectedMap } from "@/lib/collection-server";
import { CollectedMapDetail } from "@/components/collected-map-detail";
import { ShareCode } from "@/components/share-code";
import { TestStatusPanel } from "@/components/map-test-status";
import { mapTestLabels, type MapTestState } from "@/lib/map-code";
import { ArrowLeft, Download, ShieldCheck, BadgeCheck } from "lucide-react";
import { AtlasHeader, AtlasFooter, PageTitle } from "@/components/atlas-shell";
import { bindings, publicMap, identity, type MapRecord } from "@/lib/atlas-server";
export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("mapsSlug");
}
export default async function MapPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (collectionSeed(slug)) {
    const viewer = await identity();
    let item;
    try {
      item = await collectedMap(slug);
    } catch {
      return (
        <>
          <AtlasHeader />
          <main className="shell">
            <p className="notice error">
              <T text="收藏地图暂时无法读取，请稍后重试。" />
            </p>
          </main>
          <AtlasFooter />
        </>
      );
    }
    if (!item || (item.visibility === "hidden" && !viewer.admin)) notFound();
    return (
      <>
        <AtlasHeader />
        <main className="shell">
          <CollectedMapDetail map={item} admin={viewer.admin} />
        </main>
        <AtlasFooter />
      </>
    );
  }
  let record: MapRecord | null;
  try {
    record = await bindings()
      .DB.prepare("SELECT * FROM maps WHERE id = ? AND status = 'approved'")
      .bind(slug)
      .first<MapRecord>();
  } catch {
    return (
      <>
        <AtlasHeader />
        <main className="shell">
          <div className="notice error">
            <T text={"地图资料暂时无法加载，请稍后刷新。"} />
          </div>
        </main>
        <AtlasFooter />
      </>
    );
  }
  if (!record) notFound();
  const m = publicMap(record);
  const viewer = await identity();
  return (
    <>
      <AtlasHeader />
      <main className="shell">
        <Link href="/" className="back-link">
          <ArrowLeft size={16} /> <T text={"返回地图档案"} />
        </Link>
        <PageTitle eyebrow={`${m.category} / COMMUNITY MAP`} title={m.title} text={m.summary} />
        {m.has_cover && (
          <LocalizedImage
            className="public-map-cover"
            src={`/api/atlas/files/${m.id}?type=cover`}
            alt={`${m.title} 的地图封面`}
          />
        )}
        {(viewer.admin || viewer.user?.userId === record.owner_id) && (
          <div className="editor-banner">
            <span>
              <T text={"这是你可以维护的地图档案。"} />
            </span>
            <Link href={`/maps/${m.id}/edit`} className="button primary">
              <T text={"编辑地图"} />
            </Link>
          </div>
        )}
        <div className="overview-grid">
          <article className="panel">
            <h2>
              <T text={"地图玩法与使用说明"} />
            </h2>
            <p className="preserve-text">
              <T text={m.description} />
            </p>
            <h2 className="mt-8">
              <T text={"所需 Mod 与加载顺序"} />
            </h2>
            <p className="preserve-text">
              <T text={m.mods || "作者未填写额外 Mod。"} />
            </p>
          </article>
          <aside className="panel download-panel">
            <ShieldCheck size={27} />
            <h2>
              <T text={"社区审核已通过"} />
            </h2>
            {/* SB6 — badge de statut de test déclaré par l'auteur : visuel et
                libellés distincts du label admin de la collection éditoriale
                (collection-state) : classes map-test-badge dédiées. */}
            <div
              className={`map-test-badge state-${m.test_status || "untested"}`}
              data-testid="map-test-badge"
            >
              <strong>
                <T
                  text={
                    mapTestLabels[(m.test_status || "untested") as MapTestState]?.[0] ||
                    "待实测"
                  }
                />
              </strong>
              <small>
                <T
                  text={
                    m.test_set_by === "admin"
                      ? "测试状态 · 管理员已更新"
                      : "测试状态 · 由作者申报"
                  }
                />
                {m.test_updated_at && (
                  <>
                    {" · "}
                    <T text={m.test_updated_at.slice(0, 10)} />
                  </>
                )}
              </small>
            </div>
            {m.test_notes && (
              <p className="test-notes preserve-text">
                <T text={m.test_notes} />
              </p>
            )}
            <dl className="key-values">
              <div>
                <dt>
                  <T text={"作者"} />
                </dt>
                <dd className="map-author-line">
                  <T text={m.author} />
                  {/* SB7 — badge créateur vérifié : match exact auteur ↔ pseudo
                      du compte, instantané à l'écriture, jamais rétroactif. */}
                  {m.author_verified && (
                    <em className="verified-chip">
                      <BadgeCheck size={13} /> <T text={"创作者已验证"} />
                    </em>
                  )}
                </dd>
              </div>
              <div>
                <dt>
                  <T text={"测试版本"} />
                </dt>
                <dd>
                  <T text={m.game_version} />
                </dd>
              </div>
              <div>
                <dt>
                  <T text={"玩家数量"} />
                </dt>
                <dd>
                  <T text={m.players} /> <T text={"人"} />
                </dd>
              </div>
              {m.has_file && (
                <div>
                  <dt>
                    <T text={"文件大小"} />
                  </dt>
                  <dd>
                    <T text={(m.file_size / 1024 / 1024).toFixed(2)} /> MB
                  </dd>
                </div>
              )}
              <div>
                <dt>
                  <T text={"审核日期"} />
                </dt>
                <dd>
                  <T text={m.reviewed_at?.slice(0, 10)} />
                </dd>
              </div>
            </dl>
            {/* SB5 — parcours code-only : le code est l'accès principal,
                copie en un clic ; le ZIP n'existe pas forcément. */}
            {m.map_code && <ShareCode code={m.map_code} />}
            {m.has_file ? (
              <a className="button primary" href={`/api/atlas/files/${m.id}`}>
                <Download size={18} /> <T text={"下载地图 ZIP 包"} />
              </a>
            ) : (
              <p className="caption">
                <T text={"该地图未提供 ZIP 包，请使用游戏内分享码。"} />
              </p>
            )}
            {m.has_file && (
              <p className="checksum">
                <T text="SHA-256:" /> <T text={m.sha256} />
              </p>
            )}
            <p className="caption">
              <T text={"审核不等于官方认证或自动病毒扫描。请自行扫描文件并备份游戏内容。"} />
            </p>
          </aside>
        </div>
        {(viewer.admin || viewer.user?.userId === record.owner_id) && (
          <TestStatusPanel
            mapId={m.id}
            initial={{
              test_status: m.test_status,
              test_notes: m.test_notes,
              revision: record.revision,
              game_version: m.game_version,
            }}
          />
        )}
      </main>
      <AtlasFooter />
    </>
  );
}
