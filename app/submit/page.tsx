import { requireChatGPTUser } from "@/app/chatgpt-auth";
import { AtlasHeader, AtlasFooter, PageTitle } from "@/components/atlas-shell";
import { SubmissionForm } from "@/components/submission-form";
import { CreationSwitch } from "@/components/creation-tabs";
export const dynamic = "force-dynamic";
export default async function Submit() {
  await requireChatGPTUser("/submit");
  return (
    <>
      <AtlasHeader />
      <main className="shell">
        <PageTitle
          eyebrow="CONTRIBUTE TO THE ATLAS"
          title="把你的战场，交给下一位指挥官。"
          text="提交地图与 Mod 说明，审核通过后收录到社区档案。"
        />
        <CreationSwitch active="maps" />
        <SubmissionForm />
      </main>
      <AtlasFooter />
    </>
  );
}
