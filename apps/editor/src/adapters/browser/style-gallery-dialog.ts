import type {StyleGalleryProfile} from '../../modules/document/public/style-gallery-profile.ts';
import type {StyleGalleryPreview,StyleGalleryWarning} from '../rhwp/style-gallery-controller.ts';

export function showStyleGalleryDialog(
  profile:StyleGalleryProfile|undefined,
  previewEntry:(entryId:string)=>StyleGalleryPreview,
  apply:(preview:StyleGalleryPreview,acknowledgements:StyleGalleryWarning['code'][])=>void,
):void{
  const dialog=document.createElement('dialog');
  dialog.className='jueony-style-gallery-dialog';
  dialog.setAttribute('aria-labelledby','jueony-style-gallery-title');
  const title=document.createElement('h2');
  title.id='jueony-style-gallery-title';
  title.textContent='스타일마당 적용';
  const details=document.createElement('p');
  details.textContent=profile?`${profile.organization} · ${profile.name}`:'편집기 상단의 스타일마당 JSON에서 기관 프로필을 가져오세요.';
  const label=document.createElement('label');
  label.textContent='스타일 묶음 ';
  const choice=document.createElement('select');
  for(const entry of profile?.gallery??[]){
    const option=document.createElement('option');
    option.value=entry.id;option.textContent=entry.label;choice.append(option);
  }
  label.append(choice);
  label.hidden=!profile;
  const status=document.createElement('p');
  status.setAttribute('role','status');
  const warning=document.createElement('label');
  const check=document.createElement('input');
  check.type='checkbox';
  const warningText=document.createElement('span');
  warning.append(check,' ',warningText);
  const confirm=document.createElement('button');
  confirm.type='button';confirm.textContent='현재 문서에 적용';
  const close=document.createElement('button');
  close.type='button';close.textContent='닫기';close.onclick=()=>dialog.close();
  let preview:StyleGalleryPreview|undefined;
  const sync=()=>{confirm.disabled=!preview||(!warning.hidden&&!check.checked);};
  const update=()=>{
    preview=undefined;check.checked=false;warning.hidden=true;
    if(choice.value)try{
      preview=previewEntry(choice.value);
      const slots=preview.slots.map(slot=>`Ctrl+${(slot.slot+1)%10} ${slot.styleName}`);
      status.textContent=`추가할 스타일 ${preview.expectedStyleIds.length}개${slots.length?' · '+slots.join(', '):''}`;
      warning.hidden=!preview.storedTime.warnings.length;
      warningText.textContent=preview.storedTime.warnings.map(item=>item.message).join(' ');
    }catch(error){status.textContent=error instanceof Error?error.message:String(error);}
    sync();
  };
  choice.onchange=update;
  check.onchange=sync;
  confirm.onclick=()=>{
    if(!preview||confirm.disabled)return;
    try{
      apply(preview,check.checked?preview.storedTime.warnings.map(item=>item.code):[]);
      dialog.close();
    }catch(error){status.textContent=error instanceof Error?error.message:String(error);}
  };
  const actions=document.createElement('p');
  actions.append(confirm,' ',close);
  dialog.append(title,details,label,status,warning,actions);
  document.body.append(dialog);
  dialog.addEventListener('close',()=>dialog.remove(),{once:true});
  update();dialog.showModal();
}
