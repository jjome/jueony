export const STYLE_SHORTCUT_PROFILE_KEY='jueony-style-shortcut-profile';
type StoragePort=Pick<Storage,'getItem'|'setItem'|'removeItem'>;
type Slot={slot:number;styleId:number;styleName:string;source:'package'|'document'};
export type ShortcutPreviewEvidence=Readonly<{version:1;profileId:string;profileName:string;entryId:string;profileSha256:string;documentSha256:string;expectedStyleIds:readonly number[];slots:readonly Slot[]}>;
export type StoredStyleShortcutProfile=Readonly<{format:'jueony-style-shortcut-profile';version:1;profileId:string;profileName:string;entryId:string;profileSha256:string;documentSha256:string;slots:readonly Slot[]}>;
const digest=(value:unknown)=>typeof value==='string'&&/^[0-9a-f]{64}$/u.test(value);
const text=(value:unknown,max=250)=>typeof value==='string'&&value.length>0&&value.length<=max&&!/[\u0000-\u001f\u007f]/u.test(value);
const integer=(value:unknown,min:number,max:number)=>Number.isSafeInteger(value)&&(value as number)>=min&&(value as number)<=max;
const same=(left:unknown,right:unknown)=>JSON.stringify(left)===JSON.stringify(right);

function preview(value:any):ShortcutPreviewEvidence{
  if(!value||typeof value!=='object'||value.version!==1||!text(value.profileId,80)||!text(value.profileName,120)||!text(value.entryId,80)||!digest(value.profileSha256)||!digest(value.documentSha256)||!Array.isArray(value.expectedStyleIds)||value.expectedStyleIds.some((id:unknown)=>!integer(id,0,255))||new Set(value.expectedStyleIds).size!==value.expectedStyleIds.length||!Array.isArray(value.slots)||value.slots.length>10)throw new Error('번호키 설정 미리보기 증거가 올바르지 않습니다.');
  const slots=value.slots.map((slot:any)=>{if(!slot||typeof slot!=='object'||!integer(slot.slot,0,9)||!integer(slot.styleId,0,255)||!text(slot.styleName)||!['package','document'].includes(slot.source))throw new Error('번호키 스타일 지정이 올바르지 않습니다.');return{slot:slot.slot,styleId:slot.styleId,styleName:slot.styleName.normalize('NFC'),source:slot.source};});
  if(new Set(slots.map((slot:Slot)=>slot.slot)).size!==slots.length)throw new Error('번호키 지정이 중복됩니다.');
  if(slots.some((slot:Slot)=>slot.source==='package'&&!value.expectedStyleIds.includes(slot.styleId)))throw new Error('가져올 스타일 ID와 번호키 대상이 일치하지 않습니다.');
  return{version:1,profileId:value.profileId,profileName:value.profileName.normalize('NFC'),entryId:value.entryId,profileSha256:value.profileSha256,documentSha256:value.documentSha256,expectedStyleIds:[...value.expectedStyleIds],slots};
}
function stored(value:unknown):StoredStyleShortcutProfile{
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('저장된 번호키 스타일 설정이 손상되었습니다.');const source=value as any;
  if(source.format!=='jueony-style-shortcut-profile'||source.version!==1||Object.keys(source).some(key=>!['format','version','profileId','profileName','entryId','profileSha256','documentSha256','slots'].includes(key)))throw new Error('지원하지 않는 번호키 스타일 설정 버전입니다.');
  const checked=preview({...source,version:1,expectedStyleIds:source.slots?.filter((slot:any)=>slot?.source==='package').map((slot:any)=>slot.styleId)??[]});
  return{format:'jueony-style-shortcut-profile',version:1,profileId:checked.profileId,profileName:checked.profileName,entryId:checked.entryId,profileSha256:checked.profileSha256,documentSha256:checked.documentSha256,slots:checked.slots};
}
function readRaw(storage:StoragePort){try{return storage.getItem(STYLE_SHORTCUT_PROFILE_KEY);}catch{throw new Error('번호키 스타일 설정을 읽지 못했습니다.');}}

export function createStyleShortcutProfileStore(storage:StoragePort){
  function read():StoredStyleShortcutProfile|undefined{const raw=readRaw(storage);if(raw===null)return;let value:unknown;try{value=JSON.parse(raw);}catch{throw new Error('저장된 번호키 스타일 설정 JSON이 손상되었습니다.');}return stored(value);}
  function save(value:ShortcutPreviewEvidence,revalidate:()=>ShortcutPreviewEvidence):StoredStyleShortcutProfile{
    const before=readRaw(storage);if(before!==null)read();const requested=preview(value);let current:ShortcutPreviewEvidence;
    try{current=preview(revalidate());}catch{throw new Error('현재 프로필과 문서에서 번호키 설정을 다시 검증하지 못했습니다.');}
    if(!same(requested,current))throw new Error('프로필, 문서 또는 번호키 계획이 바뀌었습니다. 다시 미리 보세요.');
    const record:StoredStyleShortcutProfile={format:'jueony-style-shortcut-profile',version:1,profileId:requested.profileId,profileName:requested.profileName,entryId:requested.entryId,profileSha256:requested.profileSha256,documentSha256:requested.documentSha256,slots:requested.slots},raw=JSON.stringify(record);
    try{storage.setItem(STYLE_SHORTCUT_PROFILE_KEY,raw);if(readRaw(storage)!==raw)throw new Error('readback');}
    catch{
      let currentRaw:string|null;try{currentRaw=readRaw(storage);}catch{throw new Error('번호키 스타일 설정 저장 실패 후 기존 설정을 확인하지 못했습니다.');}
      if(currentRaw!==before){try{if(before===null)storage.removeItem(STYLE_SHORTCUT_PROFILE_KEY);else storage.setItem(STYLE_SHORTCUT_PROFILE_KEY,before);}catch{throw new Error('번호키 스타일 설정 저장 실패 후 기존 설정을 복원하지 못했습니다.');}if(readRaw(storage)!==before)throw new Error('번호키 스타일 설정 저장 실패 후 기존 설정을 복원하지 못했습니다.');}
      throw new Error('번호키 스타일 설정을 저장하지 못했습니다. 기존 설정을 유지합니다.');
    }
    return record;
  }
  return{read,save};
}
