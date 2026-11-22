import {generationMessages} from './generation-contract.mjs';
import {nativeConfig,nativeSchema,postJSON,parseGeneration,fail,incomplete,refused,invalid} from './native-common.mjs';
import {documentToolMessages,parseDocumentToolTurn,probeDocumentTools} from './document-tool-contract.mjs';
import {createDocumentToolContinuations} from './document-tool-continuations.mjs';

function completedContent(wire){
 if(wire?.promptFeedback?.blockReason)refused();
 if(!Array.isArray(wire?.candidates)||wire.candidates.length!==1)invalid();
 const candidate=wire.candidates[0];
 if(candidate.finishReason==='MAX_TOKENS')incomplete();
 if(['SAFETY','RECITATION','BLOCKLIST','PROHIBITED_CONTENT','SPII','IMAGE_SAFETY'].includes(candidate.finishReason))refused();
 if(candidate.finishReason!=='STOP'||candidate.content?.role!=='model'||!Array.isArray(candidate.content.parts))invalid();
 return candidate.content;
}

function textContent(content){
 const parts=[];
 for(const part of content.parts){
  if(part.thought===true)continue;
  if(typeof part.text!=='string'||Object.keys(part).some(k=>!['text','thought','thoughtSignature'].includes(k)))invalid();
  parts.push(part.text);
 }
 return parts.join('');
}

export function createGemini(config,key,authorization) {
 const {endpoint,model,maxTokens}=nativeConfig(config,authorization?'oauth':key,'');
 if(authorization&&endpoint.href!=='https://generativelanguage.googleapis.com/v1beta')fail('config','Google 인증에는 공식 Gemini API 주소가 필요합니다.');
 if(!/^[a-zA-Z0-9._-]+$/.test(model))fail('config','Gemini 모델 ID에는 models/ 접두사 없이 모델 이름만 입력해 주세요.');
 if(endpoint.pathname.endsWith(':generateContent'))fail('config','Gemini endpoint는 모델 경로 앞의 /v1beta까지 입력해 주세요.');
 endpoint.pathname+='/models/'+encodeURIComponent(model)+':generateContent';
 const headers=authorization??(()=>({'x-goog-api-key':key}));
 const continuations=createDocumentToolContinuations();
 async function toolTurn(input,signal,probe=false){
  const {messages:[system,user],tools}=documentToolMessages(input);
  const previous=continuations.resume(input);
  const contents=previous?[...previous.contents,{role:'user',parts:input.turns.at(-1).map(({call,result},index)=>{
    const value=JSON.parse(result),id=previous.vendorIds[index];
    return {functionResponse:{name:call.name,...(id?{id}:{}),
     response:value&&typeof value==='object'&&!Array.isArray(value)?value:{output:value}}};
  })}]:[{role:'user',parts:[{text:user.content}]}];
  const wire=await postJSON(endpoint,await headers(signal),{systemInstruction:{parts:[{text:system.content}]},contents,
   tools:[{functionDeclarations:tools.map(({function:tool})=>({name:tool.name,description:tool.description,parametersJsonSchema:tool.parameters}))}],
   generationConfig:{candidateCount:1,maxOutputTokens:probe?512:maxTokens}},signal,'Gemini');
  const content=completedContent(wire);
  const calls=content.parts.filter(part=>part?.functionCall).map(part=>part.functionCall);
  if(!calls.length)return parseDocumentToolTurn({content:textContent(content)});
  if(content.parts.some(part=>!part||(!part.functionCall&&typeof part.text!=='string'))||
     calls.some(call=>typeof call.name!=='string'||call.id!==undefined&&typeof call.id!=='string'||
      call.args!==undefined&&(!call.args||typeof call.args!=='object'||Array.isArray(call.args))))invalid();
  const turn=parseDocumentToolTurn({tool_calls:calls.map((call,index)=>({id:call.id??`gemini_${input.turns.length}_${index}`,
   function:{name:call.name,arguments:JSON.stringify(call.args??{})}}))});
  return probe?turn:continuations.issue(input,turn,{contents:[...contents,content],vendorIds:calls.map(call=>call.id)});
 }
 return {async generate(input,signal) {
  const [system,user]=generationMessages(input);
  const wire=await postJSON(endpoint,await headers(signal),{systemInstruction:{parts:[{text:system.content}]},contents:[{role:'user',parts:[{text:user.content}]}],generationConfig:{candidateCount:1,maxOutputTokens:maxTokens,responseFormat:{text:{mimeType:'application/json',schema:nativeSchema(input.references.map(r=>r.id))}}}},signal,'Gemini');
  return parseGeneration(textContent(completedContent(wire)));
 },generateDocumentToolTurn:toolTurn,
 testDocumentTools(_input,signal){return probeDocumentTools((input,signal)=>toolTurn(input,signal,true),signal);}};
}
