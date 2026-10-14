import {readRowHeightSources,assertRowHeightResult} from './row-heights.ts';
import {readEqualColumnSources} from './equal-columns.ts';
import {readCellPaddingSources} from './cell-padding.ts';
import {readAgentTableHeaderSources} from './agent-table-header.ts';
import {readAgentTablePaginationSources} from './agent-table-pagination.ts';
import {readAgentStyleNextSources} from './agent-style-next.ts';
import {readAgentStyleRenameSources} from './agent-style-rename.ts';
import {readAgentStyleCreationSources} from './agent-style-create.ts';
import {readAgentParagraphOutlineSources} from './agent-paragraph-outline.ts';
import {readAgentParagraphLists} from './agent-paragraph-list.ts';
import {readAgentParagraphDecorationSources} from './agent-paragraph-decoration.ts';
import {readAgentParagraphTabSources} from './agent-paragraph-tabs.ts';
import {recoveryBytes} from '../files/recovery-export.ts';
import {captureFileConnection, restoreFileConnection} from '../files/file-connection.ts';
import type {StoredFileConnection} from '../files/file-connection.ts';
import { rememberFileSnapshot } from '../files/save-runtime.ts';
import { collectTargetEvidence } from '../../../document-agent/controller';
import { assertRevision } from '../../modules/document/public/index.ts';
import { createDocumentFacades } from '../../modules/document/public/index.ts';
import { executeDocumentOperations } from './execute.ts';
import { readStructure } from './structure.ts';
import {verifyPreservedExport} from './preservation.ts';
import {readNativeFormattingState} from './formatting-toolbar.ts';
import { plainSnapshot } from '../../modules/document/public/index.ts';
import type { Snapshot, Receipt, EditProposal as Generation } from '../../modules/document/public/index.ts';
type Deps={wasm:any;eventBus:any;documentState:any;ready:Promise<unknown>;load:(bytes:Uint8Array,name:string,handle:any)=>Promise<void>;input:()=>any;render:()=>Promise<void>;automation:any;refreshMenus:()=>Promise<void>;};
export function installAgentBridge(d:Deps){
 const api=(window as any).jueonyEditor;let applying=false,composing=false,damaged=false;
 const applied=new Map<string,Receipt>();
 document.addEventListener('compositionstart',()=>composing=true,true);document.addEventListener('compositionend',()=>composing=false,true);
 const revision=()=>api.revision() as string;
 const textOf=(doc:any)=>{const value=JSON.parse(doc.getTextFileUnicode());return typeof value==='string'?value:typeof value.text==='string'?value.text:JSON.stringify(value);};
 function snapshot():Snapshot{
  if(applying||damaged||api.busy()||composing)throw new Error('문서 작업 또는 한글 조합이 끝난 뒤 다시 요청해 주세요.');
  d.input()?.flushDeferredPaginationIfNeeded('jueony-context');
  const before=revision();const nodes:Snapshot['nodes']=[];const controls=d.wasm.getControls();let flatParagraph=0;
  for(let section=0;section<d.wasm.getSectionCount();section++)for(let paragraph=0;paragraph<d.wasm.getParagraphCount(section);paragraph++){
   const length=d.wasm.getParagraphLength(section,paragraph),text=d.wasm.getTextRange(section,paragraph,0,length);let editable=true,reason='';
   try{
    // Section/column definitions are document metadata, not editable inline objects.
    // Only relax the inline-control guard when the entire document's controls
    // are these two known metadata types. Field/mixed-format guards stay intact.
    const localControls=controls.filter((c:any)=>c.list===0&&c.para===flatParagraph);
    const reader=localControls.length&&localControls.every((c:any)=>c.ctrlId==='secd'||c.ctrlId==='cold')
      ?Object.assign(Object.create(d.wasm),{getControlTextPositions:()=>[]}):d.wasm;
    collectTargetEvidence(reader,{kind:'body_paragraph',section,paragraph,charOffset:0,length});}catch(e){editable=false;reason=e instanceof Error?e.message:'지원하지 않는 문단';}
   nodes.push({id:`s${section}p${paragraph}`,section,paragraph,text,editable,...(!editable?{reason}:{})});
   flatParagraph++;
  }
  const plainText=textOf(d.wasm.borrowDocumentHandle());assertRevision(before,revision());
  if(plainText.length>120000)throw new Error('전체 문서 텍스트 한도 120,000자를 넘습니다.');
  const structure=readStructure(d.wasm);assertRevision(before,revision());
  const paragraphTabSources=readAgentParagraphTabSources(d.wasm,nodes),paragraphDecorationSources=readAgentParagraphDecorationSources(d.wasm,nodes);assertRevision(before,revision());
  const lists=readAgentParagraphLists(d.wasm,nodes),outlines=readAgentParagraphOutlineSources(d.wasm,nodes,lists.listCatalog);assertRevision(before,revision());
  return {revision:before,name:d.wasm.fileName,nodes,plainText,structure,rowHeightSources:readRowHeightSources(d.wasm,structure.tables,d.wasm.fileName),equalColumnSources:readEqualColumnSources(d.wasm,structure.tables,d.wasm.fileName),cellPaddingSources:readCellPaddingSources(d.wasm,structure.tables,d.wasm.fileName),tablePaginationSources:readAgentTablePaginationSources(d.wasm,structure.tables),tableHeaderSources:readAgentTableHeaderSources(d.wasm,structure.tables),...lists,...outlines,...readAgentStyleCreationSources(d.wasm),...readAgentStyleRenameSources(d.wasm),...readAgentStyleNextSources(d.wasm),...(paragraphTabSources?{paragraphTabSources}:{}),...(paragraphDecorationSources?{paragraphDecorationSources}:{}),limitations:['본문·표의 텍스트와 서식·쪽 설정을 읽습니다. 그림 안 글자/OCR은 읽지 않습니다.','AI 편집: 보호 셀/표는 내용·서식·행/열 변경을 거절합니다. 본문 단순 표 쪽 나눔 none/cell/row(단독 요청, 맨 위 연속 제목 행 수 지정/해제·반복과 쪽 나눔 설정은 단독 요청 지원; 부분/흩어진 제목 원본은 보호), 단순 본문, 글꼴·글자·문단 서식, 새 표·단순 셀·셀 서식·행/열 추가와 삭제, HWPX 본문 단순 표 전체 행에 걸친 두 열 이상 너비 같게(단독 요청, 총너비 유지)·단일 단 구역의 전체 행 열 너비 mm 직접 지정(단독 요청, 본문 폭 이내; 행 높이 같게/직접 지정은 HWPX 한 쪽 단순 표의 전체 행·단독 요청 지원, 내용 최소 높이 초과 시 거절), HWPX 원본의 기존 본문 단순 표 셀 안 여백 네 방향 직접 지정/표 기본값 복귀(단독 요청), 일반 본문 구역 나누기·합치기·검증된 빈 본문 구역 삭제·기존 단순 머리말/꼬리말 텍스트·기본 글자 서식·정렬/백분율 줄 간격 수정·일반 문서의 새 정의 생성/기존 정의 삭제(각 단독 요청), 일반 본문 점 책갈피 추가·이름 변경·삭제(단독 요청), 저장 문단 스타일의 모양을 공유하는 새 이름 정의 생성(단독 요청, 본문 적용은 후속 요청)·기존 문단 스타일 이름/다음 문단 스타일 변경(필드 문서·바탕글/글자/잠금/비정규 원본 제외, 단독 요청), 저장된 구역 개요 모양의 본문 수준 지정·해제(다른 문단 전용 묶음), 새 기본 숫자 번호 3종·7수준·시작 값 생성(단독 요청), 조회된 기본 번호 모양 복제·지정 수준 시작 값·새 목록 적용(단독 요청, 원본 모양 보존 가능 시), 기본 문자 글머리표 8종 새 정의 생성·적용(단독 요청), 현재 문서에 저장된 문단 번호·글머리표 정의 적용/번호 7수준/해제(전용 묶음), 일반 본문 문단 기본 테두리/단색 배경·간격·연결/여백 무시, 일반 본문 문단별 사용자 탭 32개·양 끝 자동 탭(다른 문단 탭끼리 최대 30명령), 구역별 용지·여백·다단·기본 탭, HWPX 기본 본문 줄 번호·기본 단색 쪽 배경·기본 텍스트 바탕쪽, 기존 문단 스타일, 쪽 감추기. 줄 번호는 현재 구역의 editable과 파일 형식을 확인합니다. 병합/중첩 표, 개체·필드 편집은 아직 미지원입니다.']} as Snapshot;
 }
 const native = {
  snapshot,
  toolbarsVisible:()=>document.documentElement.dataset.toolboxBasic!=='hidden',
  formattingState:()=>readNativeFormattingState(d.wasm,d.input(),d.automation.getContext(),api),
  commands:()=>d.automation.listCommands(),
  prepareMenus:()=>d.refreshMenus(),
  menus:()=>{
   const model=d.automation.getMenuModel();
   const ids=Array.from(document.querySelectorAll<HTMLElement>('#recent-docs-panel [data-cmd="file:open-recent"]')).map(el=>el.dataset.id);let recent=0;
   const visit=(nodes:any[])=>{for(const node of nodes){if(node.commandId==='file:open-recent'){const id=ids[recent++];node.params=id?{id}:undefined;node.enabled=node.enabled&&Boolean(id);}if(node.submenu)visit(node.submenu);}};
   for(const menu of model)visit(menu.items);
   const pageMenu=model.find((menu:any)=>menu.menuId==='page');
   if(pageMenu&&!pageMenu.items.some((item:any)=>item.commandId==='page:header-footer-dialog'))pageMenu.items.unshift({label:'머리말/꼬리말',commandId:'page:header-footer-dialog',enabled:d.automation.isEnabled('page:header-footer-dialog')});
   if(pageMenu&&!pageMenu.items.some((item:any)=>item.commandId==='page:section-break'))pageMenu.items.push({label:'구역 나누기',commandId:'page:section-break',shortcut:'Alt+Shift+Enter',enabled:d.automation.isEnabled('page:section-break')});
   const fileMenu=model.find((menu:any)=>menu.menuId==='file');
   if(fileMenu&&!fileMenu.items.some((item:any)=>item.commandId==='file:document-info'))fileMenu.items.push({label:'문서 정보',commandId:'file:document-info',enabled:d.automation.isEnabled('file:document-info')});
   return model;
  },
  focusEditor:()=>d.input()?.focus(),
  executeCommand(id:string,params?:Record<string,unknown>){
   if(applying||damaged||api.busy()||composing)throw new Error('문서 작업 또는 한글 조합이 끝난 뒤 실행해 주세요.');
   d.input()?.focus();
   if(id==='file:open-recent'&&typeof params?.id!=='string')return {ok:false,message:'최근 문서 식별자가 없습니다. 파일 메뉴를 다시 열어 주세요.'};
   return d.automation.execute(id,params,{allowDialog:true});
  },
  async preflight(base:Snapshot,generation:Generation){
   if(applying||damaged||api.busy()||composing)throw new Error('문서 작업이 끝난 뒤 다시 요청해 주세요.');
   assertRevision(base.revision,revision());
   const validated=generation;
   const {HwpDocument}=d.wasm.getWasmModuleExports();
   const creating=validated.operations[0]?.kind==='create_document';
   let copy=creating?HwpDocument.createEmpty():new HwpDocument(recoveryBytes(d.wasm,d.wasm.fileName));
   try{
    if(creating){
     copy.createBlankDocument();
     // Establish the same file-format defaults as a freshly opened document.
     // HWPX normalizes unused background metadata on its first serialization.
     const initial=d.wasm.fileName.toLowerCase().endsWith('.hwpx')?copy.exportHwpxWithReport():copy.exportHwpWithReport();
     try{
      if(JSON.parse(initial.contentLoss()).count!==0)throw new Error('새 문서 사전 검사 초기화 중 손실이 보고되었습니다.');
      const initialized=new HwpDocument(initial.takeBytes());copy.free();copy=initialized;
     }finally{initial.free();}
    }
    if(!creating){
     const text:string[]=[];for(let s=0;s<copy.getSectionCount();s++)for(let p=0;p<copy.getParagraphCount(s);p++)text.push(copy.getTextRange(s,p,0,copy.getParagraphLength(s,p)));
     if(text.join('\n')!==plainSnapshot(base))throw new Error('사전 검사용 사본이 원문과 다릅니다. 문서에 적용하지 않았습니다.');
    }
    executeDocumentOperations(copy,base,validated.operations);
    const artifact=d.wasm.fileName.toLowerCase().endsWith('.hwpx')?copy.exportHwpxWithReport():copy.exportHwpWithReport();
    try{
     const loss=JSON.parse(artifact.contentLoss());if(loss.count!==0)throw new Error('편집 결과 저장 시 내용 손실이 보고되어 문서에 적용하지 않았습니다.');
     const bytes=artifact.takeBytes();
     verifyPreservedExport(copy,bytes,d.wasm.fileName.toLowerCase().endsWith('.hwpx')?'hwpx':'hwp',loss,bytes=>new HwpDocument(bytes));
     // The preservation verifier compares resolved semantics, including text/runs/tables.
     // Raw reader JSON differs for HWPX metadata control ordering and cached storage IDs.
    }
    finally{artifact.free();}
   }finally{copy.free();}
   assertRevision(base.revision,revision());
  },
  documentIdentity:()=>String(d.wasm.documentGeneration)+':'+d.wasm.fileName,
  async open(bytes:Uint8Array,name:string,handle:any=null,dirty=false){await d.ready;if(api.busy()||applying)throw new Error('문서 작업 중입니다.');await d.load(bytes,name,handle);if(handle)await rememberFileSnapshot(handle,bytes);if(dirty)d.documentState.markDirty('workspace-recovery');},
  async restoreFileConnection(connection:StoredFileConnection,requestPermission=false){
   if(applying||composing||api.busy())throw new Error('문서 작업이 끝난 뒤 원본 파일에 연결해 주세요.');
   const generation=d.wasm.documentGeneration,name=d.wasm.fileName;
   if(connection?.handle?.name!==name)return {status:'unavailable',message:'현재 문서와 원본 파일 이름이 다릅니다. 복구 내용은 유지하며 다른 이름으로 저장해 주세요.'};
   const result=await restoreFileConnection(connection,{requestPermission});
   if(generation!==d.wasm.documentGeneration||name!==d.wasm.fileName)throw new Error('원본 연결을 확인하는 동안 다른 문서가 열렸습니다. 다시 연결해 주세요.');
   if(result.status==='connected')d.wasm.currentFileHandle=result.handle;
   return result;
  },
  recovery(){if(applying||composing||api.busy())return null;d.input()?.flushDeferredPaginationIfNeeded('jueony-recovery');return {name:d.wasm.fileName,dirty:d.documentState.isDirty(),fileConnection:captureFileConnection(d.wasm.currentFileHandle),bytes:recoveryBytes(d.wasm,d.wasm.fileName)};},
  async readReference(bytes:Uint8Array){await d.ready;const {HwpDocument}=d.wasm.getWasmModuleExports();const doc=new HwpDocument(bytes);try{return textOf(doc);}finally{doc.free();}},
  async apply(runId:string,base:Snapshot,generation:Generation):Promise<Receipt>{
   if(applied.has(runId))throw new Error('이미 적용한 요청입니다.');
   if(applying||damaged||composing||api.busy())throw new Error('문서 작업 또는 한글 조합 중입니다.');
   assertRevision(base.revision,revision());
   const validated=generation;
   if(!validated.operations.length)throw new Error('적용할 명령이 없습니다.');
   await api.preflight(base,validated);assertRevision(base.revision,revision());
   if(applying||damaged||api.busy()||composing)throw new Error('검사 중 다른 문서 작업이 시작되어 적용하지 않았습니다.');
   const before=plainSnapshot(base),beforeBytes=recoveryBytes(d.wasm,d.wasm.fileName);let executed=false;
   applying=true;const root=document.getElementById('studio-root')!;const inert=root.inert;root.inert=true;
   const overlay=Object.assign(document.createElement('div'),{id:'jueony-busy',textContent:'AI 변경을 문서에 적용하고 있습니다…'});document.body.append(overlay);
   try{
    const input=d.input();if(!input)throw new Error('편집기가 준비되지 않았습니다.');
    let afterStructure:Snapshot['structure'],renderAttempt=0;
    await input.executeDocumentAgentOperation({kind:'snapshot',operationType:'jueony:'+runId,operation:(wasm:any)=>{
     assertRevision(base.revision,revision());executed=true;return executeDocumentOperations(wasm,base,validated.operations)??(validated.operations.length===1&&(['create_paragraph_style','rename_paragraph_style','set_next_paragraph_style','set_table_pagination','set_table_header'].includes(validated.operations[0].kind)||(validated.operations[0].kind==='format_table_cells'&&(Object.hasOwn(validated.operations[0].properties,'equalizeColumns')||Object.hasOwn(validated.operations[0].properties,'columnWidthMm')||Object.hasOwn(validated.operations[0].properties,'equalizeRows')||Object.hasOwn(validated.operations[0].properties,'rowHeightMm'))))?input.getCursorPosition():{sectionIndex:0,paragraphIndex:0,charOffset:0});
    }},async()=>{
     // InputHandler invokes this callback again after restoring a failed transaction.
     // Only the first render describes the proposed mutation; recovery renders the original.
     const verifyMutation=renderAttempt++===0;await d.render();if(!verifyMutation)return;
     afterStructure=readStructure(d.wasm);for(const op of validated.operations)if(op.kind==='format_table_cells'&&(Object.hasOwn(op.properties,'equalizeRows')||Object.hasOwn(op.properties,'rowHeightMm')))assertRowHeightResult(d.wasm,base,op);});
    const afterRevision=revision();applying=false;
    // snapshot requires the busy gate to be removed; read the body directly while still gated.
    const after:string[]=[];for(let s=0;s<d.wasm.getSectionCount();s++)for(let p=0;p<d.wasm.getParagraphCount(s);p++)after.push(d.wasm.getTextRange(s,p,0,d.wasm.getParagraphLength(s,p)));
    const receipt={runId,beforeRevision:base.revision,afterRevision,before,after:after.join('\n'),beforeStructure:base.structure,afterStructure,operationCount:validated.operations.length};applied.set(runId,receipt);return receipt;
   }catch(error){
    const e=error instanceof Error?error:new Error(typeof error==='string'?error:'문서 적용 실패');
    const body:string[]=[];try{for(let s=0;s<d.wasm.getSectionCount();s++)for(let p=0;p<d.wasm.getParagraphCount(s);p++)body.push(d.wasm.getTextRange(s,p,0,d.wasm.getParagraphLength(s,p)));}catch{}
    let restored=false;try{const afterBytes=recoveryBytes(d.wasm,d.wasm.fileName);restored=body.join('\n')===before&&beforeBytes.length===afterBytes.length&&beforeBytes.every((b:number,i:number)=>b===afterBytes[i]);}catch{}
    e.name=restored?(executed?'RolledBackError':'ApplyError'):'PartialApplyError';damaged=!restored;
    if(damaged)d.documentState.markDirty('jueony-partial');throw e;
   }finally{applying=false;root.inert=inert;overlay.remove();}
  },
  async undoRequest(receipt:Receipt){
   if(applying||api.busy()||composing)throw new Error('다른 작업 중입니다.');
   assertRevision(receipt.afterRevision,revision());const input=d.input();
   if(input?.history?.peekUndoTop()?.type!=='snapshot:jueony:'+receipt.runId)throw new Error('요청 이후 편집 이력이 달라져 이 요청만 되돌릴 수 없습니다.');
   const result=d.automation.execute('edit:undo');if(!result.ok)throw new Error('되돌리기 실패');
   await d.render();const restored=snapshot();if(plainSnapshot(restored)!==receipt.before||receipt.beforeStructure&&JSON.stringify(restored.structure)!==JSON.stringify(receipt.beforeStructure))throw new Error('되돌림 결과를 확인하지 못했습니다.');
   // Keep the request ID consumed after undo; replay must use a new run ID.
  },
 };
 const facades=createDocumentFacades({readSnapshot:native.snapshot,preflight:native.preflight,apply:native.apply,undoRequest:native.undoRequest});
 Object.assign(api,native,{documentFacades:facades,preflight:facades.edit.preflight,apply:facades.edit.apply,undoRequest:facades.edit.undoRequest});
}
