import {generationMessages} from './generation-contract.mjs';
import {nativeConfig,postJSON,incomplete,refused,invalid} from './native-common.mjs';
import {anthropicSchema,parseAnthropicGeneration,ANTHROPIC_FORMAT_INSTRUCTION} from './anthropic-schema.mjs';

export function createAnthropic(config,key) {
 const {endpoint,model,maxTokens}=nativeConfig(config,key,'/messages');
 return {async generate(input,signal) {
  const [system,user]=generationMessages(input);
  const wire=await postJSON(endpoint,{'x-api-key':key,'anthropic-version':'2023-06-01'},{model,max_tokens:maxTokens,system:system.content+ANTHROPIC_FORMAT_INSTRUCTION,messages:[user],output_config:{format:{type:'json_schema',schema:anthropicSchema(input.references.map(r=>r.id))}}},signal,'Claude');
  if(wire?.stop_reason==='max_tokens')incomplete();
  if(wire?.stop_reason==='refusal')refused();
  if(wire?.type!=='message'||wire.role!=='assistant'||wire.stop_reason!=='end_turn'||!Array.isArray(wire.content))invalid();
  const parts=[];
  for(const part of wire.content){if(['thinking','redacted_thinking'].includes(part.type))continue;if(part.type!=='text'||typeof part.text!=='string')invalid();parts.push(part.text);}
  return parseAnthropicGeneration(parts.join(''));
 }};
}
