import {agentFileKinds,validateAgentFileOperation} from '../../document/public/index.ts';
import type {AgentFileReceipt} from '../../document/public/index.ts';
import type {AgentFilePort} from '../public/contracts.ts';
import {validateGeneration} from '../domain/generation.ts';
import {assertRevision} from '../../document/public/index.ts';
import type {ModelGatewayPort as LLMPort,ModelInput as LLMInput,ModelConfig} from '../../connections/public/index.ts';
import type {Snapshot,Receipt,Structure} from '../../document/public/index.ts';
import type {Generation,ReferenceChangeReview,RunStatus} from '../public/contracts.ts';
export type EditorTool={snapshot():Snapshot;revision?():string;apply(id:string,snapshot:Snapshot,result:Generation):Promise<Receipt>;preflight?(snapshot:Snapshot,result:Generation,includeStructure?:boolean):Promise<Structure|void>};
export type RunOptions={filePort?:AgentFilePort;runId:string;context:LLMInput;model:ModelConfig;port:LLMPort;editor:EditorTool;createDocument:()=>Promise<EditorTool>;signal:AbortSignal;isCurrent:()=>boolean;state:(s:RunStatus)=>void;
 reviewReferenceChanges?:(proposal:ReferenceChangeReview,signal:AbortSignal)=>Promise<boolean>;
 alignmentPlan?:{modelInput:LLMInput;operations:Generation['operations'];modelOperations?:Generation['operations']}};
export function checkRun(options:RunOptions){
 options.signal.throwIfAborted();
 if(!options.isCurrent())throw new DOMException('업무·채팅·문서가 전환되었습니다.','AbortError');
 assertRevision(options.context.document.revision,options.editor.revision?.()??options.editor.snapshot().revision);
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
const structuralKinds=new Set<Generation['operations'][number]['kind']>([
 'create_table','insert_table_row','insert_table_column','delete_table_row','delete_table_column','format_table_cells',
 'split_table_cell','split_table_cell_into','merge_table_cells','split_table','attach_table','set_table_header','set_table_pagination',
 'set_page_setup','set_page_border_inclusion','set_page_background','set_columns','set_section_tabs','set_line_numbers',
 'set_master_page_text','delete_master_page','split_section','merge_sections','remove_empty_section',
]);

async function requireReferenceChangeApproval(options:RunOptions,result:Generation,afterStructure?:Structure){
 if(!options.reviewReferenceChanges)throw Error('참고자료를 전달한 편집은 변경을 검토할 수 있는 화면에서 실행해 주세요.');
 const {request,document,references}=options.context;
 const targets=new Set(result.operations.flatMap(operation=>operation.kind==='attach_table'?[operation.target,operation.nextTarget]:'target' in operation?[operation.target]:[]));
 const tables=[...(document.structure?.tables??[]),...(document.structure?.nestedTables??[])];
 const proposal:ReferenceChangeReview=structuredClone({
  request,document:{name:document.name,nodes:document.nodes,fileContext:document.fileContext},
  shapeFills:Object.fromEntries(Object.entries(document.shapeFillSources??{}).filter(([id])=>targets.has(id))
   .map(([id,{section,paragraph,control,color}])=>[id,{section,paragraph,control,color}])),
  tableLocations:tables.filter(table=>targets.has(table.id)).map(table=>({
   id:table.id,section:table.section,paragraph:table.paragraph,control:table.control,
   ...('ancestors' in table?{ancestors:table.ancestors}:{}),
  })),
  referenceNames:[...new Set(references.map(source=>source.name))],
  operations:result.operations,
  ...(document.structure&&afterStructure?{verifiedStructure:{before:document.structure,after:afterStructure}}:{}),
 });
 if(await awaitRunRead(options.reviewReferenceChanges(proposal,options.signal),options.signal)!==true){
  throw new DOMException('참고자료를 읽은 요청의 변경을 취소했습니다.','AbortError');
 }
}
/** One final validated plan crosses this boundary, regardless of the model call count. */
export async function commitGeneration(options:RunOptions,result:Generation):Promise<CommitResult>{
 checkRun(options);
 if(options.alignmentPlan){
  if(result.sourceIds.length||!sameRecordedOperations(result.operations,options.alignmentPlan.operations)){
   throw Error('AI가 불러온 편집 기록과 다른 편집을 제안했습니다. 문서를 그대로 두었습니다.');
  }
 }
 let preflighted=false;
 if(options.context.references.length&&result.operations.some(operation=>operation.kind!=='list_document_tabs')){
  result=structuredClone(result);
  let preview:Structure|void=undefined;
  if(options.reviewReferenceChanges&&options.editor.preflight&&options.context.document.structure&&result.operations.some(operation=>structuralKinds.has(operation.kind))){
   preview=await awaitRunRead(options.editor.preflight(options.context.document,result,true),options.signal);
   checkRun(options);
   preflighted=true;
  }
  await requireReferenceChangeApproval(options,result,preview||undefined);
  checkRun(options);
 }
 if(result.operations.length===1&&(agentFileKinds as readonly string[]).includes(result.operations[0].kind)){
  if(!options.filePort||!options.context.document.fileContext)throw Error('현재 창에는 Agent 문서 탭 제어가 연결되지 않았습니다.');
  const expected=options.context.document.fileContext,operation=validateAgentFileOperation(result.operations[0],expected);options.state('applying');
  const fileReceipt=await options.filePort.execute(options.runId,operation,expected,options.signal);
  if(!fileReceipt||fileReceipt.runId!==options.runId||fileReceipt.kind!==operation.kind||fileReceipt.status!=='completed'||fileReceipt.beforeStamp!==expected.stamp||fileReceipt.operationCount!==1||fileReceipt.documentMutations!==0){const error=Error('파일 명령의 실제 완료 증거가 일치하지 않습니다. 현재 탭 상태를 확인하세요.');if(operation.kind!=='list_document_tabs')error.name='PartialApplyError';throw error;}
  if(operation.kind==='save_active_document'&&(!fileReceipt.save||fileReceipt.save.status!=='saved'||fileReceipt.save.tabId!==expected.activeTabId||fileReceipt.save.beforeRevision!==options.context.document.revision||fileReceipt.save.afterRevision!==options.editor.snapshot().revision)){const error=Error('활성 문서의 실제 저장 완료 증거가 일치하지 않습니다.');error.name='PartialApplyError';throw error;}
  return{message:result.message,sourceIds:result.sourceIds,receipt:undefined,fileReceipt,generation:result};
 }
 if(!result.operations.length)return {message:result.message,sourceIds:result.sourceIds,receipt:undefined,generation:result};
 if(!preflighted&&options.editor.preflight){await awaitRunRead(options.editor.preflight(options.context.document,result),options.signal);checkRun(options);}
 let editor=options.editor,base=options.context.document;
 if(result.operations[0].kind==='create_document'){editor=await options.createDocument();base=editor.snapshot();}
 checkRun(options);options.state('applying');
 const receipt=await editor.apply(options.runId,base,result);
 return {message:result.message,sourceIds:result.sourceIds,receipt,generation:result};
}

function recordedOperation(value:unknown):unknown[]|null {
 if(!value||typeof value!=='object'||Array.isArray(value))return null;
 const op=value as Record<string,unknown>;
 if(typeof op.target!=='string')return null;
 const keys=Object.keys(op).sort().join(',');
 if(op.kind==='format_paragraph'&&keys==='kind,properties,target'&&op.properties&&typeof op.properties==='object'){
  const properties=op.properties as Record<string,unknown>;
  return Object.keys(properties).join(',')==='alignment'&&typeof properties.alignment==='string'
   ?[op.kind,op.target,properties.alignment]:null;
 }
 if(!Number.isSafeInteger(op.start)||!Number.isSafeInteger(op.count))return null;
 if(op.kind==='delete_body_text'&&keys==='count,kind,start,target')return [op.kind,op.target,op.start,op.count];
 if(op.kind==='replace_body_text'&&keys==='count,kind,start,target,text'&&typeof op.text==='string'){
  return [op.kind,op.target,op.start,op.count,op.text];
 }
 return null;
}

function sameRecordedOperations(value:unknown,expected:Generation['operations']):boolean {
 if(!Array.isArray(value)||!expected.length||value.length!==expected.length)return false;
 const approved=expected.map(recordedOperation);
 return approved.every(Boolean)&&JSON.stringify(value.map(recordedOperation))===JSON.stringify(approved);
}

export async function runOnce(options:RunOptions){
 checkRun(options);options.state('generating');
 const raw=await awaitRunRead(options.port.generate(options.alignmentPlan?.modelInput??options.context,options.model,options.signal),options.signal);
 checkRun(options);options.state('validating');
 let proposal=raw;
 const plan=options.alignmentPlan;
 if(plan?.modelOperations){
  const echo=raw as Record<string,unknown>|null;
  if(!echo||!Array.isArray(echo.sourceIds)||echo.sourceIds.length||!sameRecordedOperations(echo.operations,plan.modelOperations)){
   throw Error('AI가 불러온 편집 기록과 다른 편집을 제안했습니다. 문서를 그대로 두었습니다.');
  }
  proposal={...echo,operations:plan.operations};
 }
 const result=validateGeneration(proposal,options.context.document,options.context.references.map(s=>s.id));
 return commitGeneration(options,result);
}
