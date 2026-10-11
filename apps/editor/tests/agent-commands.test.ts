import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import init,{HwpDocument} from '@rhwp/core';
import {executeBodyOperations,validateGeneration,assertRevision} from '../src/mvp/edit-schema.ts';
import {executeDocumentOperations} from '../src/document-control/execute.ts';
import {readStructure} from '../src/document-control/structure.ts';
import {parseAnthropicGeneration} from '../../launcher/providers/anthropic-schema.mjs';
import {initialState,addWorkspace,addChat,appendMessage,interruptRuns} from '../src/mvp/model.ts';
import {buildContext} from '../src/mvp/context.ts';
import type {Snapshot} from '../src/mvp/model.ts';
await init({module_or_path:await readFile(new URL('../node_modules/@rhwp/core/rhwp_bg.wasm',import.meta.url))});
const snapshot=(doc:HwpDocument):Snapshot=>({revision:'g1:1',name:'test.hwp',limitations:[],nodes:Array.from({length:doc.getParagraphCount(0)},(_,p)=>({id:'s0p'+p,section:0,paragraph:p,text:doc.getTextRange(0,p,0,doc.getParagraphLength(0,p)),editable:true}))});
const text=(doc:HwpDocument)=>snapshot(doc).nodes.map(n=>n.text);

test('Claude JSON 인자도 공통 대상·범위·출처·서식 검사를 통과해야 한다',()=>{
 const doc=HwpDocument.createEmpty();doc.createBlankDocument();doc.insertText(0,0,0,'검증 본문');
 try{
  const before={...snapshot(doc),structure:readStructure(doc)};
  const decode=(kind:string,args:unknown,sourceIds:string[]=[])=>parseAnthropicGeneration(JSON.stringify({message:'검증',sourceIds,operations:[{kind,arguments:JSON.stringify(args)}]}));
  assert.equal(validateGeneration(decode('format_characters',{target:'s0p0',properties:{bold:false}}),before,[]).operations.length,1);
  const invalid=[
   decode('format_characters',{target:'missing',properties:{bold:true}}),
   decode('format_characters',{target:'s0p0',properties:{bold:'true'}}),
   decode('format_characters',{target:'s0p0',properties:{bold:true,unknown:1}}),
   decode('replace_body_text',{target:'s0p0',start:0,count:100,text:'덮어쓰기'}),
   decode('replace_body_text',{target:'s0p0',start:0,count:1,text:'수정',unknown:1}),
   decode('replace_body_text',{target:'s0p0',start:0,count:1,text:'수정'},['다른 업무 자료']),
  ];
  for(const generation of invalid)assert.throws(()=>validateGeneration(generation,before,[]));
  assert.deepEqual({...snapshot(doc),structure:readStructure(doc)},before);
 }finally{doc.free();}
});
test('실제 WASM에서 새 문단 초안을 만들고 두 형식으로 보존한다',()=>{
 const doc=HwpDocument.createEmpty();doc.createBlankDocument();
 try{executeBodyOperations(doc,snapshot(doc),[{kind:'create_document',paragraphs:['올해 계획','첫 번째 항목 😀','두 번째 항목']}]);
 assert.deepEqual(text(doc),['올해 계획','첫 번째 항목 😀','두 번째 항목']);
 for(const bytes of [doc.exportHwp(),doc.exportHwpx()]){const next=new HwpDocument(bytes);try{assert.deepEqual(text(next),text(doc));}finally{next.free();}}
 }finally{doc.free();}
});
test('여러 위치 교체/삭제/삽입과 snapshot 되돌림이 앞뒤 문단을 보존한다',async()=>{
 const doc=new HwpDocument(await readFile(new URL('../fixtures/three-paragraphs.hwp',import.meta.url)));
 try{const before=snapshot(doc),id=doc.saveSnapshot(),controls=doc.getControls(),page=doc.getPageDef(0);const payload=validateGeneration({message:'편집',sourceIds:[],operations:[
 {kind:'replace_body_text',target:'s0p0',start:0,count:Array.from(before.nodes[0].text).length,text:'수정 제목'},
 {kind:'delete_body_text',target:'s0p1',start:0,count:3},
 {kind:'insert_body_paragraphs',after:'s0p2',paragraphs:['추가 본문','마지막 본문']}]},before,[]);
 executeBodyOperations(doc,before,payload.operations);
 assert.equal(text(doc)[0],'수정 제목');assert.equal(text(doc)[1],Array.from(before.nodes[1].text).slice(3).join(''));assert.deepEqual(text(doc).slice(2),[before.nodes[2].text,'추가 본문','마지막 본문']);
 assert.equal(doc.getControls(),controls);assert.equal(doc.getPageDef(0),page);doc.restoreSnapshot(id);assert.deepEqual(text(doc),before.nodes.map(n=>n.text));doc.discardSnapshot(id);
 }finally{doc.free();}
});
test('이모지 앞뒤 Unicode 범위 교체와 빈 문단 삭제를 보존한다',()=>{
 const doc=HwpDocument.createEmpty();doc.createBlankDocument();doc.insertText(0,0,0,'가😀나다');
 try{executeBodyOperations(doc,snapshot(doc),[{kind:'replace_body_text',target:'s0p0',start:1,count:1,text:'🌿'}]);assert.deepEqual(text(doc),['가🌿나다']);
 executeBodyOperations(doc,snapshot(doc),[{kind:'delete_body_text',target:'s0p0',start:0,count:4}]);assert.deepEqual(text(doc),['']);assert.equal(doc.getParagraphCount(0),1);
 }finally{doc.free();}
});
test('본문 전체 교체가 균일한 원래 글자·문단 서식을 보존한다',()=>{
 const doc=HwpDocument.createEmpty();doc.createBlankDocument();doc.insertText(0,0,0,'굵은 원문');
 try{doc.applyCharFormat(0,0,0,doc.getParagraphLength(0,0),JSON.stringify({bold:true}));const char=JSON.parse(doc.getCharPropertiesAt(0,0,0)).charShapeId,para=JSON.parse(doc.getParaPropertiesAt(0,0)).paraShapeId;
 executeBodyOperations(doc,snapshot(doc),[{kind:'replace_body_text',target:'s0p0',start:0,count:5,text:'수정된 제목 😀'}]);
 for(let i=0;i<doc.getParagraphLength(0,0);i++)assert.equal(JSON.parse(doc.getCharPropertiesAt(0,0,i)).charShapeId,char);
 assert.equal(JSON.parse(doc.getParaPropertiesAt(0,0)).paraShapeId,para);
 }finally{doc.free();}
});
test('명령 전체 사전 검사에서 알 수 없는 명령·범위·출처·중복 대상을 거부한다',()=>{
 const doc=HwpDocument.createEmpty();doc.createBlankDocument();try{const s=snapshot(doc);
 for(const operations of [[{kind:'shell',command:'anything'}],[{kind:'delete_body_text',target:'s0p0',start:0,count:1}],[{kind:'create_document',paragraphs:['a\nb']}],[{kind:'replace_body_text',target:'s0p0',start:0,count:0,text:'a'},{kind:'replace_body_text',target:'s0p0',start:0,count:0,text:'b'}]])assert.throws(()=>validateGeneration({message:'',sourceIds:[],operations},s,[]));
 assert.throws(()=>validateGeneration({message:'',sourceIds:['foreign'],operations:[]},s,[]));assert.throws(()=>assertRevision('old','new'));assert.deepEqual(text(doc),['']);
 }finally{doc.free();}
});

test('실제 HCX-005 회귀: 같은 위치의 연속 삽입을 응답 순서대로 보존하고 재열기·undo한다',()=>{
 const doc=HwpDocument.createEmpty();doc.createBlankDocument();
 try{
  const before=snapshot(doc),saved=doc.saveSnapshot();
  const values=['회의 안내','2026년 10월 20일 오후 2시','대회의실'];
  const raw={message:'회의 안내문 작성',sourceIds:[],operations:values.map(value=>({kind:'insert_body_paragraphs',after:'s0p0',paragraphs:[value]}))};
  const original=JSON.stringify(raw),result=validateGeneration(raw,before,[]);assert.equal(JSON.stringify(raw),original);assert.equal(result.operations.length,1);
  executeDocumentOperations(doc,before,result.operations);assert.deepEqual(text(doc),['',...values]);
  for(const bytes of [doc.exportHwp(),doc.exportHwpx()]){const reopened=new HwpDocument(bytes);try{assert.deepEqual(text(reopened),['',...values]);}finally{reopened.free();}}
  doc.restoreSnapshot(saved);assert.deepEqual(text(doc),['']);doc.discardSnapshot(saved);
 }finally{doc.free();}
});

test('같은 문단의 본문 변경과 그 뒤 삽입은 두 순서 모두 대상을 보존한다',()=>{
 for(const reverse of [false,true]){
  const doc=HwpDocument.createEmpty();doc.createBlankDocument();doc.insertText(0,0,0,'원래 제목');
  try{
   const base=snapshot(doc),operations:any[]=[{kind:'replace_body_text',target:'s0p0',start:0,count:5,text:'회의 안내'},{kind:'insert_body_paragraphs',after:'s0p0',paragraphs:['일시','장소']}];
   if(reverse)operations.reverse();executeDocumentOperations(doc,base,validateGeneration({message:'',sourceIds:[],operations},base,[]).operations);
   assert.deepEqual(text(doc),['회의 안내','일시','장소']);
  }finally{doc.free();}
 }
});

test('삽입 묶음도 미지원 속성·문단 수 초과·비연속 중복은 거절한다',()=>{
 const doc=HwpDocument.createEmpty();doc.createBlankDocument();doc.splitParagraph(0,0,0);
 try{
  const base=snapshot(doc),insert=(after:string,paragraphs:string[],extra={})=>({kind:'insert_body_paragraphs',after,paragraphs,...extra});
  for(const operations of [
   [insert('s0p0',['정상']),insert('s0p0',['거절'],{command:'bad'})],
   [insert('s0p0',[]),insert('s0p0',['빈 명령 숨기기 금지'])],
   [insert('s0p0',Array(100).fill('본문')),insert('s0p0',['101번째'])],
   [insert('s0p0',['앞']),insert('s0p1',['다른 위치']),insert('s0p0',['모호한 재삽입'])],
  ])assert.throws(()=>validateGeneration({message:'',sourceIds:[],operations},base,[]));
  assert.deepEqual(text(doc),['','']);
 }finally{doc.free();}
});
test('업무·채팅 Context 격리와 중단 실행 복원',()=>{
 const s=initialState(),a=addWorkspace(s,'A'),a1=s.chats[0],a2=addChat(s,a.id,'A2'),b=addWorkspace(s,'B');
 appendMessage(s,a.id,a1.id,{id:'1',role:'user',text:'A-only'});
 appendMessage(s,a.id,a2.id,{id:'2',role:'user',text:'A2-secret'});
 appendMessage(s,b.id,b.activeChatId,{id:'3',role:'user',text:'B-secret'});
 assert.throws(()=>appendMessage(s,a.id,b.activeChatId,{id:'x',role:'user',text:'wrong'}));
 const context=buildContext(s,a.id,a1.id,{revision:'1',name:'a',nodes:[],limitations:[]},[],'request');
 assert.deepEqual(context.history.map(m=>m.text),['A-only']);
 s.runs.push({id:'r',workspaceId:a.id,chatId:a1.id,documentId:'d',status:'generating',sources:[],createdAt:0});interruptRuns(s);assert.equal(s.runs[0].status,'interrupted');
});
