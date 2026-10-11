import {validateGeneration} from '../domain/generation.ts';
import {assertRevision} from '../../document/public/index.ts';
import type {ModelGatewayPort as LLMPort,ModelInput as LLMInput,ModelConfig} from '../../connections/public/index.ts';
import type {Snapshot,Receipt} from '../../document/public/index.ts';
import type {Generation,RunStatus} from '../public/contracts.ts';
export type EditorTool={snapshot():Snapshot;apply(id:string,snapshot:Snapshot,result:Generation):Promise<Receipt>;preflight?(snapshot:Snapshot,result:Generation):Promise<void>};
export type RunOptions={runId:string;context:LLMInput;model:ModelConfig;port:LLMPort;editor:EditorTool;createDocument:()=>Promise<EditorTool>;signal:AbortSignal;isCurrent:()=>boolean;state:(s:RunStatus)=>void};
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
/** One final validated plan crosses this boundary, regardless of the model call count. */
export async function commitGeneration(options:RunOptions,result:Generation){
 checkRun(options);
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