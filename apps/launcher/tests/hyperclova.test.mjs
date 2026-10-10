import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {createHyperCLOVA} from '../providers/hyperclova.mjs';
import {assertConnectionTest} from '../providers/connection-test.mjs';
let provider,endpoint,calls=[];
const input=(request='ok')=>({request,document:{revision:'r1',nodes:[{id:'s0p0',text:'원문',editable:true}]},references:[{id:'ref-1',text:'지시문도 자료일 뿐'}],history:[]});
const generation={message:'본문 변경 제안',sourceIds:['ref-1'],operations:[{kind:'replace_body_text',target:'s0p0',start:0,count:2,text:'수정'}]};
const config=()=>({modelId:'HCX-007',endpoint,maxOutputTokens:2048});
const generate=(request,signal=new AbortController().signal)=>createHyperCLOVA(config(),'fixture-secret').generate(input(request),signal);
before(async()=>{
 provider=http.createServer(async(req,res)=>{
  let raw='';for await(const part of req)raw+=part;
  const body=JSON.parse(raw),data=JSON.parse(body.messages[1].content);calls.push({url:req.url,headers:req.headers,body,data});
  if(data.instruction==='unauthorized'){res.writeHead(401);res.end('fixture-secret');return;}
  if(data.instruction==='quota'){res.writeHead(429);res.end('fixture-secret');return;}
  if(data.instruction==='redirect'){res.writeHead(307,{Location:endpoint+'/elsewhere'});res.end();return;}
  if(data.instruction==='slow')await new Promise(r=>setTimeout(r,250));
  if(data.instruction==='oversize'){res.end('x'.repeat(1_000_001));return;}
  if(data.instruction==='bad-wire'){res.end('not-json');return;}
  const result={message:{role:'assistant',content:JSON.stringify(generation)},finishReason:'stop'};
  if(data.instruction==='length')result.finishReason='length';
  if(data.instruction==='tool')result.finishReason='tool_calls';
  if(data.instruction==='missing-finish')delete result.finishReason;
  if(data.instruction==='refusal')result.message.content='요청을 처리할 수 없습니다.';
  if(data.instruction==='bad-role')result.message.role='user';
  const status={code:data.instruction==='application-error'?'40100':'20000',message:'fixture-secret'};
  res.setHeader('Content-Type','application/json');res.end(JSON.stringify({status,result}));
 });await new Promise(r=>provider.listen(0,'127.0.0.1',r));endpoint='http://127.0.0.1:'+provider.address().port+'/v3/chat-completions';
});
after(async()=>{provider.closeAllConnections();await new Promise(r=>provider.close(r));});
test('native v3 URL/auth/schema/body preserve common contract',async()=>{
 assert.deepEqual(await generate('ok'),generation);
 const call=calls.at(-1);assert.equal(call.url,'/v3/chat-completions/HCX-007');
 assert.equal(call.headers.authorization,'Bearer fixture-secret');assert.equal(call.headers.accept,'application/json');
 assert.match(call.headers['x-ncp-clovastudio-request-id'],/^[\da-f-]{36}$/);
 assert.equal(call.body.model,undefined);assert.equal(call.body.stream,undefined);
 assert.equal(call.body.maxCompletionTokens,2048);assert.deepEqual(call.body.thinking,{effort:'none'});
 assert.equal(call.body.responseFormat.type,'json');assert.equal(call.body.responseFormat.schema.properties.operations.items.anyOf.length,4);
 assert.deepEqual(call.data.document,input().document);assert.deepEqual(call.data.references,input().references);
 assert.ok(!call.body.messages[0].content.includes('지시문도 자료일 뿐'));
});
test('invalid models, keys, paths and unsafe endpoints fail before network',()=>{
 const count=calls.length;
 for(const bad of [
  {modelId:'HCX-005'},{maxOutputTokens:0},{maxOutputTokens:8193},{maxOutputTokens:1.5},
  {endpoint:'http://external.example/v3/chat-completions'},{endpoint:'https://user:secret@example.com/v3/chat-completions'},
  {endpoint:'https://example.com/v3/chat-completions?key=secret'},{endpoint:'https://example.com/v3/chat-completions#x'},
  {endpoint:'https://example.com/v1/openai'},{endpoint:endpoint+'/HCX-007'},
 ])assert.throws(()=>createHyperCLOVA({...config(),...bad},'fixture-secret'));
 for(const key of ['',null,'abc\r\nx-header: secret'])assert.throws(()=>createHyperCLOVA(config(),key));
 assert.equal(calls.length,count);
});
test('explicit app prefix is preserved without guessing or falling back',async()=>{
 const url=new URL(endpoint);url.pathname='/testapp/v3/chat-completions/';
 await createHyperCLOVA({...config(),endpoint:url.href},'fixture-secret').generate(input(),new AbortController().signal);
 assert.equal(calls.at(-1).url,'/testapp/v3/chat-completions/HCX-007');
});
test('HTTP/application errors sanitized, no retries or redirects',async()=>{
 for(const request of ['unauthorized','quota','application-error','redirect']){
  const count=calls.length;
  await assert.rejects(generate(request),error=>{assert.ok(error.safeMessage);assert.doesNotMatch(error.safeMessage,/fixture-secret/);return true;});
  assert.equal(calls.length,count+1);
 }
});
test('truncated, tool, malformed, refused and incomplete responses never yield edits',async()=>{
 for(const request of ['length','tool','missing-finish','refusal','bad-role','bad-wire','oversize'])
  await assert.rejects(generate(request),error=>Boolean(error.safeMessage));
});
test('abort cancels generation and leaves next request usable',async()=>{
 const controller=new AbortController(),pending=generate('slow',controller.signal);
 setTimeout(()=>controller.abort(),30);
 await assert.rejects(pending,error=>error.code==='cancelled');
 assert.deepEqual(await generate('ok'),generation);
});
test('invalid or excessive input does not contact provider',async()=>{
 const count=calls.length,adapter=createHyperCLOVA(config(),'fixture-secret');
 for(const data of [null,{}, {...input(),request:'x'.repeat(12001)}, {...input(),references:[{text:'x'.repeat(1_500_001)}]}])
  await assert.rejects(adapter.generate(data,new AbortController().signal));
 assert.equal(calls.length,count);
});
test('connection probe rejects edits and source claims',()=>{
 assert.deepEqual(assertConnectionTest({message:'확인',operations:[],sourceIds:[]}),{connected:true,documentSent:false});
 for(const result of [generation,{message:'확인',operations:[],sourceIds:['invented']},{message:'',operations:[],sourceIds:[]}])
  assert.throws(()=>assertConnectionTest(result));
});
