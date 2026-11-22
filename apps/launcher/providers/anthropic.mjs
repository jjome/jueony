import {generationMessages} from './generation-contract.mjs';
import {nativeConfig,postJSON,incomplete,refused,invalid} from './native-common.mjs';
import {anthropicSchema,parseAnthropicGeneration,ANTHROPIC_FORMAT_INSTRUCTION} from './anthropic-schema.mjs';
import {documentToolMessages,parseDocumentToolTurn,probeDocumentTools} from './document-tool-contract.mjs';

export function createAnthropic(config,key) {
 const {endpoint,model,maxTokens}=nativeConfig(config,key,'/messages');
 const headers={'x-api-key':key,'anthropic-version':'2023-06-01'};
 const adapter={async generate(input,signal) {
  const [system,user]=generationMessages(input);
  const wire=await postJSON(endpoint,headers,{model,max_tokens:maxTokens,system:system.content+ANTHROPIC_FORMAT_INSTRUCTION,messages:[user],output_config:{format:{type:'json_schema',schema:anthropicSchema(input.references.map(r=>r.id))}}},signal,'Claude');
  if(wire?.stop_reason==='max_tokens')incomplete();
  if(wire?.stop_reason==='refusal')refused();
  if(wire?.type!=='message'||wire.role!=='assistant'||wire.stop_reason!=='end_turn'||!Array.isArray(wire.content))invalid();
  const parts=[];
  for(const part of wire.content){if(['thinking','redacted_thinking'].includes(part.type))continue;if(part.type!=='text'||typeof part.text!=='string')invalid();parts.push(part.text);}
  return parseAnthropicGeneration(parts.join(''));
 },
 async generateDocumentToolTurn(input,signal){
  const {messages:[system,user],tools}=documentToolMessages(input);
  const messages=[user];
  for(const batch of input.turns){
   const requested=batch.map(({call})=>({type:'tool_use',id:call.id,name:call.name,input:JSON.parse(call.arguments)}));
   const results=batch.map(({call,result})=>({type:'tool_result',tool_use_id:call.id,content:result,is_error:typeof JSON.parse(result)?.error==='string'}));
   messages.push({role:'assistant',content:requested},{role:'user',content:results});
  }
  const wire=await postJSON(endpoint,headers,{model,max_tokens:maxTokens,system:system.content,messages,
   tools:tools.map(({function:tool})=>({name:tool.name,description:tool.description,input_schema:tool.parameters}))},signal,'Claude');
  if(wire?.stop_reason==='max_tokens')incomplete();
  if(wire?.stop_reason==='refusal')refused();
  if(wire?.type!=='message'||wire.role!=='assistant'||!Array.isArray(wire.content))invalid();
  if(wire.stop_reason==='tool_use'){
   const tool_calls=wire.content.filter(block=>block.type==='tool_use').map(block=>({id:block.id,
    function:{name:block.name,arguments:JSON.stringify(block.input)}}));
   return parseDocumentToolTurn({tool_calls});
  }
  if(wire.stop_reason!=='end_turn'||!wire.content.every(block=>block.type==='text'&&typeof block.text==='string'))invalid();
  return parseDocumentToolTurn({content:wire.content.map(block=>block.text).join('')});
 },
 testDocumentTools(_input,signal){return probeDocumentTools((input,signal)=>adapter.generateDocumentToolTurn(input,signal),signal);}};
 return adapter;
}
