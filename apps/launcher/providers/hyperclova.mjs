import {randomUUID} from 'node:crypto';
import {generationSchema, generationMessages} from './generation-contract.mjs';
import {PARAGRAPH_SYSTEM,paragraphTool,normalizeParagraphEdits,parseParagraphToolArguments} from './paragraph-contract.mjs';

const fail=(code,message)=>{const error=new Error(message);error.code=code;error.safeMessage=message;throw error;};

// Explicit native v3 model contracts. No endpoint/model/key fallback.
export function createHyperCLOVA(config,key){
 if(!['HCX-005','HCX-007'].includes(config.modelId))fail('configuration','HyperCLOVA X 연결은 HCX-005와 HCX-007을 지원합니다. 승인된 모델 ID를 입력해 주세요.');
 if(typeof key!=='string'||!key.trim()||key.length>8192||/[\r\n]/.test(key))fail('configuration','CLOVA Studio에서 발급한 API 키를 입력해 주세요.');
 let endpoint;try{endpoint=new URL(config.endpoint);}catch{fail('configuration','API endpoint 주소를 확인해 주세요.');}
 const local=['127.0.0.1','localhost','[::1]'].includes(endpoint.hostname);
 if((endpoint.protocol!=='https:'&&!(endpoint.protocol==='http:'&&local))||endpoint.username||endpoint.password||endpoint.search||endpoint.hash)fail('configuration','HTTPS endpoint를 사용해 주세요. 로컬 테스트 서버만 HTTP를 허용합니다.');
 if(!/^\/(?:testapp\/|serviceapp\/)?v3\/chat-completions\/?$/.test(endpoint.pathname))fail('configuration','HyperCLOVA X endpoint는 /v3/chat-completions까지 입력합니다. 모델 이름은 별도 칸에 입력해 주세요.');
 endpoint.pathname=endpoint.pathname.replace(/\/$/,'')+'/'+config.modelId;
 const maxTokens=config.maxOutputTokens??4096;
 const tokenLimit=config.modelId==='HCX-005'?4096:8192;
 const tokenMinimum=config.modelId==='HCX-005'?1024:128;
 if(!Number.isInteger(maxTokens)||maxTokens<tokenMinimum||maxTokens>tokenLimit)fail('configuration',`이 모델의 최대 출력 토큰은 ${tokenMinimum}~${tokenLimit} 사이의 정수로 입력해 주세요.`);
 return {async generate(input,signal){
  const messages=generationMessages(input,config.modelId==='HCX-005'?PARAGRAPH_SYSTEM:undefined);
  const body=config.modelId==='HCX-007'
   ?{messages,maxCompletionTokens:maxTokens,thinking:{effort:'none'},responseFormat:{type:'json',schema:generationSchema(input.references.map(source=>source.id))}}
   :{messages,maxTokens,includeAiFilters:true,tools:[paragraphTool(input.references.map(source=>source.id))],toolChoice:{type:'function',function:{name:'submit_document_edits'}}};
  let response;
  const combined=AbortSignal.any([signal,AbortSignal.timeout(90000)]);
  try{
   response=await fetch(endpoint,{method:'POST',redirect:'error',signal:combined,headers:{
    Authorization:'Bearer '+key.trim(),'Content-Type':'application/json',Accept:'application/json',
    'X-NCP-CLOVASTUDIO-REQUEST-ID':randomUUID(),
   },body:JSON.stringify(body)});
  }catch{
   fail(signal.aborted?'cancelled':'connection',signal.aborted?'AI 요청을 취소했습니다.':'CLOVA Studio 연결/시간 제한 오류입니다. endpoint·인증서·네트워크를 확인해 주세요.');
  }
  if(!response.ok){
   await response.body?.cancel();
   if(response.status===401||response.status===403)fail('authentication','CLOVA Studio API 키와 모델 접근 권한을 확인해 주세요. 서비스 키는 승인된 서비스 앱의 모델 ID와 일치해야 합니다.');
   if(response.status===429)fail('rate_limit','CLOVA Studio 호출 한도를 넘었습니다. 잠시 후 직접 다시 요청해 주세요.');
   fail('provider','CLOVA Studio 요청 실패 (HTTP '+response.status+'). endpoint·모델·구조화 출력 지원 여부를 확인해 주세요.');
  }
  if(!response.body)fail('invalid_response','CLOVA Studio 응답이 비어 있습니다.');
  const parts=[];let size=0;const reader=response.body.getReader();
  try{
   for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>1_000_000){await reader.cancel();fail('response_too_large','모델 응답 크기 제한을 넘었습니다.');}parts.push(value);}
  }catch(error){
   if(error.safeMessage)throw error;
   fail(signal.aborted?'cancelled':'connection',signal.aborted?'AI 요청을 취소했습니다.':'CLOVA Studio 응답 읽기/시간 제한 오류입니다.');
  }
  let wire;try{wire=JSON.parse(Buffer.concat(parts).toString('utf8'));}catch{fail('invalid_response','CLOVA Studio가 올바른 JSON 응답을 반환하지 않았습니다.');}
  if(wire?.status?.code!=='20000')fail('provider','CLOVA Studio가 성공 상태를 반환하지 않았습니다. 키·권한·모델 설정을 확인해 주세요.');
  if(wire.result?.finishReason==='length')fail('incomplete','생성이 출력 토큰 한도에 도달했습니다. 문서를 변경하지 않았습니다. 요청 범위를 줄이거나 출력 토큰을 늘려 주세요.');
  if(config.modelId==='HCX-005'){
   const calls=wire.result?.message?.toolCalls;
   if(wire.result?.finishReason!=='tool_calls'||wire.result?.message?.role!=='assistant'||!Array.isArray(calls)||calls.length!==1||calls[0].type!=='function'||calls[0].function?.name!=='submit_document_edits')fail('invalid_response','CLOVA Studio가 정해진 편집안 도구를 반환하지 않았습니다. 문서를 변경하지 않았습니다.');
   return normalizeParagraphEdits(parseParagraphToolArguments(calls[0].function.arguments),input.document);
  }
  if(wire.result?.finishReason!=='stop'||wire.result?.message?.role!=='assistant')fail('invalid_response','CLOVA Studio 응답이 정상 종료되지 않았습니다. 문서를 변경하지 않았습니다.');
  const content=wire.result.message.content;
  if(typeof content!=='string')fail('invalid_response','CLOVA Studio에서 텍스트 편집 JSON을 받지 못했습니다.');
  let result;try{result=JSON.parse(content);}catch{fail('invalid_response','모델이 편집 JSON을 반환하지 않았습니다. 자동 재시도하지 않았습니다.');}
  // The editor validates every command, source ID and current document revision before applying.
  return result;
 }};
}
