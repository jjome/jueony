import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {providerRegistry} from '../providers/registry.mjs';
import {nativeSchema,parseGeneration} from '../providers/native-common.mjs';

const ids=['openai-responses','anthropic','gemini'];
const input=request=>({request,document:{revision:'r1',nodes:[{id:'s0p0',text:'가😀 나',editable:true}]},references:[{id:'ref1',text:'source data'}],history:[]});
const generation={message:'본문 수정 제안',sourceIds:['ref1'],operations:[{kind:'replace_body_text',target:'s0p0',start:0,count:4,text:'수정'}]};
let server,endpoint,calls=[];
function response(id,text,mode) {
 if(id==='openai-responses')return {status:mode==='length'?'incomplete':'completed',output:[{type:'reasoning',summary:[]},{type:'message',role:'assistant',status:'completed',content:[mode==='refusal'?{type:'refusal',refusal:'no'}:mode==='tool'?{type:'tool_call'}:{type:'output_text',text}]}]};
 if(id==='anthropic')return {type:'message',role:'assistant',stop_reason:mode==='length'?'max_tokens':mode==='refusal'?'refusal':'end_turn',content:[{type:'thinking',thinking:'ignored'},{type:'text',text},...(mode==='tool'?[{type:'tool_use'}]:[])]};
 return {candidates:[{finishReason:mode==='length'?'MAX_TOKENS':mode==='refusal'?'SAFETY':'STOP',content:{role:'model',parts:[{thought:true,text:'ignored'},{text},...(mode==='tool'?[{functionCall:{name:'bad'}}]:[])]}}]};
}
before(async()=>{
 server=http.createServer(async(req,res)=>{
  let raw='';for await(const part of req)raw+=part;const body=JSON.parse(raw);
  const id=req.url.includes(':generateContent')?'gemini':req.url.endsWith('/messages')?'anthropic':'openai-responses';
  const data=JSON.parse(id==='gemini'?body.contents[0].parts[0].text:id==='anthropic'?body.messages[0].content:body.input[1].content),mode=data.instruction;
  calls.push({id,url:req.url,headers:req.headers,body,data});
  if(mode==='unauthorized'||mode==='quota'){res.writeHead(mode==='unauthorized'?401:429);res.end('fixture-secret');return;}
  if(mode==='redirect'){res.writeHead(307,{Location:endpoint+'/elsewhere'});res.end();return;}
  if(mode==='slow')await new Promise(r=>setTimeout(r,250));
  if(mode==='oversize'){res.end('x'.repeat(1_000_001));return;}
  if(mode==='bad-wire'){res.end('fixture-secret');return;}
  const output=id==='anthropic'?{...generation,operations:generation.operations.map(({kind,...args})=>({kind,arguments:JSON.stringify(args)}))}:generation;
  const text=mode==='bad-json'?'```json\n{}\n```':JSON.stringify(output);
  let wire=response(id,text,mode);
  if(mode==='empty')wire={};
  if(mode==='blocked'&&id==='gemini')wire={promptFeedback:{blockReason:'SAFETY'}};
  res.setHeader('Content-Type','application/json');res.end(JSON.stringify(wire));
 });await new Promise(r=>server.listen(0,'127.0.0.1',r));endpoint='http://127.0.0.1:'+server.address().port+'/v1';
});
after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));});
const config=id=>({id,adapterId:id,modelId:'test-model',endpoint,maxOutputTokens:8192});
const run=(id,mode,signal=new AbortController().signal)=>providerRegistry.get(id)(config(id),'fixture-secret').generate(input(mode),signal);

for(const id of ids) {
 test(id+' maps native authentication, schema, model and context',async()=>{
  assert.deepEqual(await run(id,'ok'),generation);
  const call=calls.at(-1);assert.equal(call.data.document.nodes[0].codePointLength,4);assert.deepEqual(call.data.references,input().references);
  if(id==='openai-responses') {
   assert.equal(call.url,'/v1/responses');assert.equal(call.headers.authorization,'Bearer fixture-secret');
   assert.equal(call.body.model,'test-model');assert.equal(call.body.store,false);assert.equal(call.body.max_output_tokens,8192);
   assert.equal(call.body.text.format.strict,true);assert.equal(call.body.input[0].role,'system');
  } else if(id==='anthropic') {
   assert.equal(call.url,'/v1/messages');assert.equal(call.headers['x-api-key'],'fixture-secret');assert.equal(call.headers['anthropic-version'],'2023-06-01');
   assert.equal(call.body.model,'test-model');assert.equal(call.body.max_tokens,8192);assert.equal(typeof call.body.system,'string');assert.equal(call.body.messages.length,1);assert.equal(call.body.output_config.format.type,'json_schema');
  } else {
   assert.equal(call.url,'/v1/models/test-model:generateContent');assert.equal(call.headers['x-goog-api-key'],'fixture-secret');assert.equal(call.headers.authorization,undefined);
   assert.equal(call.body.generationConfig.responseFormat.text.mimeType,'application/json');assert.equal(call.body.generationConfig.maxOutputTokens,8192);assert.equal(call.body.contents[0].role,'user');assert.ok(call.body.systemInstruction);
  }
  assert.ok(!JSON.stringify(call.data).includes('fixture-secret'));assert.equal(call.headers['content-type'],'application/json');
 });
 test(id+' rejects refusal, incomplete and unsupported output without retry',async()=>{
  for(const mode of ['length','refusal','tool','empty','bad-json','bad-wire','oversize']) {
   const before=calls.length;await assert.rejects(run(id,mode),e=>Boolean(e.safeMessage)&&!e.safeMessage.includes('fixture-secret'));assert.equal(calls.length,before+1,mode);
  }
 });
 test(id+' handles authentication, quota, redirects and cancellation safely',async()=>{
  for(const mode of ['unauthorized','quota','redirect'])await assert.rejects(run(id,mode),e=>Boolean(e.safeMessage)&&!e.safeMessage.includes('fixture-secret'));
  const controller=new AbortController();const pending=run(id,'slow',controller.signal);setTimeout(()=>controller.abort(),25);await assert.rejects(pending,e=>e.code==='cancelled');
 });
 test(id+' validates connection before any network call',()=>{
  const create=providerRegistry.get(id),c=config(id);
  for(const key of ['',undefined,'a\nb'])assert.throws(()=>create(c,key));
  for(const address of ['http://example.com/v1','https://user:pass@example.com/v1','https://example.com/v1?key=bad'])assert.throws(()=>create({...c,endpoint:address},'fixture-secret'));
  for(const maxOutputTokens of [127,32769,1.5])assert.throws(()=>create({...c,maxOutputTokens},'fixture-secret'));
 });
}
test('strict projection makes optional format fields nullable; normalization preserves false/zero and unknown fields for semantic rejection',()=>{
 const schema=nativeSchema(['ref1'],true);
 const walk=node=>{if(node.type==='object'){assert.equal(node.additionalProperties,false);assert.deepEqual(node.required,Object.keys(node.properties));Object.values(node.properties).forEach(walk);}if(node.items)walk(node.items);node.anyOf?.forEach(walk);};walk(schema);
 const format=schema.properties.operations.items.anyOf.find(v=>v.properties.kind.enum[0]==='format_characters');
 assert.deepEqual(format.properties.properties.properties.bold.anyOf,[{type:'boolean'},{type:'null'}]);
 assert.deepEqual(parseGeneration(JSON.stringify({message:'제안',sourceIds:[],operations:[{kind:'format_characters',target:'s0p0',properties:{bold:false,italic:null,fontSizePt:0,unknown:null}}]}),true).operations[0].properties,{bold:false,fontSizePt:0,unknown:null});
});
test('Gemini rejects blocked prompts and models containing path components',async()=>{
 await assert.rejects(run('gemini','blocked'),e=>e.code==='refusal');
 assert.throws(()=>providerRegistry.get('gemini')({...config('gemini'),modelId:'models/model'},'fixture-secret'));
});
