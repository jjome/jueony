import {defaultPageGradient,validatePageBorderSettings,samePageBorderSettings,pageSpacingFromInput} from '../../modules/document/public/index.ts';
import type {PageBorderKind,PageBorderSettings} from '../../modules/document/public/index.ts';
import {preflightDocumentEdit} from './edit-preflight.ts';
import {supportsPageBackgroundImage,resolvePageImageDrafts,collectPageImageSettings,populatePageImageControls} from './page-background-image.ts';

const parse=(value:any)=>typeof value==='string'?JSON.parse(value):value;
const documentHandle=(wasm:any)=>wasm.borrowDocumentHandle?.()??wasm.doc??wasm;
export function supportsPageBorderEntries(wasm:any):boolean {const doc=documentHandle(wasm);return typeof doc?.getPageBorderFillEntry==='function'&&typeof doc?.setPageBorderFillEntry==='function';}
export function supportsPageBorderInclusion(wasm:any):boolean {if(!wasm)return false;const doc=documentHandle(wasm);return typeof doc?.pageBorderInclusionEnabled==='function'&&doc.pageBorderInclusionEnabled()===true;}
export function supportsPageBorderFillArea(wasm:any):boolean {if(!wasm)return false;const doc=documentHandle(wasm);return typeof doc?.pageBorderFillAreaEnabled==='function'&&doc.pageBorderFillAreaEnabled()===true;}
export function readPageBorderSettings(wasm:any,section:number,kind:PageBorderKind='both'):PageBorderSettings {
 const doc=documentHandle(wasm);
 if(supportsPageBorderEntries(wasm))return parse(doc.getPageBorderFillEntry(section,kind));
 if(kind!=='both')throw new Error('이 문서 엔진은 홀수·짝수 쪽 배경을 지원하지 않습니다.');
 const value=parse(wasm.getPageBorderFill(section));return {...value,kind,applyPage:value.hideBorder||value.hideFill?'exceptFirst':'all'};
}
export function writePageBorderSettings(wasm:any,section:number,kind:PageBorderKind,value:PageBorderSettings):void {
 const next=validatePageBorderSettings({...value,kind}),doc=documentHandle(wasm);
 const current=readPageBorderSettings(wasm,section,kind);
 if(next.fillArea==='border'&&current.fillArea!=='border'&&!supportsPageBorderFillArea(wasm))throw new Error('이 문서 엔진은 테두리 영역의 배경 배치를 지원하지 않습니다.');
 if(next.applyPage!==undefined&&next.applyPage!==current.applyPage){
  next.hideBorder=next.hideFill=next.applyPage==='exceptFirst';
  next.firstPageBorder=next.firstPageFill=next.applyPage==='firstOnly';
 }
 // Existing images are preserved by ID when only border/position options change.
 if(next.fillType==='image'&&!supportsPageBackgroundImage(wasm))delete (next as any).fillType;
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
 const fillType=dialog.jueonyImageRadio?.checked?'image':gradientChecked?'gradient':dialog.bgColorRadio.checked?'solid':dialog.bgNoneRadio.checked?'none':current.fillType;
 const next:PageBorderSettings={...current,kind:dialog.jueonyKind,applyPage,basis:dialog.basisPaper.checked?'paper':'page',
  ...Object.fromEntries(['Left','Right','Top','Bottom'].flatMap(side=>[[`spacing${side}`,pageSpacingFromInput(Number(current[`spacing${side}`]),dialog.spacingInputs[side].value)],[`border${side}`,dialog.borderNoneCheck.checked?{type:0,width:0,color:'#000000'}:{...dialog.borderEdits[side]}]])),
  headerInside:supportsPageBorderInclusion(dialog.wasm)?dialog.jueonyHeaderInside.checked:current.headerInside,footerInside:supportsPageBorderInclusion(dialog.wasm)?dialog.jueonyFooterInside.checked:current.footerInside,
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
 if(fillType==='image')next.image=collectPageImageSettings(dialog);
 return validatePageBorderSettings(next);
}
export type PageBorderEditScope='current'|'document';
type BorderPosition={sectionIndex:number;paragraphIndex:number;charOffset:number;parentParaIndex?:number;cellPath?:unknown[]};
export function executeNewSectionBorder(wasm:any,position:BorderPosition,drafts:Map<PageBorderKind,PageBorderSettings>):BorderPosition {
 const doc=documentHandle(wasm),count=doc.getSectionCount();
 if(!position||position.parentParaIndex!==undefined||position.cellPath?.length||![position.sectionIndex,position.paragraphIndex,position.charOffset].every(v=>Number.isSafeInteger(v)&&v>=0)||count>=100)throw new Error('새 구역은 선택 없는 본문 커서에서 지정하세요. 구역은 100개 이하여야 합니다.');
 const result=parse(doc.insertSectionBreak(position.sectionIndex,position.paragraphIndex,position.charOffset));
 if(result?.ok!==true||result.sectionIdx!==position.sectionIndex+1||doc.getSectionCount()!==count+1)throw new Error('새 구역의 위치를 확인하지 못했습니다.');
 executePageBorderEdits(wasm,planPageBorderEdits(wasm,result.sectionIdx,drafts,'current'));
 return {sectionIndex:result.sectionIdx,paragraphIndex:result.paraIdx,charOffset:result.charOffset};
}
function newSectionScopeAllowed(dialog:any):boolean {
 const input=dialog.services?.getInputHandler(),cursor=input?.cursor,position=dialog.jueonyPosition;
 return !!cursor&&supportsPageBorderEntries(dialog.wasm)&&typeof documentHandle(dialog.wasm).insertSectionBreak==='function'&&position?.parentParaIndex===undefined&&!position?.cellPath?.length
  &&!cursor.hasSelection()&&!cursor.isInHeaderFooter()&&!cursor.isInFootnote()&&!cursor.isInTextBox()&&!cursor.isInCellSelectionMode()&&!cursor.isInTableObjectSelection()&&!cursor.isInPictureObjectSelection();
}
type PageBorderEdit={section:number;kind:PageBorderKind;before:PageBorderSettings;after:PageBorderSettings};
export function planPageBorderEdits(wasm:any,section:number,drafts:Map<PageBorderKind,PageBorderSettings>,scope:PageBorderEditScope):PageBorderEdit[] {
 const doc=documentHandle(wasm),count=doc.getSectionCount();
 if(!Number.isSafeInteger(count)||count<1||count>100||!Number.isSafeInteger(section)||section<0||section>=count||!['current','document'].includes(scope))throw new Error('1~100개 구역의 유효한 적용 범위를 선택하세요.');
 const kinds:PageBorderKind[]=supportsPageBorderEntries(wasm)?['both','even','odd']:['both'];
 if(!supportsPageBorderEntries(wasm)&&scope==='document')throw new Error('이 엔진은 문서 전체 쪽 테두리 설정을 지원하지 않습니다.');
 const effective=new Map(kinds.map(kind=>[kind,readPageBorderSettings(wasm,section,kind)]));
 for(const kind of kinds){const draft=drafts.get(kind);if(!draft)continue;const value=validatePageBorderSettings({...draft,kind});
  if(value.applyPage!==undefined&&value.applyPage!==effective.get(kind)?.applyPage){value.hideBorder=value.hideFill=value.applyPage==='exceptFirst';value.firstPageBorder=value.firstPageFill=value.applyPage==='firstOnly';}
  if(kind==='both'&&!samePageBorderSettings(effective.get(kind)!,value))for(const target of kinds)effective.set(target,{...structuredClone(value),kind:target});
  else effective.set(kind,value);
 }
 const edits:PageBorderEdit[]=[];
 for(const index of scope==='document'?Array.from({length:count},(_,i)=>i):[section]){
  const group=kinds.map(kind=>({section:index,kind,before:readPageBorderSettings(wasm,index,kind),after:structuredClone(effective.get(kind)!)}));
  if(scope==='document'&&!supportsPageBackgroundImage(wasm)&&group.some(edit=>edit.after.fillType==='image'))throw new Error('그림 배경은 구역 간 복사를 아직 지원하지 않습니다. 현재 구역을 선택하세요.');
  const changed=group.filter(edit=>!samePageBorderSettings(edit.before,edit.after));
  if(changed.length)edits.push(...(changed.some(edit=>edit.kind==='both')?group:changed));
 }
 return edits;
}
export function executePageBorderEdits(wasm:any,edits:PageBorderEdit[]):void {
 // Check every baseline before the first write; the both write intentionally resets parity slots.
 for(const edit of edits)if(!samePageBorderSettings(readPageBorderSettings(wasm,edit.section,edit.kind),edit.before))throw new Error('구역의 테두리 설정이 바뀌었습니다. 창을 다시 여세요.');
 for(const edit of edits)writePageBorderSettings(wasm,edit.section,edit.kind,edit.after);
 for(const edit of edits)if(!samePageBorderSettings(readPageBorderSettings(wasm,edit.section,edit.kind),edit.after))throw new Error('쪽 테두리 적용 결과가 다릅니다.');
}
export function applyPageBorderDialog(dialog:any):boolean {
 try{
  if(dialog.jueonyImageLoading)throw new Error('그림을 읽는 중입니다. 파일 읽기가 끝나면 적용하세요.');
  assertPageBorderDialogCurrent(dialog);const next=collectPageBorderSettings(dialog);
  const drafts=new Map<PageBorderKind,PageBorderSettings>(dialog.jueonyDrafts);drafts.set(dialog.jueonyKind,next);
  if(dialog.jueonyApplicationChanged)for(const [kind,draft]of drafts)drafts.set(kind,validatePageBorderSettings({...draft,applyPage:next.applyPage,hideBorder:next.hideBorder,hideFill:next.hideFill,firstPageBorder:next.firstPageBorder,firstPageFill:next.firstPageFill}));
  const scope=dialog.jueonyScope?.value??'current';
  const input=dialog.services.getInputHandler();
  const resolved=(wasm:any)=>resolvePageImageDrafts(wasm,drafts,dialog.jueonyImageUploads??new Map());
  if(scope==='new-section'){
   const assertPosition=()=>{assertPageBorderDialogCurrent(dialog);if(!newSectionScopeAllowed(dialog)||JSON.stringify(input.getCursorPosition())!==JSON.stringify(dialog.jueonyPosition))throw new Error('본문 커서나 선택이 바뀌었습니다. 새 구역 적용 창을 다시 여세요.');};
   assertPosition();preflightDocumentEdit(dialog.wasm,scratch=>executeNewSectionBorder(scratch,dialog.jueonyPosition,resolved(scratch)));assertPosition();
   input.executeOperation({kind:'snapshot',operationType:'pageBorderNewSection',operation:(wasm:any)=>{assertPosition();return executeNewSectionBorder(wasm,dialog.jueonyPosition,resolved(wasm));}});return true;
  }
  const pending=[...drafts].some(([kind,draft])=>draft.fillType==='image'&&dialog.jueonyImageUploads?.has(kind));
  if(pending){
   const apply=(wasm:any)=>executePageBorderEdits(wasm,planPageBorderEdits(wasm,dialog.sectionIdx,resolved(wasm),scope));
   preflightDocumentEdit(dialog.wasm,apply);assertPageBorderDialogCurrent(dialog);
   input.executeOperation({kind:'snapshot',operationType:'pageBorder',operation:(wasm:any)=>{assertPageBorderDialogCurrent(dialog);apply(wasm);return input.getCursorPosition();}});return true;
  }
  const edits=planPageBorderEdits(dialog.wasm,dialog.sectionIdx,drafts,scope);
  if(!edits.length)return true;
  preflightDocumentEdit(dialog.wasm,scratch=>executePageBorderEdits(scratch,planPageBorderEdits(scratch,dialog.sectionIdx,drafts,scope)));
  assertPageBorderDialogCurrent(dialog);
  input.executeOperation({kind:'snapshot',operationType:'pageBorder',operation:(wasm:any)=>{assertPageBorderDialogCurrent(dialog);executePageBorderEdits(wasm,edits);return input.getCursorPosition();}});
  return true;
 }catch(error){pageBorderError(dialog,error);return false;}
}
export function createPageBorderScopeControls(dialog:any):HTMLElement {
 const label=document.createElement('label');label.textContent='적용 범위 ';dialog.jueonyScope=document.createElement('select');dialog.jueonyScope.setAttribute('aria-label','쪽 테두리 적용 범위');
 for(const [value,text]of[['current','현재 구역'],['document','문서 전체 (현재 구역의 양쪽·홀수·짝수 설정 복사)'],['new-section','새 구역으로 (현재 본문 커서에서 나누기)']]){const option=document.createElement('option');option.value=value;option.textContent=text;option.disabled=value==='document'&&!supportsPageBorderEntries(dialog.wasm)||value==='new-section'&&!newSectionScopeAllowed(dialog);dialog.jueonyScope.append(option);}
 label.append(dialog.jueonyScope);return label;
}
export function populatePageBorderInclusion(dialog:any):void {
 const supported=supportsPageBorderInclusion(dialog.wasm),enabled=supported&&!dialog.basisPaper.checked;
 dialog.jueonyHeaderInside.disabled=dialog.jueonyFooterInside.disabled=!enabled;
 const notice=dialog.dialog?.querySelector('[data-page-inclusion-notice]');if(notice)notice.textContent=supported?'머리말·꼬리말 포함은 쪽 기준에서 지정합니다. 설정된 머리말/꼬리말 영역까지 테두리를 확장합니다.':'이 엔진은 머리말·꼬리말 포함 배치를 지원하지 않습니다. 저장 값을 표시·보존합니다.';
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
 for(const input of dialog.dialog.querySelectorAll('input[name="page-border-fill-area"][value="border"]')){input.disabled=!supportsPageBorderFillArea(dialog.wasm);input.title=input.disabled?'이 엔진은 저장된 값을 보존하지만 테두리 배경 배치를 지원하지 않습니다.':'실제 쪽 테두리 안쪽을 채웁니다.';}
 for(const select of dialog.dialog.querySelectorAll('[data-page-border-kind]'))select.value=dialog.jueonyKind;
 dialog.jueonyHeaderInside.checked=dialog.settings.headerInside;dialog.jueonyFooterInside.checked=dialog.settings.footerInside;
 for(const input of dialog.dialog.querySelectorAll('input[name="page-border-apply"]'))input.checked=input.value===(dialog.jueonyApplicationChanged?dialog.jueonyApplication:dialog.settings.applyPage??'all');
 const gradient=dialog.settings.gradient??defaultPageGradient();
 for(const key of ['type','angle','centerX','centerY','blur','stepCenter'])dialog.jueonyGradientInputs[key].value=String(gradient[key]);
 dialog.jueonyGradientInputs.start.value=gradient.colors[0]??'#ffffff';dialog.jueonyGradientInputs.end.value=gradient.colors.at(-1)??'#87b7ed';
 dialog.jueonyGradientRadio.checked=dialog.settings.fillType==='gradient';
 populatePageBorderInclusion(dialog);
 populatePageImageControls(dialog);
}
