/** Cancellation cannot erase evidence that a document/file may already have changed. */
export function classifyAgentFailure(failure:{name:string;message:string},aborted:boolean){
 const status=failure.name==='PartialApplyError'?'failed_partial':failure.name==='RolledBackError'?'failed_rolled_back':failure.name==='ConflictError'?'conflict':aborted||failure.name==='AbortError'?'cancelled':'failed_no_change';
 return{status,message:status==='cancelled'?'요청을 취소했습니다. 이 요청의 변경을 적용하지 않았습니다.':failure.message} as const;
}
