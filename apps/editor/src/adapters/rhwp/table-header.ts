import {TableHeaderDialog} from '../browser/table-header-dialog.ts';
import {readAgentTableHeaderSources,executeAgentTableHeader} from './agent-table-header.ts';
import {readStructure} from './structure.ts';
import {preflightDocumentEdit} from './edit-preflight.ts';
import type {Snapshot,AgentTableHeaderOp} from '../../modules/document/public/index.ts';
export function installTableHeader(registry:any,input:()=>any,eventBus:any):void {
 const safe=(c:any)=>{const ih=input();return !!ih&&c.hasDocument&&c.isEditable&&!c.isFormMode&&(c.inTableObjectSelection||c.inCellSelectionMode)&&!ih.isComposing&&!ih.wasm.requiresPasswordForSave&&!ih.cursor.isInHeaderFooter()&&!ih.cursor.isInFootnote()&&!ih.cursor.isInTextBox();};
 const selected=()=>{const ih=input(),block=ih.cursor.isInCellSelectionMode()?ih.cursor.captureCellSelection():null;return block?{sec:block.sec,ppi:block.ppi,ci:block.ci,block}:ih.getSelectedTableRef();};
 const target=()=>{const ref=selected();if(!ref||ref.cellPath?.length)throw new Error('본문의 단순 표 개체나 셀 블록을 선택하세요.');const structure=readStructure(input().wasm),t=structure.tables.find(t=>t.section===ref.sec&&t.paragraph===ref.ppi&&t.control===ref.ci),cap=t&&readAgentTableHeaderSources(input().wasm,structure.tables)?.[t.id];if(!t||cap?.editable!==true)throw new Error(cap?.reason??'제목 행을 편집할 수 없는 표입니다.');return {ref,t,cap};};
 registry.register({id:'table:title-row-repeat',label:'제목 행·반복',opensDialog:true,canExecute:(c:any)=>{if(!safe(c))return false;try{target();return true;}catch{return false;}},execute:()=>{
  const api=(window as any).jueonyEditor,base=api.snapshot() as Snapshot,{ref,t,cap}=target(),selection=structuredClone(ref);
  const check=()=>{if(api.busy()||api.revision()!==base.revision||!safe((window as any).rhwpStudio.automation.getContext())||JSON.stringify(selected())!==JSON.stringify(selection))throw new Error('문서나 표 선택이 바뀌었습니다. 창을 다시 여세요.');};
  const initial:AgentTableHeaderOp={kind:'set_table_header',target:t.id,headerRows:cap.headerRows!,repeatHeader:cap.repeatHeader!,paginationMode:cap.mode!};
  new TableHeaderDialog(initial,t.rows,op=>{check();preflightDocumentEdit(input().wasm,copy=>executeAgentTableHeader(copy,base,op));check();const ih=input();ih.executeOperation({kind:'snapshot',operationType:'jueonyTableHeader',operation:(wasm:any)=>{executeAgentTableHeader(wasm,base,op);return {sectionIndex:t.section,paragraphIndex:t.paragraph,charOffset:0};}});
   if(selection.block){ih.cursor.restoreCellSelection(selection.block);ih.updateCellSelection();ih.caret.hide();}else{ih.cursor.enterTableObjectSelectionDirect(selection.sec,selection.ppi,selection.ci);ih.updateCaret();eventBus.emit('table-object-selection-changed',true);}ih.focus();eventBus.emit('command-state-changed');
  }).show();
 }});
 const anchor=document.querySelector('.md-item[data-cmd="table:create"]');if(anchor){const item=document.createElement('div');item.className='md-item';item.dataset.cmd='table:title-row-repeat';const label=document.createElement('span');label.className='md-label';label.textContent='제목 행·반복';item.append(label);anchor.after(item);}
}
