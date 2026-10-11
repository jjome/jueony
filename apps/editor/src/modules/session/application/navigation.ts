export type NavigationState={closing:boolean;restoring:boolean;runStatus?:string};
export function createSessionGuard(read:()=>NavigationState,cancel:()=>void,notice:(message:string)=>void){
 return {canNavigate(){
  const state=read();
  if(state.closing||state.restoring){notice('문서 준비 또는 닫기를 완료한 뒤 전환해 주세요.');return false;}
  if(state.runStatus==='applying'){notice('문서 적용이 끝난 뒤 전환해 주세요.');return false;}
  cancel();return true;
 }};
}
