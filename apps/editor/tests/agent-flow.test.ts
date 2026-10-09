import {test} from 'node:test';
import assert from 'node:assert/strict';
import {runOnce} from '../src/mvp/run-once.ts';
import {readReferences} from '../src/mvp/references.ts';
import type {Snapshot} from '../src/mvp/model.ts';

const base:Snapshot={revision:'g1:1',name:'열린.hwp',nodes:[{id:'s0p0',section:0,paragraph:0,text:'before',editable:true}],limitations:[]};
const model={id:'m',adapterId:'openai-compatible' as const,label:'test',endpoint:'http://127.0.0.1',modelId:'test'};
const edit={message:'제안',sourceIds:[],operations:[{kind:'replace_body_text',target:'s0p0',start:0,count:6,text:'after'}]};
function harness(){
 let revision=base.revision,applies=0,calls=0,current=true;
 const controller=new AbortController();
 let release!:(value:unknown)=>void;const pending=new Promise(resolve=>release=resolve);
 const editor={snapshot:()=>({...base,revision}),apply:async()=>{applies++;return {runId:'r',beforeRevision:base.revision,afterRevision:'g1:2',before:'before',after:'after',operationCount:1};}};
 const options={runId:'r',context:{request:'edit',document:base,references:[],history:[]},model,editor,port:{generate:async()=>{calls++;return pending;}},signal:controller.signal,isCurrent:()=>current,createDocument:async()=>editor,state:()=>{}};
 return {options,release,controller,setRevision:()=>revision='g1:2',navigate:()=>current=false,counts:()=>({calls,applies})};
}
test('단일 Agent는 한 번 호출하고 검증 후 실제 적용 결과를 반환한다',async()=>{
 const h=harness(),result=runOnce(h.options);h.release(edit);
 assert.equal((await result).receipt?.operationCount,1);assert.deepEqual(h.counts(),{calls:1,applies:1});
});
test('취소/업무 전환/늦은 응답/잘못된 명령은 적용·자동 재시도하지 않는다',async()=>{
 for(const scenario of ['cancel','navigate','stale','malformed']){
  const h=harness(),result=runOnce(h.options);
  if(scenario==='cancel')h.controller.abort();if(scenario==='navigate')h.navigate();if(scenario==='stale')h.setRevision();
  h.release(scenario==='malformed'?{...edit,operations:[{kind:'arbitrary_write'}]}:edit);
  await assert.rejects(result);assert.deepEqual(h.counts(),{calls:1,applies:0});
 }
});
test('지원하지 않는 작업의 설명만 있는 응답은 문서를 변경하지 않는다',async()=>{
 const h=harness(),result=runOnce(h.options);h.release({message:'표 편집은 아직 지원하지 않습니다.',sourceIds:[],operations:[]});
 assert.equal((await result).receipt,undefined);assert.equal(h.counts().applies,0);
});
const txt={kind:'file',name:'자료.txt',queryPermission:async()=>'granted',getFile:async()=>new File(['disk'],'자료.txt')};
const folder=(children:any[]=[])=>({kind:'directory',name:'root',queryPermission:async()=>'granted',async *entries(){for(const h of children)yield [h.name,h];}});
test('참고 자료 중복 제거·다른 업무 차단·최신 열린 내용 우선',async()=>{
 const root=folder([txt]);const folders:any=[{id:'f',workspaceId:'w',name:'root',handle:root}];
 const refs:any=[{id:'f',rootId:'f',workspaceId:'w',path:'root',handle:root},{id:'f/root/자료.txt',rootId:'f',workspaceId:'w',path:'root/자료.txt',handle:txt}];
 const signal=new AbortController().signal;
 const result=await readReferences(refs,folders,'w',async()=>'',signal,async()=>({text:'미저장 최신 문서',revision:'v2'}));
 assert.equal(result.length,1);assert.equal(result[0].text,'미저장 최신 문서');assert.match(result[0].limitation!,/v2/);assert.equal(result[0].sha256.length,64);
 await assert.rejects(readReferences(refs,folders,'foreign',async()=>'',signal),/다른 업무/);
});
test('참고 폴더 미지원 형식·깊이·취소는 조용한 누락 없이 실패한다',async()=>{
 const signal=new AbortController().signal;
 const invoke=(root:any,s=signal)=>readReferences([{id:'f',rootId:'f',workspaceId:'w',path:'root',handle:root}],[{id:'f',workspaceId:'w',name:'root',handle:root}], 'w',async()=>'',s);
 await assert.rejects(invoke(folder([{...txt,name:'binary.exe'}])),/미지원/);
 let nested:any=txt;for(let i=0;i<23;i++)nested=folder([nested]);
 await assert.rejects(invoke(nested),/20단계/);
 const c=new AbortController();c.abort();await assert.rejects(invoke(folder(),c.signal),{name:'AbortError'});
});
