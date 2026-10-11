import {test} from 'node:test';
import assert from 'node:assert/strict';
import {anthropicSchema,parseAnthropicGeneration} from '../providers/anthropic-schema.mjs';
import {generationSchema} from '../providers/generation-contract.mjs';
import {providerError} from '../providers/provider-error.mjs';

function complexity(schema) {
 let optional=0,unions=0;
 function walk(node){
  if(node.type==='object'){
   assert.equal(node.additionalProperties,false);
   for(const [name,value] of Object.entries(node.properties)){if(!node.required?.includes(name))optional++;walk(value);}
  }
  if(node.items)walk(node.items);
  if(node.anyOf){unions++;node.anyOf.forEach(walk);}
  if(Array.isArray(node.type))unions++;
 }
 walk(schema);return {optional,unions};
}
const parse=operations=>parseAnthropicGeneration(JSON.stringify({message:'제안',sourceIds:[],operations}));
test('Claude schema keeps every editing command within documented optional/union budgets',()=>{
 const schema=anthropicSchema(['ref1','ref2']),budget=complexity(schema);
 assert.ok(budget.optional<=24,JSON.stringify(budget));assert.ok(budget.unions<=16,JSON.stringify(budget));
 assert.deepEqual(schema.properties.operations.items.anyOf.map(v=>v.properties.kind.enum[0]),generationSchema().properties.operations.items.anyOf.map(v=>v.properties.kind.enum[0]));
 assert.deepEqual(schema.properties.sourceIds.items.enum,['ref1','ref2']);
});
test('Claude sparse formatting restores only requested properties, including false and zero',()=>{
 const operations=[
  {kind:'replace_body_text',target:'s0p0',start:0,count:2,text:'제목'},
  {kind:'format_characters',target:'s0p0',properties:[{name:'bold',value:false},{name:'spacingPercent',value:0},{name:'fontFamily',value:'함초롬바탕'}]},
  {kind:'format_paragraph',target:'s0p0',properties:[{name:'alignment',value:'center'},{name:'marginLeftMm',value:0}]},
  {kind:'format_table_cells',target:'@t',startRow:0,rowCount:1,startColumn:0,columnCount:2,properties:[{name:'background',value:'#eeeeee'}]},
  {kind:'set_page_setup',section:0,properties:[{name:'landscape',value:false},{name:'widthMm',value:210}]},
 ];
 const expected=structuredClone(operations);expected[1].properties={bold:false,spacingPercent:0,fontFamily:'함초롬바탕'};expected[2].properties={alignment:'center',marginLeftMm:0};expected[3].properties={background:'#eeeeee'};expected[4].properties={landscape:false,widthMm:210};
 assert.deepEqual(parse(operations).operations,expected);
 assert.deepEqual(parse([{kind:'create_document',paragraphs:['제목','본문']}]).operations,[{kind:'create_document',paragraphs:['제목','본문']}]);
});
test('Claude rejects ambiguous, unknown and invalid style entries before execution',()=>{
 for(const properties of [null,{},[],[{name:'bold',value:true},{name:'bold',value:false}],[{name:'__proto__',value:'x'}],[{name:'constructor',value:'x'}],[{name:'arbitrary',value:true}],[{name:'bold',value:'true'}],[{name:'bold',value:null}],[{name:'ratioPercent',value:100.5}],[{name:'bold',value:true,extra:'x'}]]) {
  assert.throws(()=>parse([{kind:'format_characters',target:'s0p0',properties}]),e=>e.code==='invalid_response');
 }
});
test('provider errors distinguish billing, schema, model, authentication and rate limits without echoing secrets',async()=>{
 const cases=[
  [400,'Your credit balance is too low to access the Anthropic API.','billing'],
  [400,'Your organization has reached its spend limit','billing'],
  [400,'Schema is too complex for compilation.','schema'],
  [400,'Too many optional parameters: 44.','schema'],
  [400,'output_config.format.schema: unsupported schema','schema'],
  [404,'model not found','model'],[401,'invalid key','auth'],[429,'too many requests','rate_limit'],[503,'unavailable','unavailable'],[400,'invalid input','provider'],
 ];
 for(const [status,message,code] of cases){
  const result=await providerError(new Response(JSON.stringify({error:{type:'invalid_request_error',message:message+' fixture-secret PRIVATE_DOCUMENT'}}),{status,headers:{'request-id':'req_0123456789abcdef'}}),'Claude');
  assert.equal(result.code,code);assert.ok(!result.safeMessage.includes('fixture-secret'));assert.ok(!result.safeMessage.includes('PRIVATE_DOCUMENT'));assert.match(result.safeMessage,/req_0123456789abcdef/);
 }
});
test('provider errors bound malformed/oversized bodies and do not expose arbitrary headers',async()=>{
 for(const body of ['not JSON fixture-secret',JSON.stringify({error:{message:'fixture-secret '+'x'.repeat(70000)}})]){
  const result=await providerError(new Response(body,{status:400,headers:{'request-id':'fixture-secret'}}),'Claude');assert.equal(result.code,'provider');assert.ok(!result.safeMessage.includes('fixture-secret'));
 }
});
