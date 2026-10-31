import { AtlasHeader, AtlasFooter, PageTitle } from "@/components/atlas-shell";
import type { Metadata } from "next";
import { pageMetadata } from "@/lib/page-metadata";
import { ReplayBrowser } from "@/components/replay-browser";
export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("replay");
}
export default async function Replay({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const params = await searchParams;
  const initialCode = typeof params.code === "string" ? params.code.slice(0, 20) : "";
  return (
    <>
      <AtlasHeader />
      <main className="shell">
        <PageTitle
          eyebrow="WAR SELECTION / REPLAY ANALYZER"
          title="回放分析"
          text="粘贴对局回放代码，查看比分、玩家、时间线与单位统计；数据来自游戏官方接口。"
        />
        <ReplayBrowser initialCode={initialCode} />
      </main>
      <AtlasFooter />
    </>
  );
}
