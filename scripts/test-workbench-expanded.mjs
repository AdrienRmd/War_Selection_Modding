import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createRequire} from 'node:module';
import {validateDraft,readProject,projectJSON,lua} from '../lib/workbench.ts';
const c=JSON.parse(fs.readFileSync(new URL('../public/unit-catalog.json',import.meta.url),'utf8'));
assert.equal(c.schemaVersion,2);assert.equal(c.units.length,453);
assert.deepEqual(JSON.parse(gunzipSync(fs.readFileSync(new URL('../public/unit-catalog.json.gz',import.meta.url))).toString()),c);
const f=(id,key)=>c.units.find(u=>u.id===id).fields.find(f=>f.key===key);
for(const u of c.units){assert.equal(new Set(u.fields.map(f=>f.key)).size,u.fields.length);for(const x of u.fields){assert.ok(x.help&&x.helpEn);assert.ok(x.value>=x.min&&x.value<=x.max);assert.equal(Math.round(x.value*x.scale),x.raw)}}
assert.equal(f(6,'regeneration').value,.2);assert.equal(f(6,'action-active').path,'root.unitType[6].ability.onAction.active');
assert.equal(f(2,'storage').value,1);assert.equal(f(194,'build-91-initCost-0').value,300);assert.equal(f(194,'build-91-buildCost-0').value,700);
assert.equal(f(194,'work-1-time').productionGuard.researchId,106);
assert.equal(f(242,'transport-volume').value,6);assert.equal(f(242,'passenger-volume').value,7);
assert.equal(f(201,'builder-0').buildWorkerGuard.unitId,192);
const rules=[{unitId:194,targetKey:'build-91',requiredUnitId:201,min:40,max:65535},{unitId:194,targetKey:'build-91',requiredUnitId:194,min:0,max:3}];
const draft={'6:health':'100','6:receive-friendly':'0','2:storage':'1.1','194:build-91-initCost-0':'1500','194:work-1-time':'60','201:builder-0':'9000'};
const edits=validateDraft(c,draft,rules),script=lua(c,edits,'QA\nnot code',rules);
assert.match(script,/value=72090/);assert.match(script,/effect|guard/);assert.match(script,/strictBaseline = true/);assert.match(script,/root\.faction\.size/);assert.ok(!script.includes('onTick'));
assert.deepEqual(readProject(projectJSON(c,edits,'QA',rules),c).rules,rules);
const old=JSON.parse(projectJSON(c,edits,'QA'));old.schemaVersion=1;delete old.rules;delete old.conflictMode;assert.deepEqual(readProject(JSON.stringify(old),c).edits,edits);
assert.throws(()=>validateDraft(c,{'6:receive-friendly':'.5'}));assert.throws(()=>validateDraft(c,{'6:regeneration':'.21'}));
assert.throws(()=>validateDraft(c,{'6:action-min':'90'}));
assert.throws(()=>validateDraft(c,{'6:armor-0-weight':'0','6:armor-1-weight':'0'}));
assert.throws(()=>validateDraft(c,{},[...rules,rules[0]]));assert.throws(()=>validateDraft(c,{},[{...rules[0],requiredUnitId:9999}]));
assert.throws(()=>validateDraft(c,{},[{...rules[0],min:5,max:3}]));
assert.throws(()=>validateDraft(c,{},[1,2,3,4,5].map(requiredUnitId=>({...rules[0],requiredUnitId}))));
const incoming=c.units.find(u=>u.id===201).fields.find(f=>f.path==='root.unitType[194].ability.work[0].makeTime');
assert.throws(()=>validateDraft(c,{'194:work-0-time':'11',[`201:${incoming.key}`]:'12'}));
assert.equal(validateDraft(c,{'2:storage':'1.1'}).length,1);
const malicious=JSON.parse(projectJSON(c,edits,'QA'));malicious.edits[0].path='os.execute';assert.throws(()=>readProject(JSON.stringify(malicious),c));
console.log('PASS expanded catalog, bounds, bilingual help, gzip, costs/IDs, rounding, booleans, conflict guards, requirements, v1/v2 imports');
if(!process.argv[2]){console.log('Lua runtime checks skipped: pass an external fengari package directory');process.exit(0)}
const {lua:L,lauxlib:laux,lualib:libs,to_luastring,to_jsstring}=createRequire(import.meta.url)(process.argv[2]);
const mock=String.raw`
logs={}; function log(s) logs[#logs+1]=s end
function requirements() local u={size=0}; u.f_create=function() local i=u.size;u[i]={type=0,min=0,max=65535};u.size=i+1;return i end;return {unitsAll=true,unit=u,researchAny={size=1,[0]={id=59}}} end
function plan() return {unit=194,initCost={[0]=300000},requirements=requirements()} end
root={unitType={
 [6]={deathability={health=65000,receiveFriendlyDamage=true},ability={ability={[2]={type=4,data={research=140,duration=4000}}}}},
 [2]={storageMultiplier=65536},
 [194]={ability={work={[1]={ability=1,makeTime=120000}},ability={[1]={type=1,data={research=106}}}}},
 [201]={movement={building={[0]={unit=192,tickProgress=8000}}}}
},faction={size=2,[0]={build={[91]=plan()}},[1]={build={[91]=plan()}}}}
rebuilt=false;root.f_recreateModifiedUnitTypes=function() rebuilt=true end
function addMod(m) registered=m end
`;
function run(code){const state=laux.luaL_newstate();libs.luaL_openlibs(state);const status=laux.luaL_dostring(state,to_luastring(code));if(status!==L.LUA_OK)throw Error(to_jsstring(L.lua_tostring(state,-1)));L.lua_close(state)}
run(mock+script+String.raw`
registered.onStart({});assert(rebuilt);assert(root.unitType[6].deathability.health==100000);assert(root.unitType[6].deathability.receiveFriendlyDamage==false);assert(root.unitType[2].storageMultiplier==72090);assert(root.unitType[194].ability.work[1].makeTime==60000);assert(root.unitType[201].movement.building[0].tickProgress==9000)
for i=0,1 do local b=root.faction[i].build[91];assert(b.initCost[0]==1500000);assert(b.requirements.unit.size==2);assert(b.requirements.unit[0].type==201 and b.requirements.unit[0].min==40);assert(b.requirements.unit[1].type==194 and b.requirements.unit[1].max==3);assert(b.requirements.researchAny[0].id==59) end
`);
run(mock+'root.unitType[6].deathability.health=66000\n'+script+'registered.onStart({});assert(not rebuilt);assert(root.faction[1].build[91].initCost[0]==300000);assert(root.unitType[2].storageMultiplier==65536);assert(string.find(logs[1],"Preflight failed"))');
run(mock+'root.unitType[194].ability.ability[1].data.research=107\n'+script+'registered.onStart({});assert(not rebuilt);assert(root.unitType[6].deathability.health==65000)');
run(mock+'root.faction[1].build[91].unit=2\n'+script+'registered.onStart({});assert(not rebuilt);assert(root.faction[0].build[91].initCost[0]==300000)');
run(mock+'root.unitType[6].deathability.health=66000\n'+lua(c,edits,'overwrite',rules,'overwrite')+'registered.onStart({});assert(rebuilt);assert(root.unitType[6].deathability.health==100000)');
const duration=lua(c,validateDraft(c,{'6:ability-2-duration':'5'}),'duration');
run(mock+'root.unitType[6].ability.ability[2].data.research=141\n'+duration+'registered.onStart({});assert(not rebuilt);assert(root.unitType[6].ability.ability[2].data.duration==4000)');
console.log('PASS six real Lua-interpreter scenarios against mocked engine objects (not a live game test)');
