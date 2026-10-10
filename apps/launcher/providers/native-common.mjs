import {generationSchema} from './generation-contract.mjs';

export function fail(code, message) {
 throw Object.assign(new Error(message), {code, safeMessage:message});
}

export function nativeConfig(config, key, suffix) {
 if(typeof key!=='string'||!key.trim()||key.length>8192||/[\r\n]/.test(key))fail('auth','API 키를 입력해 주세요.');
 if(typeof config.modelId!=='string'||!config.modelId.trim()||config.modelId.length>200||/[\s\x00-\x1f]/.test(config.modelId))fail('config','공급자에서 사용할 수 있는 정확한 모델 ID를 입력해 주세요.');
 let endpoint;try{endpoint=new URL(config.endpoint);}catch{fail('config','API endpoint 주소를 확인해 주세요.');}
 const local=['127.0.0.1','localhost','[::1]'].includes(endpoint.hostname);
 if((endpoint.protocol!=='https:'&&!(endpoint.protocol==='http:'&&local))||endpoint.username||endpoint.password||endpoint.search||endpoint.hash)fail('config','HTTPS endpoint를 사용해 주세요. 로컬 테스트 서버만 HTTP를 허용합니다.');
 endpoint.pathname=endpoint.pathname.replace(/\/+$/,'');
 if(suffix&&!endpoint.pathname.endsWith(suffix))endpoint.pathname+=suffix;
 const maxTokens=config.maxOutputTokens??8192;
 if(!Number.isInteger(maxTokens)||maxTokens<128||maxTokens>32768)fail('config','최대 출력 토큰은 128~32,768 사이 정수로 입력해 주세요.');
 return {endpoint,model:config.modelId,maxTokens};
}

// API dialect projection only. All editing limits remain enforced by the editor.
// OpenAI requires every field; optional format properties use null = unchanged.
export function nativeSchema(referenceIds, strict=false) {
 const project=node=>{
  const out={};
  for(const [key,value] of Object.entries(node)) {
   if(['minimum','maximum','minItems','maxItems'].includes(key))continue;
   if(key==='properties')out.properties=Object.fromEntries(Object.entries(value).map(([name,child])=>[name,project(child)]));
   else if(key==='items')out.items=project(value);
   else if(key==='anyOf')out.anyOf=value.map(project);
   else out[key]=value;
  }
  if(out.type==='object') {
   out.additionalProperties=false;
   if(strict) {
    const required=new Set(out.required??[]);
    for(const [name,child] of Object.entries(out.properties))if(!required.has(name))out.properties[name]={anyOf:[child,{type:'null'}]};
    out.required=Object.keys(out.properties);
   }
  }
  return out;
 };
 return project(generationSchema(referenceIds));
}

export function parseGeneration(text, strict=false) {
 let result;
 try{if(typeof text!=='string')throw new Error();result=JSON.parse(text);}catch{fail('invalid_response','모델이 올바른 편집 JSON을 반환하지 않았습니다. 문서를 변경하지 않았습니다.');}
 if(!result||typeof result!=='object'||Array.isArray(result)||!Array.isArray(result.operations))fail('invalid_response','모델의 편집 응답 형식이 올바르지 않습니다.');
 if(strict) {
  const variants=generationSchema().properties.operations.items.anyOf;
  for(const op of result.operations) {
   const allowed=variants.find(v=>v.properties.kind.enum[0]===op?.kind)?.properties.properties?.properties;
   if(allowed&&op.properties&&typeof op.properties==='object')for(const name of Object.keys(allowed))if(op.properties[name]===null)delete op.properties[name];
  }
 }
 return result;
}

export async function postJSON(endpoint, headers, body, signal, provider) {
 const combined=AbortSignal.any([signal,AbortSignal.timeout(90000)]);
 let response;
 try{response=await fetch(endpoint,{method:'POST',redirect:'error',headers:{'Content-Type':'application/json',Accept:'application/json',...headers},body:JSON.stringify(body),signal:combined});}
 catch{fail(signal.aborted?'cancelled':'network',signal.aborted?'AI 요청을 취소했습니다.':`${provider} 연결/시간 제한 오류입니다. 주소·인증서·네트워크를 확인해 주세요.`);}
 if(!response.ok) {
  await response.body?.cancel();
  const status=response.status;
  fail(status===401||status===403?'auth':status===429?'rate_limit':'provider',status===401||status===403?`${provider} API 키 또는 모델 접근 권한을 확인해 주세요.`:status===429?`${provider} 사용량·잔액·호출 한도를 확인해 주세요.`:`${provider} 오류 (HTTP ${status}). 모델 ID·endpoint·구조화 출력 지원 여부를 확인해 주세요.`);
 }
 let wire;
 try {
  if(!response.body)fail('invalid_response',`${provider} 응답이 비어 있습니다.`);
  const reader=response.body.getReader(),parts=[];let size=0;
  for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>1_000_000){await reader.cancel();fail('invalid_response','모델 응답 크기 제한을 넘었습니다.');}parts.push(value);}
  try{wire=JSON.parse(Buffer.concat(parts).toString('utf8'));}catch{fail('invalid_response',`${provider} 서버가 JSON 응답을 반환하지 않았습니다.`);}
 }catch(error){if(error.safeMessage)throw error;fail(signal.aborted?'cancelled':'network',signal.aborted?'AI 요청을 취소했습니다.':`${provider} 응답 읽기/시간 제한 오류입니다.`);}
 if(signal.aborted)fail('cancelled','AI 요청을 취소했습니다.');
 return wire;
}

export const incomplete=()=>fail('incomplete','생성이 출력 한도에 도달했습니다. 문서를 변경하지 않았습니다. 요청을 줄이거나 최대 출력 토큰을 늘려 주세요.');
export const refused=()=>fail('refusal','모델이 요청을 거부하거나 차단했습니다. 문서를 변경하지 않았습니다.');
export const invalid=()=>fail('invalid_response','모델 응답이 정상적으로 완료되지 않았습니다. 문서를 변경하지 않았습니다.');
