export function showInstitutionReviewDialog(
 create:(files:File[],notes:string,signal:AbortSignal)=>Promise<{name:string;archive:Uint8Array}>,
):void{
 const dialog=document.createElement('dialog');dialog.id='institution-review-dialog';
 const form=document.createElement('form');
 const title=document.createElement('h2');title.textContent='문서 검토 묶음';
 const help=document.createElement('p');help.className='hint';help.textContent='현재 문서, 선택한 붙임과 검토 메모를 초안 ZIP으로 저장합니다.';
 const file=document.createElement('input');file.type='file';file.multiple=true;
 const fileLabel=document.createElement('label');fileLabel.append('붙임 파일',file);
 const notes=document.createElement('textarea');notes.maxLength=1000;notes.rows=4;
 const notesLabel=document.createElement('label');notesLabel.append('검토 메모',notes);
 const status=document.createElement('p');status.setAttribute('role','status');
 const actions=document.createElement('div');actions.className='dialog-actions';
 const close=document.createElement('button');close.type='button';close.textContent='닫기';close.onclick=()=>dialog.close();
 const submit=document.createElement('button');submit.type='submit';submit.textContent='검토 묶음 저장';
 actions.append(close,submit);form.append(title,help,fileLabel,notesLabel,status,actions);dialog.append(form);
 let task:AbortController|undefined;
 file.onchange=()=>{status.textContent=`붙임 ${file.files?.length??0}개를 선택했습니다.`;};
 form.onsubmit=async event=>{
  event.preventDefault();if(task)return;
  const controller=new AbortController(),files=[...(file.files??[])];
  task=controller;submit.disabled=file.disabled=notes.disabled=true;
  status.textContent='문서와 붙임을 확인하고 있습니다.';
  try{
   const {name,archive}=await create(files,notes.value,controller.signal);
   controller.signal.throwIfAborted();
   const link=document.createElement('a');
   const url=URL.createObjectURL(new Blob([new Uint8Array(archive)],{type:'application/zip'}));
   link.href=url;link.download=name;link.click();
   window.setTimeout(()=>URL.revokeObjectURL(url),1000);
   dialog.close();
  }catch(error){if(dialog.open)status.textContent=error instanceof Error?error.message:String(error);}
  finally{task=undefined;submit.disabled=file.disabled=notes.disabled=false;}
 };
 dialog.addEventListener('close',()=>{task?.abort();dialog.remove();},{once:true});
 document.body.append(dialog);dialog.showModal();
}
