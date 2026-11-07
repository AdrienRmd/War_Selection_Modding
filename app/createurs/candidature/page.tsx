import { AtlasHeader, AtlasFooter, PageTitle } from "@/components/atlas-shell";
import { requireChatGPTUser } from "@/app/chatgpt-auth";
import { CreatorApplicationForm } from "@/components/creator-application-form";
import { pageMetadata } from "@/lib/page-metadata";
import "../../creators.css";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return pageMetadata("creatorApply");
}

/** Page /createurs/candidature — formulaire « devenir créateur » pour tout
 *  compte connecté (redirection vers /signin sinon, avec retour). */
export default async function CreatorApplyPage() {
  const user = await requireChatGPTUser("/createurs/candidature");
  return (
    <>
      <AtlasHeader />
      <main className="shell">
        <PageTitle
          eyebrow="CREATORS"
          title="成为内容创作者"
          text="提交后会由管理员审核：名称、简介、社交链接与要关联的作品都可以在这里填写。"
        />
        <CreatorApplicationForm defaultName={user.displayName} />
      </main>
      <AtlasFooter />
    </>
  );
}
