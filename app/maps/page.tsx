import Link from '@/components/site-link';
import {AtlasHeader,AtlasFooter,PageTitle} from '@/components/atlas-shell';
import {Bilingual} from '@/components/i18n';
import {CollectedMaps} from '@/components/collected-maps';
import {CommunityMaps} from '@/components/community-maps';
import {collectedMaps} from '@/lib/collection-server';
import {identity} from '@/lib/atlas-server';
export const dynamic='force-dynamic';
export const metadata={title:'地图档案 | WS ATLAS'};
export default async function Maps(){const viewer=await identity();let content;try{content=<CollectedMaps items={await collectedMaps()} admin={viewer.admin}/>;}catch{content=<p className="notice error"><Bilingual zh="收藏地图暂时无法读取，请稍后重试。" en="Saved maps are temporarily unavailable. Please try again."/></p>;}return <><AtlasHeader/><main className="shell"><PageTitle eyebrow="WAR SELECTION / MAP ARCHIVE" title="地图档案" text="寻找下一张地图，查看原始预览与分享码；测试状态独立标注。"/><div className="collection-management"><div><h2><Bilingual zh="精选战场 · 斯大林格勒" en="Featured battlefield · Stalingrad"/></h2><p><Bilingual zh="30 人历史战役，独立维护的玩法与 Mod 档案。" en="A 30-player historical battle with its own gameplay and mod archive."/></p></div><Link className="button" href="/maps/stalingrad"><Bilingual zh="查看斯大林格勒" en="View Stalingrad"/></Link></div>{content}<CommunityMaps/></main><AtlasFooter/></>}
