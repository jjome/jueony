import type {EquationRefN015,MixedRootObjectRefN015,MixedRootSelectionBookmarkN015,MixedRootSelectionEntryN015,SingleEquationSelectionBookmarkN015} from '../public/contracts.ts';

const digestPattern=/^[a-f0-9]{64}$/u;
const addressKeys=['section','paragraph','control','type'];

function object(value:unknown):Record<string,unknown>|undefined{
  if(typeof value==='string'){
    try{value=JSON.parse(value);}catch{return;}
  }
  return value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:undefined;
}

function hasFields(value:Record<string,unknown>,fields:string[]){
  return Object.keys(value).length===fields.length&&fields.every(field=>Object.hasOwn(value,field));
}

const integer=(value:unknown):value is number=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=0&&value<=2147483647;
const digest=(value:unknown):value is string=>typeof value==='string'&&digestPattern.test(value);

function address(value:Record<string,unknown>):MixedRootObjectRefN015|undefined{
  const {section,paragraph,control,type}=value;
  if(!integer(section)||!integer(paragraph)||!integer(control)||(type!=='equation'&&type!=='image'))return;
  return {section,paragraph,control,type};
}

export function parseMixedRootSelectionBookmarkN015(value:unknown):MixedRootSelectionBookmarkN015|undefined{
  const raw=object(value);
  if(!raw||!hasFields(raw,['version','kind','objects','active','documentFingerprint','integrity'])
    ||raw.version!==1||raw.kind!=='mixed-root-object-selection'||!digest(raw.documentFingerprint)||!digest(raw.integrity)
    ||!Array.isArray(raw.objects)||raw.objects.length<2||raw.objects.length>32||raw.active!==raw.objects.length-1)return;
  const entries:MixedRootSelectionEntryN015[]=[];
  for(const value of raw.objects){
    const entry=object(value);
    if(!entry||!hasFields(entry,[...addressKeys,'objectFingerprint'])||!digest(entry.objectFingerprint))return;
    const ref=address(entry);
    if(!ref)return;
    entries.push(Object.freeze({...ref,objectFingerprint:entry.objectFingerprint}));
  }
  if(!entries.some(entry=>entry.type==='equation')||!entries.some(entry=>entry.type==='image')
    ||new Set(entries.map(entry=>`${entry.section}:${entry.paragraph}:${entry.control}:${entry.type}`)).size!==entries.length)return;
  return Object.freeze({version:1,kind:raw.kind,objects:Object.freeze(entries),active:raw.active,
    documentFingerprint:raw.documentFingerprint,integrity:raw.integrity});
}

export function parseSingleEquationSelectionBookmarkN015(value:unknown):SingleEquationSelectionBookmarkN015|undefined{
  const raw=object(value);
  if(!raw||!hasFields(raw,['version','kind','target','documentFingerprint','objectFingerprint','integrity'])
    ||raw.version!==1||raw.kind!=='single-root-equation-selection'||!digest(raw.documentFingerprint)
    ||!digest(raw.objectFingerprint)||!digest(raw.integrity))return;
  const targetRaw=object(raw.target);
  const ref=targetRaw&&hasFields(targetRaw,addressKeys)?address(targetRaw):undefined;
  if(ref?.type!=='equation')return;
  const target:EquationRefN015=Object.freeze({...ref,type:ref.type});
  return Object.freeze({version:1,kind:raw.kind,target,documentFingerprint:raw.documentFingerprint,
    objectFingerprint:raw.objectFingerprint,integrity:raw.integrity});
}
