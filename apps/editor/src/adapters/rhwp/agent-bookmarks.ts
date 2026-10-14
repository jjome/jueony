import type {Snapshot,AgentBookmarkOp,AgentBookmarks,Structure} from '../../modules/document/public/index.ts';
import {validateAgentBookmark,validBookmarkName} from '../../modules/document/public/engine-integration.ts';
import {readStructure,nativeDocument,parsed} from './structure.ts';
import {captureBodyPreservation} from './body-preservation.ts';
type RootControl={list:number;para:number;controlIndex:number;ctrlId:string};
type RawBookmark={name:string;sec:number;para:number;ctrlIdx:number;charPos:number};
const sorted=<T extends {name:string;target:string|null;offset:number|null}>(items:T[])=>[...items].sort((a,b)=>String(a.target).localeCompare(String(b.target))||(a.offset??0)-(b.offset??0)||a.name.localeCompare(b.name));
export function readAgentBookmarks(wasm:any):AgentBookmarks|undefined {
 const doc=nativeDocument(wasm);if(typeof doc.getBookmarks!=='function')return;
 try{
  const raw:RawBookmark[]=parsed(doc.getBookmarks()),controls:RootControl[]=parsed(doc.getControls());
  if(!Array.isArray(raw)||raw.length>200||raw.some(b=>!validBookmarkName(b.name))||new Set(raw.map(b=>b.name)).size!==raw.length||!Array.isArray(controls))throw new Error('잘못되거나 너무 큰 책갈피 목록');
  const editable=['addBookmark','renameBookmark','deleteBookmark'].every(m=>typeof doc[m]==='function')&&controls.every(c=>c.list===0&&['secd','cold','bokm'].includes(c.ctrlId));
  const items=raw.map(b=>{
   if(![b.sec,b.para,b.ctrlIdx,b.charPos].every(v=>Number.isSafeInteger(v)&&v>=0)||b.sec>=doc.getSectionCount()||b.para>=doc.getParagraphCount(b.sec))throw new Error('잘못된 책갈피 위치');
   if(editable){const flat=Array.from({length:b.sec},(_,s)=>doc.getParagraphCount(s)).reduce((n,c)=>n+c,0)+b.para;
    if(b.charPos>doc.getParagraphLength(b.sec,b.para)||!controls.some(c=>c.list===0&&c.para===flat&&c.controlIndex===b.ctrlIdx&&c.ctrlId==='bokm'))throw new Error('책갈피의 본문 위치 확인 실패');
   }
   return {name:b.name,target:editable?`s${b.sec}p${b.para}`:null,offset:editable?b.charPos:null,editable};
  });
  return {editable,items:sorted(items),...(!editable?{reason:'책갈피 편집은 구역·단 정의와 본문 점 책갈피만 있는 일반 문서에서 지원합니다. 표·개체·필드·특수 영역은 읽기 전용입니다.'}:{})};
 }catch{return {editable:false,items:[],reason:'책갈피 목록/이름/본문 위치를 확인하지 못했거나 200개 한도를 넘었습니다. 원본은 유지합니다.'};}
}
export function executeAgentBookmark(wasm:any,base:Snapshot,op:AgentBookmarkOp):void {
 validateAgentBookmark(op,base);const doc=nativeDocument(wasm),before=readStructure(doc);
 validateAgentBookmark(op,{...base,structure:before});
 if(JSON.stringify(before.bookmarks)!==JSON.stringify(base.structure!.bookmarks))throw new Error('책갈피 이름 또는 위치가 바뀌었습니다. 최신 문서로 다시 요청하세요.');
 const originalBody=captureBodyPreservation(doc),expected=structuredClone(before),raw:RawBookmark[]=parsed(doc.getBookmarks());let result:any;
 if(op.kind==='add_bookmark'){
  const node=base.nodes.find(n=>n.id===op.target)!;
  const text=doc.getTextRange(node.section,node.paragraph,0,doc.getParagraphLength(node.section,node.paragraph));
  const flat=expected.paragraphs.findIndex(p=>p.id===node.id),controls:RootControl[]=parsed(doc.getControls());
  const runs:{charShapeId:number}[]=parsed(doc.getCharShapeRuns(node.section,node.paragraph,0,Array.from(text).length));
  if(text!==node.text||Array.from(text).length>4000||/[\u0000-\u001f\u007f-\u009f]/u.test(text)||controls.some(c=>c.list===0&&c.para===flat&&!['secd','cold'].includes(c.ctrlId))||new Set(runs.map(r=>r.charShapeId)).size>1)throw new Error('새 책갈피의 일반 본문 원문/서식을 확인하지 못했습니다.');
  for(let offset=0;offset<=Array.from(text).length;offset++)if(parsed(doc.getFieldInfoAt(node.section,node.paragraph,offset)).inField)throw new Error('필드가 있는 본문에는 책갈피를 추가하지 않습니다.');
  result=parsed(doc.addBookmark(node.section,node.paragraph,op.offset,op.name));
  expected.bookmarks!.items.push({name:op.name,target:op.target,offset:op.offset,editable:true});expected.paragraphs[flat].controls!.push('bokm');
 }else{
  const item=raw.find(b=>b.name===op.name)!;
  if(op.kind==='rename_bookmark'){result=parsed(doc.renameBookmark(item.sec,item.para,item.ctrlIdx,op.newName));expected.bookmarks!.items.find(b=>b.name===op.name)!.name=op.newName;}
  else{result=parsed(doc.deleteBookmark(item.sec,item.para,item.ctrlIdx));expected.bookmarks!.items=expected.bookmarks!.items.filter(b=>b.name!==op.name);const flat=expected.paragraphs.findIndex(p=>p.id===`s${item.sec}p${item.para}`);
   // The old root control list is reconstructed from the stored pre-operation index.
   const index=item.ctrlIdx;if(expected.paragraphs[flat].controls?.[index]!=='bokm')throw new Error('삭제 책갈피의 본문 제어 순서가 다릅니다.');expected.paragraphs[flat].controls!.splice(index,1);
  }
 }
 if(result?.ok!==true)throw new Error('문서 엔진이 책갈피 명령을 거절했습니다.');
 expected.bookmarks!.items=sorted(expected.bookmarks!.items);expected.unsupportedControls=[...new Set(expected.paragraphs.flatMap(p=>(p.controls??[]).filter(id=>!['secd','cold'].includes(id))))];
 const stable=(value:Structure)=>({...value,sections:value.sections.map(s=>{const {emptySectionRemoval,...rest}=s;return {...rest,...(s.lineNumbers?{lineNumbers:{...s.lineNumbers,editable:undefined}}:{}),headerFooters:s.headerFooters?.map(h=>{const {creatable,deletable,...stored}=h;return stored;})};}),paragraphs:value.paragraphs.map(p=>{const {pageIndex,...rest}=p;return rest;})});
 if(JSON.stringify(captureBodyPreservation(doc))!==JSON.stringify(originalBody)||JSON.stringify(stable(readStructure(doc)))!==JSON.stringify(stable(expected)))throw new Error('책갈피 변경 뒤 이름·위치·본문·다른 설정이 계획과 다릅니다.');
}
