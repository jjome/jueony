export function connectionTestInput(){
 return {
  request:'연결 확인 요청입니다. message는 연결 확인, sourceIds와 operations는 빈 배열로 답하세요. 문서 작업을 하지 마세요.',
  document:{revision:'connection-test',name:'합성 연결 확인',nodes:[],limitations:[]},
  references:[],history:[],
 };
}
export function assertConnectionTest(result){
 if(!result||typeof result.message!=='string'||!result.message.trim()||!Array.isArray(result.operations)||result.operations.length||!Array.isArray(result.sourceIds)||result.sourceIds.length){
  const error=new Error('연결 응답은 받았지만 편집 JSON 계약을 확인하지 못했습니다. 문서에는 적용하지 않았습니다.');
  error.safeMessage=error.message;throw error;
 }
 return {connected:true,documentSent:false};
}
