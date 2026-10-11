import test from 'node:test';
import assert from 'node:assert/strict';
import {createDocumentFacades} from '../src/modules/document/application/facades.ts';
import type {Snapshot,EditProposal,Receipt} from '../src/modules/document/public/index.ts';
const snapshot:Snapshot={revision:'1:2',name:'document.hwp',limitations:[],nodes:[{id:'s0p0',section:0,paragraph:0,text:'원문',editable:true}]};
const receipt:Receipt={runId:'r',beforeRevision:'1:2',afterRevision:'1:3',before:'원문',after:'수정',operationCount:1};
const proposal:EditProposal={message:'수정',sourceIds:[],operations:[{kind:'replace_body_text',target:'s0p0',start:0,count:2,text:'수정'}]};
function fixture(){
 const calls:string[]=[];
 const facade=createDocumentFacades({readSnapshot(){calls.push('read');return snapshot;},async preflight(_base,value){calls.push('preflight');assert.deepEqual(value,proposal);},async apply(id,_base,value){calls.push('apply:'+id);assert.deepEqual(value,proposal);return receipt;},async undoRequest(value){calls.push('undo');assert.deepEqual(value,receipt);}});
 return {calls,facade};
}
test('Document facade rejects an invalid batch before any native operation',async()=>{
 const {facade,calls}=fixture();
 const invalid={...proposal,operations:[{kind:'replace_body_text',target:'s0p0',start:0,count:200,text:'invalid'}]} as EditProposal;
 await assert.rejects(facade.edit.preflight(snapshot,invalid),/범위/);
 await assert.rejects(facade.edit.apply('r',snapshot,invalid),/범위/);
 assert.deepEqual(calls,[]);
});
test('Document facade passes valid detached contracts and receipts through the engine port',async()=>{
 const {facade,calls}=fixture();assert.deepEqual(await facade.query.readSnapshot(),snapshot);
 await facade.edit.preflight(snapshot,proposal);assert.deepEqual(await facade.edit.apply('r',snapshot,proposal),receipt);
 await facade.edit.undoRequest(receipt);assert.deepEqual(calls,['read','preflight','apply:r','undo']);
});
