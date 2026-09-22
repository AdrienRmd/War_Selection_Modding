import assert from 'node:assert/strict';
const origin='http://127.0.0.1:5174';
const headers={'oai-authenticated-user-id':'qa_other_player','oai-authenticated-user-email':'qa-player@example.invalid'};
const id='67d2c81d-1178-4df3-8f7a-645d390b3ebd';
// Run only against the locally retained built Worker, never a hosted Site.
async function call(path,method='GET',body){return fetch(origin+path,{method,headers:{...headers,...(method!=='GET'?{Origin:origin,'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});}
const me=await (await call('/api/atlas/me')).json();assert.equal(me.signedIn,true);assert.equal(me.admin,false);
assert.equal((await call('/api/atlas/submissions?scope=admin')).status,403);
assert.equal((await call('/api/atlas/review/'+id,'PATCH',{status:'approved',feedback:'不应允许此账号操作',revision:0,checks:['ownership','files','gameplay','description']})).status,403);
assert.equal((await call('/api/atlas/withdraw/'+id,'POST')).status,404);
assert.equal((await call('/api/atlas/files/'+id)).status,404);
const list=await (await call('/api/atlas/submissions')).json();assert.equal(list.items.some(x=>x.id===id),false);
console.log('PASS 6 authenticated non-admin / cross-owner authorization checks (local built Worker only).');
