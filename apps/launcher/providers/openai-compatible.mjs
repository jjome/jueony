import {generationMessages} from './generation-contract.mjs';
const fail=(text)=>{const e=new Error(text);e.safeMessage=text;throw e;};
export function createOpenAICompatible(config,key){
 if(typeof config.modelId!=='string'||!config.modelId.trim()||config.modelId.length>200)fail('모델 ID를 입력해 주세요.');
 if(typeof key!=='string'||key.length>8192||/[\r\n]/.test(key))fail('인증정보 형식이 올바르지 않습니다.');
 let endpoint;try{endpoint=new URL(config.endpoint);}catch{fail('API endpoint 주소를 확인해 주세요.');}
 const local=['127.0.0.1','localhost','[::1]'].includes(endpoint.hostname);
 if((endpoint.protocol!=='https:'&&!(endpoint.protocol==='http:'&&local))||endpoint.username||endpoint.password||endpoint.search||endpoint.hash)fail('HTTPS endpoint를 사용해 주세요. 로컬 테스트 서버만 HTTP를 허용합니다.');
 if(!endpoint.pathname.endsWith('/chat/completions'))endpoint.pathname=endpoint.pathname.replace(/\/$/,'')+'/chat/completions';
 const model=config.modelId.trim();
 return {async generate(input,signal){
  const messages=generationMessages(input);
  let response;
  try{response=await fetch(endpoint,{method:'POST',redirect:'error',headers:{'Content-Type':'application/json',...(key?{Authorization:'Bearer '+key}:{})},body:JSON.stringify({model,messages,stream:false}),signal:AbortSignal.any([signal,AbortSignal.timeout(90000)])});}
  catch{fail(signal.aborted?'AI 요청을 취소했습니다.':'모델 서버 연결/시간 제한 오류입니다. endpoint·인증서·네트워크를 확인해 주세요.');}
  if(!response.ok){await response.body?.cancel();fail(response.status===401||response.status===403?'API 인증 또는 모델 접근 권한을 확인해 주세요.':response.status===429?'모델 호출 한도를 넘었습니다. 잠시 후 다시 요청해 주세요.':`모델 서버 오류 (HTTP ${response.status}). 모델 ID와 endpoint를 확인해 주세요.`);}
  const reader=response.body.getReader();const parts=[];let size=0;
  try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>1_000_000){await reader.cancel();fail('모델 응답 크기 제한을 넘었습니다.');}parts.push(value);}}catch(e){if(e.safeMessage)throw e;fail('모델 응답을 읽지 못했습니다.');}
  let result;try{const wire=JSON.parse(Buffer.concat(parts).toString('utf8'));let content=wire.choices?.[0]?.message?.content;if(typeof content!=='string')fail('텍스트 JSON 응답을 받지 못했습니다.');content=content.trim().replace(/^\x60\x60\x60(?:json)?\s*/,'').replace(/\s*\x60\x60\x60$/,'');result=JSON.parse(content);}catch{fail('모델이 올바른 편집 JSON을 반환하지 않았습니다. 자동 재시도하지 않았습니다.');}
  return result;
 }};
}
