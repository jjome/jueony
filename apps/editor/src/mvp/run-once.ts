import { validateGeneration, assertRevision } from './edit-schema.ts';
import type { LLMPort, LLMInput } from './llm.ts';
import type { ModelConfig, Snapshot, Receipt, Generation, RunStatus } from './model.ts';
export type EditorTool={snapshot():Snapshot;apply(id:string,snapshot:Snapshot,result:Generation):Promise<Receipt>};
export async function runOnce(options:{runId:string;context:LLMInput;model:ModelConfig;port:LLMPort;editor:EditorTool;createDocument:()=>Promise<EditorTool>;signal:AbortSignal;isCurrent:()=>boolean;state:(s:RunStatus)=>void}){
 const check=()=>{options.signal.throwIfAborted();if(!options.isCurrent())throw new DOMException('업무·채팅·문서가 전환되었습니다.','AbortError');};
 check();options.state('generating');
 const raw=await options.port.generate(options.context,options.model,options.signal);
 check();options.state('validating');
 assertRevision(options.context.document.revision,options.editor.snapshot().revision);
 const result=validateGeneration(raw,options.context.document,options.context.references.map(s=>s.id));
 if(!result.operations.length)return {message:result.message,receipt:undefined};
 let editor=options.editor,base=options.context.document;
 if(result.operations[0].kind==='create_document'){check();editor=await options.createDocument();base=editor.snapshot();}
 check();options.state('applying');
 const receipt=await editor.apply(options.runId,base,result);
 return {message:result.message,receipt};
}
