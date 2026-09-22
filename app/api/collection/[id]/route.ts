import { bindings,identity,json,sameOrigin,limitedBody,HttpError } from '@/lib/atlas-server';
import { collectedMap } from '@/lib/collection-server';
import { collectionSeed,collectionBodySchema } from '@/lib/collection';
export const dynamic='force-dynamic';
type Context={params:Promise<{id:string}>};
export async function GET(_req:Request,{params}:Context){try{
  const {id}=await params;const viewer=await identity();const m=await collectedMap(id);
  if(!m||m.visibility==='hidden'&&!viewer.admin)return json({error:'地图不存在。'},404);
  return json({...m,editable:viewer.admin});
}catch{return json({error:'暂时无法读取收藏地图。'},503);}}
export async function PATCH(req:Request,{params}:Context){try{
  // Consume bounded JSON before an authorization early return, avoiding unread
  // body resets on reused HTTP connections. Never execute uploaded content.
  const bytes=await limitedBody(req,131072);
  sameOrigin(req);
  const {user,admin}=await identity();if(!user)return json({error:'请先登录。'},401);if(!admin)return json({error:'只有管理员可以维护收藏档案。'},403);
  const {id}=await params;if(!collectionSeed(id))return json({error:'地图不存在。'},404);
  let input;try{input=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{return json({error:'提交内容不是有效 JSON。'},400);}
  if(!input||!Number.isSafeInteger(input.revision)||input.revision<0)return json({error:'缺少有效修订号，请刷新后重试。'},400);
  const parsed=collectionBodySchema.safeParse(input.body);if(!parsed.success)return json({error:parsed.error.issues[0]?.message||'请检查输入。'},400);
  const current=await collectedMap(id);if(!current||current.revision!==input.revision)return json({error:'资料已被其他编辑更新。请保留草稿，重新载入后再提交。'},409);
  const now=new Date().toISOString();const body=JSON.stringify(parsed.data);const db=bindings().DB;
  let changed;
  if(input.revision===0){changed=await db.prepare('INSERT INTO featured_maps (id,body,revision,updated_at,updated_by) VALUES (?,?,1,?,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body, revision=featured_maps.revision+1, updated_at=excluded.updated_at, updated_by=excluded.updated_by WHERE featured_maps.revision=0').bind(id,body,now,user.userId).run();}
  else changed=await db.prepare('UPDATE featured_maps SET body=?,revision=revision+1,updated_at=?,updated_by=? WHERE id=? AND revision=?').bind(body,now,user.userId,id,input.revision).run();
  if(changed.meta.changes!==1)return json({error:'资料已更新，请重新载入后再提交。'},409);
  return json(await collectedMap(id));
}catch(e){return json({error:e instanceof HttpError?e.message:'保存失败，当前草稿仍保留，请稍后重试。'},e instanceof HttpError?e.status:503);}}
