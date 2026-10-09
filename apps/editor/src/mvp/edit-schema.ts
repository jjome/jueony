import type { Snapshot, Generation, EditOp } from './model.ts';
const fail=(m:string):never=>{throw new Error(m);};
const object=(v:unknown):Record<string,unknown>=>{if(!v||typeof v!=='object'||Array.isArray(v))return fail('응답이 JSON 객체가 아닙니다.');return v as Record<string,unknown>;};
function keys(o:Record<string,unknown>, allowed:string[]){if(Object.keys(o).some(k=>!allowed.includes(k)))fail('지원하지 않는 응답 필드입니다.');}
function string(v:unknown,max=16000){if(typeof v!=='string'||v.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(v))return fail('텍스트 형식/길이가 잘못되었습니다.');return v;}
function paragraphs(v:unknown){if(!Array.isArray(v)||!v.length||v.length>100)return fail('문단은 1~100개여야 합니다.');return v.map(t=>{const s=string(t);if(/[\r\n\t]/.test(s))fail('문단별 텍스트에 줄바꿈/탭을 넣지 마세요.');return s;});}
export function validateGeneration(raw:unknown,snapshot:Snapshot,sourceIds:string[]):Generation{
 const g=object(raw);keys(g,['message','operations','sourceIds']);const message=string(g.message,6000);
 if(!Array.isArray(g.sourceIds)||g.sourceIds.some(s=>typeof s!=='string'||!sourceIds.includes(s)))fail('알 수 없는 출처입니다.');
 if(!Array.isArray(g.operations)||g.operations.length>30)fail('명령은 최대 30개입니다.');
 const touched=new Set<string>();let total=0;
 const operations:EditOp[]=(g.operations as unknown[]).map(value=>{
  const o=object(value);const kind=o.kind;
  if(kind==='create_document'){keys(o,['kind','paragraphs']);if(g.operations instanceof Array&&g.operations.length!==1)fail('새 문서 작성은 다른 명령과 함께 실행할 수 없습니다.');const p=paragraphs(o.paragraphs);total+=p.join('').length;return {kind,paragraphs:p};}
  const id=string(kind==='insert_body_paragraphs'?o.after:o.target,100);
  const target=snapshot.nodes.find(n=>n.id===id);if(!target||!target.editable)fail('없는 대상 또는 현재 AI 편집을 지원하지 않는 문단입니다.');
  if(touched.has(id))fail('같은 문단의 겹치는 명령은 한 명령으로 합쳐 주세요.');touched.add(id);
  if(kind==='insert_body_paragraphs'){keys(o,['kind','after','paragraphs']);const p=paragraphs(o.paragraphs);total+=p.join('').length;return {kind,after:id,paragraphs:p};}
  if(kind!=='replace_body_text'&&kind!=='delete_body_text')return fail('이 편집 명령은 아직 지원하지 않습니다.');
  keys(o,kind==='replace_body_text'?['kind','target','start','count','text']:['kind','target','start','count']);
  const start=o.start,count=o.count;
  if(!Number.isSafeInteger(start)||!Number.isSafeInteger(count)||(start as number)<0||(count as number)<0||(start as number)+(count as number)>Array.from(target!.text).length)fail('텍스트 범위가 문단을 벗어납니다.');
  if(kind==='delete_body_text'){if(!count)fail('삭제 범위가 비어 있습니다.');return {kind,target:id,start:start as number,count:count as number};}
  const text=string(o.text);if(/[\r\n\t]/.test(text))fail('줄바꿈은 문단 삽입 명령으로 처리해야 합니다.');total+=text.length;
  if(!count&&!text)fail('변경이 없는 명령입니다.');
  return {kind,target:id,start:start as number,count:count as number,text};
 });
 if(total>60000)fail('한 번에 생성하는 본문은 60,000자 이내입니다.');
 return {message,operations,sourceIds:g.sourceIds as string[]};
}
export function assertRevision(expected:string,actual:string){if(expected!==actual){const e=new Error('요청 후 문서가 변경되었습니다. 최신 문서로 다시 요청해 주세요.');e.name='ConflictError';throw e;}}
export function executeBodyOperations(wasm:any, snapshot:Snapshot, ops:EditOp[]){
 const parsed=(v:any)=>typeof v==='string'?JSON.parse(v):v;
 const check=(v:any)=>{const r=parsed(v);if(r?.ok===false)throw new Error('편집 엔진이 명령을 거절했습니다.');return r;};
 const append=(section:number,paragraph:number,values:string[])=>{
  let at=paragraph;
  for(const value of values){check(wasm.splitParagraph(section,at,wasm.getParagraphLength(section,at)));at++;if(value)check(wasm.insertText(section,at,0,value));}
 };
 const ordered=[...ops].sort((a,b)=>{const at=(o:EditOp)=>o.kind==='create_document'?undefined:snapshot.nodes.find(n=>n.id===(o.kind==='insert_body_paragraphs'?o.after:o.target));const x=at(a),y=at(b);return (y?.section??0)-(x?.section??0)||(y?.paragraph??0)-(x?.paragraph??0);});
 for(const op of ordered){
  if(op.kind==='create_document'){
   if(wasm.getSectionCount()!==1||wasm.getParagraphCount(0)!==1||wasm.getParagraphLength(0,0)!==0)throw new Error('새 빈 문서에서만 초안을 작성할 수 있습니다.');
   if(op.paragraphs[0])check(wasm.insertText(0,0,0,op.paragraphs[0]));append(0,0,op.paragraphs.slice(1));continue;
  }
  const n=snapshot.nodes.find(n=>n.id===(op.kind==='insert_body_paragraphs'?op.after:op.target))!;
  if(wasm.getTextRange(n.section,n.paragraph,0,wasm.getParagraphLength(n.section,n.paragraph))!==n.text)throw new Error('대상 문단 원문이 달라졌습니다.');
  if(op.kind==='insert_body_paragraphs'){append(n.section,n.paragraph,op.paragraphs);}
  else check(wasm.replaceText(n.section,n.paragraph,op.start,op.count,op.kind==='delete_body_text'?'':op.text));
 }
}
