import { T } from "@/components/i18n";
import { requireChatGPTUser } from "@/app/chatgpt-auth";
import { AtlasHeader, AtlasFooter, PageTitle } from "@/components/atlas-shell";
import { MapEditor } from "@/components/map-editor";
import { CollectedMapEditor } from "@/components/collected-map-editor";
import { collectionSeed, type CollectedMap } from "@/lib/collection";
import { collectedMap } from "@/lib/collection-server";
import { bindings, isAdmin, publicMap, type MapRecord } from "@/lib/atlas-server";
import { getFeaturedMap } from "@/lib/featured-server";
import type { EditableMap } from "@/lib/map-content";
export const dynamic = "force-dynamic";
export const metadata = { title: "编辑地图 | WS ATLAS" };
export default async function EditMap({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <EditorContent slug={slug} />;
}
async function EditorContent({ slug }: { slug: string }) {
  const user = await requireChatGPTUser(`/maps/${encodeURIComponent(slug)}/edit`);
  const admin = isAdmin(user);
  type Editor =
    | { view: "collection"; item: CollectedMap }
    | { view: "map"; initial: EditableMap }
    | { view: "notice"; text: string };
  let editor: Editor;
  try {
    if (collectionSeed(slug)) {
      const item = admin ? await collectedMap(slug) : null;
      editor = item
        ? { view: "collection", item }
        : { view: "notice", text: "只有管理员可以维护收藏地图。" };
    } else if (slug === "stalingrad") {
      editor = admin
        ? { view: "map", initial: await getFeaturedMap() }
        : { view: "notice", text: "只有管理员可以编辑此精选档案。" };
    } else {
      const m = await bindings()
        .DB.prepare("SELECT * FROM maps WHERE id = ?")
        .bind(slug)
        .first<MapRecord>();
      editor =
        m && (admin || m.owner_id === user.userId)
          ? {
              view: "map",
              initial: { ...publicMap(m), revision: m.revision, status: m.status, has_file: true },
            }
          : { view: "notice", text: "没有可编辑的地图，或你没有此地图的编辑权限。" };
    }
  } catch {
    editor = { view: "notice", text: "暂时无法加载编辑内容，请稍后重试。" };
  }
  const content =
    editor.view === "collection" ? (
      <CollectedMapEditor initial={editor.item} />
    ) : editor.view === "map" ? (
      <MapEditor initial={editor.initial} />
    ) : (
      <p className="notice error">
        <T text={editor.text} />
      </p>
    );
  return (
    <>
      <AtlasHeader />
      <main className="shell">
        <PageTitle
          eyebrow="CREATOR / MAP EDITOR"
          title="编辑地图档案"
          text="维护资料、更新文件，让玩家看到当前版本。"
        />
        <T text={content} />
      </main>
      <AtlasFooter />
    </>
  );
}
