// Only trusted catalog paths can become executable Lua.
export function generateGameplayLua(catalog, edits, title='WS ATLAS balance', rules=[], conflictMode='abort') {
 const byId=new Map(catalog.units.map(u=>[u.id,u])),changed=[],seen=new Set(),paths=new Map();
 if(!['abort','overwrite'].includes(conflictMode))throw new Error('Invalid conflict policy');
 if(edits.length>500||rules.length>100)throw new Error('Project is too large');
 for(const edit of edits){
  const unit=byId.get(edit.unitId),field=unit?.fields.find(f=>f.key===edit.fieldKey);
  if(!field)throw new Error('Unknown unit or field');
  const id=unit.id+':'+field.key,value=edit.value,raw=Math.round(value*field.scale);
  if(seen.has(id))throw new Error('Duplicate edit');seen.add(id);
  if(typeof value!=='number'||!Number.isFinite(value)||value<field.min||value>field.max||!Number.isSafeInteger(raw)||(!field.round&&Math.abs(raw-value*field.scale)>1e-7)||(field.kind==='boolean'&&value!==0&&value!==1))throw new Error('Invalid value: '+id);
  if(!/^root\.(?:unitType|build)\[\d+\](?:\.[A-Za-z][A-Za-z0-9_]*|\[\d+\])+$/.test(field.path))throw new Error('Untrusted catalog path');
  if(raw===field.raw)continue;
  if(paths.has(field.path)){if(paths.get(field.path)!==raw)throw new Error('The same producer field has conflicting edits.');continue}
  paths.set(field.path,raw);changed.push({unit,field,value,raw});
 }
 const value=(u,k,fallback)=>{const f=u.fields.find(f=>f.key===k);return f&&paths.has(f.path)?paths.get(f.path)/f.scale:fallback};
 for(const u of byId.values()){
  for(const w of u.weapons){
   const keys=['min','max','stop'].map(s=>w.key+'-range-'+s);
   if(!keys.some(k=>{const f=u.fields.find(x=>x.key===k);return f&&paths.has(f.path)}))continue;
   const min=value(u,keys[0],w.rangeMin??0),max=value(u,keys[1],w.rangeMax),stop=value(u,keys[2],w.rangeStop);
   if(max===null||stop===null||min>max||max>=stop)throw new Error('Range must satisfy minimum <= maximum < stop');
  }
  if(changed.some(e=>e.unit.id===u.id&&e.field.key.startsWith('action-'))){
   const lo=u.fields.find(f=>f.key==='action-min'),hi=u.fields.find(f=>f.key==='action-max');
   if(lo&&hi&&value(u,lo.key,lo.value)>value(u,hi.key,hi.value))throw new Error('Action minimum distance exceeds maximum');
  }
  if(changed.some(e=>e.unit.id===u.id&&/^armor-\d+-weight$/.test(e.field.key))&&u.armor.reduce((n,a)=>n+value(u,'armor-'+a.index+'-weight',a.probabilityWeight??1),0)<=0)throw new Error('Armor weights must have a positive sum');
 }
 const ruleSeen=new Set(),ruleGroups=new Map();
 const checkedRules=rules.map(rule=>{
  const u=byId.get(rule.unitId),target=u?.ruleTargets?.find(t=>t.key===rule.targetKey);
  if(!target||!byId.has(rule.requiredUnitId)||![rule.min,rule.max].every(n=>Number.isInteger(n)&&n>=0&&n<=65535)||rule.min>rule.max)throw new Error('Invalid unit requirement');
  if(target.requirements.unitsAll===false)throw new Error('Any-of unit requirements are read-only');
  const key=u.id+':'+target.key+':'+rule.requiredUnitId;
  if(ruleSeen.has(key))throw new Error('Duplicate unit requirement');ruleSeen.add(key);
  const group=u.id+':'+target.key,ids=ruleGroups.get(group)||new Set(target.requirements.units.map(x=>x.id));ids.add(rule.requiredUnitId);ruleGroups.set(group,ids);
  if(ids.size>4)throw new Error('At most four unit conditions per target are supported');
  return {...rule,unit:u,target,baseline:target.requirements.units.find(x=>x.id===rule.requiredUnitId)};
 });
 if(!changed.length&&!checkedRules.length)throw new Error('No changed values to export');
 const q=v=>JSON.stringify(String(v).replace(/[\r\n\u0000-\u001f]/g,' ')).replace(/\\u([0-9a-f]{4})/gi,(_,hex)=>String.fromCharCode(parseInt(hex,16)));
 const tokens=path=>[...path.slice(5).matchAll(/([A-Za-z][A-Za-z0-9_]*)|\[(\d+)\]/g)].map(m=>m[1]?q(m[1]):m[2]).join(', ');
 const guard=g=>g?', guard={producer='+g.producerId+', work='+g.workId+', ability='+g.abilityId+', kind='+(g.abilityType??0)+(g.targetId!==undefined?', target='+g.targetId:'')+(g.researchId!==undefined?', research='+g.researchId:'')+'}':'';
 const patches=changed.map(({unit,field,raw})=>'    {path={'+tokens(field.path)+'}, value='+(field.kind==='boolean'?String(!!raw):raw)+', expected='+(field.kind==='boolean'?String(!!field.raw):field.raw)+', label='+q(unit.name+' #'+unit.id+' '+field.label)+(field.scope==='faction-build'?', build='+field.buildId+', unit='+unit.id:'')+guard(field.productionGuard)+(field.abilityGuard?', abilityUnit='+unit.id+', ability='+field.abilityGuard.abilityId+', abilityKind='+field.abilityGuard.type+(field.abilityGuard.targetId!==undefined?', effectTarget='+field.abilityGuard.targetId:'')+(field.abilityGuard.researchId!==undefined?', effectResearch='+field.abilityGuard.researchId:''):'')+(field.buildWorkerGuard?', workerUnit='+unit.id+', workerIndex='+field.buildWorkerGuard.index+', workerTarget='+field.buildWorkerGuard.unitId:'')+'},');
 const rows=checkedRules.map(r=>'    {path={'+tokens(r.target.path)+'}, required='+r.requiredUnitId+', min='+r.min+', max='+r.max+', label='+q(r.unit.name+' '+r.target.key+' requires #'+r.requiredUnitId)+(r.target.buildId!==undefined?', build='+r.target.buildId+', unit='+r.unit.id:'')+guard(r.target.guard)+(r.baseline?', baselineMin='+r.baseline.min+', baselineMax='+r.baseline.max:'')+'},');
 const attacks=[...new Set(changed.filter(e=>e.field.path.includes('.attack.')).map(e=>e.unit.id))];
 return [
  '-- '+String(title).replace(/[\r\n\u0000-\u001f]/g,' '),
  '-- WS ATLAS gameplay Lua. Paste into a gameplay mod and test privately.',
  '-- Baseline: Steam '+catalog.provenance.steamBuild+'; Gameplay '+catalog.provenance.gameplayVersion+'.',
  '-- Global unit types; build plans for all existing factions including neutral. No per-tick scanning.',
  '-- Preserves research prerequisites. No new units, buttons, projectiles or graphics.',
  '-- Maximum requirements gate live/constructed counts; parallel queues are not reserved.',
  'local strictBaseline = '+(conflictMode==='abort'),
  'local patches = {',...patches,'}','local rules = {',...rows,'}',
  String.raw`local function checkGuard(c)
    if c.guard then
        local g = c.guard
        local producer = root.unitType[g.producer]
        local work = producer.ability.work[g.work]
        local ability = producer.ability.ability[g.ability]
        assert(work.ability == g.ability and ability.type == g.kind, "Work mapping changed: " .. c.label)
        if g.target ~= nil then assert(ability.data.unit == g.target, "Unit target changed") end
        if g.research ~= nil then assert(ability.data.research == g.research, "Research target changed") end
    end
    if c.abilityUnit ~= nil then
        local ability = root.unitType[c.abilityUnit].ability.ability[c.ability]
        assert(ability.type == c.abilityKind, "Ability type changed")
        if c.effectTarget ~= nil then assert(ability.data.unit == c.effectTarget, "Ability unit target changed") end
        if c.effectResearch ~= nil then assert(ability.data.research == c.effectResearch, "Ability research target changed") end
    end
    if c.workerUnit ~= nil then assert(root.unitType[c.workerUnit].movement.building[c.workerIndex].unit == c.workerTarget, "Worker building mapping changed") end
end
local function eachRoot(c, visit)
    if c.build == nil then visit(root); return end
    local count = 0
    for f = 0, root.faction.size - 1 do
        local faction = root.faction[f]
        if faction ~= nil and faction.build ~= nil and faction.build[c.build] ~= nil then
            assert(faction.build[c.build].unit == c.unit, "Build ID maps to another unit")
            visit(faction); count = count + 1
        end
    end
    assert(count > 0, "No faction build plans found")
end
local function follow(base, path, last)
    for j = 1, last do base = base[path[j]]; assert(base ~= nil, "Missing runtime path") end
    return base
end
function onStart(var)
    local targets, conditions = {}, {}
    local ok, reason = pcall(function()
        for _, c in ipairs(patches) do
            checkGuard(c)
            eachRoot(c, function(base)
                local parent = follow(base, c.path, #c.path - 1)
                local key = c.path[#c.path]
                assert(type(parent[key]) == type(c.value), "Field type changed: " .. c.label)
                if parent[key] ~= c.expected then
                    assert(not strictBaseline, "Baseline conflict: " .. c.label)
                    log("[WS ATLAS] Overriding a different baseline: " .. c.label)
                end
                targets[#targets + 1] = {parent=parent, key=key, value=c.value}
            end)
        end
        for _, c in ipairs(rules) do
            checkGuard(c)
            eachRoot(c, function(base)
                local requirements = follow(base, c.path, #c.path)
                assert(requirements.unitsAll == true, "Any-of conditions cannot be changed safely")
                local units = requirements.unit
                assert(units ~= nil and type(units.size) == "number" and units.f_create ~= nil, "Requirements schema changed")
                local index = nil
                for j = 0, units.size - 1 do if units[j].type == c.required then index = j; break end end
                if strictBaseline then
                    if c.baselineMin == nil then assert(index == nil, "A mod already added this condition")
                    else assert(index ~= nil and units[index].min == c.baselineMin and units[index].max == c.baselineMax, "Requirement baseline changed") end
                end
                local pending = 0
                for _, old in ipairs(conditions) do if old.units == units and old.index == nil then pending = pending + 1 end end
                assert(units.size + pending + (index == nil and 1 or 0) <= 4, "More than four unit conditions")
                conditions[#conditions + 1] = {units=units, index=index, rule=c}
            end)
        end
    end)
    if not ok then log("[WS ATLAS] Preflight failed; no changes applied: " .. tostring(reason)); return end
    ok, reason = pcall(function()
        for _, t in ipairs(targets) do t.parent[t.key] = t.value end
        for _, t in ipairs(conditions) do
            local index = t.index
            if index == nil then index = t.units.f_create(); if index == nil then index = t.units.size - 1 end end
            t.units[index].type = t.rule.required
            t.units[index].min = t.rule.min; t.units[index].max = t.rule.max
        end`,
  ...attacks.map(id=>'        root.unitType['+id+'].attack.f_updateCachedData()'),
  String.raw`        root.f_recreateModifiedUnitTypes()
    end)
    if not ok then log("[WS ATLAS] Apply interrupted; restart without this mod: " .. tostring(reason)); return end
    log("[WS ATLAS] Applied " .. #patches .. " fields and " .. #rules .. " conditions; test in a private match.")
end
addMod({onStart=onStart})
`
 ].join('\n');
}
