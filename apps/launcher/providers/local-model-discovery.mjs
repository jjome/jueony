const safe = message => Object.assign(new Error(message),{safeMessage:message});
const LOCAL = ['127.0.0.1','localhost','[::1]'];

export async function discoverLocalModels(endpoint, key, signal) {
  let url;
  try {url=new URL(endpoint);} catch {throw safe('로컬 모델 주소를 확인해 주세요.');}
  if (!LOCAL.includes(url.hostname)||!['http:','https:'].includes(url.protocol)||url.username||url.password||url.search||url.hash
      || typeof key!=='string'||key.length>8192||/[\r\n]/u.test(key)) throw safe('로컬 모델 검색은 이 PC의 모델 서버 주소만 지원합니다.');
  const path=url.pathname.replace(/\/+$/u,'').replace(/\/chat\/completions$/u,'');
  url.pathname=`${path || '/v1'}/models`;
  const headers={Accept:'application/json',...(key?{Authorization:`Bearer ${key}`}:{})};
  const bounded=AbortSignal.any([signal,AbortSignal.timeout(8000)]);
  async function read() {
    let response;
    try {response=await fetch(url,{headers,signal:bounded,redirect:'error'});}
    catch {throw safe('로컬 모델 서버에 연결할 수 없습니다. 주소와 실행 상태를 확인해 주세요.');}
    if (response.status===404){await response.body?.cancel();return null;}
    if(!response.ok){await response.body?.cancel();throw safe(response.status===401||response.status===403?'로컬 모델 서버의 인증을 확인해 주세요.':'모델 목록을 읽지 못했습니다.');}
    const reader=response.body.getReader(),chunks=[];let size=0;
    try {
      for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>500_000)throw new Error();chunks.push(value);}
      return JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch {throw safe('로컬 서버의 모델 목록 형식을 확인할 수 없습니다.');}
    finally {await reader.cancel().catch(()=>{});}
  }
  let result=await read();
  let kind='openai-compatible';
  if(result===null && (path===''||path==='/v1')){url.pathname='/api/tags';result=await read();kind='ollama';}
  const rows=kind==='ollama'?result?.models:result?.data;
  if(!Array.isArray(rows))throw safe('OpenAI 호환 또는 Ollama 모델 목록을 찾지 못했습니다.');
  const ids=[...new Set(rows.map(row=>kind==='ollama'?row?.model??row?.name:row?.id)
    .filter(id=>typeof id==='string'&&id.length>0&&id.length<=200&&!/[\p{Cc}\s]/u.test(id)))].slice(0,128);
  return { kind, models:ids };
}
