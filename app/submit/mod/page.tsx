import {requireChatGPTUser} from "@/app/chatgpt-auth";
import {AtlasHeader,AtlasFooter,PageTitle} from "@/components/atlas-shell";
import {Bilingual} from "@/components/i18n";
import {ModEditor} from "@/components/mod-editor";
import Link from "@/components/site-link";
import {identity} from "@/lib/atlas-server";

export const dynamic="force-dynamic";
export const metadata={title:"提交 Mod / Submit mod | WS ATLAS"};

export default async function SubmitMod(){
 await requireChatGPTUser("/submit/mod");
 const {admin}=await identity();
 return <><AtlasHeader/><main className="shell"><div className="chinese-only"><PageTitle eyebrow="共建资料库 / MOD 投稿" title="分享你的 Mod，让新玩法被发现。" text="提供真实分享码、清晰使用说明与授权信息，审核通过后加入社区资料库。"/></div><div className="english-only"><PageTitle eyebrow="CONTRIBUTE / SUBMIT A MOD" title="Share your mod. Make new ways to play discoverable." text="Provide real codes, clear instructions, and permission details. Approved submissions join the community library."/></div><nav className="creation-switch" aria-label="投稿类型 / Submission type"><Link href="/submit"><Bilingual zh="提交地图" en="Submit a map"/></Link><Link href="/submit/mod" aria-current="page"><Bilingual zh="提交 Mod" en="Submit a mod"/></Link></nav><ModEditor admin={admin}/></main><AtlasFooter/></>;
}
