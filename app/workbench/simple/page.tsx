import { AtlasHeader, AtlasFooter } from "@/components/atlas-shell";
import { SimpleWorkbench } from "@/components/simple-workbench";
import { unitsIndex } from "@/lib/units";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "简易 Mod 工作台 | WS ATLAS",
  description:
    "三步创建 War Selection 平衡 Mod：选择单位、修改数值（原值可见）、导出 Lua。数据来自当前同步的游戏版本。",
};
export default function WorkbenchSimple() {
  // Étape 1 rendue côté serveur (recherche + cartes depuis l'index embarqué) :
  // le HTML initial contient déjà la liste des unités avant tout chargement JS.
  return (
    <>
      <AtlasHeader />
      <SimpleWorkbench index={unitsIndex} />
      <AtlasFooter />
    </>
  );
}
