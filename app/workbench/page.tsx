import {AtlasHeader,AtlasFooter} from "@/components/atlas-shell";
import {ModWorkbench} from "@/components/mod-workbench";
export const dynamic="force-dynamic";
export const metadata={title:"Mod 工作台 | WS ATLAS",description:"编辑 War Selection 单位、武器、经济、建造、科技与技能参数，查看效果说明，设置前置条件并导出 Lua。"};
export default function Workbench(){return <><AtlasHeader/><ModWorkbench/><AtlasFooter/></>}
