import type { Snapshot, EditOp, BodyOp } from '../../modules/document/public/index.ts';
import { controlKinds } from '../../modules/document/public/wire-schema.mjs';
export function executeBodyOperations(wasm:any, snapshot:Snapshot, ops:EditOp[]){
 if(ops.some(o=>controlKinds.includes(o.kind)))throw new Error('구조 명령은 DocumentControl 실행기를 사용해야 합니다.');
 const parsed=(v:any)=>typeof v==='string'?JSON.parse(v):v;
 const check=(v:any)=>{const r=parsed(v);if(r?.ok===false)throw new Error('편집 엔진이 명령을 거절했습니다.');return r;};
 const append=(section:number,paragraph:number,values:string[])=>{
  let at=paragraph;
  for(const value of values){check(wasm.splitParagraph(section,at,wasm.getParagraphLength(section,at)));at++;if(value)check(wasm.insertText(section,at,0,value));}
 };
 const ordered=[...ops as BodyOp[]].sort((a,b)=>{const at=(o:BodyOp)=>o.kind==='create_document'?undefined:snapshot.nodes.find(n=>n.id===(o.kind==='insert_body_paragraphs'?o.after:o.target));const x=at(a),y=at(b);return (y?.section??0)-(x?.section??0)||(y?.paragraph??0)-(x?.paragraph??0);});
 for(const op of ordered){
  if(op.kind==='create_document'){
   if(wasm.getSectionCount()!==1||wasm.getParagraphCount(0)!==1||wasm.getParagraphLength(0,0)!==0)throw new Error('새 빈 문서에서만 초안을 작성할 수 있습니다.');
   if(op.paragraphs[0])check(wasm.insertText(0,0,0,op.paragraphs[0]));append(0,0,op.paragraphs.slice(1));continue;
  }
  const n=snapshot.nodes.find(n=>n.id===(op.kind==='insert_body_paragraphs'?op.after:op.target))!;
  if(wasm.getTextRange(n.section,n.paragraph,0,wasm.getParagraphLength(n.section,n.paragraph))!==n.text)throw new Error('대상 문단 원문이 달라졌습니다.');
  if(op.kind==='insert_body_paragraphs'){append(n.section,n.paragraph,op.paragraphs);}
  else {
   const charShape=parsed(wasm.getCharPropertiesAt(n.section,n.paragraph,0)).charShapeId;
   const paraShape=parsed(wasm.getParaPropertiesAt(n.section,n.paragraph)).paraShapeId;
   if(!Number.isInteger(charShape)||!Number.isInteger(paraShape))throw new Error('원래 문단 서식을 확인하지 못했습니다.');
   const replacement=op.kind==='delete_body_text'?'':op.text;
   const original=Array.from(n.text),expected=[...original.slice(0,op.start),replacement,...original.slice(op.start+op.count)].join('');
   check(wasm.replaceText(n.section,n.paragraph,op.start,op.count,replacement));
   const length=wasm.getParagraphLength(n.section,n.paragraph);
   if(length)check(wasm.setCharShapeId(n.section,n.paragraph,0,length,charShape));
   check(wasm.setParaShapeId(n.section,n.paragraph,paraShape));
   if(wasm.getTextRange(n.section,n.paragraph,0,length)!==expected)throw new Error('편집 결과가 명령과 다릅니다.');
  }
 }
}
