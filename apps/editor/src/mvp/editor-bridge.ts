import { collectTargetEvidence } from '../../document-agent/controller';
import { assertRevision, executeBodyOperations, validateGeneration } from './edit-schema.ts';
import { plainSnapshot } from './model.ts';
import type { Snapshot, Receipt, Generation } from './model.ts';
type Deps={wasm:any;eventBus:any;documentState:any;ready:Promise<unknown>;load:(bytes:Uint8Array,name:string,handle:any)=>Promise<void>;input:()=>any;render:()=>Promise<void>;automation:any;};
export function installAgentBridge(d:Deps){
 const api=(window as any).jueonyEditor;let applying=false,composing=false,damaged=false;
 const applied=new Map<string,Receipt>();
 document.addEventListener('compositionstart',()=>composing=true,true);document.addEventListener('compositionend',()=>composing=false,true);
 const revision=()=>api.revision() as string;
 const textOf=(doc:any)=>{const value=JSON.parse(doc.getTextFileUnicode());return typeof value==='string'?value:typeof value.text==='string'?value.text:JSON.stringify(value);};
 function snapshot():Snapshot{
  if(applying||damaged||api.busy()||composing)throw new Error('문서 작업 또는 한글 조합이 끝난 뒤 다시 요청해 주세요.');
  d.input()?.flushDeferredPaginationIfNeeded('jueony-context');
  const before=revision();const nodes:Snapshot['nodes']=[];
  for(let section=0;section<d.wasm.getSectionCount();section++)for(let paragraph=0;paragraph<d.wasm.getParagraphCount(section);paragraph++){
   const length=d.wasm.getParagraphLength(section,paragraph),text=d.wasm.getTextRange(section,paragraph,0,length);let editable=true,reason='';
   try{
    // Section/column definitions are document metadata, not editable inline objects.
    // Only relax the inline-control guard when the entire document's controls
    // are these two known metadata types. Field/mixed-format guards stay intact.
    const controls=d.wasm.getControls();
    const reader=controls.length&&controls.every((c:any)=>c.ctrlId==='secd'||c.ctrlId==='cold')
      ?Object.assign(Object.create(d.wasm),{getControlTextPositions:()=>[]}):d.wasm;
    collectTargetEvidence(reader,{kind:'body_paragraph',section,paragraph,charOffset:0,length});}catch(e){editable=false;reason=e instanceof Error?e.message:'지원하지 않는 문단';}
   nodes.push({id:`s${section}p${paragraph}`,section,paragraph,text,editable,...(!editable?{reason}:{})});
  }
  const plainText=textOf(d.wasm.borrowDocumentHandle());assertRevision(before,revision());
  if(plainText.length>120000)throw new Error('전체 문서 텍스트 한도 120,000자를 넘습니다.');
  return {revision:before,name:d.wasm.fileName,nodes,plainText,limitations:['본문 전체와 엔진의 Unicode 추출문을 읽습니다. 그림 안 글자/OCR은 읽지 않습니다.','AI 편집: 단순 본문 문단만 지원. 표·개체·필드·혼합 서식·4,000자 초과 문단은 직접 편집해 주세요.']} as Snapshot;
 }
 Object.assign(api,{
  snapshot,
  async open(bytes:Uint8Array,name:string,handle:any=null,dirty=false){await d.ready;if(api.busy()||applying)throw new Error('문서 작업 중입니다.');await d.load(bytes,name,handle);if(dirty)d.documentState.markDirty('workspace-recovery');},
  recovery(){if(applying||composing||api.busy())return null;d.input()?.flushDeferredPaginationIfNeeded('jueony-recovery');return {name:d.wasm.fileName,dirty:d.documentState.isDirty(),bytes:d.wasm.fileName.toLowerCase().endsWith('.hwpx')?d.wasm.exportHwpx():d.wasm.exportHwp()};},
  async readReference(bytes:Uint8Array){await d.ready;const {HwpDocument}=d.wasm.getWasmModuleExports();const doc=new HwpDocument(bytes);try{return textOf(doc);}finally{doc.free();}},
  async apply(runId:string,base:Snapshot,generation:Generation):Promise<Receipt>{
   if(applied.has(runId))throw new Error('이미 적용한 요청입니다.');
   if(applying||damaged||composing||api.busy())throw new Error('문서 작업 또는 한글 조합 중입니다.');
   assertRevision(base.revision,revision());
   const validated=validateGeneration(generation,base,generation.sourceIds);
   if(!validated.operations.length)throw new Error('적용할 명령이 없습니다.');
   const before=plainSnapshot(base),beforeBytes=d.wasm.exportHwp();let executed=false;
   applying=true;const root=document.getElementById('studio-root')!;const inert=root.inert;root.inert=true;
   const overlay=Object.assign(document.createElement('div'),{id:'jueony-busy',textContent:'AI 변경을 문서에 적용하고 있습니다…'});document.body.append(overlay);
   try{
    const input=d.input();if(!input)throw new Error('편집기가 준비되지 않았습니다.');
    await input.executeDocumentAgentOperation({kind:'snapshot',operationType:'jueony:'+runId,operation:(wasm:any)=>{
     assertRevision(base.revision,revision());executed=true;executeBodyOperations(wasm,base,validated.operations);return {sectionIndex:0,paragraphIndex:0,charOffset:0};
    }},d.render);
    const afterRevision=revision();applying=false;
    // snapshot requires the busy gate to be removed; read the body directly while still gated.
    const after:string[]=[];for(let s=0;s<d.wasm.getSectionCount();s++)for(let p=0;p<d.wasm.getParagraphCount(s);p++)after.push(d.wasm.getTextRange(s,p,0,d.wasm.getParagraphLength(s,p)));
    const receipt={runId,beforeRevision:base.revision,afterRevision,before,after:after.join('\n'),operationCount:validated.operations.length};applied.set(runId,receipt);return receipt;
   }catch(error){
    const e=error instanceof Error?error:new Error('문서 적용 실패');
    const body:string[]=[];try{for(let s=0;s<d.wasm.getSectionCount();s++)for(let p=0;p<d.wasm.getParagraphCount(s);p++)body.push(d.wasm.getTextRange(s,p,0,d.wasm.getParagraphLength(s,p)));}catch{}
    let restored=false;try{const afterBytes=d.wasm.exportHwp();restored=body.join('\n')===before&&beforeBytes.length===afterBytes.length&&beforeBytes.every((b:number,i:number)=>b===afterBytes[i]);}catch{}
    e.name=restored?(executed?'RolledBackError':'ApplyError'):'PartialApplyError';damaged=!restored;
    if(damaged)d.documentState.markDirty('jueony-partial');throw e;
   }finally{applying=false;root.inert=inert;overlay.remove();}
  },
  async undoRequest(receipt:Receipt){
   if(applying||api.busy()||composing)throw new Error('다른 작업 중입니다.');
   assertRevision(receipt.afterRevision,revision());const input=d.input();
   if(input?.history?.peekUndoTop()?.type!=='snapshot:jueony:'+receipt.runId)throw new Error('요청 이후 편집 이력이 달라져 이 요청만 되돌릴 수 없습니다.');
   const result=d.automation.execute('edit:undo');if(!result.ok)throw new Error('되돌리기 실패');
   await d.render();if(plainSnapshot(snapshot())!==receipt.before)throw new Error('되돌림 결과를 확인하지 못했습니다.');
   applied.delete(receipt.runId);
  },
 });
}
