import {AtlasHeader,AtlasFooter,PageTitle} from "@/components/atlas-shell";
import {ModLibrary} from "@/components/mod-library";
import {listMods} from "@/lib/mod-server";
export const dynamic="force-dynamic";
export const metadata={title:"Mod library | WS ATLAS"};
export default async function Mods(){const entries=await listMods();return <><AtlasHeader/><main className="shell"><PageTitle eyebrow="MOD INTELLIGENCE / LIBRARY" title="规则背后的完整档案。" text="独立查看 Mod 功能与兼容说明。地图只关联资料，不再与资料库混在一起。"/><ModLibrary entries={entries}/></main><AtlasFooter/></>}
