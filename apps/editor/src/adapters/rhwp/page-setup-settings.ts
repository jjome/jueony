import {pageSetupKeys,pageDimensionFromInput,validatePageSetup,samePageSetup} from '../../modules/document/public/index.ts';
import type {PageSetupSettings} from '../../modules/document/public/index.ts';
import {preflightDocumentEdit} from './edit-preflight.ts';
const parse=(value:any)=>typeof value==='string'?JSON.parse(value):value,handle=(wasm:any)=>wasm.borrowDocumentHandle?.()??wasm.doc??wasm;
const presets:Record<string,[number,number]>={A4:[59528,84188],A3:[84188,119055],B4:[72850,103040],B5:[51502,72850],Letter:[62208,80496],Legal:[62208,102816]};
export function collectPageSetup(dialog:any):PageSetupSettings {
 const base=dialog.pageDef as PageSetupSettings,landscape=dialog.landscapeRadios[1].checked,preset=dialog.jueonyPaperChanged&&dialog.paperSelect.value!=='custom'?presets[dialog.paperSelect.value]:undefined;
 const width=preset?.[0]??base.width,height=preset?.[1]??base.height;
 let w=pageDimensionFromInput(landscape?height:width,dialog.widthInput.value),h=pageDimensionFromInput(landscape?width:height,dialog.heightInput.value);if(landscape)[w,h]=[h,w];
 return validatePageSetup({...base,width:w,height:h,landscape,binding:Number(dialog.bindingRadios.find((r:HTMLInputElement)=>r.checked)?.value),...Object.fromEntries(pageSetupKeys.filter(key=>key.startsWith('margin')).map(key=>[key,pageDimensionFromInput(Number(base[key]),dialog.marginInputs[key].value)]))});
}
type Edit={section:number;before:PageSetupSettings;after:PageSetupSettings};
export function planPageSetupEdits(wasm:any,section:number,value:PageSetupSettings,scope:string):Edit[]{
 const doc=handle(wasm),count=doc.getSectionCount(),next=validatePageSetup(value);
 if(!Number.isInteger(count)||count<1||count>100||!Number.isInteger(section)||section<0||section>=count||!['current','all'].includes(scope))throw new Error('편집 용지의 구역·적용 범위를 확인하세요.');
 return (scope==='all'?Array.from({length:count},(_,i)=>i):[section]).map(index=>({section:index,before:parse(doc.getPageDef(index)),after:next})).filter(edit=>!samePageSetup(edit.before,edit.after));
}
export function executePageSetupEdits(wasm:any,edits:Edit[]):void {
 const doc=handle(wasm);for(const edit of edits)if(!samePageSetup(parse(doc.getPageDef(edit.section)),edit.before))throw new Error('편집 용지가 바뀌었습니다. 창을 다시 여세요.');
 for(const edit of edits)if(parse(doc.setPageDef(edit.section,JSON.stringify(edit.after)))?.ok!==true)throw new Error('편집 용지를 적용하지 못했습니다.');
 for(const edit of edits)if(!samePageSetup(parse(doc.getPageDef(edit.section)),edit.after))throw new Error('편집 용지 적용 결과가 다릅니다.');
}
export function pageSetupNewSectionAllowed(dialog:any):boolean {
 const ih=dialog.services?.getInputHandler(),c=ih?.cursor,p=dialog.jueonyPosition;
 return !!c&&p?.parentParaIndex===undefined&&!p?.cellPath?.length&&typeof handle(dialog.wasm).insertSectionBreak==='function'&&!c.hasSelection()&&!c.isInHeaderFooter()&&!c.isInFootnote()&&!c.isInTextBox()&&!c.isInCellSelectionMode()&&!c.isInTableObjectSelection()&&!c.isInPictureObjectSelection();
}
export function executeNewSectionPageSetup(wasm:any,position:any,next:PageSetupSettings):any {
 const doc=handle(wasm),count=doc.getSectionCount();if(count>=100||!position||position.parentParaIndex!==undefined||position.cellPath?.length||![position.sectionIndex,position.paragraphIndex,position.charOffset].every(v=>Number.isInteger(v)&&v>=0))throw new Error('선택 없는 본문 커서에서 새 구역을 만드세요.');
 const result=parse(doc.insertSectionBreak(position.sectionIndex,position.paragraphIndex,position.charOffset));if(result?.ok!==true||doc.getSectionCount()!==count+1||result.sectionIdx!==position.sectionIndex+1)throw new Error('새 구역을 만들지 못했습니다.');
 executePageSetupEdits(doc,planPageSetupEdits(doc,result.sectionIdx,next,'current'));return {sectionIndex:result.sectionIdx,paragraphIndex:result.paraIdx,charOffset:result.charOffset};
}
export function populatePageSetupScope(dialog:any):void {
 const select=dialog.scopeSelect;select.setAttribute('aria-label','편집 용지 적용 범위');select.replaceChildren();
 for(const [value,text]of [['current','현재 구역'],['all','문서 전체'],['new-section','새 구역으로']]){const option=document.createElement('option');option.value=value;option.textContent=text;option.disabled=value==='new-section'&&!pageSetupNewSectionAllowed(dialog);select.append(option);}select.value=handle(dialog.wasm).getSectionCount()===1?'all':'current';
 dialog.widthInput.setAttribute('aria-label','용지 너비');dialog.heightInput.setAttribute('aria-label','용지 높이');for(const key of pageSetupKeys.filter(k=>k.startsWith('margin')))dialog.marginInputs[key].setAttribute('aria-label',key);
}
export function applyPageSetupDialog(dialog:any,bodyViolation:(value:PageSetupSettings)=>string|null|undefined):boolean {
 try{
  const api=(window as any).jueonyEditor,ctx=(window as any).rhwpStudio?.automation.getContext(),ih=dialog.services?.getInputHandler();
  const assertCurrent=()=>{if(!ih||!api||api.busy()||api.revision()!==dialog.jueonyRevision||!ctx?.isEditable||ctx.isFormMode||dialog.wasm.requiresPasswordForSave)throw new Error('문서가 바뀌었거나 편집할 수 없습니다. 창을 다시 여세요.');};assertCurrent();
  const next=collectPageSetup(dialog),violation=bodyViolation(next);if(violation)throw new Error(violation);const scope=dialog.scopeSelect.value;
  if(scope==='new-section'){
   const assertPosition=()=>{assertCurrent();if(!pageSetupNewSectionAllowed(dialog)||JSON.stringify(ih.getCursorPosition())!==JSON.stringify(dialog.jueonyPosition))throw new Error('본문 커서·선택이 바뀌었습니다. 창을 다시 여세요.');};assertPosition();preflightDocumentEdit(dialog.wasm,scratch=>executeNewSectionPageSetup(scratch,dialog.jueonyPosition,next));assertPosition();ih.executeOperation({kind:'snapshot',operationType:'pageSetupNewSection',operation:(wasm:any)=>{assertPosition();return executeNewSectionPageSetup(wasm,dialog.jueonyPosition,next);}});return true;
  }
  const edits=planPageSetupEdits(dialog.wasm,dialog.sectionIdx,next,scope);if(!edits.length)return true;
  preflightDocumentEdit(dialog.wasm,scratch=>executePageSetupEdits(scratch,planPageSetupEdits(scratch,dialog.sectionIdx,next,scope)));assertCurrent();ih.executeOperation({kind:'snapshot',operationType:'pageSetup',operation:(wasm:any)=>{assertCurrent();executePageSetupEdits(wasm,edits);return ih.getCursorPosition();}});return true;
 }catch(error){let label=dialog.dialog.querySelector('[data-page-setup-error]');if(!label){label=document.createElement('p');label.dataset.pageSetupError='true';label.setAttribute('role','alert');label.style.cssText='color:#b43b2e;padding:8px 14px;';dialog.dialog.append(label);}label.textContent=error instanceof Error?error.message:String(error);return false;}
}
