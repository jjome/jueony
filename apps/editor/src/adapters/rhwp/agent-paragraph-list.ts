import type {Snapshot,BodyNode,AgentParagraphListOp,AgentListCatalog} from '../../modules/document/public/index.ts';
import {agentParagraphListPayload} from '../../modules/document/public/engine-integration.ts';
import {nativeDocument,parsed} from './structure.ts';
import {capturePreservationEvidence} from './preservation.ts';
const canonical=(v:any):any=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const same=(a:any,b:any)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
export function readAgentParagraphLists(wasm:any,nodes:BodyNode[]):Pick<Snapshot,'paragraphListSources'|'listCatalog'|'basicBulletSources'|'basicNumberingSources'|'numberingDefinitionSources'>{
 const d=nativeDocument(wasm);if(typeof d.getAgentParagraphList!=='function'||typeof d.setAgentParagraphList!=='function'||typeof d.getAgentListDefinitions!=='function')return {};
 try{const numberings=parsed(d.getNumberingList()),bullets=parsed(d.getBulletList());
  if(!Array.isArray(numberings)||!Array.isArray(bullets)||numberings.length>200||bullets.length>200||numberings.some((n,i)=>n.id!==i+1||!Array.isArray(n.levelFormats)||n.levelFormats.length!==7||n.levelFormats.some((f:any)=>typeof f!=='string'||f.length>500))||bullets.some((b,i)=>b.id!==i+1||typeof b.char!=='string'||b.char.length>4))return {};
  const definitions=parsed(d.getAgentListDefinitions());const textBullets=bullets.filter((b:any)=>{const raw=definitions.bullets?.[b.id-1];return raw?.image_bullet===0&&Array.isArray(raw.image_data)&&raw.image_data.every((n:any)=>n===0)&&raw.check_bullet_char===String.fromCharCode(0);});
  const paragraphListSources=Object.fromEntries(nodes.map(n=>{try{const raw=parsed(d.getAgentParagraphList(n.section,n.paragraph)),editable=n.editable&&raw.editable===true;return [n.id,{editable,...(!editable?{reason:n.reason??(typeof raw.reason==='string'?raw.reason.slice(0,500):'현재 번호 원본은 읽기 전용입니다.')}:{})}];}catch{return [n.id,{editable:false,reason:'원본 번호 속성을 확인하지 못했습니다.'}];}}));
  const basicBulletSources=typeof d.setAgentBasicBullet==='function'?Object.fromEntries(Object.entries(paragraphListSources).map(([id,cap])=>[id,definitions.bullets.length>=200?{editable:false,reason:'글머리표 정의 한도 200개를 확인하세요.'}:cap])):undefined;
  const basicNumberingSources=typeof d.setAgentBasicNumbering==='function'?Object.fromEntries(Object.entries(paragraphListSources).map(([id,cap])=>[id,definitions.numberings.length>=200?{editable:false,reason:'번호 정의 한도 200개를 확인하세요.'}:cap])):undefined;
  let numberingDefinitionSources;
  if(typeof d.getAgentNumberingDefinitions==='function'&&typeof d.cloneAgentNumbering==='function'){
   const entries=parsed(d.getAgentNumberingDefinitions());
   if(Array.isArray(entries)&&entries.length===numberings.length&&entries.every((e,i)=>e.id===i+1&&typeof e.editable==='boolean'&&(!e.editable||Array.isArray(e.startNumbers)&&e.startNumbers.length===7&&e.startNumbers.every((n:any)=>Number.isInteger(n)&&n>=0&&n<=4294967295))))numberingDefinitionSources=entries.map(e=>({id:e.id,editable:e.editable,...(e.editable?{startNumbers:e.startNumbers}:{reason:typeof e.reason==='string'?e.reason.slice(0,500):'원본 번호 정의는 읽기 전용입니다.'})}));
  }
  return {...(basicNumberingSources?{basicNumberingSources}:{}),...(numberingDefinitionSources?{numberingDefinitionSources}:{}),listCatalog:{numberings,bullets:textBullets} as AgentListCatalog,paragraphListSources,...(basicBulletSources?{basicBulletSources}:{})};
 }catch{return {};}
}
const list=(p:any)=>({headType:p.headType,numberingId:p.numberingId,paraLevel:p.paraLevel});
export function executeAgentParagraphList(wasm:any,base:Snapshot,op:AgentParagraphListOp):void{
 const props=agentParagraphListPayload(op,base),d=nativeDocument(wasm),n=base.nodes.find(n=>n.id===op.target)!;
 const current=parsed(d.getParaPropertiesAt(n.section,n.paragraph)),source=base.structure!.paragraphs.find(p=>p.id===op.target)!.paragraph;
 if(d.getTextRange(n.section,n.paragraph,0,d.getParagraphLength(n.section,n.paragraph))!==n.text||!same(list(current),list(source))||!same(readAgentParagraphLists(d,base.nodes).listCatalog,base.listCatalog))throw new Error('문단 원문·번호 또는 정의가 바뀌었습니다. 최신 문서로 다시 요청하세요.');
 const raw=parsed(d.getAgentParagraphList(n.section,n.paragraph));if(raw.editable!==true||typeof raw.token!=='string'||!/^[a-f0-9]{64}$/u.test(raw.token))throw new Error('원본 문단 번호 검증 정보가 없습니다.');
 const storedRestarts=parsed(d.getAgentListDefinitions()).storedRestarts;
 const before=capturePreservationEvidence(d);if(before.issues.length)throw new Error('전체 문서 보존 정보를 확인하지 못했습니다.');
 const expected=structuredClone(before.values),key=`section/${n.section}/paragraph/${n.paragraph}`,target:any=expected[key];if(!target?.paragraph)throw new Error('대상 문단 보존 정보가 없습니다.');Object.assign(target.paragraph,props);
 // The engine reports inferred continuation modes based on preceding list paragraphs.
 // They are computed views, not stored restart instructions (Native rejects explicit restarts).
 for(const [k,v]of Object.entries(expected))if(/^section\/\d+\/paragraph\/\d+$/u.test(k)){const p=(v as any).paragraph;delete p.numberingRestartMode;delete p.numberingStartNum;}
 const response=parsed(d.setAgentParagraphList(n.section,n.paragraph,JSON.stringify({...props,token:raw.token})));
 if(response.editable!==true)throw new Error('문서 엔진이 문단 번호 명령을 확인하지 못했습니다.');
 const after=capturePreservationEvidence(d);for(const [k,v]of Object.entries(after.values))if(/^section\/\d+\/paragraph\/\d+$/u.test(k)){const p=(v as any).paragraph;delete p.numberingRestartMode;delete p.numberingStartNum;}
 if(!same(storedRestarts,parsed(d.getAgentListDefinitions()).storedRestarts)||after.issues.length||!same(after.values,expected))throw new Error('문단 번호 적용 뒤 본문·서식·공유 정의·다른 문단이 계획과 다릅니다.');
}
