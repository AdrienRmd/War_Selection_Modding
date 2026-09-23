import { requireChatGPTUser } from "@/app/chatgpt-auth";
import { AtlasHeader, AtlasFooter, PageTitle } from "@/components/atlas-shell";
import { CreationSwitch } from "@/components/creation-tabs";
import { ModEditor } from "@/components/mod-editor";
import { identity } from "@/lib/atlas-server";

export const dynamic = "force-dynamic";
export const metadata = { title: "提交 Mod / Submit mod | WS ATLAS" };

export default async function SubmitMod() {
  await requireChatGPTUser("/submit/mod");
  const { admin } = await identity();
  return (
    <>
      <AtlasHeader />
      <main className="shell">
        <PageTitle
          eyebrow="共建资料库 / MOD 投稿"
          title="分享你的 Mod，让新玩法被发现。"
          text="提供真实分享码、清晰使用说明与授权信息，审核通过后加入社区资料库。"
        />
        <CreationSwitch active="mods" />
        <ModEditor admin={admin} />
      </main>
      <AtlasFooter />
    </>
  );
}
