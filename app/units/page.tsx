import { AtlasHeader, AtlasFooter, PageTitle } from "@/components/atlas-shell";
import { UnitsBrowser } from "@/components/units-browser";
import { unitsIndex } from "@/lib/units";
export const dynamic = "force-dynamic";
export const metadata = { title: "单位档案 | WS ATLAS" };
export default async function Units({
  searchParams,
}: {
  searchParams: Promise<{ unit?: string }>;
}) {
  // Lien profond /units?unit=<id> : la fiche enrichie (données embarquées,
  // libellés officiels localisés via le cookie de langue) est rendue côté
  // serveur — le HTML initial contient déjà coûts, travaux et nation/âge.
  const params = await searchParams;
  const initialUnitId = typeof params.unit === "string" ? params.unit : undefined;
  return (
    <>
      <AtlasHeader />
      <main className="shell">
        <PageTitle
          eyebrow="WAR SELECTION / UNIT ARCHIVE"
          title="单位档案"
          text="按时代浏览游戏单位，查看原始数值、武器与图片；数据来自公开导出。"
        />
        <UnitsBrowser index={unitsIndex} initialUnitId={initialUnitId} />
      </main>
      <AtlasFooter />
    </>
  );
}
