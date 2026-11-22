import type {InstitutionTemplateField,WorkTemplateValues} from '../../modules/document/public/work-templates.ts';

type TemplateSource={file:File;bytes:Uint8Array;fields:InstitutionTemplateField[]};

export function showInstitutionTemplateDialog(actions:{
 inspect(bytes:Uint8Array,name:string):InstitutionTemplateField[];
 open(source:TemplateSource,values:WorkTemplateValues):Promise<void>;
 suggest(fields:string[],notes:string,signal:AbortSignal):Promise<WorkTemplateValues>;
}):void{
 const dialog=document.createElement('dialog');dialog.id='institution-template-dialog';
 const form=document.createElement('form');
 const title=document.createElement('h2');title.textContent='기관 양식 사본';
 const file=document.createElement('input');file.type='file';file.accept='.hwp,.hwpx';file.required=true;
 const fileLabel=document.createElement('label');fileLabel.append('기관 양식 파일',file);
 const hint=document.createElement('p');hint.className='hint';hint.textContent='입력 항목은 양식에서 {{항목}}으로 표시합니다. {{본문:항목}}은 AI 제안을 받을 수 있습니다.';
 const fields=document.createElement('fieldset');fields.hidden=true;
 const ai=document.createElement('details');ai.hidden=true;
 const summary=document.createElement('summary');summary.textContent='AI로 본문 초안 제안 받기';
 const label=document.createElement('label');label.textContent='AI에 전달할 메모';
 const notes=document.createElement('textarea');notes.maxLength=4000;notes.rows=3;label.append(notes);
 const aiHint=document.createElement('p');aiHint.className='hint';aiHint.textContent='선택한 모델에는 이 메모와 비어 있는 본문 항목의 이름을 보냅니다.';
 const ask=document.createElement('button');ask.type='button';ask.textContent='초안 제안 받기';
 ai.append(summary,label,aiHint,ask);
 const notice=document.createElement('p');notice.setAttribute('role','status');
 const buttons=document.createElement('div');buttons.className='dialog-actions';
 const close=document.createElement('button');close.type='button';close.textContent='닫기';close.onclick=()=>dialog.close();
 const open=document.createElement('button');open.type='submit';open.textContent='양식 사본 열기';open.disabled=true;
 buttons.append(close,open);
 form.append(title,fileLabel,hint,fields,ai,notice,buttons);dialog.append(form);
 let source:TemplateSource|undefined,loading=0,copying=false,draft:AbortController|undefined;
 const inputs=()=>[...fields.querySelectorAll('input')];
 const values=()=>Object.fromEntries(inputs().map(input=>[input.name,input.value]));
 function render(source:TemplateSource){
  const legend=document.createElement('legend');legend.textContent='양식 입력 항목';
  fields.replaceChildren(legend);
  for(const {name,draft} of source.fields){
   const field=document.createElement('label'),input=document.createElement('input');
   input.name=name;input.maxLength=180;input.required=true;
   field.append(name+(draft?' (본문)':''),input);fields.append(field);
  }
  fields.hidden=!source.fields.length;
  ai.hidden=!source.fields.some(field=>field.draft);
  notice.textContent=source.fields.length?`입력 항목 ${source.fields.length}개를 찾았습니다.`:'입력 항목 없이 원본 형식의 사본을 엽니다.';
 }
 file.onchange=async()=>{
  draft?.abort();source=undefined;open.disabled=true;fields.hidden=true;ai.hidden=true;
  const selected=file.files?.[0],id=++loading;
  if(!selected){notice.textContent='';return;}
  try{
   if(selected.size>50_000_000)throw Error('50MB 이하의 양식을 선택하세요.');
   notice.textContent='기관 양식의 입력 항목을 확인하고 있습니다.';
   const bytes=new Uint8Array(await selected.arrayBuffer());
   if(id!==loading||!dialog.open)return;
   source={file:selected,bytes,fields:actions.inspect(bytes,selected.name)};
   render(source);open.disabled=false;
  }catch(error){if(id===loading)notice.textContent=error instanceof Error?error.message:String(error);}
 };
 ask.onclick=async()=>{
  if(draft){draft.abort();return;}
  if(copying||!source)return;
  const input=source,controller=new AbortController(),memo=notes.value,before=values();
  const pending=input.fields.filter(field=>field.draft&&!before[field.name]?.trim()).map(field=>field.name);
  draft=controller;open.disabled=true;ask.textContent='제안 요청 취소';notice.textContent='본문 초안을 요청했습니다.';
  try{
   const result=await actions.suggest(pending,memo,controller.signal);
   controller.signal.throwIfAborted();
   if(!dialog.open||input!==source)return;
   if(memo!==notes.value||JSON.stringify(before)!==JSON.stringify(values()))throw Error('입력 내용이 바뀌었습니다. 초안 제안을 다시 요청하세요.');
   for(const field of inputs())if(pending.includes(field.name)&&Object.hasOwn(result,field.name))field.value=result[field.name];
   notice.textContent=Object.keys(result).length?'제안한 문장을 확인한 뒤 사본을 여세요.':'입력한 메모에서 채울 내용을 찾지 못했습니다.';
  }catch(error){if(source===input)notice.textContent=controller.signal.aborted?'초안 요청을 취소했습니다.':error instanceof Error?error.message:String(error);}
  finally{draft=undefined;open.disabled=!source;ask.textContent='초안 제안 받기';}
 };
 form.onsubmit=async event=>{
  event.preventDefault();if(!source||copying||draft)return;
  copying=true;form.inert=true;
  try{await actions.open(source,values());dialog.close();}
  catch(error){notice.textContent=error instanceof Error?error.message:String(error);}
  finally{copying=false;form.inert=false;}
 };
 dialog.addEventListener('cancel',event=>{if(copying)event.preventDefault();});
 dialog.addEventListener('close',()=>{draft?.abort();dialog.remove();},{once:true});
 document.body.append(dialog);dialog.showModal();
}
