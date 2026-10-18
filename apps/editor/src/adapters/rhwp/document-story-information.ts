/** Census of canonical owned model paragraphs; not Hancom page statistics. */
export const STORY_KINDS=['body','tableCell','textBox','header','footer','footnote','endnote','hiddenComment','fieldMemo','caption','masterPage'] as const;
type StoryKind=typeof STORY_KINDS[number];
export type StoryCounts={paragraphs:number;unicodeScalars:number;utf16Units:number;textScalars:number;nonWhitespaceTextScalars:number};
export type StoryInformation={schemaVersion:1;basis:'canonical-model-paragraphs';counts:StoryCounts;stories:{kind:StoryKind;counts:StoryCounts}[];
  paragraphs:{section:number;story:StoryKind;path:string;text:string}[];objects:Record<'tables'|'pictures'|'shapes'|'groups'|'charts'|'ole'|'equations'|'fields'|'unknownControls',number>;limitations:string[]};
const countKeys=['paragraphs','unicodeScalars','utf16Units','textScalars','nonWhitespaceTextScalars'] as const;
const objectKeys=['tables','pictures','shapes','groups','charts','ole','equations','fields','unknownControls'];
const record=(v:any)=>v&&typeof v==='object'&&!Array.isArray(v);
const keys=(v:object,expected:readonly string[])=>Object.keys(v).sort().join(',')===[...expected].sort().join(',');
const int=(v:unknown)=>Number.isSafeInteger(v)&&(v as number)>=0&&(v as number)<=16*1024*1024;
const failure=()=>Error('문서 전체 저장 모델의 텍스트 집계 계약을 확인하지 못했습니다.');
function empty():StoryCounts{return{paragraphs:0,unicodeScalars:0,utf16Units:0,textScalars:0,nonWhitespaceTextScalars:0};}
function counted(text:string):StoryCounts {
  const all=Array.from(text),visible=all.filter(c=>!/[\u0000-\u0008\u000a-\u001f\u007f\ufffc]/u.test(c));
  return{paragraphs:1,unicodeScalars:all.length,utf16Units:text.length,textScalars:visible.length,nonWhitespaceTextScalars:visible.filter(c=>!/\p{White_Space}/u.test(c)).length};
}
function add(a:StoryCounts,b:StoryCounts){for(const k of countKeys)a[k]+=b[k];}
function matches(value:any,expected:StoryCounts):boolean{return record(value)&&keys(value,countKeys)&&countKeys.every(k=>int(value[k])&&value[k]===expected[k]);}
export function validateStoryInformation(value:unknown):StoryInformation {
  const v=value as any;if(!record(v)||!keys(v,['schemaVersion','basis','counts','stories','paragraphs','objects','limitations'])||v.schemaVersion!==1||v.basis!=='canonical-model-paragraphs'
      ||!Array.isArray(v.paragraphs)||v.paragraphs.length>20000||!Array.isArray(v.stories)||v.stories.length>STORY_KINDS.length
      ||!record(v.objects)||!keys(v.objects,objectKeys)||objectKeys.some(k=>!int(v.objects[k]))||!Array.isArray(v.limitations)||v.limitations.length>100
      ||v.limitations.some((s:unknown)=>typeof s!=='string'||s.length>4096))throw failure();
  const paths=new Set<string>(),groups=new Map<StoryKind,StoryCounts>(),total=empty();let bytes=0;
  for(const p of v.paragraphs){
    if(!record(p)||!keys(p,['section','story','path','text'])||!int(p.section)||!STORY_KINDS.includes(p.story)||typeof p.path!=='string'||p.path.length>4096
        ||!p.path.startsWith(`section/${p.section}/`)||paths.has(p.path)||typeof p.text!=='string'||/[\ud800-\udfff]/u.test(p.text))throw failure();
    paths.add(p.path);bytes+=new TextEncoder().encode(p.text).length;if(bytes>8*1024*1024)throw failure();
    const counts=counted(p.text);add(total,counts);const group=groups.get(p.story)??empty();add(group,counts);groups.set(p.story,group);
  }
  if(!matches(v.counts,total)||v.stories.length!==groups.size)throw failure();const seen=new Set<string>();
  for(const s of v.stories){if(!record(s)||!keys(s,['kind','counts'])||seen.has(s.kind)||!groups.has(s.kind)||!matches(s.counts,groups.get(s.kind)!))throw failure();seen.add(s.kind);}
  if(new TextEncoder().encode(JSON.stringify(v)).length>16*1024*1024)throw failure();return structuredClone(v);
}
export function readStoryInformation(wasm:any):{value?:StoryInformation;reason?:string} {
  const doc=wasm.borrowDocumentHandle?.()??wasm;if(typeof doc.getDocumentStoryInformation!=='function')return{reason:'현재 엔진은 전체 저장 모델 집계를 지원하지 않습니다.'};
  try{const raw=doc.getDocumentStoryInformation();return{value:validateStoryInformation(typeof raw==='string'?JSON.parse(raw):raw)};}
  catch{return{reason:'전체 저장 모델을 완전하게 읽지 못했습니다. 일부 결과를 전체 집계로 표시하지 않습니다.'};}
}
