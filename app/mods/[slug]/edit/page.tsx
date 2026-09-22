import { requireChatGPTUser } from "@/app/chatgpt-auth";
import { AtlasHeader, AtlasFooter, PageTitle } from "@/components/atlas-shell";
import { Bilingual } from "@/components/i18n";
import { ModEditor } from "@/components/mod-editor";
import { identity } from "@/lib/atlas-server";
import { publicMod, rawMod } from "@/lib/mod-server";
import type { ModEntry } from "@/lib/mod-types";

export const dynamic = "force-dynamic";
export const metadata = { title: "编辑 Mod / Edit mod | WS ATLAS" };

export default async function EditMod({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await requireChatGPTUser(`/mods/${encodeURIComponent(slug)}/edit`);
  const { admin } = await identity();
  let entry: ModEntry | undefined;
  let failed = false;
  try {
    const record = await rawMod(slug);
    // Authorize the raw record before serializing any private entry or feedback.
    if (record && (admin || record.owner_id === user.userId)) entry = publicMod(record, true);
  } catch {
    failed = true;
  }
  const content = failed ? (
    <p className="notice error">
      <Bilingual
        zh="暂时无法加载编辑内容，请稍后重试。"
        en="The editor could not be loaded. Please try again later."
      />
    </p>
  ) : entry ? (
    <ModEditor initial={entry} admin={admin} />
  ) : (
    <p className="notice error">
      <Bilingual
        zh="没有可编辑的 Mod，或你没有此作品的编辑权限。"
        en="This mod is unavailable, or you do not have permission to edit it."
      />
    </p>
  );
  return (
    <>
      <AtlasHeader />
      <main className="shell">
        <div className="chinese-only">
          <PageTitle
            eyebrow="创作中心 / MOD 编辑"
            title="编辑 Mod 档案"
            text="维护分享码、使用说明与文件，让玩家看到可靠的当前版本。"
          />
        </div>
        <div className="english-only">
          <PageTitle
            eyebrow="CREATOR / MOD EDITOR"
            title="Edit mod dossier"
            text="Maintain codes, instructions, and files so players can find a reliable current version."
          />
        </div>
        {content}
      </main>
      <AtlasFooter />
    </>
  );
}
