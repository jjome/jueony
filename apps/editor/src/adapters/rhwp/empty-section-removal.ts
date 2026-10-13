import {validateEmptySectionRemovalPlan,sameEmptySectionRemovalRange} from '../../modules/document/public/index.ts';
import type {EmptySectionRemovalPlan} from '../../modules/document/public/index.ts';
import {preflightDocumentEdit} from './edit-preflight.ts';
const json=(v:any)=>typeof v==='string'?JSON.parse(v):v,doc=(w:any)=>w.borrowDocumentHandle?.()??w;
export function readEmptySectionRemovalPlan(wasm:any,section:number):EmptySectionRemovalPlan{return validateEmptySectionRemovalPlan(json(doc(wasm).getEmptySectionRemovalPlan(section)));}
export function executeEmptySectionRemoval(wasm:any,plan:EmptySectionRemovalPlan):{sectionIndex:number;paragraphIndex:number;charOffset:number}{
 const current=readEmptySectionRemovalPlan(wasm,plan.section);if(current.token!==plan.token||!sameEmptySectionRemovalRange(current,plan))throw new Error('문서가 바뀌었습니다. 빈 구역 삭제 창을 다시 여세요.');
 const r=json(doc(wasm).removeEmptySection(plan.section,plan.token));
 if(r.ok!==true||r.removedSection!==plan.section||r.sectionIdx!==plan.cursorSection||r.paraIdx!==plan.cursorParagraph||r.charOffset!==plan.cursorOffset||r.sectionCount!==plan.sectionCountBefore-1||r.pageCount!==plan.pagesBefore-1)throw new Error('빈 구역 삭제 결과가 계획과 다릅니다.');
 return {sectionIndex:r.sectionIdx,paragraphIndex:r.paraIdx,charOffset:r.charOffset};
}
export function installEmptySectionRemoval(registry:any,input:()=>any):void{
 const can=(c:any)=>{const ih=input();return c.hasDocument&&c.isEditable&&!c.isFormMode&&!c.inTable&&!c.inCellSelectionMode&&!c.inPictureObjectSelection&&!c.inTableObjectSelection&&!ih?.isComposing&&!ih?.cursor.hasSelection()&&!ih?.cursor.isInHeaderFooter()&&!ih?.cursor.isInFootnote()&&!ih?.cursor.isInTextBox()&&typeof doc(ih?.wasm??{}).removeEmptySection==='function';};
 registry.register({id:'page:remove-empty-section',label:'빈 본문 구역 삭제',opensDialog:true,canExecute:can,execute(services:any){
  if(document.querySelector('dialog[open],.modal-overlay'))return;const ih=input(),api=(window as any).jueonyEditor;ih.flushDeferredPaginationIfNeeded('empty-section-remove');const revision=api.revision(),position=ih.getCursorPosition();
  const dialog=document.createElement('dialog');dialog.id='jueony-empty-section-remove';dialog.style.cssText='box-sizing:border-box;max-width:min(520px,calc(100vw - 24px));max-height:calc(100vh - 24px);overflow:auto;border:1px solid #cbd5e1;border-radius:8px;padding:16px;font:14px "Segoe UI",sans-serif';
  const form=document.createElement('form'),heading=document.createElement('h2'),notice=document.createElement('p'),summary=document.createElement('p'),error=document.createElement('p'),cancel=document.createElement('button'),apply=document.createElement('button');
  heading.textContent=`${position.sectionIndex+1}구역 삭제`;notice.textContent='본문이 없는 문단 하나의 구역을 용지·테두리·배경 설정과 함께 삭제합니다. 다른 구역을 합치거나 설정을 덮어쓰지 않습니다. 유일한 구역·공백/추가 문단·표·개체·특수 영역 등은 제외하며 전체 5,000문단·10만 문자 이내 일반 본문 문서에서 지원합니다. 한 번에 되돌릴 수 있습니다.';notice.style.cssText='font-size:12px;line-height:1.5;color:#596579';summary.dataset.emptySectionSummary='true';error.setAttribute('role','alert');error.style.color='#b42318';cancel.type='button';cancel.textContent='취소';cancel.onclick=()=>dialog.close();apply.type='submit';apply.textContent='빈 구역 삭제';
  let plan:EmptySectionRemovalPlan|undefined;try{plan=readEmptySectionRemovalPlan(services.wasm,position.sectionIndex);summary.textContent=`${plan.sectionCountBefore}구역 → ${plan.sectionCountBefore-1}구역, ${plan.pagesBefore}쪽 → ${plan.pagesBefore-1}쪽. 커서는 ${plan.section<plan.sectionCountBefore-1?'뒤 구역의 처음':'앞 구역의 끝'}으로 옮깁니다.`;}catch(e){apply.disabled=true;error.textContent=e instanceof Error?e.message:String(e);}
  form.append(heading,notice,summary,error,cancel,apply);dialog.append(form);document.body.append(dialog);
  const current=()=>{if(api.busy(dialog)||api.revision()!==revision||!can((window as any).rhwpStudio.automation.getContext())||services.wasm.requiresPasswordForSave||JSON.stringify(input().getCursorPosition())!==JSON.stringify(position))throw new Error('문서나 커서가 바뀌었습니다. 창을 다시 여세요.');};
  form.onsubmit=e=>{e.preventDefault();try{current();if(!plan)throw new Error('삭제할 빈 구역이 없습니다.');preflightDocumentEdit(services.wasm,scratch=>{const checked=readEmptySectionRemovalPlan(scratch,plan!.section);if(!sameEmptySectionRemovalRange(plan!,checked))throw new Error('저장 사본의 빈 구역 범위가 다릅니다.');executeEmptySectionRemoval(scratch,checked);});current();ih.executeOperation({kind:'snapshot',operationType:'removeEmptySection',operation:(wasm:any)=>{current();return executeEmptySectionRemoval(wasm,plan!);}});dialog.close();}catch(e){error.textContent=e instanceof Error?e.message:String(e);}};
  dialog.addEventListener('close',()=>{dialog.remove();ih.focus();},{once:true});dialog.showModal();cancel.focus();
 }});
}
