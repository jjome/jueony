import {createHash,randomUUID} from 'node:crypto';

const MAX_PENDING=32;
const TTL=180_000;
const fingerprint=(input,count)=>createHash('sha256').update(JSON.stringify([
  input.request,input.paragraphs,input.referenceCount,input.readOnly??null,input.documentScope??null,input.repair??null,input.tools,input.turns.slice(0,count),
])).digest('hex');
const invalid=()=>Object.assign(new Error('문서 조회 도구의 이전 응답과 연결할 수 없습니다.'),
  {safeMessage:'문서 조회 도구의 이전 응답과 연결할 수 없습니다.'});

/** Each configured provider owns its transient, single-use continuation tokens. */
export function createDocumentToolContinuations(){
  const pending=new Map();
  return {
    resume(input){
      if(!input.turns.length){
        if(input.continuation!==undefined)throw invalid();
        return undefined;
      }
      const state=pending.get(input.continuation);
      if(!state||state.until<Date.now()||state.count!==input.turns.length-1||
        state.fingerprint!==fingerprint(input,state.count)||
        JSON.stringify(state.calls)!==JSON.stringify(input.turns.at(-1).map(item=>item.call)))throw invalid();
      pending.delete(input.continuation);
      return state.payload;
    },
    issue(input,turn,payload){
      if(turn.kind!=='tools')return turn;
      if(JSON.stringify(payload).length>1_000_000)throw invalid();
      while(pending.size>=MAX_PENDING)pending.delete(pending.keys().next().value);
      const token='turn_'+randomUUID().replaceAll('-','');
      const count=input.turns.length;
      pending.set(token,{count,calls:turn.calls,payload,until:Date.now()+TTL,fingerprint:fingerprint(input,count)});
      setTimeout(()=>pending.delete(token),TTL).unref();
      return {...turn,continuation:token};
    },
  };
}
