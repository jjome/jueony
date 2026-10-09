import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import init,{HwpDocument} from '@rhwp/core';
import {executeBodyOperations,validateGeneration,assertRevision} from '../src/mvp/edit-schema.ts';
import {initialState,addWorkspace,addChat,appendMessage,interruptRuns} from '../src/mvp/model.ts';
import {buildContext} from '../src/mvp/context.ts';
import type {Snapshot} from '../src/mvp/model.ts';
await init({module_or_path:await readFile(new URL('../node_modules/@rhwp/core/rhwp_bg.wasm',import.meta.url))});
const snapshot=(doc:HwpDocument):Snapshot=>({revision:'g1:1',name:'test.hwp',limitations:[],nodes:Array.from({length:doc.getParagraphCount(0)},(_,p)=>({id:'s0p'+p,section:0,paragraph:p,text:doc.getTextRange(0,p,0,doc.getParagraphLength(0,p)),editable:true}))});
const text=(doc:HwpDocument)=>snapshot(doc).nodes.map(n=>n.text);
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
test('명령 전체 사전 검사에서 알 수 없는 명령·범위·출처·중복 대상을 거부한다',()=>{
 const doc=HwpDocument.createEmpty();doc.createBlankDocument();try{const s=snapshot(doc);
 for(const operations of [[{kind:'shell',command:'anything'}],[{kind:'delete_body_text',target:'s0p0',start:0,count:1}],[{kind:'create_document',paragraphs:['a\nb']}],[{kind:'insert_body_paragraphs',after:'s0p0',paragraphs:['a']},{kind:'insert_body_paragraphs',after:'s0p0',paragraphs:['b']}]])assert.throws(()=>validateGeneration({message:'',sourceIds:[],operations},s,[]));
 assert.throws(()=>validateGeneration({message:'',sourceIds:['foreign'],operations:[]},s,[]));assert.throws(()=>assertRevision('old','new'));assert.deepEqual(text(doc),['']);
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
