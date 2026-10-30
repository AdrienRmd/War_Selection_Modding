import { requireChatGPTUser, getChatGPTUser } from "@/app/chatgpt-auth";
import type { Metadata } from "next";
import { pageMetadata } from "@/lib/page-metadata";
import { AtlasHeader, AtlasFooter, PageTitle } from "@/components/atlas-shell";
import { SubmissionForm } from "@/components/submission-form";
import { CreationSwitch } from "@/components/creation-tabs";
export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("submit");
}
export default async function Submit() {
  await requireChatGPTUser("/submit");
  // SB7-a : pré-remplissage de l'auteur avec le pseudo du compte (une saisie
  // de moins) — le champ reste éditable pour les pseudonymes d'équipe.
  const viewer = await getChatGPTUser();
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
        <SubmissionForm initialAuthor={viewer?.displayName || ""} />
      </main>
      <AtlasFooter />
    </>
  );
}
