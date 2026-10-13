import {validatePageBodyClipboard,samePageBodyDeletionRange} from '../../modules/document/public/index.ts';
import type {PageBodyClipboard,PageBodyDeletionPlan} from '../../modules/document/public/index.ts';
import {readPageBodyDeletionPlan} from './page-body-deletion.ts';
import {preflightDocumentEdit} from './edit-preflight.ts';
const doc=(w:any)=>w.borrowDocumentHandle?.()??w,json=(v:any)=>typeof v==='string'?JSON.parse(v):v;
export function copyPageBody(wasm:any,plan:PageBodyDeletionPlan):PageBodyClipboard {
 const now=readPageBodyDeletionPlan(wasm,plan.page);if(now.token!==plan.token||!samePageBodyDeletionRange(now,plan))throw new Error('복사할 쪽 본문이 바뀌었습니다.');
 return validatePageBodyClipboard({version:1,bytes:doc(wasm).copyPageBody(plan.page,plan.token),texts:plan.texts});
}
export function pastePageBody(wasm:any,plan:PageBodyDeletionPlan,value:PageBodyClipboard):{sectionIndex:number;paragraphIndex:number;charOffset:number} {
 const clipboard=validatePageBodyClipboard(value),now=readPageBodyDeletionPlan(wasm,plan.page);if(now.token!==plan.token||!samePageBodyDeletionRange(now,plan))throw new Error('붙일 대상 쪽 본문이 바뀌었습니다.');
 const HwpDocument=wasm.getWasmModuleExports?.().HwpDocument??doc(wasm).constructor;let source:any;
 try{source=new HwpDocument(clipboard.bytes);if(source.getSectionCount()!==1||source.pageCount()!==1||JSON.stringify(readPageBodyDeletionPlan(source,0).texts)!==JSON.stringify(clipboard.texts))throw new Error('복사 자료의 미리보기와 실제 본문이 다릅니다.');}finally{source?.free();}
 const r=json(doc(wasm).pastePageBody(plan.page,plan.token,clipboard.bytes));
 if(r.ok!==true||r.sectionIdx!==plan.section||r.paraIdx!==plan.firstParagraph+plan.paragraphCount||r.charOffset!==0||r.pageCount!==plan.pagesBefore+1)throw new Error('쪽 붙이기 결과가 유효하지 않습니다.');
 return {sectionIndex:r.sectionIdx,paragraphIndex:r.paraIdx,charOffset:0};
}
// All Studio frames share the same local app parent. Cross-document use requires an explicit paste.
const clipboardOwner=()=>window.parent;
const readClipboard=():PageBodyClipboard|undefined=>{try{return validatePageBodyClipboard((clipboardOwner() as any).__jueonyPageClipboardV1);}catch{return undefined;}};
export function installPageBodyClipboard(registry:any,input:()=>any):void {
 const can=(c:any)=>{const ih=input();return c.hasDocument&&c.isEditable&&!c.isFormMode&&!c.inTable&&!c.inCellSelectionMode&&!c.inPictureObjectSelection&&!c.inTableObjectSelection&&!ih?.isComposing&&!ih?.cursor.hasSelection()&&!ih?.cursor.isInHeaderFooter()&&!ih?.cursor.isInFootnote()&&!ih?.cursor.isInTextBox()&&typeof doc(ih?.wasm??{}).copyPageBody==='function';};
 for(const mode of ['copy','paste'] as const)registry.register({id:`page:${mode}-body-page`,label:mode==='copy'?'쪽 본문 복사 (완전 문단)':'쪽 뒤에 본문 붙이기',opensDialog:true,canExecute:(c:any)=>can(c)&&(mode==='copy'||!!readClipboard()),execute(services:any){
  if(document.querySelector('dialog[open],.modal-overlay'))return;const ih=input(),api=(window as any).jueonyEditor;ih.flushDeferredPaginationIfNeeded('page-'+mode);const revision=api.revision(),position=ih.getCursorPosition(),page=ih.cursor.rect?.pageIndex??json(doc(services.wasm).getPageOfPosition(position.sectionIndex,position.paragraphIndex)).page;
  const clipboard=mode==='paste'?readClipboard():undefined,dialog=document.createElement('dialog');dialog.id='jueony-page-'+mode;dialog.className='jueony-page-dialog';dialog.style.cssText='box-sizing:border-box;max-width:min(520px,calc(100vw - 24px));max-height:calc(100vh - 24px);overflow:auto;border:1px solid #cbd5e1;border-radius:8px;padding:16px;font:14px "Segoe UI",sans-serif';
  const form=document.createElement('form'),heading=document.createElement('h2'),notice=document.createElement('p'),preview=document.createElement('pre'),error=document.createElement('p'),cancel=document.createElement('button'),apply=document.createElement('button');heading.textContent=mode==='copy'?`${page+1}쪽 본문 복사`:`${page+1}쪽 뒤에 본문 붙이기`;notice.textContent='프로그램 안에서 한 쪽의 완전한 본문 문단과 서식을 복사합니다. 복사 자료는 메모리에만 유지됩니다. 표·개체·걸친 문단·바탕쪽·줄 번호·그림 배경·개요 번호는 제외하며, 서로 다른 용지·쪽 설정은 아직 붙일 수 없습니다. 붙이기는 커서가 있는 쪽 바로 뒤에 새 쪽으로 넣고 한 번에 되돌립니다.';notice.style.cssText='font-size:12px;line-height:1.5;color:#596579';preview.style.cssText='white-space:pre-wrap;max-height:180px;overflow:auto;background:#f4f6fa;padding:10px';error.setAttribute('role','alert');error.style.color='#b42318';cancel.type='button';cancel.textContent='취소';cancel.onclick=()=>dialog.close();apply.type='submit';apply.textContent=mode==='copy'?'본문 복사':'쪽 뒤에 붙이기';
  let plan:PageBodyDeletionPlan|undefined;try{plan=readPageBodyDeletionPlan(services.wasm,page);doc(services.wasm).getPageBodyClipboardSettings(plan.section);preview.textContent=(clipboard?.texts??plan.texts).join('\n').slice(0,2000);if(mode==='paste'&&!clipboard)throw new Error('먼저 쪽 본문을 복사하세요.');}catch(e){apply.disabled=true;error.textContent=e instanceof Error?e.message:String(e);}
  form.append(heading,notice,preview,error,cancel,apply);dialog.append(form);document.body.append(dialog);
  const current=()=>{if(api.busy(dialog)||api.revision()!==revision||!can((window as any).rhwpStudio.automation.getContext())||services.wasm.requiresPasswordForSave||JSON.stringify(input().getCursorPosition())!==JSON.stringify(position))throw new Error('문서나 커서가 바뀌었습니다. 창을 다시 여세요.');};
  form.onsubmit=e=>{e.preventDefault();try{current();if(!plan)throw new Error('쪽 본문 범위를 확인하지 못했습니다.');if(mode==='copy'){const next=copyPageBody(services.wasm,plan);current();(clipboardOwner() as any).__jueonyPageClipboardV1=next;}else{if(!clipboard)throw new Error('쪽 복사 자료가 없습니다.');preflightDocumentEdit(services.wasm,scratch=>{const checked=readPageBodyDeletionPlan(scratch,page);if(!samePageBodyDeletionRange(plan!,checked))throw new Error('저장 사본의 대상 쪽 범위가 다릅니다.');pastePageBody(scratch,checked,clipboard);});current();ih.executeOperation({kind:'snapshot',operationType:'pastePageBody',operation:(wasm:any)=>{current();return pastePageBody(wasm,plan!,clipboard);}});}dialog.close();}catch(e){error.textContent=e instanceof Error?e.message:String(e);}};
  dialog.addEventListener('close',()=>{dialog.remove();ih.focus();},{once:true});dialog.showModal();cancel.focus();
 }});
}
