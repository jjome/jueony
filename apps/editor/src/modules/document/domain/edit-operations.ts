import type { Snapshot, EditOp } from '../public/types.ts';
import { controlKinds, validateControlOperations } from './control-operations.ts';
const fail=(m:string):never=>{throw new Error(m);};
const object=(v:unknown):Record<string,unknown>=>{if(!v||typeof v!=='object'||Array.isArray(v))return fail('응답이 JSON 객체가 아닙니다.');return v as Record<string,unknown>;};
function keys(o:Record<string,unknown>, allowed:string[]){if(Object.keys(o).some(k=>!allowed.includes(k)))fail('지원하지 않는 응답 필드입니다.');}
function string(v:unknown,max=16000){if(typeof v!=='string'||v.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(v))return fail('텍스트 형식/길이가 잘못되었습니다.');return v;}
function paragraphs(v:unknown){if(!Array.isArray(v)||!v.length||v.length>100)return fail('문단은 1~100개여야 합니다.');return v.map(t=>{const s=string(t);if(Array.from(s).length>4000)fail('AI가 만드는 한 문단은 4,000자 이내입니다.');if(/[\r\n\t]/.test(s))fail('문단별 텍스트에 줄바꿈/탭을 넣지 마세요.');return s;});}
function groupConsecutiveInsertions(values:unknown[]){
 const grouped:Record<string,unknown>[]=[];
 for(const value of values){
  const op=object(value),previous=grouped.at(-1);
  if(op.kind==='insert_body_paragraphs'){
   // Check every original object before grouping so unknown fields cannot disappear.
   keys(op,['kind','after','paragraphs']);
   paragraphs(op.paragraphs);
   if(previous?.kind===op.kind&&typeof op.after==='string'&&previous.after===op.after&&Array.isArray(previous.paragraphs)&&Array.isArray(op.paragraphs)){
    grouped[grouped.length-1]={...previous,paragraphs:[...previous.paragraphs,...op.paragraphs]};continue;
   }
  }
  grouped.push(op);
 }
 return grouped;
}
export function validateEditOperations(raw:unknown,snapshot:Snapshot):EditOp[]{
 const g={operations:raw};
 if(!Array.isArray(g.operations)||g.operations.length>30)fail('명령은 최대 30개입니다.');
 const touched=new Set<string>(),inserted=new Set<string>();let total=0;
 const grouped=groupConsecutiveInsertions(g.operations as unknown[]);
 const operations:EditOp[]=grouped.map(value=>{
  const o=object(value);const kind=o.kind;
  if(controlKinds.includes(kind as string))return o as EditOp;
  if(kind==='create_document'){keys(o,['kind','paragraphs']);if(g.operations instanceof Array&&g.operations.length!==1)fail('새 문서 작성은 다른 명령과 함께 실행할 수 없습니다.');const p=paragraphs(o.paragraphs);total+=p.join('').length;return {kind,paragraphs:p};}
  const id=string(kind==='insert_body_paragraphs'?o.after:o.target,100);
  const target=snapshot.nodes.find(n=>n.id===id);if(!target||!target.editable)fail('없는 대상 또는 현재 AI 편집을 지원하지 않는 문단입니다.');
  if(kind==='insert_body_paragraphs'){if(inserted.has(id))fail('같은 위치의 삽입 명령은 연속된 한 묶음으로 보내 주세요.');inserted.add(id);keys(o,['kind','after','paragraphs']);const p=paragraphs(o.paragraphs);total+=p.join('').length;return {kind,after:id,paragraphs:p};}
  if(touched.has(id))fail('같은 문단의 겹치는 변경 명령은 한 명령으로 합쳐 주세요.');touched.add(id);
  if(kind!=='replace_body_text'&&kind!=='delete_body_text')return fail('이 편집 명령은 아직 지원하지 않습니다.');
  keys(o,kind==='replace_body_text'?['kind','target','start','count','text']:['kind','target','start','count']);
  const start=o.start,count=o.count;
  if(!Number.isSafeInteger(start)||!Number.isSafeInteger(count)||(start as number)<0||(count as number)<0||(start as number)+(count as number)>Array.from(target!.text).length)fail('텍스트 범위가 문단을 벗어납니다.');
  if(kind==='delete_body_text'){if(!count)fail('삭제 범위가 비어 있습니다.');return {kind,target:id,start:start as number,count:count as number};}
  const text=string(o.text);if(/[\r\n\t]/.test(text))fail('줄바꿈은 문단 삽입 명령으로 처리해야 합니다.');total+=text.length;
  if(Array.from(target!.text).length-(count as number)+Array.from(text).length>4000)fail('수정 결과의 한 문단은 4,000자 이내입니다.');
  if(!count&&!text)fail('변경이 없는 명령입니다.');
  return {kind,target:id,start:start as number,count:count as number,text};
 });
 if(total>60000)fail('한 번에 생성하는 본문은 60,000자 이내입니다.');
 if(operations.some(o=>controlKinds.includes(o.kind)))validateControlOperations(operations,snapshot);
 return operations;
}
export function assertRevision(expected:string,actual:string){if(expected!==actual){const e=new Error('요청 후 문서가 변경되었습니다. 최신 문서로 다시 요청해 주세요.');e.name='ConflictError';throw e;}}
