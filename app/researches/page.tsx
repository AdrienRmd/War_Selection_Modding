import { AtlasHeader, AtlasFooter, PageTitle } from "@/components/atlas-shell";
import { ResearchesBrowser } from "@/components/researches-browser";
import { researchesIndex } from "@/lib/researches";
export const dynamic = "force-dynamic";
export const metadata = { title: "科技档案 | WS ATLAS" };
export default async function Researches({
  searchParams,
}: {
  searchParams: Promise<{ research?: string }>;
}) {
  const params = await searchParams;
  const requested = Number(params.research);
  const initialGameId = Number.isInteger(requested) ? requested : null;
  return (
    <>
      <AtlasHeader />
      <main className="shell">
        <PageTitle
          eyebrow="WAR SELECTION / RESEARCH ARCHIVE"
          title="科技档案"
          text="浏览全部研究，按类型筛选，查看官方名称、描述与关联单位；数据来自公开导出。"
        />
        <ResearchesBrowser index={researchesIndex} initialGameId={initialGameId} />
      </main>
      <AtlasFooter />
    </>
  );
}
