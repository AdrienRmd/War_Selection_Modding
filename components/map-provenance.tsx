'use client';
import Link from '@/components/site-link';
import {useI18n} from '@/components/i18n';
import type {MapProvenance as Provenance} from '@/lib/collection';
import {GitBranch,ExternalLink} from 'lucide-react';

export function MapProvenance({map}:{map:Provenance}){
  const {locale}=useI18n();const en=locale==='en';
  if(!map.sources?.length&&!map.relation_note&&!map.related_maps?.length)return null;
  const editions={original:['原版','Original'],variant:['玩法版本','Gameplay variant'],remix:['改编版','Remix']};
  return <section className="panel map-provenance"><div className="section-head"><h2><GitBranch size={20}/>{en?'Origins & editions':'来源与版本关系'}</h2>{map.edition&&<span className="collection-state">{editions[map.edition][en?1:0]}</span>}</div>
    {map.map_version&&<p className="caption">{en?'Map version in source: ':'原帖地图版本：'}{map.map_version}</p>}
    {map.relation_note&&<p>{en?map.relation_note_en||map.relation_note:map.relation_note}</p>}
    {!!map.related_maps?.length&&<div className="map-related">{map.related_maps.map(r=><Link key={r.id} href={`/maps/${r.id}`} className="text-link">{en?r.label_en:r.label} →</Link>)}</div>}
    {!!map.sources?.length&&<div className="map-sources">{map.sources.map(s=><a key={s.url} href={s.url} target="_blank" rel="noreferrer">{en?s.label_en:s.label}<ExternalLink size={14}/></a>)}<small>{en?'Discord may require sign-in and server access. Source rules are not current-version test results.':'Discord 原帖可能需要登录并加入服务器。原帖规则不代表当前版本实测结果。'}</small></div>}
  </section>;
}
export function StalingradProvenance(){return <MapProvenance map={{edition:'remix',relation_note:'Austin 的斯大林格勒是原版《Battle of Stalingrad》的改编版本（作者本人确认）。原版由 Yurky 发布；两者的规则、Mod 和测试记录分开维护。',relation_note_en:'Austin confirms this Stalingrad is a remix of the original Battle of Stalingrad, published by Yurky. Rules, mods and test records are maintained separately.',related_maps:[{id:'map-00200088',label:'查看原版 · Battle of Stalingrad',label_en:'Original · Battle of Stalingrad'}]}}/>;}
