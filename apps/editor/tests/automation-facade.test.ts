import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createAutomationFacade} from '../src/modules/automation/public/index.ts';
import type {AutomationEditorPort} from '../src/modules/automation/public/index.ts';
import type {Snapshot} from '../src/modules/document/public/index.ts';
const base:Snapshot={revision:'original',name:'기존.hwp',nodes:[{id:'s0p0',section:0,paragraph:0,text:'기존',editable:true}],limitations:[]};
test('new-document macro applies only through newly created editor with its own revision',async()=>{
 const automation=createAutomationFacade();let creates=0,applies=0;
 const proposal=automation.prepare(automation.draft('report'),base,{'사업명':'사업','개요':'개요','실적':'실적','개선사항':'개선','향후계획':'계획'});
 const newBase={...base,revision:'new',name:'새 문서.hwp'};
 const created:AutomationEditorPort={snapshot:()=>newBase,async apply(id,snapshot,value){assert.equal(snapshot,newBase);assert.equal(value,proposal);applies++;return {runId:id,beforeRevision:'new',afterRevision:'applied',before:'',after:'결과',operationCount:value.operations.length};}};
 const original:AutomationEditorPort={snapshot:()=>base,apply:async()=>{throw new Error('old document must not change');}};
 const receipt=await automation.apply({runId:'macro',base,proposal,editor:original,createDocument:async()=>{creates++;return created;}});
 assert.equal(receipt.runId,'macro');assert.equal(creates,1);assert.equal(applies,1);
});
test('failed macro application is surfaced once without automatic retry or a false receipt',async()=>{
 const automation=createAutomationFacade();let calls=0;
 const editor:AutomationEditorPort={snapshot:()=>base,async apply(){calls++;throw new Error('partial native failure');}};
 await assert.rejects(automation.apply({runId:'macro',base,proposal:{message:'',sourceIds:[],operations:[{kind:'replace_body_text',target:'s0p0',start:0,count:2,text:'변경'}]},editor,createDocument:async()=>{throw new Error('unexpected new document');}}),/partial native failure/);
 assert.equal(calls,1);
});
