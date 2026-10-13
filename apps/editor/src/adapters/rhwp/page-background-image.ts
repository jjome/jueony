import {defaultPageImage,validatePageBorderSettings} from '../../modules/document/public/index.ts';
import type {PageBorderKind,PageBorderSettings,PageImageFill} from '../../modules/document/public/index.ts';

export interface PageImageUpload {bytes:Uint8Array;extension:'png'|'jpg';name:string}
const handle=(wasm:any)=>wasm.borrowDocumentHandle?.()??wasm.doc??wasm;
export function supportsPageBackgroundImage(wasm:any):boolean {const doc=wasm&&handle(wasm);return doc?.pageBackgroundImageEnabled?.()===true&&typeof doc.registerPageBackgroundImage==='function';}
/** Keep bytes outside persisted settings; materialize only inside the snapshot/preflight owner. */
export function resolvePageImageDrafts(wasm:any,drafts:Map<PageBorderKind,PageBorderSettings>,uploads:Map<PageBorderKind,PageImageUpload>):Map<PageBorderKind,PageBorderSettings>{
 const resolved=new Map<PageBorderKind,PageBorderSettings>(),ids=new Map<PageImageUpload,number>();
 for(const [kind,draft]of drafts){let next=structuredClone(draft);const upload=uploads.get(kind);
  if(next.fillType==='image'&&upload){
   if(!supportsPageBackgroundImage(wasm))throw new Error('이 엔진은 새 그림 배경을 지원하지 않습니다.');
   let id=ids.get(upload);if(id===undefined){const result=handle(wasm).registerPageBackgroundImage(upload.bytes,upload.extension),value=typeof result==='string'?JSON.parse(result):result;if(value?.ok!==true||!Number.isInteger(value.binDataId)||value.binDataId<1||value.binDataId>65535)throw new Error('그림 자산을 등록하지 못했습니다.');id=value.binDataId;ids.set(upload,id!);}
   next={...next,image:{...next.image??defaultPageImage(),binDataId:id}};
  }
  resolved.set(kind,validatePageBorderSettings(next));
 }
 return resolved;
}
export function collectPageImageSettings(dialog:any):PageImageFill|undefined {
 if(!dialog.jueonyImageRadio?.checked)return dialog.settings.image;
 if(!supportsPageBackgroundImage(dialog.wasm))return dialog.settings.image;
 if(!dialog.settings.image?.binDataId&&!dialog.jueonyImageUploads?.has(dialog.jueonyKind))throw new Error('배경 그림 파일을 먼저 선택하세요.');
 const inputs=dialog.jueonyImageInputs;
 if(inputs.mode.value==='zoom'&&!/\.hwpx$/i.test(dialog.wasm.fileName??''))throw new Error('비율 유지 맞춤은 HWPX에서만 저장할 수 있습니다.');
 for(const key of ['brightness','contrast'])if(inputs[key].value.trim()==='')throw new Error('그림 밝기·대비 값을 입력하세요.');
 return {...dialog.settings.image??defaultPageImage(),mode:inputs.mode.value,brightness:Number(inputs.brightness.value),contrast:Number(inputs.contrast.value),effect:Number(inputs.effect.value)};
}
export function resetPageImageDrafts(dialog:any):void {dialog.jueonyImageUploads=new Map();dialog.jueonyImageEpoch=(dialog.jueonyImageEpoch??0)+1;dialog.jueonyImageLoading=false;}
export function populatePageImageControls(dialog:any):void {
 if(!dialog.jueonyImageRadio)return;
 const capable=supportsPageBackgroundImage(dialog.wasm),image=dialog.settings.image??defaultPageImage(),inputs=dialog.jueonyImageInputs;
 dialog.jueonyImageRadio.checked=dialog.settings.fillType==='image';dialog.jueonyImageRadio.disabled=!capable;
 for(const [key,input]of Object.entries(inputs) as [keyof PageImageFill,HTMLInputElement|HTMLSelectElement][]){
  if((key==='mode'||key==='effect')&&![...((input as HTMLSelectElement).options)].some(o=>o.value===String(image[key]))){const option=document.createElement('option');option.value=String(image[key]);option.textContent=`기존 값 유지 (${image[key]})`;option.disabled=true;input.append(option);}
  input.value=String(image[key]);input.disabled=!capable||!dialog.jueonyImageRadio.checked;
 }
 dialog.jueonyImageFile.disabled=!capable;
 const zoom=[...inputs.mode.options].find((option:HTMLOptionElement)=>option.value==='zoom');if(zoom)zoom.disabled=!/\.hwpx$/i.test(dialog.wasm.fileName??'');
 dialog.jueonyWatermark.disabled=!capable||!dialog.jueonyImageRadio.checked;
 dialog.jueonyImageName.textContent=dialog.jueonyImageUploads?.get(dialog.jueonyKind)?.name??(dialog.settings.image?.binDataId?`문서에 포함된 그림 #${dialog.settings.image.binDataId}`:capable?'PNG/JPEG · 10MiB 이하 · 문서 안에 포함':'이 엔진은 새 그림 배경을 지원하지 않습니다.');
}
export function createPageImageControls(dialog:any,assertCurrent:()=>void,report:(error:unknown)=>void):HTMLElement {
 const root=document.createElement('fieldset'),legend=document.createElement('legend');legend.textContent='그림 배경';root.append(legend);
 dialog.jueonyImageRadio=dialog.radio('page-border-bg','image','그림');root.append(dialog.radioRow(dialog.jueonyImageRadio));
 const file=document.createElement('input');file.type='file';file.accept='.png,.jpg,.jpeg,image/png,image/jpeg';file.setAttribute('aria-label','쪽 배경 그림 파일');dialog.jueonyImageFile=file;dialog.jueonyImageName=document.createElement('p');root.append(file,dialog.jueonyImageName);
 dialog.jueonyImageInputs={};
 for(const [key,label,options]of [['mode','그림 채우기 방식',[['fit','크기에 맞추어'],['tile','바둑판식'],['center','가운데'],['zoom','비율 유지 맞춤 (HWPX)']]],['effect','그림 효과',[['0','원래 색'],['1','회색조'],['2','흑백']]],['brightness','그림 밝기',null],['contrast','그림 대비',null]] as const){
  const row=document.createElement('label');row.textContent=label+' ';row.style.cssText='display:inline-flex;gap:6px;margin:4px;';let input:HTMLInputElement|HTMLSelectElement;
  if(options){const select=document.createElement('select');for(const [value,text]of options){const option=document.createElement('option');option.value=value;option.textContent=text;select.append(option);}input=select;}
  else{input=document.createElement('input');input.type='number';input.min='-100';input.max='100';input.step='1';input.style.width='64px';}
  input.setAttribute('aria-label',label);dialog.jueonyImageInputs[key]=input;row.append(input);root.append(row);
 }
 const watermark=document.createElement('button');dialog.jueonyWatermark=watermark;watermark.type='button';watermark.textContent='워터마크 효과';watermark.setAttribute('aria-label','그림 워터마크 효과');watermark.addEventListener('click',()=>{dialog.jueonyImageInputs.brightness.value='70';dialog.jueonyImageInputs.contrast.value='-50';});root.append(watermark);
 for(const radio of [dialog.jueonyImageRadio,dialog.bgNoneRadio,dialog.bgColorRadio,dialog.jueonyGradientRadio])radio.addEventListener('change',()=>{const disabled=!supportsPageBackgroundImage(dialog.wasm)||!dialog.jueonyImageRadio.checked;for(const input of Object.values(dialog.jueonyImageInputs) as HTMLInputElement[])input.disabled=disabled;watermark.disabled=disabled;});
 file.addEventListener('change',async()=>{
  const selected=file.files?.[0],kind=dialog.jueonyKind,epoch=dialog.jueonyImageEpoch;if(!selected)return;
  if(dialog.jueonyImageLoading){report(new Error('다른 그림을 읽는 중입니다.'));return;}
  try{assertCurrent();dialog.jueonyImageLoading=true;
   const extension=selected.name.split('.').at(-1)?.toLowerCase();if(!['png','jpg','jpeg'].includes(extension??'')||selected.size===0||selected.size>10*1024*1024)throw new Error('10MiB 이하 PNG/JPEG 파일을 선택하세요.');
   const bytes=new Uint8Array(await selected.arrayBuffer());assertCurrent();if(epoch!==dialog.jueonyImageEpoch||kind!==dialog.jueonyKind||!dialog.dialog.isConnected)throw new Error('그림을 읽는 동안 창이나 쪽 종류가 바뀌었습니다. 다시 선택하세요.');
   dialog.jueonyImageUploads.set(kind,{bytes,extension:extension==='png'?'png':'jpg',name:selected.name});dialog.settings={...dialog.settings,image:{...dialog.settings.image??defaultPageImage()}};
   dialog.jueonyImageRadio.checked=true;populatePageImageControls({...dialog,settings:{...dialog.settings,fillType:'image'}});
  }catch(error){report(error);}finally{if(epoch===dialog.jueonyImageEpoch)dialog.jueonyImageLoading=false;file.value='';}
 });
 return root;
}
