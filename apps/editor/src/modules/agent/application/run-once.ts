import {agentFileKinds,validateAgentFileOperation} from '../../document/public/index.ts';
import type {AgentFileReceipt} from '../../document/public/index.ts';
import type {AgentFilePort} from '../public/contracts.ts';
import {validateGeneration} from '../domain/generation.ts';
import {assertRevision} from '../../document/public/index.ts';
import type {ModelGatewayPort as LLMPort,ModelInput as LLMInput,ModelConfig} from '../../connections/public/index.ts';
import type {Snapshot,Receipt} from '../../document/public/index.ts';
import type {Generation,RunStatus} from '../public/contracts.ts';
export type EditorTool={snapshot():Snapshot;apply(id:string,snapshot:Snapshot,result:Generation):Promise<Receipt>;preflight?(snapshot:Snapshot,result:Generation):Promise<void>};
export type RunOptions={filePort?:AgentFilePort;runId:string;context:LLMInput;model:ModelConfig;port:LLMPort;editor:EditorTool;createDocument:()=>Promise<EditorTool>;signal:AbortSignal;isCurrent:()=>boolean;state:(s:RunStatus)=>void};
export function checkRun(options:RunOptions){
 options.signal.throwIfAborted();
 if(!options.isCurrent())throw new DOMException('업무·채팅·문서가 전환되었습니다.','AbortError');
 assertRevision(options.context.document.revision,options.editor.snapshot().revision);
}
/** Read-only stages may stop waiting on a provider that ignores cancellation. */
export function awaitRunRead<T>(work:Promise<T>,signal:AbortSignal):Promise<T>{
 return new Promise((resolve,reject)=>{
  const cancel=()=>reject(signal.reason??new DOMException('작업을 취소했습니다.','AbortError'));
  if(signal.aborted){work.catch(()=>{});cancel();return;}
  signal.addEventListener('abort',cancel,{once:true});
  work.then(resolve,reject).finally(()=>signal.removeEventListener('abort',cancel));
 });
}
export type CommitResult={message:string;sourceIds:string[];receipt?:Receipt;fileReceipt?:AgentFileReceipt;generation:Generation};
/** One final validated plan crosses this boundary, regardless of the model call count. */
export async function commitGeneration(options:RunOptions,result:Generation):Promise<CommitResult>{
 checkRun(options);
 if(result.operations.length===1&&(agentFileKinds as readonly string[]).includes(result.operations[0].kind)){
  if(!options.filePort||!options.context.document.fileContext)throw Error('현재 창에는 Agent 문서 탭 제어가 연결되지 않았습니다.');
  const expected=options.context.document.fileContext,operation=validateAgentFileOperation(result.operations[0],expected);options.state('applying');
  const fileReceipt=await options.filePort.execute(options.runId,operation,expected,options.signal);
  if(!fileReceipt||fileReceipt.runId!==options.runId||fileReceipt.kind!==operation.kind||fileReceipt.status!=='completed'||fileReceipt.beforeStamp!==expected.stamp||fileReceipt.operationCount!==1||fileReceipt.documentMutations!==0){const error=Error('파일 명령의 실제 완료 증거가 일치하지 않습니다. 현재 탭 상태를 확인하세요.');if(operation.kind!=='list_document_tabs')error.name='PartialApplyError';throw error;}
  if(operation.kind==='save_active_document'&&(!fileReceipt.save||fileReceipt.save.status!=='saved'||fileReceipt.save.tabId!==expected.activeTabId||fileReceipt.save.beforeRevision!==options.context.document.revision||fileReceipt.save.afterRevision!==options.editor.snapshot().revision)){const error=Error('활성 문서의 실제 저장 완료 증거가 일치하지 않습니다.');error.name='PartialApplyError';throw error;}
  return{message:result.message,sourceIds:result.sourceIds,receipt:undefined,fileReceipt,generation:result};
 }
 if(!result.operations.length)return {message:result.message,sourceIds:result.sourceIds,receipt:undefined,generation:result};
 if(options.editor.preflight){await awaitRunRead(options.editor.preflight(options.context.document,result),options.signal);checkRun(options);}
 let editor=options.editor,base=options.context.document;
 if(result.operations[0].kind==='create_document'){editor=await options.createDocument();base=editor.snapshot();}
 checkRun(options);options.state('applying');
 const receipt=await editor.apply(options.runId,base,result);
 return {message:result.message,sourceIds:result.sourceIds,receipt,generation:result};
}
export async function runOnce(options:RunOptions){
 checkRun(options);options.state('generating');
 const raw=await awaitRunRead(options.port.generate(options.context,options.model,options.signal),options.signal);
 checkRun(options);options.state('validating');
 const result=validateGeneration(raw,options.context.document,options.context.references.map(s=>s.id));
 return commitGeneration(options,result);
}