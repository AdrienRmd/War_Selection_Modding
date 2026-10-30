import { AtlasHeader, AtlasFooter, PageTitle } from "@/components/atlas-shell";
import { UnitsBrowser } from "@/components/units-browser";
import { unitsIndex } from "@/lib/units";
export const dynamic = "force-dynamic";
export const metadata = { title: "单位档案 | WS ATLAS" };
export default function Units() {
  return (
    <>
      <AtlasHeader />
      <main className="shell">
        <PageTitle
          eyebrow="WAR SELECTION / UNIT ARCHIVE"
          title="单位档案"
          text="按时代浏览游戏单位，查看原始数值、武器与图片；数据来自公开导出。"
        />
        <UnitsBrowser index={unitsIndex} />
      </main>
      <AtlasFooter />
    </>
  );
}
