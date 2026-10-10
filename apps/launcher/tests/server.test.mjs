import {test,after,before} from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {resolve} from 'node:path';
const origin='http://127.0.0.1:4195',providerOrigin='http://127.0.0.1:4196';
let server,provider,token,logs='',calls=[];
const input={request:'test',document:{nodes:[]},references:[],history:[]};
before(async()=>{
 provider=http.createServer(async(req,res)=>{
  let bytes='';for await(const chunk of req)bytes+=chunk;
  const body=JSON.parse(bytes);calls.push({body,authorization:req.headers.authorization,url:req.url});
  if(req.url.startsWith('/v3/chat-completions/')){
   res.setHeader('Content-Type','application/json');res.end(JSON.stringify({status:{code:'20000'},result:{finishReason:'stop',message:{role:'assistant',content:JSON.stringify({message:'연결 확인',operations:[],sourceIds:[]})}}}));return;
  }
  if(body.model==='unauthorized'){res.writeHead(401);res.end('private-key-in-error');return;}
  if(body.model==='redirect'){res.writeHead(307,{Location:providerOrigin+'/redirect-target'});res.end();return;}
  if(body.model==='bad-json'){res.end('not JSON');return;}
  if(body.model==='slow')await new Promise(r=>setTimeout(r,1500));
  res.setHeader('Content-Type','application/json');res.end(JSON.stringify({choices:[{message:{content:JSON.stringify({message:body.model,sourceIds:[],operations:[]})}}]}));
 });await new Promise(r=>provider.listen(4196,'127.0.0.1',r));
 server=spawn(process.execPath,['server.mjs'],{cwd:resolve('apps/launcher'),env:{...process.env,JUEONY_PORT:'4195',JUEONY_DIST:resolve('apps/editor/dist'),JUEONY_CONNECTION_STORE:'memory'},stdio:['ignore','pipe','pipe'],windowsHide:true});
 server.stdout.on('data',b=>logs+=b);server.stderr.on('data',b=>logs+=b);
 for(let i=0;i<50;i++){try{const r=await fetch(origin+'/api/health');if(r.ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 const r=await fetch(origin+'/api/session',{headers:{Origin:origin,'X-Jueony-Bootstrap':'1'}});assert.equal(r.status,200);token=(await r.json()).token;
});
after(async()=>{server?.kill();provider?.closeAllConnections();await new Promise(r=>provider?.close(r));});
async function post(path,data,headers={}){return fetch(origin+'/api/'+path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','X-Jueony-Token':token,...headers},body:JSON.stringify(data)});}
async function config(model,endpoint=providerOrigin+'/v1',key='private-key-in-error'){
 return post('configure',{config:{id:model,adapterId:'openai-compatible',modelId:model,endpoint,label:'Fixture'},key});
}
test('세션 부트스트랩과 토큰/Origin/Host 경계를 강제한다',async()=>{
 for(const [headers,status] of [[{},403],[{Origin:'https://unrelated.example','X-Jueony-Bootstrap':'1'},403],[{Origin:origin,'X-Jueony-Bootstrap':'1'},200]]){
  assert.equal((await fetch(origin+'/api/session',{headers})).status,status);
 }
 assert.equal((await post('configure',{}, {'X-Jueony-Token':''})).status,403);
 assert.equal((await post('configure',{}, {Origin:'https://unrelated.example'})).status,403);
 const status=await new Promise((resolveStatus,reject)=>{const req=http.get(origin+'/api/health',{headers:{Host:'evil.example:4195'}},res=>{res.resume();resolveStatus(res.statusCode);});req.on('error',reject);});assert.equal(status,403);
});
test('선택한 두 모델과 인증을 정확한 endpoint에 보내고 임의 응답 필드가 UI로 새지 않는다',async()=>{
 for(const id of ['model-a','model-b']){assert.equal((await config(id)).status,200);const r=await post('generate',{configId:id,input});assert.equal(r.status,200);assert.equal((await r.json()).result.message,id);}
 assert.deepEqual(calls.slice(-2).map(c=>c.body.model),['model-a','model-b']);
 assert.ok(calls.slice(-2).every(c=>c.authorization==='Bearer private-key-in-error'&&c.url==='/v1/chat/completions'&&c.body.stream===false));
});
test('외부 HTTP·사용자정보·쿼리 endpoint와 redirect 전송을 거부한다',async()=>{
 for(const url of ['http://external.example/v1','https://user:pass@example.com/v1','https://example.com/v1?key=secret','file:///tmp/a'])assert.equal((await config('invalid',url)).status,400);
 await config('redirect');const before=calls.length;const r=await post('generate',{configId:'redirect',input});assert.equal(r.status,400);assert.equal(calls.length,before+1);
});
test('인증/잘못된 JSON 오류를 정제하고 자동 재시도와 키 로그를 남기지 않는다',async()=>{
 for(const id of ['unauthorized','bad-json']){await config(id);const before=calls.length;const r=await post('generate',{configId:id,input});assert.equal(r.status,400);assert.doesNotMatch(await r.text(),/private-key-in-error/);assert.equal(calls.length,before+1);}
 assert.doesNotMatch(logs,/private-key-in-error/);
});
test('취소된 HTTP 요청 후에도 다음 요청이 정상 처리된다',async()=>{
 await config('slow');const abort=new AbortController();
 const request=fetch(origin+'/api/generate',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','X-Jueony-Token':token},body:JSON.stringify({configId:'slow',input}),signal:abort.signal});
 await new Promise(r=>setTimeout(r,100));abort.abort();await assert.rejects(request,{name:'AbortError'});
 const r=await post('generate',{configId:'model-a',input});assert.equal(r.status,200);
});
test('정적 자산은 로컬 CSP로 제공하고 경로 순회와 잘못된 JSON을 거부한다',async()=>{
 const r=await fetch(origin+'/');assert.equal(r.status,200);assert.match(r.headers.get('Content-Security-Policy'),/connect-src 'self'/);
 for(const path of ['/%2e%2e%5cLICENSE.txt','/C%3A/Windows/win.ini','/%00'])assert.equal((await fetch(origin+path)).status,404);
 const bad=await fetch(origin+'/api/configure',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','X-Jueony-Token':token},body:'{'});assert.equal(bad.status,400);
});
test('HyperCLOVA registry와 합성 연결 테스트는 사용자 문맥/키를 저장하지 않는다',async()=>{
 const native={id:'hyperclova-fixture',adapterId:'hyperclova',label:'NAVER fixture',endpoint:providerOrigin+'/v3/chat-completions',modelId:'HCX-007'};
 const before=calls.length;
 const probe=await post('test-connection',{config:native,key:'private-key-in-error',input:{privateDocument:'MUST NOT SEND'}});
 assert.equal(probe.status,200);assert.deepEqual(await probe.json(),{connected:true,documentSent:false});
 assert.equal(calls.length,before+1);const context=JSON.parse(calls.at(-1).body.messages[1].content);
 assert.deepEqual(context.references,[]);assert.deepEqual(context.conversation,[]);assert.deepEqual(context.document.nodes,[]);
 assert.doesNotMatch(JSON.stringify(context),/MUST NOT SEND/);
 assert.equal((await post('generate',{configId:native.id,input})).status,400);
 assert.equal((await post('configure',{config:native,key:'private-key-in-error'})).status,200);
 assert.equal((await post('generate',{configId:native.id,input})).status,200);
 assert.doesNotMatch(logs,/private-key-in-error/);
});

test('연결 키 삭제 후 기존 모델로 호출할 수 없다',async()=>{await config('model-a');assert.equal((await post('clear-credentials',{})).status,200);assert.equal((await post('generate',{configId:'model-a',input})).status,400);});
test('connection metadata hides secrets; key reuse cannot switch destinations; replacement and removal work',async()=>{
 const selected={id:'key-reuse',adapterId:'openai-compatible',label:'Fixture',endpoint:providerOrigin+'/v1',modelId:'model-a'};
 assert.equal((await post('configure',{config:{...selected,secret:'must-not-leak'},key:'first-fake-key'})).status,200);
 const metadata=await (await post('connections',{})).json();assert.equal(metadata.secureStorage,false);
 assert.doesNotMatch(JSON.stringify(metadata),/first-fake-key|must-not-leak/);assert.equal(metadata.connections.find(c=>c.config.id===selected.id).hasKey,true);
 assert.equal((await post('configure',{config:{...selected,label:'Renamed'}})).status,200);
 await post('generate',{configId:selected.id,input});assert.equal(calls.at(-1).authorization,'Bearer first-fake-key');
 assert.equal((await post('configure',{config:{...selected,modelId:'model-b'}})).status,200);
 await post('generate',{configId:selected.id,input});assert.equal(calls.at(-1).authorization,'Bearer first-fake-key');
 for(const change of [{endpoint:providerOrigin+'/other'},{adapterId:'hyperclova'}]){
  assert.equal((await post('test-connection',{config:{...selected,...change}})).status,400);
  assert.equal((await post('configure',{config:{...selected,...change}})).status,400);
 }
 assert.equal((await post('configure',{config:selected,key:'replacement-fake-key'})).status,200);
 await post('generate',{configId:selected.id,input});assert.equal(calls.at(-1).authorization,'Bearer replacement-fake-key');
 assert.equal((await post('configure',{config:selected,key:'other',remember:true})).status,400);
 await post('generate',{configId:selected.id,input});assert.equal(calls.at(-1).authorization,'Bearer replacement-fake-key');
 assert.equal((await post('remove-connection',{configId:selected.id})).status,200);
 assert.equal((await post('generate',{configId:selected.id,input})).status,400);
 assert.doesNotMatch(logs,/first-fake-key|replacement-fake-key/);
});
