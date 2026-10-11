import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import init,{HwpDocument} from '@rhwp/core';
import {runBounded} from '../src/agent/run-bounded.ts';
import {executeDocumentOperations} from '../src/document-control/execute.ts';
import {readStructure} from '../src/document-control/structure.ts';
import type {Snapshot,Generation} from '../src/mvp/model.ts';
await init({module_or_path:await readFile(new URL('../node_modules/@rhwp/core/rhwp_bg.wasm',import.meta.url))});
const body=(doc:HwpDocument)=>Array.from({length:doc.getParagraphCount(0)},(_,paragraph)=>doc.getTextRange(0,paragraph,0,doc.getParagraphLength(0,paragraph)));

test('bounded 최종 계획만 실제 WASM에 적용하고 기존 표/양방향 저장/요청 snapshot undo를 보존한다',async()=>{
 const doc=new HwpDocument(await readFile(new URL('../fixtures/schedule-table.hwpx',import.meta.url)));
 let undo:number|undefined;
 try{
  const before=body(doc),beforeStructure=readStructure(doc),snapshot:Snapshot={revision:'engine:1',name:'일정.hwpx',nodes:before.map((text,paragraph)=>({id:'s0p'+paragraph,section:0,paragraph,text,editable:paragraph===0})),structure:beforeStructure,limitations:[]};
  let calls=0,applies=0,preflights=0;
  const editor={snapshot:()=>snapshot,preflight:async(base:Snapshot,generation:Generation)=>{
   preflights++;const copy=new HwpDocument(doc.exportHwpx());try{executeDocumentOperations(copy,base,generation.operations);assert.deepEqual(body(doc),before);}finally{copy.free();}
  },apply:async(id:string,base:Snapshot,generation:Generation)=>{
   applies++;undo=doc.saveSnapshot();executeDocumentOperations(doc,base,generation.operations);
   return {runId:id,beforeRevision:base.revision,afterRevision:'engine:2',before:before.join('\n'),after:body(doc).join('\n'),operationCount:generation.operations.length};
  }};
  const result=await runBounded({runId:'r-engine',context:{request:'제목을 정리해줘',document:snapshot,references:[],history:[]},model:{id:'mock',adapterId:'openai-compatible',label:'mock',endpoint:'http://127.0.0.1',modelId:'mock'},port:{generate:async()=>{
   calls++;assert.deepEqual(body(doc),before);return {message:'최종 제목 후보',sourceIds:[],operations:[{kind:'replace_body_text',target:'s0p0',start:0,count:Array.from(before[0]).length,text:'최종 추진 일정'}]};
  }},editor,createDocument:async()=>{throw new Error('unexpected new document');},signal:new AbortController().signal,isCurrent:()=>true,state:()=>{}});
  assert.deepEqual({calls,applies,preflights},{calls:2,applies:1,preflights:1});assert.equal(result.receipt?.operationCount,1);
  assert.equal(body(doc)[0],'최종 추진 일정');assert.deepEqual(readStructure(doc).tables,beforeStructure.tables);
  for(const bytes of [doc.exportHwp(),doc.exportHwpx()]){const reopened=new HwpDocument(bytes);try{assert.equal(body(reopened)[0],'최종 추진 일정');assert.deepEqual(readStructure(reopened).tables,beforeStructure.tables);}finally{reopened.free();}}
  doc.restoreSnapshot(undo);undo=undefined;assert.deepEqual(body(doc),before);assert.deepEqual(readStructure(doc),beforeStructure);
 }finally{if(undo!==undefined)doc.discardSnapshot(undo);doc.free();}
});