import type {Snapshot,EditOp} from '../../document/public/index.ts';
import {shapeFillColor,shapeFillDigest,shapeFillId,validateEditProposal as validateGeneration} from '../../document/public/index.ts';
import type {CommandTemplate,SectionTargets,TableTargets,TableTemplateAnchor,AutomationProposal as Generation} from '../public/contracts.ts';
import {assertTableTargets,bindTableTargets,captureTableTarget,isRecordedTableCommand} from './table-template-targets.ts';
const legacyKinds=new Set(['create_document','replace_body_text','delete_body_text','insert_body_paragraphs','format_characters','format_paragraph','create_table']);
const sectionKinds=new Set(['set_section_tabs','set_line_numbers','set_page_background','set_master_page_text','delete_master_page','set_page_setup','set_columns']);
const variablePattern=/\{\{([가-힣A-Za-z0-9_ ]{1,40})\}\}/g;
const fail=(message:string):never=>{throw new Error(message);};
const storesCharacterStyle=(op:EditOp)=>op.kind==='format_characters'&&Object.hasOwn(op.properties??{},'storedStyle');
function outputStrings(op:EditOp):string[]{
 if(op.kind==='create_document'||op.kind==='insert_body_paragraphs')return op.paragraphs;
 if(op.kind==='replace_body_text')return [op.text];
 if(op.kind==='set_table_cell')return [op.text];
 if(op.kind==='insert_table_row'||op.kind==='insert_table_column')return op.values;
 if(op.kind==='create_table')return op.rows.flat();
 if(op.kind==='set_master_page_text')return [op.text];
 return [];
}
export function captureTemplate(generation:Generation,base:Snapshot):CommandTemplate{
 const g=validateGeneration(generation,base,generation.sourceIds);
 if(!g.operations.length)fail('문서 변경이 있는 작업만 반복 작업으로 저장할 수 있습니다.');
 const [first]=g.operations;
 if(first.kind==='set_shape_fill'){
  const template:CommandTemplate={version:4,anchors:{},operations:[structuredClone(first)],shapeFingerprint:base.shapeFillSources![first.target].templateFingerprint};
  assertTemplate(template);return template;
 }
 const anchors:Record<string,string>=Object.create(null),sections=new Set<number>();
 const tableRefs:Record<string,TableTemplateAnchor>=Object.create(null);
 const hasSections=g.operations.some(op=>sectionKinds.has(op.kind));
 for(const op of g.operations){
  if(isRecordedTableCommand(op)){
   tableRefs[op.target]??=captureTableTarget(base,op);continue;
  }
  if(storesCharacterStyle(op)||!legacyKinds.has(op.kind)&&!sectionKinds.has(op.kind))fail('이 문서 명령은 반복 작업으로 아직 기록할 수 없습니다.');
  if(sectionKinds.has(op.kind)&&'section' in op)sections.add(op.section);
  const id='target' in op?op.target:'after' in op?op.after:undefined;
  if(id){const node=base.nodes.find(n=>n.id===id);if(!node)fail('기준 문단을 찾을 수 없습니다.');anchors[id]=node!.text;if(hasSections)sections.add(node!.section);}
 }
 const operations=structuredClone(g.operations),sectionRefs=[...sections].sort((a,b)=>a-b);
 const template:CommandTemplate=Object.keys(tableRefs).length?{version:3,operations,anchors,sectionRefs,tableRefs}
  :hasSections?{version:2,operations,anchors,sectionRefs}:{version:1,operations,anchors};
 assertTemplate(template);return template;
}
export function templateVariables(template:CommandTemplate):string[]{
 assertTemplate(template);
 const names=new Set<string>();for(const op of template.operations)for(const text of outputStrings(op)){if(typeof text!=='string')fail('반복 작업의 텍스트 형식이 잘못되었습니다.');for(const match of text.matchAll(variablePattern))names.add(match[1]);}
 if(names.size>20)fail('반복 작업 변수는 최대 20개입니다.');return [...names];
}
export function assertTemplate(value:unknown):asserts value is CommandTemplate{
 const t=value as CommandTemplate;
 if(!t||![1,2,3,4].includes(t.version)||!Array.isArray(t.operations)||!t.operations.length||t.operations.length>30||!t.anchors||typeof t.anchors!=='object'||Array.isArray(t.anchors))fail('반복 작업 저장 형식이 잘못되었습니다.');
 if(t.version===4){
  const [op]=t.operations;
  if(Object.keys(t).length!==4||Object.keys(t.anchors).length!==0||t.operations.length!==1||!op||op.kind!=='set_shape_fill'||Object.keys(op).length!==4||
     typeof op.target!=='string'||!shapeFillId.test(op.target)||typeof op.originalFingerprint!=='string'||!shapeFillDigest.test(op.originalFingerprint)||
     typeof op.color!=='string'||!shapeFillColor.test(op.color)||typeof t.shapeFingerprint!=='string'||!shapeFillDigest.test(t.shapeFingerprint)){
   fail('기록한 도형의 원본 속성을 확인할 수 없습니다.');
  }
  return;
 }
 for(const [id,text] of Object.entries(t.anchors))if(!/^s[0-9]+p[0-9]+$/.test(id)||typeof text!=='string'||text.length>16000)fail('반복 작업 기준 문단이 잘못되었습니다.');
 for(const op of t.operations)if(!op||typeof op!=='object'||Array.isArray(op)||storesCharacterStyle(op)||!legacyKinds.has(op.kind)&&
   !(t.version!==1&&sectionKinds.has(op.kind))&&!(t.version===3&&isRecordedTableCommand(op)))fail('지원하지 않는 반복 작업 명령입니다.');
 if(t.version!==1){
  const keys=['version','operations','anchors','sectionRefs',...(t.version===3?['tableRefs']:[])];
  if(Object.keys(t).some(k=>!keys.includes(k))||!Array.isArray(t.sectionRefs)||(t.version===2&&!t.sectionRefs.length)||t.sectionRefs.length>30||new Set(t.sectionRefs).size!==t.sectionRefs.length||t.sectionRefs.some(s=>!Number.isSafeInteger(s)||s<0||s>99))fail('반복 작업의 기록 구역 목록이 잘못되었습니다.');
  const refs=new Set<number>();
  for(const op of t.operations)if(sectionKinds.has(op.kind)){if(!('section' in op))return fail('반복 작업의 구역 대상이 잘못되었습니다.');if(!Number.isSafeInteger(op.section)||op.section<0||op.section>99)fail('반복 작업의 구역 대상이 잘못되었습니다.');refs.add(op.section);}
  if(refs.size)for(const id of Object.keys(t.anchors))refs.add(Number(id.match(/^s([0-9]+)p/)![1]));
  if(refs.size!==t.sectionRefs.length||t.sectionRefs.some(s=>!refs.has(s)))fail('반복 작업의 구역과 대상 정보가 일치하지 않습니다.');
 }
 if(t.version===3)assertTableTargets(t);
 // Detailed command validation runs against the current document at execution.
 if(JSON.stringify(t).length>250000)fail('반복 작업이 너무 큽니다.');
}
export function templateSections(template:CommandTemplate):number[]{assertTemplate(template);return template.version===2||template.version===3?[...template.sectionRefs]:[];}
export function shapeTargetOptions(template:CommandTemplate,current:Snapshot){
 assertTemplate(template);
 if(template.version!==4)return undefined;
 return Object.entries(current.shapeFillSources??{}).filter(([,source])=>source.templateFingerprint===template.shapeFingerprint)
  .map(([id,{section,paragraph,control}])=>({id,section,paragraph,control}));
}
export function materializeTemplate(template:CommandTemplate,current:Snapshot,values:Record<string,string>,sectionTargets:SectionTargets={},tableTargets:TableTargets={},shapeTarget?:string):Generation{
 assertTemplate(template);const mapping=new Map<string,string>(),assigned=new Set<string>();
 if(template.version===4){
  if(Object.keys(values).length||Object.keys(sectionTargets).length||Object.keys(tableTargets).length)fail('도형 반복 작업에는 직접 고른 도형만 지정하세요.');
  if(!shapeTarget||!shapeTargetOptions(template,current)?.some(item=>item.id===shapeTarget))return fail('원본 속성이 일치하는 도형을 직접 선택해 주세요.');
  const source=current.shapeFillSources![shapeTarget];
  return validateGeneration({message:'저장한 도형 채우기 작업을 실행했습니다.',sourceIds:[],operations:[{...template.operations[0],target:shapeTarget,originalFingerprint:source.fingerprint}]},current,[]);
 }
 if(shapeTarget!==undefined)fail('기록하지 않은 도형 대상이 지정되었습니다.');
 const sectionRefs=templateSections(template),selected=new Map<number,number>();
 if(!sectionTargets||typeof sectionTargets!=='object'||Array.isArray(sectionTargets)||Object.keys(sectionTargets).some(k=>!sectionRefs.some(s=>String(s)===k)))fail('기록하지 않은 구역 대상이 지정되었습니다.');
 for(const source of sectionRefs){
  if(!Object.hasOwn(sectionTargets,String(source)))fail('기록한 각 구역의 대상 구역을 직접 선택해 주세요.');
  const target=sectionTargets[String(source)];
  if(!Number.isSafeInteger(target)||!current.structure?.sections.some(s=>s.index===target))fail('현재 문서의 대상 구역을 다시 선택해 주세요.');
  if([...selected.values()].includes(target))fail('서로 다른 기록 구역을 같은 대상 구역으로 합칠 수 없습니다.');
  selected.set(source,target);
 }
 for(const [id,original] of Object.entries(template.anchors)){
  const source=Number(id.match(/^s([0-9]+)p/)![1]),section=selected.get(source);
  const matches=current.nodes.filter(n=>n.editable&&n.text===original&&(!sectionRefs.length||n.section===section));
  if(matches.length!==1)fail(matches.length?'같은 내용의 문단이 여러 개 있어 대상을 결정할 수 없습니다.':'기준 문단 내용이 달라졌거나 사라졌습니다. 반복 작업을 다시 기록해 주세요.');
  if(assigned.has(matches[0].id))fail('서로 다른 기준 문단이 같은 문단을 가리킵니다. 반복 작업을 다시 기록해 주세요.');
  assigned.add(matches[0].id);mapping.set(id,matches[0].id);
 }
 const fill=(text:string)=>text.replace(variablePattern,(_,name:string)=>{
  if(!Object.hasOwn(values,name)||typeof values[name]!=='string')return fail('변수를 입력해 주세요: '+name);
  return values[name];
 });
 const tables=bindTableTargets(template,current,tableTargets);
 const operations=structuredClone(template.operations).map(op=>{
  if(sectionKinds.has(op.kind)&&'section' in op){const target=selected.get(op.section);if(target===undefined)fail('반복 작업의 구역 대상 정보가 없습니다.');op.section=target!;}
  if('target' in op){const id=(isRecordedTableCommand(op)?tables:mapping).get(op.target);if(!id)fail('반복 작업 대상 정보가 없습니다.');op.target=id!;}
  if('after' in op){const id=mapping.get(op.after);if(!id)fail('반복 작업 삽입 위치 정보가 없습니다.');op.after=id!;}
  if(op.kind==='create_document'||op.kind==='insert_body_paragraphs')op.paragraphs=op.paragraphs.map(fill);
  else if(op.kind==='replace_body_text'||op.kind==='set_table_cell')op.text=fill(op.text);
  else if(op.kind==='insert_table_row'||op.kind==='insert_table_column')op.values=op.values.map(fill);
  else if(op.kind==='create_table')op.rows=op.rows.map(row=>row.map(fill));
  else if(op.kind==='set_master_page_text')op.text=fill(op.text);
  return op;
 });
 return validateGeneration({message:'저장한 반복 작업을 실행했습니다.',operations,sourceIds:[]},current,[]);
}
export function draftTemplate(kind:'official-letter'|'plan'|'report'):CommandTemplate{
 const paragraphs=kind==='official-letter'?['수신: {{수신}}','제목: {{제목}}','1. {{목적}}','2. 요청 사항: {{요청사항}}','3. 제출 기한: {{기한}}','붙임: {{붙임}}']:kind==='plan'?['{{사업명}} 추진 계획','1. 추진 목적','{{목적}}','2. 추진 기간','{{기간}}','3. 주요 추진 내용','{{내용}}','4. 추진 일정','{{일정}}','5. 소요 예산','{{예산}}']:['{{사업명}} 결과 보고','1. 추진 개요','{{개요}}','2. 추진 실적','{{실적}}','3. 문제점 및 개선 사항','{{개선사항}}','4. 향후 계획','{{향후계획}}'];
 return {version:1,operations:[{kind:'create_document',paragraphs}],anchors:{}};
}
