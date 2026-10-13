import {defaultMasterPageText,validateMasterPageText,sameMasterPageText,pageDimensionFromInput} from '../../modules/document/public/index.ts';
import type {MasterPageKind,MasterPageText} from '../../modules/document/public/index.ts';
import {preflightDocumentEdit} from './edit-preflight.ts';
const parse=(value:any)=>typeof value==='string'?JSON.parse(value):value,handle=(wasm:any)=>wasm.borrowDocumentHandle?.()??wasm.doc??wasm;
export function supportsMasterPages(wasm:any):boolean {const doc=wasm&&handle(wasm);return typeof doc?.getMasterPages==='function'&&typeof doc?.setMasterPageText==='function';}
export function readMasterPages(wasm:any,section:number):any {if(!supportsMasterPages(wasm))throw new Error('이 문서 엔진은 기본 바탕쪽 편집을 지원하지 않습니다.');const state=parse(handle(wasm).getMasterPages(section));if(state?.ok!==true||!Array.isArray(state.pages)||typeof state.editable!=='boolean')throw new Error('바탕쪽 상태를 읽지 못했습니다.');return state;}
type Edit={section:number;before:any;kind:MasterPageKind;after:MasterPageText|null};
export function planMasterPageEdits(wasm:any,section:number,kind:MasterPageKind,value:MasterPageText|null,scope:string):Edit[]{
 const doc=handle(wasm),count=doc.getSectionCount();if(!Number.isInteger(count)||count<1||count>100||!Number.isInteger(section)||section<0||section>=count||!['both','odd','even'].includes(kind)||!['current','from-current','document'].includes(scope))throw new Error('바탕쪽 구역·종류·적용 범위를 확인하세요.');
 const sections=scope==='current'?[section]:Array.from({length:scope==='document'?count:count-section},(_,i)=>scope==='document'?i:section+i),edits:Edit[]=[];
 for(const index of sections){const before=readMasterPages(doc,index);if(!before.editable)throw new Error(`${index+1}구역에 표·그림·혼합 서식·확장 바탕쪽이 있어 기본 텍스트 편집으로 바꾸지 않습니다.`);
  const target=before.pages.filter((page:any)=>page.kind===kind);if(target.length>1)throw new Error('같은 종류의 바탕쪽이 여러 개 있습니다.');
  const next=value?validateMasterPageText(value,parse(doc.getPageDef(index))):null;
  if(/\.hwp$/i.test(wasm.fileName??'')){
   const kinds=[...before.pages.filter((p:any)=>p.kind!==kind).map((p:any)=>p.kind),...(next?[kind]:[])].sort().join(',');
   if(!['','both','odd','both,odd','both,even,odd'].includes(kinds))throw new Error('이 바탕쪽 홀짝 조합은 HWP에서 보존되지 않습니다. HWPX를 사용하거나 양쪽·홀수·짝수 순서로 만드세요.');
  }
  if(next?sameMasterPageText(target[0],next):!target.length)continue;edits.push({section:index,before,kind,after:next});
 }
 return edits;
}
export function executeMasterPageEdits(wasm:any,edits:Edit[]):void {
 const doc=handle(wasm);for(const edit of edits)if(JSON.stringify(readMasterPages(doc,edit.section))!==JSON.stringify(edit.before))throw new Error('바탕쪽이 바뀌었습니다. 창을 다시 여세요.');
 for(const edit of edits){if(parse(doc.setMasterPageText(edit.section,edit.kind,JSON.stringify(edit.after??{delete:true})))?.ok!==true)throw new Error('바탕쪽을 적용하지 못했습니다.');}
 for(const edit of edits){const target=readMasterPages(doc,edit.section).pages.find((p:any)=>p.kind===edit.kind);if(edit.after?!sameMasterPageText(target,edit.after):!!target)throw new Error('바탕쪽 적용 결과가 다릅니다.');}
}
export function installMasterPageControls(registry:any,input:()=>any):void {
 registry.register({id:'page:master-page',label:'바탕쪽 (기본 텍스트)',opensDialog:true,canExecute:(ctx:any)=>ctx.hasDocument&&ctx.isEditable&&!ctx.isFormMode&&supportsMasterPages(input()?.wasm),execute(services:any){
  if(document.querySelector('dialog[open],.modal-overlay'))return;
  const ih=input(),section=ih.getPosition().sectionIndex,revision=(window as any).jueonyEditor.revision(),state=readMasterPages(services.wasm,section),dialog=document.createElement('dialog');dialog.id='jueony-master-page';dialog.className='jueony-page-dialog';dialog.style.maxWidth='min(600px,calc(100vw - 32px))';
  const form=document.createElement('form'),title=document.createElement('h2'),notice=document.createElement('p'),error=document.createElement('p');title.textContent='바탕쪽 · 기본 텍스트';notice.textContent='텍스트·위치·크기·색·진하게를 편집합니다. 표/그림/필드/혼합 서식/확장 바탕쪽 편집은 아직 지원하지 않습니다. 앞 구역의 바탕쪽은 계속 적용될 수 있습니다.';error.setAttribute('role','alert');error.style.color='#b43b2e';form.append(title,notice);
  const select=(label:string,options:string[][])=>{const row=document.createElement('label'),control=document.createElement('select');row.textContent=label+' ';control.setAttribute('aria-label',label);for(const [value,text]of options){const option=document.createElement('option');option.value=value!;option.textContent=text!;control.append(option);}row.append(control);row.style.cssText='display:block;margin:10px 0';form.append(row);return control;};
  const kind=select('바탕쪽 종류',[['both','양쪽'],['odd','홀수 쪽'],['even','짝수 쪽']]),scope=select('바탕쪽 적용 범위',[['from-current','현재 구역부터'],['document','첫 구역부터'],['current','현재 구역에 저장']]);
  if(!/\.hwpx$/i.test(services.wasm.fileName??'')&&!['both','odd'].every(k=>state.pages.some((p:any)=>p.kind===k)))kind.querySelector<HTMLOptionElement>('option[value=even]')!.disabled=true;
  const text=document.createElement('textarea');text.rows=6;text.style.width='100%';text.setAttribute('aria-label','바탕쪽 텍스트');form.append(text);
  const fields:Record<string,HTMLInputElement>={};for(const [key,label,type]of [['x','바탕쪽 가로 위치 (mm)','number'],['y','바탕쪽 세로 위치 (mm)','number'],['fontSize','바탕쪽 글자 크기 (pt)','number'],['color','바탕쪽 글자 색','color'],['bold','바탕쪽 진하게','checkbox']]){const row=document.createElement('label'),control=document.createElement('input');control.type=type!;control.setAttribute('aria-label',label!);if(type==='number'){control.min=key==='fontSize'?'1':'0';control.max=key==='fontSize'?'72':'2000';control.step=key==='fontSize'?'0.01':'0.1';}row.textContent=label+' ';row.append(control);row.style.cssText='display:inline-flex;gap:6px;margin:5px';fields[key!]=control;form.append(row);}
  const apply=document.createElement('button'),remove=document.createElement('button'),cancel=document.createElement('button');apply.type='submit';apply.textContent='적용';remove.type='button';remove.textContent='선택 바탕쪽 삭제';cancel.type='button';cancel.textContent='닫기';apply.disabled=remove.disabled=!state.editable;form.append(error,apply,remove,cancel);dialog.append(form);document.body.append(dialog);
  let original:MasterPageText=defaultMasterPageText();const populate=()=>{original=state.pages.find((p:any)=>p.kind===kind.value)??defaultMasterPageText();text.value=original.text;fields.x!.value=(Math.round(original.x*25.4/7200*10)/10).toFixed(1);fields.y!.value=(Math.round(original.y*25.4/7200*10)/10).toFixed(1);fields.fontSize!.value=String(original.fontSize/100);fields.color!.value=original.color;fields.bold!.checked=original.bold;error.textContent=state.editable?'':'복잡한 원본 바탕쪽은 읽기 전용입니다. 내용과 자산을 유지합니다.';};populate();kind.onchange=populate;
  const assertCurrent=()=>{const api=(window as any).jueonyEditor,ctx=(window as any).rhwpStudio?.automation.getContext();if(api.busy(dialog)||api.revision()!==revision||!ctx?.isEditable||ctx.isFormMode||services.wasm.requiresPasswordForSave)throw new Error('문서가 바뀌었거나 편집할 수 없습니다. 창을 다시 여세요.');};
  const run=(deleting:boolean)=>{try{assertCurrent();if(!state.editable)throw new Error('이 원본 바탕쪽은 기본 텍스트 편집으로 바꾸지 않습니다.');if(!deleting&&fields.fontSize!.value.trim()==='')throw new Error('글자 크기를 입력하세요.');const next=deleting?null:validateMasterPageText({text:text.value,x:pageDimensionFromInput(original.x,fields.x!.value),y:pageDimensionFromInput(original.y,fields.y!.value),fontSize:Math.round(Number(fields.fontSize!.value)*100),color:fields.color!.value,bold:fields.bold!.checked});const edits=planMasterPageEdits(services.wasm,section,kind.value as MasterPageKind,next,scope.value);if(edits.length){preflightDocumentEdit(services.wasm,scratch=>executeMasterPageEdits(scratch,planMasterPageEdits(scratch,section,kind.value as MasterPageKind,next,scope.value)));assertCurrent();ih.executeOperation({kind:'snapshot',operationType:'masterPage',operation:(wasm:any)=>{assertCurrent();executeMasterPageEdits(wasm,edits);return ih.getCursorPosition();}});}dialog.close();}catch(e){error.textContent=e instanceof Error?e.message:String(e);}};
  form.onsubmit=e=>{e.preventDefault();run(false);};remove.onclick=()=>run(true);cancel.onclick=()=>dialog.close();dialog.addEventListener('close',()=>{dialog.remove();ih.focus();},{once:true});dialog.showModal();text.focus();
 }});
}
