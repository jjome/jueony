import {generationMessages} from './generation-contract.mjs';
import {nativeConfig,nativeSchema,postJSON,parseGeneration,incomplete,refused,invalid} from './native-common.mjs';
import {documentToolMessages,parseDocumentToolTurn,probeDocumentTools} from './document-tool-contract.mjs';
import {createDocumentToolContinuations} from './document-tool-continuations.mjs';

function completedItems(wire){
 if(wire?.status==='incomplete')incomplete();
 if(wire?.status!=='completed'||!Array.isArray(wire.output))invalid();
 return wire.output;
}

function messageText(items){
 const parts=[];let count=0;
 for(const item of items) {
  if(item.type==='reasoning')continue;
  if(item.type!=='message'||item.role!=='assistant'||item.status!=='completed'||!Array.isArray(item.content))invalid();
  count++;
  for(const part of item.content){if(part.type==='refusal')refused();if(part.type!=='output_text'||typeof part.text!=='string')invalid();parts.push(part.text);}
 }
 if(count!==1)invalid();
 return parts.join('');
}

export function createOpenAIResponses(config,key) {
 const {endpoint,model,maxTokens}=nativeConfig(config,key,'/responses');
 const headers={Authorization:'Bearer '+key};
 const continuations=createDocumentToolContinuations();
 async function toolTurn(input,signal,probe=false){
  const {messages:[system,user],tools}=documentToolMessages(input);
  const previous=continuations.resume(input);
  const items=previous?[...previous,...input.turns.at(-1).map(({call,result})=>({
    type:'function_call_output',call_id:call.id,output:result,
  }))]:[user];
  const wire=await postJSON(endpoint,headers,{model,input:items,instructions:system.content,store:false,
   include:['reasoning.encrypted_content'],max_output_tokens:probe?512:maxTokens,
   tools:tools.map(({type,function:tool})=>({type,...tool,strict:false}))},signal,'OpenAI');
  const output=completedItems(wire);
  const calls=output.filter(item=>item?.type==='function_call');
  if(!calls.length)return parseDocumentToolTurn({content:messageText(output)});
  for(const item of output){
   if(!['function_call','reasoning','message'].includes(item?.type))invalid();
   if(item.type==='message')messageText([item]);
  }
  const turn=parseDocumentToolTurn({tool_calls:calls.map(call=>({id:call.call_id,function:{name:call.name,arguments:call.arguments}}))});
  return probe?turn:continuations.issue(input,turn,[...items,...output]);
 }
 return {async generate(input,signal) {
  const messages=generationMessages(input);
  messages[0].content+=' Optional formatting fields set to null mean unchanged. Use null for every property the user did not request.';
  const wire=await postJSON(endpoint,headers,{model,input:messages,store:false,max_output_tokens:maxTokens,text:{format:{type:'json_schema',name:'jueony_edit',strict:true,schema:nativeSchema(input.references.map(r=>r.id),true)}}},signal,'OpenAI');
  return parseGeneration(messageText(completedItems(wire)),true);
 },generateDocumentToolTurn:toolTurn,
 testDocumentTools(_input,signal){return probeDocumentTools((input,signal)=>toolTurn(input,signal,true),signal);}};
}
