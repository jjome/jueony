import type {Snapshot,EditOp} from '../../document/public/index.ts';
import {validateEditProposal as validateGeneration} from '../../document/public/index.ts';
import type {CommandTemplate,SectionTargets,AutomationProposal as Generation} from '../public/contracts.ts';
const legacyKinds=new Set(['create_document','replace_body_text','delete_body_text','insert_body_paragraphs','format_characters','format_paragraph','create_table']);
const sectionKinds=new Set(['set_section_tabs','set_line_numbers','set_page_background','set_master_page_text','delete_master_page','set_page_setup','set_columns']);
const variablePattern=/\{\{([가-힣A-Za-z0-9_ ]{1,40})\}\}/g;
const fail=(message:string):never=>{throw new Error(message);};
function outputStrings(op:EditOp):string[]{
 if(op.kind==='create_document'||op.kind==='insert_body_paragraphs')return op.paragraphs;
 if(op.kind==='replace_body_text')return [op.text];
 if(op.kind==='create_table')return op.rows.flat();
 if(op.kind==='set_master_page_text')return [op.text];
 return [];
}
export function captureTemplate(generation:Generation,base:Snapshot):CommandTemplate{
 const g=validateGeneration(generation,base,generation.sourceIds);
 if(!g.operations.length)fail('문서 변경이 있는 작업만 반복 작업으로 저장할 수 있습니다.');
 const anchors:Record<string,string>=Object.create(null),sections=new Set<number>();
 const hasSections=g.operations.some(op=>sectionKinds.has(op.kind));
 for(const op of g.operations){
  if(!legacyKinds.has(op.kind)&&!sectionKinds.has(op.kind))fail('이 반복 작업은 본문·문단 서식·새 표와 기본 구역·쪽·바탕쪽 설정만 지원합니다. 기존 표·스타일 ID·개체 명령은 아직 기록하지 않습니다.');
  if(sectionKinds.has(op.kind)&&'section' in op)sections.add(op.section);
  const id='target' in op?op.target:'after' in op?op.after:undefined;
  if(id){const node=base.nodes.find(n=>n.id===id);if(!node)fail('기준 문단을 찾을 수 없습니다.');anchors[id]=node!.text;if(hasSections)sections.add(node!.section);}
 }
 const template:CommandTemplate=hasSections?{version:2,operations:structuredClone(g.operations),anchors,sectionRefs:[...sections].sort((a,b)=>a-b)}:{version:1,operations:structuredClone(g.operations),anchors};
 assertTemplate(template);return template;
}
export function templateVariables(template:CommandTemplate):string[]{
 assertTemplate(template);
 const names=new Set<string>();for(const op of template.operations)for(const text of outputStrings(op)){if(typeof text!=='string')fail('반복 작업의 텍스트 형식이 잘못되었습니다.');for(const match of text.matchAll(variablePattern))names.add(match[1]);}
 if(names.size>20)fail('반복 작업 변수는 최대 20개입니다.');return [...names];
}
export function assertTemplate(value:unknown):asserts value is CommandTemplate{
 const t=value as CommandTemplate;
 if(!t||![1,2].includes(t.version)||!Array.isArray(t.operations)||!t.operations.length||t.operations.length>30||!t.anchors||typeof t.anchors!=='object'||Array.isArray(t.anchors))fail('반복 작업 저장 형식이 잘못되었습니다.');
 for(const [id,text] of Object.entries(t.anchors))if(!/^s[0-9]+p[0-9]+$/.test(id)||typeof text!=='string'||text.length>16000)fail('반복 작업 기준 문단이 잘못되었습니다.');
 for(const op of t.operations)if(!op||typeof op!=='object'||Array.isArray(op)||!legacyKinds.has(op.kind)&&!(t.version===2&&sectionKinds.has(op.kind)))fail('지원하지 않는 반복 작업 명령입니다.');
 if(t.version===2){
  if(Object.keys(t).some(k=>!['version','operations','anchors','sectionRefs'].includes(k))||!Array.isArray(t.sectionRefs)||!t.sectionRefs.length||t.sectionRefs.length>30||new Set(t.sectionRefs).size!==t.sectionRefs.length||t.sectionRefs.some(s=>!Number.isSafeInteger(s)||s<0||s>99))fail('반복 작업의 기록 구역 목록이 잘못되었습니다.');
  const refs=new Set<number>();
  for(const op of t.operations)if(sectionKinds.has(op.kind)){if(!('section' in op))return fail('반복 작업의 구역 대상이 잘못되었습니다.');if(!Number.isSafeInteger(op.section)||op.section<0||op.section>99)fail('반복 작업의 구역 대상이 잘못되었습니다.');refs.add(op.section);}
  for(const id of Object.keys(t.anchors))refs.add(Number(id.match(/^s([0-9]+)p/)![1]));
  if(refs.size!==t.sectionRefs.length||t.sectionRefs.some(s=>!refs.has(s)))fail('반복 작업의 구역과 대상 정보가 일치하지 않습니다.');
 }
 // Detailed command validation runs against the current document at execution.
 if(JSON.stringify(t).length>250000)fail('반복 작업이 너무 큽니다.');
}
export function templateSections(template:CommandTemplate):number[]{assertTemplate(template);return template.version===2?[...template.sectionRefs]:[];}
export function materializeTemplate(template:CommandTemplate,current:Snapshot,values:Record<string,string>,sectionTargets:SectionTargets={}):Generation{
 assertTemplate(template);const mapping=new Map<string,string>(),assigned=new Set<string>();
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
  const matches=current.nodes.filter(n=>n.editable&&n.text===original&&(template.version===1||n.section===section));
  if(matches.length!==1)fail(matches.length?'같은 내용의 문단이 여러 개 있어 대상을 결정할 수 없습니다.':'기준 문단 내용이 달라졌거나 사라졌습니다. 반복 작업을 다시 기록해 주세요.');
  if(assigned.has(matches[0].id))fail('서로 다른 기준 문단이 같은 문단을 가리킵니다. 반복 작업을 다시 기록해 주세요.');
  assigned.add(matches[0].id);mapping.set(id,matches[0].id);
 }
 const fill=(text:string)=>text.replace(variablePattern,(_,name:string)=>{
  if(!Object.hasOwn(values,name)||typeof values[name]!=='string')return fail('변수를 입력해 주세요: '+name);
  return values[name];
 });
 const operations=structuredClone(template.operations).map(op=>{
  if(sectionKinds.has(op.kind)&&'section' in op){const target=selected.get(op.section);if(target===undefined)fail('반복 작업의 구역 대상 정보가 없습니다.');op.section=target!;}
  if('target' in op){const id=mapping.get(op.target);if(!id)fail('반복 작업 대상 정보가 없습니다.');op.target=id!;}
  if('after' in op){const id=mapping.get(op.after);if(!id)fail('반복 작업 삽입 위치 정보가 없습니다.');op.after=id!;}
  if(op.kind==='create_document'||op.kind==='insert_body_paragraphs')op.paragraphs=op.paragraphs.map(fill);
  else if(op.kind==='replace_body_text')op.text=fill(op.text);
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
