import {defaultPageGradient,validatePageBorderSettings,samePageBorderSettings,pageSpacingFromInput} from '../../modules/document/public/index.ts';
import type {PageBorderKind,PageBorderSettings} from '../../modules/document/public/index.ts';

const parse=(value:any)=>typeof value==='string'?JSON.parse(value):value;
const documentHandle=(wasm:any)=>wasm.borrowDocumentHandle?.()??wasm.doc??wasm;
export function supportsPageBorderEntries(wasm:any):boolean {const doc=documentHandle(wasm);return typeof doc?.getPageBorderFillEntry==='function'&&typeof doc?.setPageBorderFillEntry==='function';}
export function readPageBorderSettings(wasm:any,section:number,kind:PageBorderKind='both'):PageBorderSettings {
 const doc=documentHandle(wasm);
 if(supportsPageBorderEntries(wasm))return parse(doc.getPageBorderFillEntry(section,kind));
 if(kind!=='both')throw new Error('이 문서 엔진은 홀수·짝수 쪽 배경을 지원하지 않습니다.');
 const value=parse(wasm.getPageBorderFill(section));return {...value,kind,applyPage:value.hideBorder||value.hideFill?'exceptFirst':'all'};
}
export function writePageBorderSettings(wasm:any,section:number,kind:PageBorderKind,value:PageBorderSettings):void {
 const next=validatePageBorderSettings({...value,kind}),doc=documentHandle(wasm);
 const current=readPageBorderSettings(wasm,section,kind);
 if(next.applyPage!==undefined&&next.applyPage!==current.applyPage){
  next.hideBorder=next.hideFill=next.applyPage==='exceptFirst';
  next.firstPageBorder=next.firstPageFill=next.applyPage==='firstOnly';
 }
 // Existing images are preserved by ID when only border/position options change.
 if(next.fillType==='image')delete (next as any).fillType;
 const result=supportsPageBorderEntries(wasm)?parse(doc.setPageBorderFillEntry(section,kind,JSON.stringify(next))):
  kind==='both'&&next.applyPage!=='firstOnly'&&next.fillType!=='gradient'?parse(wasm.setPageBorderFill(section,next)):null;
 if(result?.ok!==true)throw new Error('쪽 테두리/배경을 적용하지 못했습니다.');
}
export function assertPageBorderDialogCurrent(dialog:any):void {
 const api=(window as any).jueonyEditor,context=(window as any).rhwpStudio?.automation.getContext();
 if(!dialog.services?.getInputHandler()||!api||api.busy()||api.revision()!==dialog.jueonyRevision||dialog.wasm.requiresPasswordForSave||!context?.isEditable||context.isFormMode)throw new Error('문서가 바뀌었거나 편집할 수 없습니다. 창을 닫고 다시 여세요.');
}
export function pageBorderError(dialog:any,error:unknown):void {
 let label=dialog.dialog.querySelector('.jueony-page-border-error');if(!label){label=document.createElement('div');label.className='jueony-page-border-error';label.setAttribute('role','alert');label.style.cssText='padding:8px 14px;color:#b43b2e;white-space:pre-wrap;';dialog.dialog.append(label);}label.textContent=error instanceof Error?error.message:String(error);
}
export function collectPageBorderSettings(dialog:any):PageBorderSettings {
 const current=dialog.settings as PageBorderSettings,applyPage=dialog.radioValue('page-border-apply','all');
 const scopeChanged=dialog.jueonyApplicationChanged||applyPage!==(current.applyPage??'all');
 const pattern=dialog.bgPatternSelect.value,originalPattern=Math.max(0,Number(current.patternType));
 const gradientChecked=dialog.jueonyGradientRadio?.checked===true;
 const fillType=gradientChecked?'gradient':dialog.bgColorRadio.checked?'solid':dialog.bgNoneRadio.checked?'none':current.fillType;
 const next:PageBorderSettings={...current,kind:dialog.jueonyKind,applyPage,basis:dialog.basisPaper.checked?'paper':'page',
  ...Object.fromEntries(['Left','Right','Top','Bottom'].flatMap(side=>[[`spacing${side}`,pageSpacingFromInput(Number(current[`spacing${side}`]),dialog.spacingInputs[side].value)],[`border${side}`,dialog.borderNoneCheck.checked?{type:0,width:0,color:'#000000'}:{...dialog.borderEdits[side]}]])),
  headerInside:dialog.jueonyHeaderInside.disabled?current.headerInside:dialog.jueonyHeaderInside.checked,footerInside:dialog.jueonyFooterInside.disabled?current.footerInside:dialog.jueonyFooterInside.checked,
  fillType,fillColor:dialog.bgColorInput.value,patternColor:dialog.bgPatternColorInput.value,patternType:!dialog.bgColorRadio.checked||pattern===''||current.fillType==='solid'&&Number(pattern)===originalPattern?current.patternType:pattern==='0'?-1:Number(pattern),
  fillArea:dialog.radioValue('page-border-fill-area','paper'),
  hideBorder:scopeChanged?applyPage==='exceptFirst':current.hideBorder,hideFill:scopeChanged?applyPage==='exceptFirst':current.hideFill,
  firstPageBorder:scopeChanged?applyPage==='firstOnly':current.firstPageBorder,firstPageFill:scopeChanged?applyPage==='firstOnly':current.firstPageFill};
 if(fillType==='gradient'){
  const gradient=structuredClone(current.gradient??defaultPageGradient()),inputs=dialog.jueonyGradientInputs;
  for(const key of ['type','angle','centerX','centerY','blur','stepCenter'])gradient[key as keyof typeof gradient]=Number(inputs[key].value) as never;
  // Keep unsupported multi-stop data intact so validation can reject rather than flatten it.
  if(gradient.colors.length===2)gradient.colors=[inputs.start.value,inputs.end.value];
  next.gradient=gradient;
 }
 return validatePageBorderSettings(next);
}
export function applyPageBorderDialog(dialog:any):boolean {
 try{
  assertPageBorderDialogCurrent(dialog);const next=collectPageBorderSettings(dialog);
  const drafts=new Map<PageBorderKind,PageBorderSettings>(dialog.jueonyDrafts);drafts.set(dialog.jueonyKind,next);
  const changed=[...drafts].map(([kind,draft])=>[kind,validatePageBorderSettings(dialog.jueonyApplicationChanged?{...draft,applyPage:next.applyPage,hideBorder:next.hideBorder,hideFill:next.hideFill,firstPageBorder:next.firstPageBorder,firstPageFill:next.firstPageFill}:draft)] as const)
   .filter(([kind,draft])=>!samePageBorderSettings(readPageBorderSettings(dialog.wasm,dialog.sectionIdx,kind),draft))
   .sort(([a],[b])=>['both','even','odd'].indexOf(a)-['both','even','odd'].indexOf(b));
  if(!changed.length)return true;
  const input=dialog.services.getInputHandler();
  input.executeOperation({kind:'snapshot',operationType:'pageBorder',operation:(wasm:any)=>{assertPageBorderDialogCurrent(dialog);for(const [kind,draft]of changed)writePageBorderSettings(wasm,dialog.sectionIdx,kind,draft);return input.getCursorPosition();}});
  return true;
 }catch(error){pageBorderError(dialog,error);return false;}
}
export function createPageBorderKindControls(dialog:any):HTMLElement {
 const group=document.createElement('fieldset'),legend=document.createElement('legend');legend.textContent='쪽 종류';group.append(legend);
 const select=document.createElement('select');select.className='dialog-select';select.dataset.pageBorderKind='true';select.setAttribute('aria-label','쪽 테두리/배경 종류');
 for(const [value,label]of[['both','양쪽'],['odd','홀수 쪽'],['even','짝수 쪽']]){const option=document.createElement('option');option.value=value;option.textContent=label;option.disabled=value!=='both'&&!supportsPageBorderEntries(dialog.wasm);select.append(option);}
 select.value=dialog.jueonyKind;
 select.addEventListener('change',()=>{try{
  dialog.jueonyDrafts.set(dialog.jueonyKind,collectPageBorderSettings(dialog));dialog.jueonyKind=select.value;
  dialog.settings=structuredClone(dialog.jueonyDrafts.get(dialog.jueonyKind)??readPageBorderSettings(dialog.wasm,dialog.sectionIdx,dialog.jueonyKind));
  dialog.borderEdits=Object.fromEntries(['Left','Right','Top','Bottom'].map(side=>[side,{...dialog.settings[`border${side}`]}]));dialog.populate();
 }catch(error){select.value=dialog.jueonyKind;pageBorderError(dialog,error);}});
 group.append(select);return group;
}
export function createPageGradientControls(dialog:any):HTMLElement {
 const root=document.createElement('div');root.style.cssText='display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px';
 dialog.jueonyGradientRadio=dialog.radio('page-border-bg','gradient','그러데이션');dialog.jueonyGradientRadio.disabled=!supportsPageBorderEntries(dialog.wasm);
 const radio=dialog.radioRow(dialog.jueonyGradientRadio);radio.style.gridColumn='1 / -1';root.append(radio);dialog.jueonyGradientInputs={};
 for(const [key,label,max]of[['type','유형',4],['start','시작 색',0],['end','끝 색',0],['angle','각도',360],['centerX','가로 중심 (%)',100],['centerY','세로 중심 (%)',100],['blur','번짐 (%)',100],['stepCenter','번짐 중심 (%)',100]] as const){
  const container=document.createElement('label');container.textContent=label;container.style.cssText='display:flex;align-items:center;gap:6px';
  let input:HTMLInputElement|HTMLSelectElement;
  if(key==='type'){input=document.createElement('select');for(const [value,text]of[['1','선형'],['2','원형'],['3','원뿔형 (표시 근사)'],['4','사각형 (표시 근사)']]){const option=document.createElement('option');option.value=value;option.textContent=text;option.disabled=Number(value)>2;input.append(option);}}
  else{input=document.createElement('input');input.type=key==='start'||key==='end'?'color':'number';if(input.type==='number'){input.min='0';input.max=String(max);input.step='1';}}
  input.setAttribute('aria-label',`그러데이션 ${label}`);input.dataset.pageGradient=key;input.style.cssText='width:92px;max-width:100%;';input.disabled=!supportsPageBorderEntries(dialog.wasm);dialog.jueonyGradientInputs[key]=input;container.append(input);root.append(container);
 }
 return root;
}
export function populatePageBorderExtras(dialog:any):void {
 for(const select of dialog.dialog.querySelectorAll('[data-page-border-kind]'))select.value=dialog.jueonyKind;
 dialog.jueonyHeaderInside.checked=dialog.settings.headerInside;dialog.jueonyFooterInside.checked=dialog.settings.footerInside;
 for(const input of dialog.dialog.querySelectorAll('input[name="page-border-apply"]'))input.checked=input.value===(dialog.jueonyApplicationChanged?dialog.jueonyApplication:dialog.settings.applyPage??'all');
 const gradient=dialog.settings.gradient??defaultPageGradient();
 for(const key of ['type','angle','centerX','centerY','blur','stepCenter'])dialog.jueonyGradientInputs[key].value=String(gradient[key]);
 dialog.jueonyGradientInputs.start.value=gradient.colors[0]??'#ffffff';dialog.jueonyGradientInputs.end.value=gradient.colors.at(-1)??'#87b7ed';
 dialog.jueonyGradientRadio.checked=dialog.settings.fillType==='gradient';
}
