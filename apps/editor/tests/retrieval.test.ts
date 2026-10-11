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