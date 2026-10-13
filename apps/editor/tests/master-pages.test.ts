import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultMasterPageText,validateMasterPageText,sameMasterPageText} from '../src/modules/document/public/index.ts';
import {planMasterPageEdits,executeMasterPageEdits,supportsMasterPages} from '../src/adapters/rhwp/master-pages.ts';
const paper={width:59528,height:84188,landscape:false};
test('master text validates scalar text, line limit, paper coordinates and hundred-point styles',()=>{
 assert.equal(validateMasterPageText({...defaultMasterPageText(),text:'기관명 😀\n내부 검토용'}).text,'기관명 😀\n내부 검토용');
 for(const patch of [{text:'\t'},{text:'x'.repeat(4001)},{text:'\n'.repeat(100)},{x:59528},{y:84188},{fontSize:0},{fontSize:7201},{bold:1},{color:'red'}])assert.throws(()=>validateMasterPageText({...defaultMasterPageText(),...patch} as any,paper));
 assert.equal(sameMasterPageText({...defaultMasterPageText(),color:'#AABBCC'},{...defaultMasterPageText(),color:'#aabbcc'}),true);
});
test('from-current scope isolates earlier sections and existing other parity; no-op and delete use exact baselines',()=>{
 const rows=[0,1,2].map(()=>({ok:true,editable:true,pages:[] as any[]})),calls:number[]=[],doc={getSectionCount:()=>3,getPageDef:()=>JSON.stringify(paper),getMasterPages:(s:number)=>JSON.stringify(rows[s]),setMasterPageText:(s:number,kind:string,json:string)=>{calls.push(s);const next=JSON.parse(json);rows[s].pages=rows[s].pages.filter(p=>p.kind!==kind);if(!next.delete)rows[s].pages.push({...next,kind});return '{"ok":true}';}};
 const next={...defaultMasterPageText(),text:'양식'},edits=planMasterPageEdits(doc,1,'odd',next,'from-current');assert.equal(edits.length,2);executeMasterPageEdits(doc,edits);assert.deepEqual(calls,[1,2]);assert.equal(rows[0].pages.length,0);assert.deepEqual(planMasterPageEdits(doc,1,'odd',next,'from-current'),[]);
 const pending=planMasterPageEdits(doc,1,'odd',null,'from-current');rows[2].pages[0].text='변경';assert.throws(()=>executeMasterPageEdits(doc,pending),/바뀌었습니다/);assert.deepEqual(calls,[1,2]);
});
test('complex master siblings and unsupported engines are refused before any write',()=>{
 assert.equal(supportsMasterPages(undefined),false);const doc={getSectionCount:()=>1,getPageDef:()=>JSON.stringify(paper),getMasterPages:()=>'{"ok":true,"editable":false,"pages":[]}',setMasterPageText:()=>{throw new Error('must not write');}};
 assert.throws(()=>planMasterPageEdits(doc,0,'both',defaultMasterPageText(),'document'),/혼합 서식/);
 assert.throws(()=>planMasterPageEdits(doc,0,'both',defaultMasterPageText(),'invalid'));
});
