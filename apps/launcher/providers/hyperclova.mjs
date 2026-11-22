import {randomUUID} from 'node:crypto';
import {generationSchema, generationMessages} from './generation-contract.mjs';
import {PARAGRAPH_SYSTEM,paragraphTool,normalizeParagraphEdits,parseParagraphToolArguments} from './paragraph-contract.mjs';
import {documentToolMessages,parseDocumentToolTurn,probeDocumentTools} from './document-tool-contract.mjs';

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
 async function request(body,signal){
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
  return wire.result;
 }
 const nativeTokenField=config.modelId==='HCX-005'?'maxTokens':'maxCompletionTokens';
 async function documentTurn(input,signal,limit){
  if(maxTokens<1024)fail('configuration','CLOVA Studio 문서 조회 도구에는 출력 토큰을 1,024 이상으로 설정해 주세요.');
  const {messages,tools}=documentToolMessages(input);
  const native=messages.map(message=>{
   if(message.role==='tool')return {role:'tool',toolCallId:message.tool_call_id,content:message.content};
   if(!message.tool_calls)return message;
   const toolCalls=message.tool_calls.map(call=>{
    let args;try{args=JSON.parse(call.function.arguments);}catch{}
    if(!args||typeof args!=='object'||Array.isArray(args))fail('invalid_request','CLOVA Studio 조회 도구 인수가 올바른 객체가 아닙니다.');
    return {...call,function:{name:call.function.name,arguments:args}};
   });
   return {role:'assistant',content:'',toolCalls};
  });
  const {message,finishReason}=await request({messages:native,tools,toolChoice:'auto',[nativeTokenField]:limit},signal)??{};
  if(message?.role!=='assistant')fail('invalid_response','CLOVA Studio 조회 응답이 올바르지 않습니다.');
  if(finishReason==='tool_calls'&&Array.isArray(message.toolCalls)&&message.toolCalls.length){
   const ids=new Set();
   const calls=message.toolCalls.map(call=>{
    const args=call?.function?.arguments;
    if(call?.type!=='function'||typeof call.id!=='string'||!/^[A-Za-z0-9_-]{1,160}$/u.test(call.id)||ids.has(call.id)||
      !input.tools.includes(call.function?.name)||!args||typeof args!=='object'||Array.isArray(args)){
     fail('invalid_response','CLOVA Studio가 제공하지 않은 조회 도구 또는 잘못된 인수를 반환했습니다.');
    }
    ids.add(call.id);
    const argumentsJson=JSON.stringify(args);
    if(argumentsJson.length>1000)fail('invalid_response','CLOVA Studio 조회 도구 인수의 크기가 한도를 넘었습니다.');
    return {id:call.id,function:{name:call.function.name,arguments:argumentsJson}};
   });
   return parseDocumentToolTurn({tool_calls:calls});
  }
  if(finishReason!=='stop'||(Array.isArray(message.toolCalls)&&message.toolCalls.length))fail('invalid_response','CLOVA Studio 조회 응답이 정상 종료되지 않았습니다.');
  return parseDocumentToolTurn({content:message.content});
 }
 return {async generate(input,signal){
  const messages=generationMessages(input,config.modelId==='HCX-005'?PARAGRAPH_SYSTEM:undefined);
  const body=config.modelId==='HCX-007'
   ?{messages,maxCompletionTokens:maxTokens,thinking:{effort:'none'},responseFormat:{type:'json',schema:generationSchema(input.references.map(source=>source.id))}}
   :{messages,maxTokens,includeAiFilters:true,tools:[paragraphTool(input.references.map(source=>source.id))],toolChoice:{type:'function',function:{name:'submit_document_edits'}}};
  const result=await request(body,signal);
  if(config.modelId==='HCX-005'){
   const calls=result?.message?.toolCalls;
   if(result?.finishReason!=='tool_calls'||result?.message?.role!=='assistant'||!Array.isArray(calls)||calls.length!==1||calls[0].type!=='function'||calls[0].function?.name!=='submit_document_edits')fail('invalid_response','CLOVA Studio가 정해진 편집안 도구를 반환하지 않았습니다. 문서를 변경하지 않았습니다.');
   return normalizeParagraphEdits(parseParagraphToolArguments(calls[0].function.arguments),input.document);
  }
  if(result?.finishReason!=='stop'||result?.message?.role!=='assistant')fail('invalid_response','CLOVA Studio 응답이 정상 종료되지 않았습니다. 문서를 변경하지 않았습니다.');
  const content=result.message.content;
  if(typeof content!=='string')fail('invalid_response','CLOVA Studio에서 텍스트 편집 JSON을 받지 못했습니다.');
  // The editor validates every command, source ID and current document revision before applying.
  try{return JSON.parse(content);}catch{fail('invalid_response','모델이 편집 JSON을 반환하지 않았습니다. 자동 재시도하지 않았습니다.');}
 },
 generateDocumentToolTurn(input,signal){return documentTurn(input,signal,maxTokens);},
 testDocumentTools(_input,signal){return probeDocumentTools((input,activeSignal)=>documentTurn(input,activeSignal,1024),signal);},
 };
}
