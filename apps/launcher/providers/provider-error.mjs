// Provider bodies can echo credentials or document text. Read a bounded JSON
// error for classification only; expose fixed messages, never the raw body.
async function errorFacts(response) {
 if(!response.body)return {};
 const reader=response.body.getReader(),parts=[];let size=0;
 try {
  for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>65536)return {};parts.push(value);}
  const data=JSON.parse(Buffer.concat(parts).toString('utf8')),error=data?.error;
  return {type:typeof error?.type==='string'?error.type:'',code:typeof error?.code==='string'?error.code:'',message:typeof error?.message==='string'?error.message:''};
 }catch{return {};}
 finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
}

export async function providerError(response,provider) {
 const status=response.status,{type='',code='',message=''}=await errorFacts(response);
 let category='provider',advice='요청 형식·모델 접근 권한·구조화 출력 지원 여부를 확인해 주세요.';
 if(status===401||status===403){category='auth';advice='API 키 또는 모델 접근 권한을 확인해 주세요.';}
 else if(code==='insufficient_quota'||/credit balance.{0,40}(low|insufficient)|insufficient.{0,20}(credit|balance)|billing.{0,20}(limit|quota)|spend limit/i.test(message)){category='billing';advice='API 크레딧 부족 또는 결제·사용 한도 초과입니다. 키가 속한 조직의 잔액과 한도를 확인해 주세요.';}
 else if(/schema.{0,80}(complex|compil)|too many.{0,30}(optional|union)|optional.{0,40}(limit|24)|union.{0,40}(limit|16)/i.test(message)){category='schema';advice='편집 명령 정의가 제공자의 구조화 출력 복잡도 제한을 넘었습니다. Jueony 업데이트가 필요합니다. 키를 재발급할 필요는 없습니다.';}
 else if(status===404||type==='not_found_error'||/model.{0,50}(not found|not exist|not available|not supported|access)/i.test(message)){category='model';advice='모델 ID·endpoint 또는 해당 모델의 계정 접근 권한을 확인해 주세요.';}
 else if(status===429){category='rate_limit';advice='호출 속도·사용량 한도를 초과했습니다. 잠시 후 다시 시도하거나 제공자 콘솔의 한도를 확인해 주세요.';}
 else if(/(output_config|response_format|json_schema|schema)/i.test(message)){category='schema';advice='제공자가 편집 JSON 형식을 거부했습니다. 모델의 구조화 출력 지원과 Jueony 요청 형식을 확인해야 합니다.';}
 else if(status>=500){category='unavailable';advice='제공자 서버가 요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.';}
 const requestId=response.headers.get('request-id')??response.headers.get('x-request-id');
 const suffix=requestId&&/^req_[A-Za-z0-9]{8,80}$/.test(requestId)?` 요청 ID: ${requestId}`:'';
 return {code:category,safeMessage:`${provider} 오류 (HTTP ${status}, ${category}). ${advice}${suffix}`};
}
