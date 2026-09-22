"use client";

import {useRef,useState,type FormEvent} from "react";
import {ArrowUpRight,FileArchive,Save,ShieldCheck} from "lucide-react";
import Link from "@/components/site-link";
import {useI18n} from "@/components/i18n";
import {Button} from "@/components/ui/button";
import {Checkbox} from "@/components/ui/checkbox";
import {Input} from "@/components/ui/input";
import {Textarea} from "@/components/ui/textarea";
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from "@/components/ui/select";
import {emptyMod,kindLabels,usageLabels,usageStates,type ModBody,type ModEntry} from "@/lib/mod-types";

export function ModEditor({initial,admin=false}:{initial?:ModEntry;admin?:boolean}){
 const {locale}=useI18n();
 const l=(zh:string,en:string)=>locale==="en"?en:zh;
 const [data,setData]=useState<ModBody>(()=>({...emptyMod,...initial}));
 const [rights,setRights]=useState(false);
 const [busy,setBusy]=useState(false);
 const [dirty,setDirty]=useState(false);
 const [error,setError]=useState("");
 const [fileName,setFileName]=useState("");
 const submissionId=useRef<string|null>(null);
 const submitting=useRef(false);
 const curated=!!initial&&initial.origin!=="community"&&admin;
 const change=<K extends keyof ModBody>(key:K,value:ModBody[K])=>{
  setData(current=>({...current,[key]:value}));
  setDirty(true);
 };

 async function save(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  if(submitting.current)return;
  const form=new FormData(event.currentTarget);
  for(const key of Object.keys(emptyMod) as (keyof ModBody)[])form.set(key,data[key].trim());
  form.set("revision",String(initial?.revision??0));
  form.set("rights",String(rights));
  const file=form.get("file");
  const hasFile=file instanceof File&&file.size>0;
  if(hasFile&&(!/\.(lua|zip)$/i.test(file.name)||file.size>10*1024*1024)){
   setError(l("请选择 10 MB 以内的 .lua 或 .zip 文件。","Choose a .lua or .zip file no larger than 10 MB."));
   return;
  }
  if(!initial&&!data.mod_code.trim()&&!data.source_url.trim()&&!hasFile){
   setError(l("请至少提供一个 Mod 分享码、来源链接或文件。","Provide at least one mod code, source URL, or file."));
   return;
  }
  if(!rights){
   setError(l("请先确认分享授权与公开范围。","Please confirm sharing permission and the publication scope."));
   return;
  }
  submitting.current=true;
  setBusy(true);
  setError("");
  try{
   const headers:Record<string,string>={};
   if(!initial){submissionId.current??=crypto.randomUUID();headers["X-Submission-Id"]=submissionId.current;}
   const response=await fetch(initial?`/api/mods/${encodeURIComponent(initial.id)}`:"/api/mods",{
    method:initial?"PATCH":"POST",headers,body:form,
   });
   const result=await response.json() as {error?:string;item?:{id:string;status?:string}};
   if(!response.ok)throw new Error(result.error||l("保存失败，内容仍保留，请重试。","Saving failed. Your content is still here; please try again."));
   if(!result.item?.id)throw new Error(l("服务器未返回作品编号，请刷新“我的投稿”确认结果后再试。","No entry ID was returned. Check My submissions before retrying."));
   const published=curated&&(result.item.status??initial?.status)==="approved";
   window.location.assign(published?`/mods/${encodeURIComponent(result.item.id)}`:"/submissions");
  }catch(cause){
   setError(cause instanceof Error?cause.message:l("保存未完成，内容仍保留，请重试。","Saving did not finish. Your content is still here; please try again."));
   submitting.current=false;
   setBusy(false);
  }
 }

 return <form className="map-editor" onSubmit={save}>
  <div className="editor-banner">
   <span><Save size={18}/>{dirty?l("有尚未保存的修改","You have unsaved changes"):initial?l("正在编辑 Mod 档案","Editing a mod dossier"):l("建立新的 Mod 档案","Create a new mod dossier")}</span>
   <div><Link className="button" href={curated?`/mods/${encodeURIComponent(initial.id)}`:"/submissions"}>{curated?l("查看 Mod","View mod"):l("我的投稿","My submissions")}<ArrowUpRight size={16}/></Link>
    <Button className="button primary" type="submit" disabled={busy||!rights}>{busy?l("正在保存…","Saving…"):curated?l("保存并更新档案","Save and publish changes"):initial?l("保存并重新提交审核","Save and resubmit"):l("提交审核","Submit for review")}</Button>
   </div>
  </div>
  {error&&<p className="notice error" role="alert">{error}</p>}
  <div className="mod-editor-layout">
   <section className="atlas-form panel">
    <div className="form-section-heading"><span>01</span><div><h2>{l("Mod 基本资料","Mod essentials")}</h2><p>{l("请填写实际功能、测试情况与玩家需要知道的限制。","Describe actual features, testing, and the limitations players need to know.")}</p></div></div>
    <div className="mod-form-grid">
     <label>{l("Mod 名称（必填）","Mod title (required)")}<Input name="title" required minLength={3} maxLength={100} value={data.title} onChange={e=>change("title",e.target.value)}/></label>
     <label>{l("作者 / 团队名（必填）","Author / team (required)")}<Input name="author" required minLength={2} maxLength={80} value={data.author} onChange={e=>change("author",e.target.value)}/></label>
     <label>{l("Mod 类型","Mod type")}<Select value={data.kind} onValueChange={value=>change("kind",value)}><SelectTrigger aria-label={l("Mod 类型","Mod type")}><SelectValue/></SelectTrigger><SelectContent>{Object.entries(kindLabels).map(([value,label])=><SelectItem key={value} value={value}>{l(...label)}</SelectItem>)}</SelectContent></Select></label>
     <label>{l("使用状态","Usage status")}<Select value={data.usage_status} onValueChange={value=>change("usage_status",value)}><SelectTrigger aria-label={l("使用状态","Usage status")}><SelectValue/></SelectTrigger><SelectContent>{usageStates.map(value=><SelectItem key={value} value={value}>{l(...usageLabels[value])}</SelectItem>)}</SelectContent></Select></label>
     <label>{l("实际测试游戏版本（选填）","Tested game version (optional)")}<Input name="game_version" maxLength={100} value={data.game_version} onChange={e=>change("game_version",e.target.value)} placeholder={l("未测试时请明确说明","State clearly if untested")}/></label>
     <label>{l("关联地图（选填）","Associated map (optional)")}<Select value={data.map_slug||"none"} onValueChange={value=>change("map_slug",value==="none"?"":value)}><SelectTrigger aria-label={l("关联地图","Associated map")}><SelectValue/></SelectTrigger><SelectContent><SelectItem value="none">{l("不关联地图","No associated map")}</SelectItem><SelectItem value="stalingrad">{l("斯大林格勒","Stalingrad")}</SelectItem></SelectContent></Select></label>
    </div>
    <label>{l("简短介绍（必填，10–300 字）","Summary (required, 10–300 characters)")}<Textarea name="summary" rows={3} required minLength={10} maxLength={300} value={data.summary} onChange={e=>change("summary",e.target.value)}/></label>
    <label>{l("详细介绍（必填，20–12,000 字）","Detailed description (required, 20–12,000 characters)")}<Textarea name="description" rows={9} required minLength={20} maxLength={12000} value={data.description} onChange={e=>change("description",e.target.value)} placeholder={l("介绍功能、适用场景、修改内容与已知问题。","Describe features, intended use, changes, and known issues.")}/></label>
    <div className="form-section-heading"><span>02</span><div><h2>{l("分享码与使用说明","Codes and usage instructions")}</h2><p>{l("新投稿至少提供分享码、来源链接或文件中的一项。","New submissions need at least one mod code, source URL, or file.")}</p></div></div>
    <label>{l("游戏内 Mod 分享码（选填）","In-game mod codes (optional)")}<Textarea name="mod_code" rows={4} maxLength={2000} value={data.mod_code} onChange={e=>change("mod_code",e.target.value)} placeholder={l("玩法 Mod：mod-…\n视觉 Mod：mod-…","Gameplay mod: mod-…\nVisual mod: mod-…")}/><span className="mod-code-hint">{l("每行一个 mod-… 分享码，可在分享码前附上名称或用途标签；请勿填写示例码。","One mod-… code per line; an optional name or usage label may precede the code. Do not submit example codes.")}</span></label>
    <label>{l("安装步骤、依赖与加载顺序（选填）","Installation, dependencies, and load order (optional)")}<Textarea name="instructions" rows={7} maxLength={6000} value={data.instructions} onChange={e=>change("instructions",e.target.value)} placeholder={l("写明导入方法、必须或可选的依赖，以及玩法 / 视觉 Mod 的加载位置与顺序。","Explain importing, required or optional dependencies, and where and in which order to load gameplay / visual mods.")}/></label>
    <label>{l("兼容性、冲突与测试范围（选填）","Compatibility, conflicts, and testing scope (optional)")}<Textarea name="compatibility" rows={5} maxLength={3000} value={data.compatibility} onChange={e=>change("compatibility",e.target.value)} placeholder={l("注明已测试地图、客户端版本、不兼容的 Mod 与尚未验证的情况。","List tested maps and client versions, incompatible mods, and anything not yet verified.")}/></label>
    <div className="form-section-heading"><span>03</span><div><h2>{l("英文资料（选填）","English content (optional)")}</h2><p className="bilingual-note">{l("未提供英文时，英文页面将保留原文。","When English is omitted, the English page keeps the original content.")}</p></div></div>
    <label>{l("英文名称（选填）","English title (optional)")}<Input name="title_en" lang="en" maxLength={100} value={data.title_en} onChange={e=>change("title_en",e.target.value)}/></label>
    <label>{l("英文简短介绍（选填）","English summary (optional)")}<Textarea name="summary_en" lang="en" rows={3} maxLength={500} value={data.summary_en} onChange={e=>change("summary_en",e.target.value)}/></label>
    <label>{l("英文详细介绍（选填）","English description (optional)")}<Textarea name="description_en" lang="en" rows={6} maxLength={18000} value={data.description_en} onChange={e=>change("description_en",e.target.value)}/></label>
    <label>{l("英文安装步骤、依赖与加载顺序（选填）","English installation, dependencies, and load order (optional)")}<Textarea name="instructions_en" lang="en" rows={5} maxLength={9000} value={data.instructions_en} onChange={e=>change("instructions_en",e.target.value)}/></label>
    <label>{l("英文兼容性说明（选填）","English compatibility notes (optional)")}<Textarea name="compatibility_en" lang="en" rows={4} maxLength={4500} value={data.compatibility_en} onChange={e=>change("compatibility_en",e.target.value)}/></label>
   </section>
   <aside className="detail-aside">
    <section className="atlas-form panel">
     <div className="form-section-heading"><FileArchive size={24}/><div><h2>{l("文件与来源","Files and attribution")}</h2><p>{l("只分享你有权公开的内容。","Share only content you have permission to publish.")}</p></div></div>
     <label>{l("来源链接（选填）","Source URL (optional)")}<Input name="source_url" type="url" maxLength={500} value={data.source_url} onChange={e=>change("source_url",e.target.value)} placeholder="https://…"/></label>
     <label>{l("授权 / 许可证（选填）","Permission / license (optional)")}<Input name="license" maxLength={200} value={data.license} onChange={e=>change("license",e.target.value)} placeholder={l("许可证名称或作者授权说明","License name or author permission details")}/></label>
     <label className="upload-box"><FileArchive size={28}/><strong>{fileName||l(initial?"替换 Mod 文件（选填）":"上传 Mod 文件（选填）",initial?"Replace mod file (optional)":"Upload mod file (optional)")}</strong><span>{l(".lua / .zip · 最大 10 MB",".lua / .zip · Up to 10 MB")}</span><Input name="file" type="file" accept=".lua,.zip,application/zip" onChange={e=>{setFileName(e.target.files?.[0]?.name||"");setDirty(true);}}/></label>
     {initial&&<p className="caption">{initial.has_file?`${l("当前文件：","Current file: ")}${initial.file_name}`:l("当前没有下载文件。","No download file is currently attached.")} {l("不选择新文件，将保留原文件。","Leave the file field empty to keep the existing file.")}</p>}
     <p className="caption">{l("请勿上传可执行安装器、账号信息、私人资料或未授权素材。文件检查不等于自动病毒扫描。","Do not upload executable installers, account details, private information, or unauthorized assets. File checks are not an automatic virus scan.")}</p>
    </section>
    <section className="panel"><ShieldCheck size={28}/><h3>{curated?l("管理员维护的精选档案","Admin-maintained curated entry"):l("审核通过后公开","Published after review")}</h3><p>{curated?l("精选档案的资料修改立即生效；保存前请核对分享码、说明与文件。","Curated metadata changes take effect immediately. Check codes, instructions, and files before saving."):l("新投稿和社区作品修改会进入待审核状态；审核通过前不会公开更新。","New submissions and community edits enter review. Updates are not public until approved.")}</p><p className="caption">{l("版本冲突时不会覆盖他人的修改。离开此页前请保存，未保存内容不会自动同步。","Revision conflicts will not overwrite someone else's changes. Save before leaving; unsaved content is not synced.")}</p></section>
    {initial?.feedback&&<section className="panel"><h3>{l("审核反馈","Review feedback")}</h3><p className="mod-detail-copy">{initial.feedback}</p></section>}
    <section className="panel"><label className="check-line rights"><Checkbox checked={rights} onCheckedChange={value=>setRights(value===true)} aria-label={l("确认分享授权","Confirm sharing permission")}/><span>{l("我拥有或已获授权分享上述内容，同意审核通过后公开资料、作者名、分享码及上传文件。我已阅读","I own or have permission to share this content and agree to publish its details, author name, codes, and uploaded file after approval. I have read the ")}<Link className="text-link inline-link" href="/guidelines" target="_blank" rel="noopener noreferrer">{l("投稿规范","submission guidelines")}</Link>{l("。",".")}</span></label><Button className="button primary mt-5" type="submit" disabled={busy||!rights}>{busy?l("正在保存…","Saving…"):curated?l("保存并更新档案","Save and publish changes"):initial?l("保存并重新提交审核","Save and resubmit"):l("提交审核","Submit for review")}<ArrowUpRight size={16}/></Button></section>
   </aside>
  </div>
 </form>;
}
