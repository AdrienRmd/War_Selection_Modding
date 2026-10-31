import { requireChatGPTUser } from "@/app/chatgpt-auth";
import type { Metadata } from "next";
import { pageMetadata } from "@/lib/page-metadata";
import { AtlasHeader, AtlasFooter, PageTitle } from "@/components/atlas-shell";
import { SubmissionDashboard } from "@/components/submission-dashboard";
import { CreatorFeatured } from "@/components/creator-featured";
import { ModDashboard } from "@/components/mod-dashboard";
import { ReplayModeration } from "@/components/replay/replay-moderation";
import { CreationTabs } from "@/components/creation-tabs";
import { isAdmin } from "@/lib/atlas-server";
export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("submissions");
}
export default async function Submissions() {
  const user = await requireChatGPTUser("/submissions");
  return (
    <>
      <AtlasHeader />
      <main className="shell">
        <PageTitle
          eyebrow="YOUR CONTRIBUTIONS"
          title="我的创作"
          text="管理地图与 Mod、编辑资料和发布码、查看审核意见。"
        />
        <CreationTabs
          maps={
            <>
              {isAdmin(user) && <CreatorFeatured />}
              <SubmissionDashboard />
            </>
          }
          mods={<ModDashboard />}
          replays={<ReplayModeration />}
        />
      </main>
      <AtlasFooter />
    </>
  );
}
