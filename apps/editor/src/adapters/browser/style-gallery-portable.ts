import {sha256} from '@noble/hashes/sha2.js';
import {parseStyleGalleryProfile,validateStyleGalleryProfile,type StyleGalleryProfile} from '../../modules/document/public/style-gallery-profile.ts';
import {parseStylePackage} from '../../modules/document/public/style-package.ts';
import {STYLE_GALLERY_PROFILE_KEY} from './style-gallery-profile.ts';

type StoragePort=Pick<Storage,'getItem'|'setItem'|'removeItem'>;
export type StyleGalleryPortablePreview=Readonly<{version:1;kind:'profile'|'package';expectedStorageSha256:string;profileSha256:string;profile:StyleGalleryProfile}>;
export class StyleGalleryPortableStorageError extends Error{
  readonly settingsState:'unchanged'|'uncertain';
  constructor(message:string,settingsState:'unchanged'|'uncertain'){super(message);this.name='StyleGalleryPortableStorageError';this.settingsState=settingsState;}
}
const canonical=(value:any):any=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
const digest=(value:unknown)=>Array.from(sha256(new TextEncoder().encode(typeof value==='string'?value:JSON.stringify(canonical(value)))),byte=>byte.toString(16).padStart(2,'0')).join('');
const storageDigest=(raw:string|null)=>digest(raw===null?'jueony-style-gallery-profile:absent':`jueony-style-gallery-profile:${raw}`);
const checkedId=(value:unknown)=>typeof value==='string'&&/^[a-z0-9][a-z0-9._-]{0,79}$/u.test(value)?value:undefined;
const checkedLabel=(value:unknown)=>typeof value==='string'&&value.trim()&&value.trim().length<=120&&!/[\u0000-\u001f\u007f]/u.test(value)?value.trim().normalize('NFC'):undefined;
function readRaw(storage:StoragePort):string|null{try{return storage.getItem(STYLE_GALLERY_PROFILE_KEY);}catch{throw new StyleGalleryPortableStorageError('스타일마당 프로필을 읽지 못했습니다.','uncertain');}}
function current(storage:StoragePort):{raw:string|null;profile?:StyleGalleryProfile}{const raw=readRaw(storage);return{raw,...(raw===null?{}:{profile:parseStyleGalleryProfile(raw)})};}
function pretty(value:unknown){return JSON.stringify(value,null,2);}

export function exportPortableStyleGalleryProfile(storage:StoragePort):string{
  const value=current(storage).profile;if(!value)throw new Error('내보낼 스타일마당 프로필이 없습니다.');return pretty(value);
}
export function exportPortableStyleGalleryPackage(storage:StoragePort,entryId:string):string{
  const value=current(storage).profile,entry=value?.gallery.find(item=>item.id===entryId);if(!entry)throw new Error('내보낼 스타일마당 항목을 다시 선택하세요.');return pretty(entry.package);
}
export function previewPortableStyleGalleryImport(storage:StoragePort,source:string,packageEntry?:{id:unknown;label:unknown}):StyleGalleryPortablePreview{
  if(typeof source!=='string'||source.length>2_000_000)throw new Error('가져올 스타일마당 JSON은 2MB 이하여야 합니다.');
  const before=current(storage);let decoded:any;try{decoded=JSON.parse(source);}catch{throw new Error('가져올 스타일마당 JSON 형식을 확인하세요.');}
  let kind:'profile'|'package',profile:StyleGalleryProfile;
  if(decoded?.format==='jueony-style-gallery-profile'){kind='profile';profile=parseStyleGalleryProfile(source);}
  else if(decoded?.format==='jueony-styles'){
    kind='package';const packageValue=parseStylePackage(source),id=checkedId(packageEntry?.id),label=checkedLabel(packageEntry?.label);
    if(!before.profile)throw new Error('스타일 패키지를 추가할 기존 스타일마당 프로필이 없습니다.');
    if(!id||!label)throw new Error('추가할 스타일마당 ID와 이름을 확인하세요.');
    if(before.profile.gallery.some(entry=>entry.id===id||entry.label.normalize('NFC')===label))throw new Error('같은 ID 또는 이름의 스타일마당 항목이 이미 있습니다.');
    profile=validateStyleGalleryProfile({...before.profile,gallery:[...before.profile.gallery,{id,label,package:packageValue}]});
  }else throw new Error('지원하는 스타일마당 프로필 또는 스타일 패키지 JSON이 아닙니다.');
  const profileSha256=digest(profile);if(before.profile&&digest(before.profile)===profileSha256)throw new Error('현재 설정과 동일한 스타일마당 프로필이 이미 있습니다.');
  return{version:1,kind,expectedStorageSha256:storageDigest(before.raw),profileSha256,profile};
}
export function commitPortableStyleGalleryImport(storage:StoragePort,preview:StyleGalleryPortablePreview):StyleGalleryProfile{
  if(!preview||preview.version!==1||!['profile','package'].includes(preview.kind)||!/^\p{ASCII_Hex_Digit}{64}$/u.test(preview.expectedStorageSha256)||!/^\p{ASCII_Hex_Digit}{64}$/u.test(preview.profileSha256))throw new Error('스타일마당 가져오기 미리보기 정보가 올바르지 않습니다.');
  const profile=validateStyleGalleryProfile(preview.profile);if(digest(profile)!==preview.profileSha256)throw new Error('스타일마당 가져오기 내용이 미리보기 후 바뀌었습니다.');
  const before=readRaw(storage);if(storageDigest(before)!==preview.expectedStorageSha256)throw new Error('스타일마당 설정이 미리보기 후 바뀌었습니다. 다시 가져오세요.');
  if(before!==null)parseStyleGalleryProfile(before);const next=JSON.stringify(profile);
  try{
    storage.setItem(STYLE_GALLERY_PROFILE_KEY,next);const after=readRaw(storage);
    if(after!==next||digest(parseStyleGalleryProfile(after))!==preview.profileSha256)throw new Error('readback');
  }catch{
    let observed:string|null;try{observed=readRaw(storage);}catch{throw new StyleGalleryPortableStorageError('스타일마당 저장 결과를 확인하지 못했습니다. 설정을 다시 열어 확인하세요.','uncertain');}
    if(observed!==before){try{if(before===null)storage.removeItem(STYLE_GALLERY_PROFILE_KEY);else storage.setItem(STYLE_GALLERY_PROFILE_KEY,before);}catch{throw new StyleGalleryPortableStorageError('스타일마당 저장 실패 후 기존 설정을 복원하지 못했습니다.','uncertain');}
      try{if(readRaw(storage)!==before)throw new Error('readback');}catch{throw new StyleGalleryPortableStorageError('스타일마당 저장 실패 후 기존 설정을 복원하지 못했습니다.','uncertain');}}
    throw new StyleGalleryPortableStorageError('스타일마당 프로필을 저장하지 못했습니다. 기존 설정을 유지합니다.','unchanged');
  }
  return profile;
}
