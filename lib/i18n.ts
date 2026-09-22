import {english} from './english';
export type Locale='zh'|'en';
const normalize=(text:string)=>text.replace(/\s+/g,' ').trim();
const normalizedEnglish:Record<string,string>=Object.fromEntries(Object.entries(english).map(([key,value])=>[normalize(key),value]));
const own=(dictionary:Record<string,string>,key:string)=>Object.hasOwn(dictionary,key)?dictionary[key]:undefined;
const exact=(text:string)=>own(english,text)??own(normalizedEnglish,normalize(text));
const escapePattern=(text:string)=>text.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
// Dictionary placeholders are identifiers, never executable JavaScript. Each
// source placeholder captures text and is substituted by name in the target.
const templates=Object.entries(english).filter(([key])=>key.includes('${')).map(([source,target])=>{
 const slots=[...source.matchAll(/\$\{([^{}]+)\}/g)];let end=0,pattern='^';
 for(const slot of slots){pattern+=escapePattern(source.slice(end,slot.index))+'([\\s\\S]*?)';end=slot.index!+slot[0].length;}
 pattern+=escapePattern(source.slice(end))+'$';
 return {prefix:source.slice(0,slots[0]?.index??source.length),pattern:new RegExp(pattern),names:slots.map(s=>s[1]),target};
});
export function translate(text:string,locale:Locale){
 if(locale==='zh')return text;
 const direct=exact(text);if(direct!==undefined)return direct;
 // Bound dynamic matching to short UI messages rather than uploaded documents.
 if(text.length<=4096)for(const template of templates){
  if(template.prefix&&!text.startsWith(template.prefix))continue;
  const match=template.pattern.exec(text);if(!match)continue;
  const values=new Map(template.names.map((name,index)=>[name,exact(match[index+1])??match[index+1]]));
  return template.target.replace(/\$\{([^{}]+)\}/g,(original,name:string)=>values.get(name)??original);
 }
 const validationPrefix='导出校验未通过，请检查改动：';
 if(text.startsWith(validationPrefix))return (exact(validationPrefix)??validationPrefix)+text.slice(validationPrefix.length);
 return text;
}
