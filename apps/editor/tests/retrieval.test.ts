import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {indexSelectedSources,searchSelectedSources} from '../src/retrieval/selected-sources.ts';
import {buildContext,buildRetrievedContext} from '../src/mvp/context.ts';
import {initialState,addWorkspace} from '../src/mvp/model.ts';
import type {Source,Snapshot} from '../src/mvp/model.ts';
const scope={workspaceId:'업무-A',chatId:'채팅-A'};
const source=(id:string,text:string,name=id+'.txt'):Source=>({id,name,text,characters:text.length,sha256:createHash('sha256').update(text).digest('hex')});
const doc:Snapshot={revision:'v1',name:'초안.hwp',nodes:[{id:'s0p0',section:0,paragraph:0,text:'현재 문서',editable:true}],limitations:[]};

test('구간은 원문 UTF-16 위치와 줄번호를 보존하고 surrogate/CRLF를 나누지 않는다',async()=>{
 const original=('정확한 문장😀\r\n'.repeat(180))+'마지막 줄';
 const index=await indexSelectedSources(scope,[source('s',original)]);
 assert.ok(index.chunks.length>1);assert.equal(index.chunks.map(chunk=>chunk.text).join(''),original);
 for(const chunk of index.chunks){
  assert.equal(original.slice(chunk.start,chunk.end),chunk.text);assert.ok(chunk.text.length<=1000);
  assert.equal(chunk.startLine,original.slice(0,chunk.start).split(/\r\n|\r|\n/).length);
  assert.doesNotMatch(chunk.text,/^[\uDC00-\uDFFF]|[\uD800-\uDBFF]$/);
  assert.doesNotMatch(chunk.text,/\r$/);assert.equal(chunk.contentSha256,createHash('sha256').update(chunk.text).digest('hex'));
 }
});

test('자료 순서에 상관없이 구간 ID가 같고 파일/추출문/업무 변경은 ID를 바꾼다',async()=>{
 const a=source('a','추진 일정 5월'),b=source('b','예산 100만원');
 const first=await indexSelectedSources(scope,[a,b]),second=await indexSelectedSources(scope,[b,a]);
 assert.deepEqual(first.chunks,second.chunks);
 for(const changed of [await indexSelectedSources(scope,[{...a,sha256:'f'.repeat(64)},b]),await indexSelectedSources(scope,[{...a,text:'추진 일정 6월'},b]),await indexSelectedSources({...scope,workspaceId:'다른 업무'},[a,b])]) assert.notEqual(changed.chunks[0].id,first.chunks[0].id);
});

test('검색 전후에 업무/채팅 범위를 검사하고 다른 scope chunk를 거부한다',async()=>{
 const index=await indexSelectedSources(scope,[source('a','예산 100만원')]);
 assert.throws(()=>searchSelectedSources(index,{...scope,workspaceId:'다른 업무'},'예산'),/다른 업무/);
 assert.throws(()=>searchSelectedSources(index,{...scope,chatId:'다른 채팅'},'예산'),/다른 업무/);
 assert.throws(()=>searchSelectedSources({...index,chunks:[{...index.chunks[0],workspaceId:'다른 업무'}]},scope,'예산'),/다른 업무/);
});

test('명시 자료에서 요청과 관련된 한국어 구간만 선택하고 원본과 구간 hash를 구분한다',async()=>{
 const originals=[source('budget','올해 주민 교육사업 예산은 300만원입니다.','사업비.txt'),source('other','직원 체육행사 참석자 명단입니다.','참석자.txt')];
 const index=await indexSelectedSources(scope,originals),result=searchSelectedSources(index,scope,'주민 교육사업 예산을 정리해줘');
 assert.equal(result.references[0].originSourceId,'budget');assert.equal(result.references[0].sha256,originals[0].sha256);
 assert.ok(result.references[0].id.startsWith('chunk:'));assert.match(result.references[0].limitation!,/UTF-16/);
 assert.equal(result.references.some(item=>item.originSourceId==='other'),false);
 assert.equal(result.retrieval.hits[0].startLine,1);assert.equal(result.references[0].text,originals[0].text);
});

test('검색 결과는 최대 8개/8000자/원본별3개이며 예산 때문에 무관한 내용을 채우지 않는다',async()=>{
 const originals=Array.from({length:5},(_,index)=>source('s'+index,('교육 예산 추진 일정 계획 '.repeat(400))));
 const index=await indexSelectedSources(scope,originals),result=searchSelectedSources(index,scope,'교육 예산');
 assert.equal(result.references.length,8);assert.ok(result.retrieval.sentCharacters<=8000);
 for(const original of originals)assert.ok(result.references.filter(item=>item.originSourceId===original.id).length<=3);
 const missing=searchSelectedSources(index,scope,'quasarxylophone');
 assert.equal(missing.references.length,0);assert.match(missing.retrieval.warnings[0],/찾지 못했습니다/);
});

test('현행 검색은 같은 문서군의 명시된 시행일을 비교하고 과거 요청에는 그대로 답한다',async()=>{
 const edition=(id:string,version:number,date:string,body='교통비 상한 금액 8만원')=>source(id,`출장비 기준\n시행일: ${date}\n${body}`,`내규/출장비 기준 v${version}.hwpx`);
 const old=edition('first',1,'2022-01-01'),current=edition('current',2,'2024-07-01','교통비 상한 금액 10만원');
 const future=edition('future',3,'2099-06-12'),invalid=edition('invalid',4,'2025-02-31');
 const index=await indexSelectedSources(scope,[old,current,future,invalid]);
 const currentQuery='현행 출장비 기준 교통비 상한 금액';
 assert.equal(searchSelectedSources(index,scope,currentQuery,undefined,'bm25').references[0].originSourceId,'current');
 assert.equal(searchSelectedSources(index,scope,'2022년 구본 출장비 기준 교통비 상한 금액',undefined,'bm25').references[0].originSourceId,'first');
 const unrelated=source('unrelated',future.text,'타 부서/출장비 기준 v3.hwpx');
 const crossed=await indexSelectedSources(scope,[old,current,unrelated]);
 assert.equal(searchSelectedSources(crossed,scope,currentQuery,undefined,'bm25').references[0].originSourceId,'current');
});

test('명시적으로 폐기되거나 초안인 출처는 현행 질문에서만 낮추고 이전판·초안 요청은 우선한다',async()=>{
 const archived=source('archive','버전: 1 | 상태: superseded\n출장비 교통비 상한 8만원');
 const draft=source('draft','상태: draft\n출장비 교통비 상한 12만원');
 const current=source('current','상태: current\n출장비 교통비 상한 10만원');
 const index=await indexSelectedSources(scope,[archived,draft,current]);
 const first=(query:string)=>searchSelectedSources(index,scope,query+' 출장비 교통비 상한',undefined,'bm25').references[0]?.originSourceId;
 assert.equal(first('현행'),'current');
 assert.equal(first('이전 적용 기준'),'archive');
 assert.equal(first('9월까지 적용했던 초안'),'archive');
 assert.equal(first('초안'),'draft');
});

test('한국어 검색은 요청한 사업을 확인하고 표의 날짜나 총액을 뒷받침하는 자료를 먼저 올린다',async()=>{
 const heading='산업 안전 현장 점검 사업';
 const index=await indexSelectedSources(scope,[
  source('plan',`${heading} 계획\n내년도 일정과 예산 총액을 검토한다.\n점검 완료 예정일을 협의한다.`,'계획.hwpx'),
  source('budget',`${heading} 예산\n항목\n금액(원)\n총사업비\n10,200,000원`,'예산.hwpx'),
  source('schedule',`${heading} 일정\n적용: 2024-04-01 ~ 현재 | 상태: current\n완료\n2024-12-20`,'일정.hwpx'),
  source('archived',`${heading} 일정\n적용: 2023-08-01 ~ 2024-03-31 | 상태: superseded\n완료 예정일은 2024-12-11이다.`,'일정-v1.txt'),
 ]);
 const find=(query:string)=>searchSelectedSources(index,scope,query,undefined,'bm25').references;
 assert.equal(find(`${heading}의 확정 총예산은 얼마인가요?`)[0]?.originSourceId,'budget');
 assert.equal(find(`현재 확정된 ${heading}의 완료 예정일은 언제인가요?`)[0]?.originSourceId,'schedule');
 assert.equal(find(`이전 초안에서 ${heading}의 완료 예정일은 언제였나요?`)[0]?.originSourceId,'archived');
 assert.deepEqual(find('농촌 용수 개선 사업의 총예산은 얼마인가요?'),[]);
});

test('날짜를 지정한 회의 검색은 헤더의 연도·월·일을 함께 비교한다',async()=>{
 const index=await indexSelectedSources(scope,[
  source('old','2023-06-20 유지보수 협의 회의록\n유지보수 일정과 작업량은 안건이다.','회의록 2023-06-20.md'),
  source('exact','2024-06-20 유지보수 회의록\n작업량 25건을 확정했다.','회의록 2024-06-20.md'),
  source('recent','2024-06-21 유지보수 협의 회의록\n유지보수 일정과 작업량은 안건이다.','회의록 2024-06-21.md'),
 ]);
 const found=searchSelectedSources(index,scope,'2024년 6월 20일 유지보수 회의에서 확정한 작업량을 알려 주세요.',undefined,'bm25');
 assert.equal(found.references[0]?.originSourceId,'exact');
});

test('색인과 검색은 취소·중복 자료·잘못된 버전·탐색 예산을 거부한다',async()=>{
 const controller=new AbortController();controller.abort();
 await assert.rejects(indexSelectedSources(scope,[source('a','본문')],controller.signal),{name:'AbortError'});
 await assert.rejects(indexSelectedSources(scope,[source('a','하나'),source('a','둘')]),/식별자/);
 await assert.rejects(indexSelectedSources(scope,[{...source('a','본문'),sha256:'bad'}]),/hash/);
 await assert.rejects(indexSelectedSources(scope,[source('a','x'.repeat(120001))]),/120,000/);
 const index=await indexSelectedSources(scope,[source('a','본문')]);
 assert.throws(()=>searchSelectedSources(index,scope,'본문',controller.signal),{name:'AbortError'});
});

test('선택을 해제하거나 원문이 바뀌면 다음 요청의 색인에 이전 구간이 남지 않는다',async()=>{
 const first=await indexSelectedSources(scope,[source('a','당초 예산 100만원')]);
 const next=await indexSelectedSources(scope,[source('a','변경 예산 200만원')]);
 const cleared=await indexSelectedSources(scope,[]);
 assert.notEqual(first.chunks[0].id,next.chunks[0].id);
 assert.equal(searchSelectedSources(cleared,scope,'예산').references.length,0);
 assert.match(searchSelectedSources(next,scope,'예산').references[0].text,/200만원/);
});

test('선택형 Context는 기본 single 문맥을 유지하고 현재 채팅만 사용한다',async()=>{
 const state=initialState(),a=addWorkspace(state,'A'),b=addWorkspace(state,'B');
 state.chats.find(chat=>chat.id===a.activeChatId)!.messages.push({id:'a1',role:'user',text:'A 이력'});
 state.chats.find(chat=>chat.id===b.activeChatId)!.messages.push({id:'b1',role:'user',text:'B 비공개 이력'});
 const refs=[source('a','예산 확정 200만원')],normal=buildContext(state,a.id,a.activeChatId,doc,refs,'예산');
 assert.equal(normal.references[0].id,'a');
 const result=await buildRetrievedContext(state,a.id,a.activeChatId,doc,refs,'예산');
 assert.ok(result.context.references[0].id.startsWith('chunk:'));
 assert.equal(result.context.history.length,1);assert.equal(result.context.history[0].text,'A 이력');
 assert.equal(result.context.document,doc);assert.equal(result.retrieval.selectedSourceCount,1);
 await assert.rejects(buildRetrievedContext(state,a.id,b.activeChatId,doc,refs,'예산'),/이 업무의 채팅/);
});
