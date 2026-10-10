import {generationMessages} from './generation-contract.mjs';
import {nativeConfig,nativeSchema,postJSON,parseGeneration,fail,incomplete,refused,invalid} from './native-common.mjs';

export function createGemini(config,key) {
 const {endpoint,model,maxTokens}=nativeConfig(config,key,'');
 if(!/^[a-zA-Z0-9._-]+$/.test(model))fail('config','Gemini 모델 ID에는 models/ 접두사 없이 모델 이름만 입력해 주세요.');
 if(endpoint.pathname.endsWith(':generateContent'))fail('config','Gemini endpoint는 모델 경로 앞의 /v1beta까지 입력해 주세요.');
 endpoint.pathname+='/models/'+encodeURIComponent(model)+':generateContent';
 return {async generate(input,signal) {
  const [system,user]=generationMessages(input);
  const wire=await postJSON(endpoint,{'x-goog-api-key':key},{systemInstruction:{parts:[{text:system.content}]},contents:[{role:'user',parts:[{text:user.content}]}],generationConfig:{candidateCount:1,maxOutputTokens:maxTokens,responseFormat:{text:{mimeType:'application/json',schema:nativeSchema(input.references.map(r=>r.id))}}}},signal,'Gemini');
  if(wire?.promptFeedback?.blockReason)refused();
  if(!Array.isArray(wire?.candidates)||wire.candidates.length!==1)invalid();
  const candidate=wire.candidates[0];
  if(candidate.finishReason==='MAX_TOKENS')incomplete();
  if(['SAFETY','RECITATION','BLOCKLIST','PROHIBITED_CONTENT','SPII','IMAGE_SAFETY'].includes(candidate.finishReason))refused();
  if(candidate.finishReason!=='STOP'||candidate.content?.role!=='model'||!Array.isArray(candidate.content.parts))invalid();
  const parts=[];
  for(const part of candidate.content.parts){if(part.thought===true)continue;if(typeof part.text!=='string'||Object.keys(part).some(k=>!['text','thought','thoughtSignature'].includes(k)))invalid();parts.push(part.text);}
  return parseGeneration(parts.join(''));
 }};
}
