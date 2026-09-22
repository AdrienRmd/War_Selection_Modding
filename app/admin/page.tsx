import { requireChatGPTUser } from "@/app/chatgpt-auth";
import { isAdmin } from "@/lib/atlas-server";
import { AtlasHeader, AtlasFooter, PageTitle } from "@/components/atlas-shell";
import { SubmissionDashboard } from "@/components/submission-dashboard";
import { CreatorFeatured } from "@/components/creator-featured";
import { ModDashboard } from "@/components/mod-dashboard";
import { CreationTabs } from "@/components/creation-tabs";
import { Bilingual } from "@/components/i18n";
export const dynamic = "force-dynamic";
export default async function Admin() {
  const user = await requireChatGPTUser("/admin");
  return (
    <>
      <AtlasHeader />
      <main className="shell">
        <PageTitle
          eyebrow="MODERATION DESK"
          title="战场检阅台"
          text="每一次发布，都需要真实检查。身份和权限在服务器端验证。"
        />
        {isAdmin(user) ? (
          <CreationTabs
            maps={
              <>
                <CreatorFeatured />
                <SubmissionDashboard admin />
              </>
            }
            mods={<ModDashboard admin />}
          />
        ) : (
          <div className="empty-surface">
            <h2>
              <Bilingual
                zh="此账号没有审核权限。"
                en="This account does not have moderator access."
              />
            </h2>
          </div>
        )}
      </main>
      <AtlasFooter />
    </>
  );
}
