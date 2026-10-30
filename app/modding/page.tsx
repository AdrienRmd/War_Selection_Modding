import { AtlasHeader, AtlasFooter, PageTitle } from "@/components/atlas-shell";
import { ModdingTreeBrowser } from "@/components/modding-tree";
import homeRaw from "@/lib/modding-home.json";
import { moddingMeta, type ModdingHome } from "@/lib/modding";
export const dynamic = "force-dynamic";
export const metadata = { title: "参数档案 | WS ATLAS" };
export default async function Modding({
  searchParams,
}: {
  searchParams: Promise<{ path?: string }>;
}) {
  const params = await searchParams;
  // Les clés du jeu sont [A-Za-z0-9_-] jointes par des points : on épure et
  // borne l'entrée pour ne jamais propager d'URL hostile dans le fil d'Ariane.
  const initialPath =
    typeof params.path === "string"
      ? params.path
          .replace(/[^A-Za-z0-9_.-]/g, "")
          .replace(/\.+/g, ".")
          .replace(/^\.|\.$/g, "")
          .slice(0, 512)
      : "";
  return (
    <>
      <AtlasHeader />
      <main className="shell">
        <PageTitle
          eyebrow="WAR SELECTION / MODDING ARCHIVE"
          title="参数档案"
          text="浏览游戏参数树：按节点展开数值、字符串与函数签名，支持路径搜索与深链；数据来自公开导出，只读。"
        />
        <ModdingTreeBrowser
          home={homeRaw as ModdingHome}
          meta={moddingMeta}
          initialPath={initialPath}
        />
      </main>
      <AtlasFooter />
    </>
  );
}
