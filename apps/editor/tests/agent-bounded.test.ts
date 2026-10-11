import {test} from 'node:test';
import assert from 'node:assert/strict';
import {runBounded} from '../src/agent/run-bounded.ts';
import {runOnce} from '../src/mvp/run-once.ts';
import type {Generation,Snapshot} from '../src/mvp/model.ts';
import type {AgentEvent} from '../src/agent/run-bounded.ts';
const base:Snapshot={revision:'g1:1',name:'계획.hwp',nodes:[{id:'s0p0',section:0,paragraph:0,text:'이전 본문',editable:true}],limitations:[]};
const model={id:'m',adapterId:'openai-compatible' as const,label:'test',endpoint:'http://127.0.0.1',modelId:'test'};
const plan=(text='수정 본문'):Generation=>({message:'편집 후보',sourceIds:[],operations:[{kind:'replace_body_text',target:'s0p0',start:0,count:5,text}]});
function harness(responses:unknown[]){
 let revision=base.revision,applies=0,calls=0,current=true,preflights=0,creates=0;const seen:any[]=[],events:AgentEvent[]=[],controller=new AbortController();
 const editor={snapshot:()=>({...base,revision}),preflight:async()=>{preflights++;},apply:async(_id:string,_base:Snapshot,generation:Generation)=>{applies++;return {runId:'r',beforeRevision:base.revision,afterRevision:'g1:2',before:'이전 본문',after:JSON.stringify(generation),operationCount:generation.operations.length};}};
 const options={runId:'r',context:{request:'문장을 다듬어줘',document:base,references:[],history:[]},model,editor,port:{generate:async(input:any)=>{seen.push(input);calls++;const value=responses[Math.min(calls-1,responses.length-1)];return typeof value==='function'?(value as Function)():value;}},signal:controller.signal,isCurrent:()=>current,createDocument:async()=>{creates++;return editor;},state:()=>{},onEvent:(event:AgentEvent)=>events.push(event)};
 return {options,controller,events,seen,counts:()=>({calls,applies,preflights,creates}),change:()=>revision='g1:2',navigate:()=>current=false};
}

test('동일 명령계획이면 두 번에 종료하고 최종 계획만 한번 검증/적용한다',async()=>{
 const h=harness([plan(),{...plan(),message:'검토 완료'}]);
 const result=await runBounded(h.options);
 assert.deepEqual(h.counts(),{calls:2,applies:1,preflights:1,creates:0});
 assert.equal(result.execution.stopReason,'stable-plan');assert.equal(result.generation.message,'검토 완료');
 assert.equal(h.seen[0].request,'문장을 다듬어줘');assert.match(h.seen[1].request,/적용 전 재검토/);
 assert.deepEqual(JSON.parse(h.seen[1].history.at(-1).text),plan());
 assert.deepEqual(h.events.map(event=>event.phase),['generating','validated','reviewing','validated','ready','applying','completed']);
});

test('계획이 계속 바뀌어도 최대 세 번 호출하고 마지막 결과만 적용한다',async()=>{
 const h=harness([plan('1안'),plan('2안'),plan('3안'),plan('실행하면 안 됨')]);
 const result=await runBounded(h.options);
 assert.equal(h.counts().calls,3);assert.equal(h.counts().applies,1);assert.equal(result.execution.stopReason,'call-budget');
 assert.equal((result.generation.operations[0] as any).text,'3안');
 assert.equal(h.seen[2].history.length,1);assert.equal((JSON.parse(h.seen[2].history[0].text).operations[0]).text,'2안');
});

test('검토 중 취소·문서 변경·업무 전환은 늦은 결과를 적용하지 않는다',async()=>{
 for(const variant of ['cancel','edit','navigate']){
  const h=harness([plan(),()=>{if(variant==='cancel')h.controller.abort();if(variant==='edit')h.change();if(variant==='navigate')h.navigate();return plan();}]);
  await assert.rejects(runBounded(h.options));assert.equal(h.counts().calls,2);assert.equal(h.counts().applies,0);assert.equal(h.counts().preflights,0);
 }
});

test('검토 응답에 잘못된 명령/출처가 있으면 첫 유효 계획도 적용하지 않는다',async()=>{
 for(const invalid of [{...plan(),operations:[{kind:'shell',command:'anything'}]},{...plan(),sourceIds:['선택하지 않은 자료']},null]){
  const h=harness([plan(),invalid]);await assert.rejects(runBounded(h.options));assert.equal(h.counts().applies,0);assert.equal(h.counts().calls,2);
 }
});

test('시간 제한은 취소를 무시하는 제공자를 기다리지 않으며 문서를 변경하지 않는다',async()=>{
 const h=harness([()=>new Promise(()=>{})]);
 await assert.rejects(runBounded({...h.options,maxDurationMs:10}),{name:'TimeoutError'});
 assert.equal(h.counts().applies,0);assert.equal(h.events.at(-1)?.phase,'stopped');
});

test('입력 예산은 호출 전에 누적 확인하고 초과 시 자동 적용/재시도하지 않는다',async()=>{
 const h=harness([plan()]);const cost=JSON.stringify(h.options.context).length;
 await assert.rejects(runBounded({...h.options,maxInputCharacters:cost-1}),/입력 예산/);assert.equal(h.counts().calls,0);
 const next=harness([plan()]);await assert.rejects(runBounded({...next.options,maxInputCharacters:cost+1}),/입력 예산/);
 assert.equal(next.counts().calls,1);assert.equal(next.counts().applies,0);
});

test('실제 엔진 preflight 실패 또는 preflight 중 문서 변경이면 적용하지 않는다',async()=>{
 const bad=harness([plan()]);bad.options.editor.preflight=async()=>{throw new Error('engine rejected');};
 await assert.rejects(runBounded(bad.options),/engine rejected/);assert.equal(bad.counts().applies,0);
 const changed=harness([plan()]);changed.options.editor.preflight=async()=>{changed.change();};
 await assert.rejects(runBounded(changed.options),{name:'ConflictError'});assert.equal(changed.counts().applies,0);
});

test('읽기 응답은 receipt 없이 반환하고 새 문서도 최종 단계에서 한번만 생성한다',async()=>{
 const explain=harness([{message:'지원 범위를 설명합니다.',sourceIds:[],operations:[]}]);
 const result=await runBounded(explain.options);assert.equal(result.receipt,undefined);assert.equal(explain.counts().applies,0);
 const create=harness([{message:'새 초안',sourceIds:[],operations:[{kind:'create_document',paragraphs:['계획서']}]}]);
 await runBounded(create.options);assert.equal(create.counts().creates,1);assert.equal(create.counts().applies,1);
});

test('단일 실행은 계속 한번만 호출하며 매크로 기록용 validated generation을 반환한다',async()=>{
 const h=harness([plan()]);const result=await runOnce(h.options);
 assert.deepEqual(result.generation,plan());assert.equal(h.counts().calls,1);assert.equal(h.counts().applies,1);
});

test('초기 충돌, 무효 호출 한도, 과도한 검토 요청은 문서 변경 전에 거절한다',async()=>{
 const stale=harness([plan()]);stale.change();await assert.rejects(runBounded(stale.options),{name:'ConflictError'});assert.equal(stale.counts().calls,0);
 const count=harness([plan()]);await assert.rejects(runBounded({...count.options,maxCalls:4 as any}),/2~3회/);
 const long=harness([plan()]);long.options.context.request='x'.repeat(12000);await assert.rejects(runBounded(long.options),/12,000자/);assert.equal(long.counts().applies,0);
});
test('검증용 read-only preflight도 취소를 무시해 대기하면 시간 예산으로 중단한다',async()=>{
 const h=harness([plan()]);h.options.editor.preflight=()=>new Promise(()=>{});
 await assert.rejects(runBounded({...h.options,maxDurationMs:10}),{name:'TimeoutError'});
 assert.equal(h.counts().calls,2);assert.equal(h.counts().applies,0);
});