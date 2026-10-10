import {generationMessages} from './generation-contract.mjs';
import {nativeConfig,nativeSchema,postJSON,parseGeneration,incomplete,refused,invalid} from './native-common.mjs';

export function createOpenAIResponses(config,key) {
 const {endpoint,model,maxTokens}=nativeConfig(config,key,'/responses');
 return {async generate(input,signal) {
  const messages=generationMessages(input);
  messages[0].content+=' Optional formatting fields set to null mean unchanged. Use null for every property the user did not request.';
  const wire=await postJSON(endpoint,{Authorization:'Bearer '+key},{model,input:messages,store:false,max_output_tokens:maxTokens,text:{format:{type:'json_schema',name:'jueony_edit',strict:true,schema:nativeSchema(input.references.map(r=>r.id),true)}}},signal,'OpenAI');
  if(wire?.status==='incomplete')incomplete();
  if(wire?.status!=='completed'||!Array.isArray(wire.output))invalid();
  const parts=[];let count=0;
  for(const item of wire.output) {
   if(item.type==='reasoning')continue;
   if(item.type!=='message'||item.role!=='assistant'||item.status!=='completed'||!Array.isArray(item.content))invalid();
   count++;
   for(const part of item.content){if(part.type==='refusal')refused();if(part.type!=='output_text'||typeof part.text!=='string')invalid();parts.push(part.text);}
  }
  if(count!==1)invalid();
  return parseGeneration(parts.join(''),true);
 }};
}
