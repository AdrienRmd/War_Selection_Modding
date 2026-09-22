import {z} from 'zod';
import {bindings,identity,HttpError,sameOrigin,limitedBody,json} from '@/lib/atlas-server';
import {rawMod,listMods,publicMod,seedRecord} from '@/lib/mod-server';
import {usageStates,kindLabels,type ModRecord} from '@/lib/mod-types';
export const dynamic='force-dynamic';
const fields=z.object({title:z.string().trim().min(3).max(100),title_en:z.string().trim().max(100),author:z.string().trim().min(2).max(80),summary:z.string().trim().min(10).max(300),summary_en:z.string().trim().max(500),description:z.string().trim().min(20).max(12000),description_en:z.string().trim().max(18000),instructions:z.string().trim().max(6000),instructions_en:z.string().trim().max(9000),compatibility:z.string().trim().max(3000),compatibility_en:z.string().trim().max(4500),game_version:z.string().trim().max(100),mod_code:z.string().trim().max(2000),source_url:z.string().trim().max(500),license:z.string().trim().max(200),map_slug:z.enum(['','stalingrad']),kind:z.string().refine(v=>Object.hasOwn(kindLabels,v)),usage_status:z.enum(usageStates)});
const checks=['ownership','files','gameplay','description'] as const;
// Drain rejected, bounded uploads without retaining bytes. Returning with an
// unread/cancelled small body can reset a reused local HTTP/1.1 connection.
async function discardUnusedBody(req:Request){if(!req.body||req.bodyUsed||req.body.locked)return;const reader=req.body.getReader();let size=0;try{while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>11*1024*1024){await reader.cancel();break}}}catch{/* Client disconnected; preserve the original response. */}finally{reader.releaseLock()}}
async function route(req:Request,ctx:{params:Promise<{path?:string[]}>}){let uploaded:string|undefined;try{
 const path=(await ctx.params).path||[],action=path[0];const {user,admin}=await identity();const {DB,BUCKET}=bindings();
 if(req.method!=='GET')sameOrigin(req);
 if(req.method==='GET'&&!action)return json({items:await listMods(user?.userId,admin)});
 if(req.method==='GET'&&action==='submissions'){if(!user)throw new HttpError(401,'Please sign in. / 请先登录。');const adminScope=new URL(req.url).searchParams.get('scope')==='admin';if(adminScope&&!admin)throw new HttpError(403,'Admin access required. / 需要管理员权限。');if(adminScope)return json({items:await listMods(user.userId,true,true)});const own=await listMods(user.userId,false,true);const curated=admin?(await listMods(user.userId,true,true)).filter(m=>m.origin!=='community'):[];return json({items:[...curated,...own]});}
 if(req.method==='GET'){
  const target=action==='files'?path[1]:action;if(!target)throw new HttpError(404,'Mod unavailable. / Mod 尚未公开。');const m=await rawMod(target);if(!m||(m.status!=='approved'&&m.owner_id!==user?.userId&&!admin))throw new HttpError(404,'Mod unavailable. / Mod 尚未公开。');
  if(action!=='files')return json({item:publicMod(m,!!user&&(admin||m.owner_id===user.userId))});
  if(!m.file_key)throw new HttpError(404,'No downloadable file. / 尚无下载文件。');const obj=await BUCKET.get(m.file_key);if(!obj)throw new HttpError(404,'File not found. / 未找到文件。');
  return new Response(obj.body,{headers:{'Content-Type':'application/octet-stream','Content-Disposition':`attachment; filename="mod${m.file_name.endsWith('.lua')?'.lua':'.zip'}"; filename*=UTF-8''${encodeURIComponent(m.file_name)}`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox"}});
 }
 if(!user)throw new HttpError(401,'Please sign in. / 请先登录。');
 if(action==='review'&&path[1]&&req.method==='PATCH'){
  if(!admin)throw new HttpError(403,'Admin access required. / 需要管理员权限。');const b=z.object({status:z.enum(['approved','rejected']),feedback:z.string().trim().min(5).max(2000),revision:z.number().int().min(0),checks:z.array(z.enum(checks))}).parse(JSON.parse(new TextDecoder().decode(await limitedBody(req,16000))));
  const m=await DB.prepare('SELECT * FROM community_mods WHERE id = ?').bind(path[1]).first<ModRecord>();if(!m||m.status==='withdrawn')throw new HttpError(404,'Submission unavailable. / 稿件不存在或已撤回。');
  if(b.status==='approved'&&checks.some(c=>!b.checks.includes(c)))throw new HttpError(400,'Complete all four checks first. / 请先完成四项人工检查。');const token=crypto.randomUUID(),now=new Date().toISOString();
  const r=await DB.batch([DB.prepare("UPDATE community_mods SET status=?,feedback=?,updated_at=?,revision=revision+1,review_token=? WHERE id=? AND revision=? AND status!='withdrawn'").bind(b.status,b.feedback,now,token,m.id,b.revision),DB.prepare('INSERT INTO mod_reviews (id,mod_id,reviewer_id,action,feedback,checklist,created_at) SELECT ?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM community_mods WHERE id=? AND review_token=?)').bind(token,m.id,user.userId,b.status,b.feedback,JSON.stringify(b.checks),now,m.id,token)]);
  if(r[0].meta.changes!==1)throw new HttpError(409,'Updated elsewhere; reload. / 记录已更新，请刷新。');return json({id:m.id,status:b.status});
 }
 if(action==='withdraw'&&path[1]&&req.method==='POST'){
  const b=z.object({revision:z.number().int().min(0)}).parse(JSON.parse(new TextDecoder().decode(await limitedBody(req,2000))));const m=await rawMod(path[1]);if(!m||(!admin&&m.owner_id!==user.userId))throw new HttpError(404,'Submission unavailable. / 无权访问稿件。');
  if(m.origin!=='community')throw new HttpError(400,'Use the usage status to pause curated entries. / 已收录资料请通过编辑标记暂停或弃用。');
  const r=await DB.prepare("UPDATE community_mods SET status='withdrawn',revision=revision+1,updated_at=? WHERE id=? AND revision=? AND status!='withdrawn'").bind(new Date().toISOString(),m.id,b.revision).run();if(r.meta.changes!==1)throw new HttpError(409,'Updated elsewhere; reload. / 记录已更新，请刷新。');return json({status:'withdrawn'});
 }
 const creating=!action&&req.method==='POST';if(!creating&&!(action&&path.length===1&&req.method==='PATCH'))throw new HttpError(404,'Unknown endpoint.');
 const id=creating?z.string().uuid().parse(req.headers.get('x-submission-id')):action;const current=await rawMod(id);
 if(creating&&current){if(current.owner_id!==user.userId)throw new HttpError(409,'Submission ID conflict. / 投稿编号冲突。');return json({item:publicMod(current,true)});}
 if(!creating&&(!current||(!admin&&current.owner_id!==user.userId)))throw new HttpError(404,'You cannot edit this entry. / 无权编辑此资料。');
 if(!req.headers.get('content-type')?.startsWith('multipart/form-data'))throw new HttpError(400,'Use the submission form. / 请使用投稿表单。');
 const bytes=await limitedBody(req,11*1024*1024),form=await new Request(req.url,{method:'POST',headers:{'content-type':req.headers.get('content-type')!},body:bytes}).formData();
 if(form.get('rights')!=='true')throw new HttpError(400,'Confirm attribution and upload rights. / 请确认署名与上传权限。');
 const body=fields.parse(Object.fromEntries(form.entries()));if(body.source_url){let url:URL;try{url=new URL(body.source_url)}catch{throw new HttpError(400,'Invalid source URL. / 来源链接无效。')}if(!['https:','http:'].includes(url.protocol)||url.username||url.password)throw new HttpError(400,'Only public HTTP(S) links are allowed. / 来源仅支持公开 HTTP(S) 链接。');}
 if(body.mod_code&&body.mod_code.split(/\r?\n/).filter(Boolean).some(line=>!/^.{0,100}?\bmod-[A-Za-z0-9]{3,80}\s*$/.test(line)))throw new HttpError(400,'One mod-… code per line, optionally preceded by a label. / 每行填写一个 mod-… 代码，可在前面加名称。');
 const revision=z.coerce.number().int().min(0).parse(form.get('revision')||0);if(current&&current.revision!==revision)throw new HttpError(409,'Updated elsewhere; reload. / 记录已更新，请刷新后编辑。');
 let file_key=current?.file_key||null,file_name=current?.file_name||'',file_size=current?.file_size||0,sha256=current?.sha256||'';
 const file=form.get('file');if(file instanceof File&&file.size){const ext=file.name.toLowerCase().endsWith('.lua')?'lua':file.name.toLowerCase().endsWith('.zip')?'zip':'';if(!ext||file.size>10*1024*1024)throw new HttpError(400,'Upload a Lua or ZIP file up to 10 MB. / 仅支持 10 MB 以内的 Lua 或 ZIP。');const data=new Uint8Array(await file.arrayBuffer());if(ext==='zip'){if(data.length<4||data[0]!==80||data[1]!==75||!((data[2]===3&&data[3]===4)||(data[2]===5&&data[3]===6)))throw new HttpError(400,'Invalid ZIP signature. / ZIP 格式无效。');}else{try{new TextDecoder('utf-8',{fatal:true}).decode(data);if(data.includes(0))throw Error('binary')}catch{throw new HttpError(400,'Lua must be UTF-8 text. / Lua 必须为 UTF-8 文本。');}}
  sha256=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',data))).map(n=>n.toString(16).padStart(2,'0')).join('');file_key=`mods/${id}/${crypto.randomUUID()}/mod.${ext}`;uploaded=file_key;file_name=file.name.replace(/[\x00-\x1f\x7f/\\]/g,'_').slice(0,120);file_size=file.size;await BUCKET.put(file_key,data,{httpMetadata:{contentType:'application/octet-stream'}});
 }
 if(creating&&!body.mod_code&&!body.source_url&&!file_key)throw new HttpError(400,'Add a Mod code, source link or file. / 请至少填写 Mod 码、来源链接或上传文件。');
 const now=new Date().toISOString(),since=new Date(Date.now()-86400000).toISOString(),curated=!!current&&current.origin!=='community',status=curated?'approved':'pending';
 if(creating){const r=await DB.prepare("INSERT INTO community_mods (id,owner_id,origin,body,status,revision,created_at,updated_at,feedback,file_key,file_name,file_size,sha256) SELECT ?,?,'community',?,'pending',0,?,?,'',?,?,?,? WHERE (SELECT COUNT(*) FROM community_mods WHERE owner_id=? AND status='pending')<3 AND (SELECT COUNT(*) FROM community_mods WHERE owner_id=? AND created_at>?)<5").bind(id,user.userId,JSON.stringify(body),now,now,file_key,file_name,file_size,sha256,user.userId,user.userId,since).run();if(r.meta.changes!==1)throw new HttpError(429,'Limit: 3 pending submissions and 5 new submissions per day. / 最多 3 份待审核，每日最多 5 次新投稿。');}
 else{
  if(curated&&seedRecord(id)){const seed=seedRecord(id)!;await DB.prepare('INSERT OR IGNORE INTO community_mods (id,owner_id,origin,body,status,revision,created_at,updated_at,feedback,file_key,file_name,file_size,sha256) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(seed.id,seed.owner_id,seed.origin,seed.body,seed.status,seed.revision,seed.created_at,seed.updated_at,'',null,'',0,'').run();}
  const r=await DB.prepare("UPDATE community_mods SET body=?,status=?,feedback='',revision=revision+1,updated_at=?,review_token=NULL,file_key=?,file_name=?,file_size=?,sha256=? WHERE id=? AND revision=? AND (?=1 OR owner_id=?) AND (?=1 OR status='pending' OR (SELECT COUNT(*) FROM community_mods WHERE owner_id=? AND status='pending')<3)").bind(JSON.stringify(body),status,now,file_key,file_name,file_size,sha256,id,revision,admin?1:0,user.userId,curated?1:0,current!.owner_id).run();if(r.meta.changes!==1)throw new HttpError(409,'Entry changed or pending limit reached. Reload or wait for review. / 记录已更新或待审数量已满，请刷新或等待审核。');
 }
 const saved=await rawMod(id);
 // Replacement is complete. Remove only the previous, now-unreferenced object;
 // preserve it if the reference check is uncertain. Current files are never GC'd.
 if(uploaded&&current?.file_key&&current.file_key!==saved?.file_key){try{const used=await DB.prepare('SELECT id FROM community_mods WHERE file_key=?').bind(current.file_key).first();if(!used)await BUCKET.delete(current.file_key);}catch{/* Best effort only; do not turn a committed save into an error. */}}
 return json({item:publicMod(saved!,true)},creating?201:200);
 }catch(e){if(uploaded){try{const used=await bindings().DB.prepare('SELECT id FROM community_mods WHERE file_key=?').bind(uploaded).first();if(!used)await bindings().BUCKET.delete(uploaded);}catch{/* Preserve on uncertain commit; never remove a possibly referenced object. */}}
 if(e instanceof HttpError)return json({error:e.message},e.status);if(e instanceof z.ZodError||e instanceof SyntaxError)return json({error:'Invalid fields. Check lengths, required values and formats. / 字段不完整或超出限制，请检查输入。'},400);console.error('Mod request failed',e instanceof Error?e.message:'Unknown');return json({error:'Service unavailable. Your form is retained; please retry. / 服务暂时不可用，表单仍保留，请稍后重试。'},503);
 }finally{await discardUnusedBody(req)}}
export {route as GET,route as POST,route as PATCH};
