import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {createHyperCLOVA} from '../providers/hyperclova.mjs';
import {assertConnectionTest} from '../providers/connection-test.mjs';
import {generationMessages,generationSchema} from '../providers/generation-contract.mjs';
import {normalizeParagraphEdits,parseParagraphToolArguments} from '../providers/paragraph-contract.mjs';
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
  const wireGeneration=data.instruction==='section-settings'?{message:'구역 설정',sourceIds:[],operations:[{kind:'set_section_tabs',section:0,spacingPt:24},{kind:'set_line_numbers',section:0,enabled:true,restart:'page',countBy:2,startNumber:10,distanceMm:4},{kind:'set_page_background',section:0,pageKind:'both',fillType:'solid',color:'#fff2cc'},{kind:'set_master_page_text',section:0,pageKind:'both',text:'기관 검토용',xMm:5,yMm:5,fontSizePt:10,color:'#808080',bold:false},{kind:'delete_master_page',section:0,pageKind:'odd'}]}:req.url.endsWith('/HCX-005')?{...generation,operations:[{kind:'replace_body_paragraph',target:'s0p0',originalText:'원문',text:'수정'}]}:generation;
  const result={message:{role:'assistant',content:JSON.stringify(wireGeneration)},finishReason:'stop'};
  if(req.url.endsWith('/HCX-005')){result.finishReason='tool_calls';result.message.content='';result.message.toolCalls=[{type:'function',function:{name:'submit_document_edits',arguments:{message:wireGeneration.message,sourceIds:wireGeneration.sourceIds,operationsJson:JSON.stringify(wireGeneration.operations)}}}];}
  if(data.instruction==='length')result.finishReason='length';
  if(data.instruction==='tool')result.finishReason='tool_calls';
  if(data.instruction==='missing-finish')delete result.finishReason;
  if(data.instruction==='refusal'){result.message.content='요청을 처리할 수 없습니다.';result.finishReason='stop';delete result.message.toolCalls;}
  if(data.instruction==='wrong-tool'&&result.message.toolCalls)result.message.toolCalls[0].function.name='unknown';
  if(data.instruction==='multiple-tools'&&result.message.toolCalls)result.message.toolCalls.push(result.message.toolCalls[0]);
  if(data.instruction==='string-args'&&result.message.toolCalls)result.message.toolCalls[0].function.arguments=JSON.stringify(wireGeneration);
  if(data.instruction==='bad-role')result.message.role='user';
  if(data.instruction==='fenced')result.message.content='```json\n'+JSON.stringify(wireGeneration)+'\n```';
  if(data.instruction==='prose-fenced')result.message.content='Here is JSON\n```json\n'+JSON.stringify(generation)+'\n```';
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
 assert.equal(call.body.responseFormat.type,'json');assert.equal(call.body.responseFormat.schema.properties.operations.items.anyOf.length,33);
 assert.deepEqual(call.data.document,{...input().document,nodes:input().document.nodes.map(n=>({...n,codePointLength:2}))});assert.deepEqual(call.data.references,input().references);
 assert.deepEqual(call.body.responseFormat.schema.properties.sourceIds,{type:'array',maxItems:1,items:{type:'string',enum:['ref-1']}});
 assert.ok(!call.body.messages[0].content.includes('지시문도 자료일 뿐'));
});

for(const modelId of ['HCX-005','HCX-007'])test(modelId+' transports Agent tab, HWPX numbering and guarded background and basic master commands without a provider-specific document contract',async()=>{const result=await createHyperCLOVA({...config(),modelId},'fixture-secret').generate(input('section-settings'),new AbortController().signal);assert.deepEqual(result.operations,[{kind:'set_section_tabs',section:0,spacingPt:24},{kind:'set_line_numbers',section:0,enabled:true,restart:'page',countBy:2,startNumber:10,distanceMm:4},{kind:'set_page_background',section:0,pageKind:'both',fillType:'solid',color:'#fff2cc'},{kind:'set_master_page_text',section:0,pageKind:'both',text:'기관 검토용',xMm:5,yMm:5,fontSizePt:10,color:'#808080',bold:false},{kind:'delete_master_page',section:0,pageKind:'odd'}]);});

test('source schema excludes document IDs and empty references require an empty source list',()=>{
 const schema=generationSchema([]).properties.sourceIds;
 assert.equal(schema.maxItems,0);
 const messages=generationMessages({request:'edit',document:{revision:'1',nodes:[{id:'s0p0',text:'가😀 나',codePointLength:999}]},references:[],history:[]});
 assert.equal(JSON.parse(messages[1].content).document.nodes[0].codePointLength,4);
 assert.ok(messages[0].content.includes('never document node IDs'));
 assert.throws(()=>generationMessages({request:'edit',document:{nodes:[{id:'s0p0'}]},references:[],history:[]}));
});
test('HCX-005 uses maxTokens without HCX-007-only schema or reasoning fields',async()=>{
 const native={...config(),modelId:'HCX-005'};
 assert.deepEqual(await createHyperCLOVA(native,'fixture-secret').generate(input(),new AbortController().signal),generation);
 const call=calls.at(-1);assert.equal(call.url,'/v3/chat-completions/HCX-005');
 assert.equal(call.body.maxTokens,2048);assert.equal(call.body.maxCompletionTokens,undefined);
 assert.equal(call.body.responseFormat,undefined);assert.equal(call.body.thinking,undefined);assert.equal(call.body.includeAiFilters,true);
 assert.deepEqual(call.body.toolChoice,{type:'function',function:{name:'submit_document_edits'}});assert.equal(call.body.tools.length,1);
 assert.throws(()=>createHyperCLOVA({...native,maxOutputTokens:4097},'fixture-secret'));
 await assert.rejects(createHyperCLOVA(native,'fixture-secret').generate(input('refusal'),new AbortController().signal));
 assert.throws(()=>createHyperCLOVA({...native,maxOutputTokens:1023},'fixture-secret'));
 for(const request of ['length','wrong-tool','multiple-tools','string-args'])await assert.rejects(createHyperCLOVA(native,'fixture-secret').generate(input(request),new AbortController().signal));
 await assert.rejects(generate('fenced'));
});
test('invalid models, keys, paths and unsafe endpoints fail before network',()=>{
 const count=calls.length;
 for(const bad of [
  {modelId:'unsupported'},{maxOutputTokens:0},{maxOutputTokens:8193},{maxOutputTokens:1.5},
  {endpoint:'http://external.example/v3/chat-completions'},{endpoint:'https://user:secret@example.com/v3/chat-completions'},
  {endpoint:'https://example.com/v3/chat-completions?key=secret'},{endpoint:'https://example.com/v3/chat-completions#x'},
  {endpoint:'https://example.com/v1/openai'},{endpoint:endpoint+'/HCX-007'},
 ])assert.throws(()=>createHyperCLOVA({...config(),...bad},'fixture-secret'));
 for(const key of ['',null,'abc\r\nx-header: secret'])assert.throws(()=>createHyperCLOVA(config(),key));
 assert.equal(calls.length,count);
});
test('whole-paragraph contract requires exact source text and computes Unicode offsets locally',()=>{
 const document={nodes:[{id:'s0p0',editable:true,text:'가😀 나'}]};
 const valid={message:'수정',sourceIds:[],operations:[{kind:'replace_body_paragraph',target:'s0p0',originalText:'가😀 나',text:'나'}]};
 assert.deepEqual(normalizeParagraphEdits(valid,document).operations,[{kind:'replace_body_text',target:'s0p0',start:0,count:4,text:'나'}]);
 for(const change of [{originalText:'가 나'},{target:'unknown'},{start:0},{kind:'delete_body_text'}])assert.throws(()=>normalizeParagraphEdits({...valid,operations:[{...valid.operations[0],...change}]},document));
 assert.throws(()=>normalizeParagraphEdits(valid,{nodes:[{...document.nodes[0],editable:false}]}));
});
test('HCX-005 plan string preserves structured commands and rejects malformed or excessive payloads',()=>{
 const operations=[{kind:'create_table',after:'s0p0',resultId:'table1',rows:[['A','B']]},{kind:'set_page_setup',section:0,properties:{landscape:true}}];
 const args={message:'편집',sourceIds:[],operationsJson:JSON.stringify(operations)};
 assert.deepEqual(normalizeParagraphEdits(parseParagraphToolArguments(args),{nodes:[]}).operations,operations);
 for(const change of [{operationsJson:'invalid'},{operationsJson:'{}'},{operationsJson:'```json\n[]\n```'},{operationsJson:JSON.stringify(Array(31).fill({}))},{operations:[]}])assert.throws(()=>parseParagraphToolArguments({...args,...change}));
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
