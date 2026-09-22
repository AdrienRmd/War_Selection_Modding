import { requireChatGPTUser } from "@/app/chatgpt-auth";
import { AtlasHeader, AtlasFooter, PageTitle } from "@/components/atlas-shell";
import { Bilingual } from "@/components/i18n";
import { CollectedMaps } from "@/components/collected-maps";
import { collectedMaps } from "@/lib/collection-server";
import { isAdmin } from "@/lib/atlas-server";
import type { CollectedMap } from "@/lib/collection";
export const dynamic = "force-dynamic";
export const metadata = { title: "收藏地图管理 | WS ATLAS" };
export default async function ManageCollection() {
  const user = await requireChatGPTUser("/maps/collection/manage");
  const admin = isAdmin(user);
  let items: CollectedMap[] | null = null;
  if (admin) {
    try {
      items = await collectedMaps(true);
    } catch {
      items = null;
    }
  }
  const content = !admin ? (
    <p className="notice error">
      <Bilingual
        zh="只有管理员可以维护收藏地图。"
        en="Only administrators can maintain saved-map records."
      />
    </p>
  ) : items === null ? (
    <p className="notice error">
      <Bilingual
        zh="收藏资料暂时无法读取，请稍后重试。"
        en="Saved-map records are unavailable. Please try again later."
      />
    </p>
  ) : (
    <CollectedMaps items={items} admin manage />
  );
  return (
    <>
      <AtlasHeader />
      <main className="shell">
        <PageTitle
          eyebrow="CURATOR / MAP COLLECTION"
          title="收藏地图管理"
          text="补充原作者与玩法，记录实测结果，隐藏或恢复条目。"
        />
        {content}
      </main>
      <AtlasFooter />
    </>
  );
}
