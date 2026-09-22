
import {T} from "@/components/i18n";
import {requireChatGPTUser} from "@/app/chatgpt-auth";
import {AtlasHeader,AtlasFooter,PageTitle} from "@/components/atlas-shell";
import {MapEditor} from "@/components/map-editor";
import {CollectedMapEditor} from "@/components/collected-map-editor";
import {collectionSeed} from "@/lib/collection";
import {collectedMap} from "@/lib/collection-server";
import {bindings,isAdmin,publicMap,type MapRecord} from "@/lib/atlas-server";
import {getFeaturedMap} from "@/lib/featured-server";
export const dynamic="force-dynamic";
export const metadata={title:"编辑地图 | WS ATLAS"};
export default async function EditMap({params}:{params:Promise<{slug:string}>}){const {slug}=await params;return <EditorContent slug={slug}/>;}
async function EditorContent({slug}:{slug:string}){const user=await requireChatGPTUser(`/maps/${encodeURIComponent(slug)}/edit`);const admin=isAdmin(user);let content;
 try{if(collectionSeed(slug)){const item=admin?await collectedMap(slug):null;content=item?<CollectedMapEditor initial={item}/>:<p className="notice error"><T text="只有管理员可以维护收藏地图。"/></p>;}else if(slug==="stalingrad"){content=admin?<MapEditor initial={await getFeaturedMap()}/>:<p className="notice error"><T text={"只有管理员可以编辑此精选档案。"}/></p>;}else{const m=await bindings().DB.prepare("SELECT * FROM maps WHERE id = ?").bind(slug).first<MapRecord>();content=m&&(admin||m.owner_id===user.userId)?<MapEditor initial={{...publicMap(m),revision:m.revision,status:m.status,has_file:true}}/>:<p className="notice error"><T text={"没有可编辑的地图，或你没有此地图的编辑权限。"}/></p>;}}catch{content=<p className="notice error"><T text={"暂时无法加载编辑内容，请稍后重试。"}/></p>;}
 return <><AtlasHeader/><main className="shell"><PageTitle eyebrow="CREATOR / MAP EDITOR" title="编辑地图档案" text="维护资料、更新文件，让玩家看到当前版本。"/><T text={content}/></main><AtlasFooter/></>;
}
