import { LocalizedImage } from "@/components/localized-media";

import { T } from "@/components/i18n";
import Link from "@/components/site-link";
import { ArrowUpRight, Layers3, Map, Users, SlidersHorizontal, ChevronRight } from "lucide-react";
import { AtlasHeader, AtlasFooter } from "@/components/atlas-shell";
import { CommunityMaps } from "@/components/community-maps";
import { CollectedMaps } from "@/components/collected-maps";
import { collectedMaps } from "@/lib/collection-server";
import { identity } from "@/lib/atlas-server";
import type { CollectedMap } from "@/lib/collection";
import { getFeaturedMap } from "@/lib/featured-server";
import { stalingradDefault } from "@/lib/map-content";
export const dynamic = "force-dynamic";
export default async function Home() {
  let collection: CollectedMap[] = [],
    collectionUnavailable = false;
  const viewer = await identity();
  try {
    collection = await collectedMaps();
  } catch {
    collectionUnavailable = true;
  }
  let m = stalingradDefault,
    unavailable = false;
  try {
    m = await getFeaturedMap();
  } catch {
    unavailable = true;
  }
  return (
    <>
      <AtlasHeader />
      <main className="shell">
        <div className="page-heading">
          <div>
            <p className="eyebrow">
              <T text="WAR SELECTION / FIELD ARCHIVE" />
            </p>
            <h1>
              <T text={"选择你的"} />
              <em>
                <T text={"下一场战役。"} />
              </em>
            </h1>
            <p>
              <T text={"地图归地图，规则归规则。创作者在这里开始。"} />
            </p>
          </div>
          <Link href="/workbench" className="button">
            <SlidersHorizontal size={18} /> <T text={"打开 Mod 工作台"} />
          </Link>
        </div>
        {unavailable && (
          <p className="notice error">
            <T text={"最新精选资料暂时不可读，以下显示初始档案。"} />
          </p>
        )}
        <section className="command-feature">
          <Link href="/maps/stalingrad" className="command-art" aria-label={`查看${m.title}`}>
            <LocalizedImage
              src={m.has_cover ? "/api/featured?asset=cover" : "/stalingrad-art.png"}
              alt={m.has_cover ? `${m.title}的作者封面` : "斯大林格勒历史氛围插画"}
            />
            <span className="tag">
              <T text={"精选战场 / MAP 001"} />
            </span>
            <div className="command-art-title">
              <p>
                <T text="THE VOLGA FRONT · 1942" />
              </p>
              <h2>
                <T text={m.title} />
              </h2>
              <span>
                <T text="STALINGRAD" /> <ArrowUpRight size={32} />
              </span>
            </div>
            <small>
              <T text={m.has_cover ? "作者上传封面" : "AI 历史氛围插画 · 非游戏截图"} />
            </small>
          </Link>
          <div className="command-brief">
            <p className="eyebrow">
              <T text="MISSION BRIEF" />
            </p>
            <h2>
              <T text={"伏尔加河畔，"} />
              <br />
              <T text={"每一寸土地都算数。"} />
            </h2>
            <p>
              <T text={m.summary} />
            </p>
            <dl>
              <div>
                <dt>
                  <Users size={17} /> <T text={"玩家"} />
                </dt>
                <dd>
                  <T text={m.players} /> <T text={"人"} />
                </dd>
              </div>
              <div>
                <dt>
                  <Map size={17} /> <T text={"战场"} />
                </dt>
                <dd>
                  <T text={m.category} />
                </dd>
              </div>
              <div>
                <dt>
                  <T text={"作者"} />
                </dt>
                <dd>
                  <T text={m.author} />
                </dd>
              </div>
              <div>
                <dt>
                  <T text={"地图包"} />
                </dt>
                <dd>
                  <T text={m.has_file ? "已提供" : "待作者上传"} />
                </dd>
              </div>
            </dl>
            <Link href="/maps/stalingrad" className="button primary">
              <T text={"查看地图档案"} /> <ArrowUpRight size={18} />
            </Link>
          </div>
        </section>
        <div className="portal-grid">
          <Link href="/mods" className="portal-card">
            <Layers3 size={30} />
            <div>
              <p className="eyebrow">
                <T text="LIBRARY / 01" />
              </p>
              <h2>
                <T text={"Mod 资料库"} />
              </h2>
              <p>
                <T text={"独立查阅功能、状态与兼容边界。"} />
              </p>
            </div>
            <ChevronRight size={22} />
          </Link>
          <Link href="/workbench" className="portal-card">
            <SlidersHorizontal size={30} />
            <div>
              <p className="eyebrow">
                <T text="WORKSHOP / 02" />
              </p>
              <h2>
                <T text={"你的规则，你来写。"} />
              </h2>
              <p>
                <T text={"选择基础单位，调整数值，导出 Lua。"} />
              </p>
            </div>
            <ChevronRight size={22} />
          </Link>
        </div>
        {collectionUnavailable ? (
          <p className="notice error">
            <T text="收藏地图暂时无法读取，请稍后重试。" />
          </p>
        ) : (
          <CollectedMaps items={collection} admin={viewer.admin} />
        )}
        <CommunityMaps />
      </main>
      <AtlasFooter />
    </>
  );
}
