import {sha256} from '@noble/hashes/sha2.js';
import type {StyleGalleryProfile} from '../../modules/document/public/style-gallery-profile.ts';
import {validateStyleGalleryProfile} from '../../modules/document/public/style-gallery-profile.ts';
import {importStyleNames,importStylePackage} from './style-package-native.ts';

type ProfileStore={read():StyleGalleryProfile|undefined};
type PlannedSlot={slot:number;styleId:number;styleName:string;source:'package'|'document'};
export type StyleGalleryPreview=Readonly<{version:1;profileId:string;profileName:string;entryId:string;entryLabel:string;profileSha256:string;documentSha256:string;expectedStyleIds:readonly number[];slots:readonly PlannedSlot[]}>;
export type StyleGalleryApplyResult=Readonly<{styleIds:readonly number[];slots:readonly PlannedSlot[]}>;
const parsed=(value:any):any=>typeof value==='string'?JSON.parse(value):value;
const raw=(wasm:any)=>wasm.borrowDocumentHandle?.()??wasm;
const canonical=(value:any):any=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
const digest=(value:unknown)=>Array.from(sha256(new TextEncoder().encode(JSON.stringify(canonical(value)))),byte=>byte.toString(16).padStart(2,'0')).join('');
const name=(value:string)=>value.normalize('NFC');

function catalog(document:any):any[]{
  const value=parsed(document?.getStyleList?.());
  if(!Array.isArray(value)||value.length<1||value.length>256||value.some((style,index)=>!style||typeof style!=='object'||style.id!==index||![0,1].includes(style.type)||typeof style.name!=='string'))throw new Error('현재 문서의 스타일 목록을 확인할 수 없습니다.');
  return value;
}
function profile(store:ProfileStore,profileId:string,profileName:string){
  const value=store.read();if(!value)throw new Error('적용할 스타일마당 프로필이 없습니다.');
  const checked=validateStyleGalleryProfile(value);
  if(checked.id!==profileId||checked.name!==name(profileName))throw new Error('스타일마당 프로필 이름 또는 ID가 바뀌었습니다. 다시 선택하세요.');
  return checked;
}
function planning(store:ProfileStore,wasm:any,selection:{profileId:string;profileName:string;entryId:string}){
  const checked=profile(store,selection.profileId,selection.profileName),entry=checked.gallery.find(value=>value.id===selection.entryId);
  if(!entry)throw new Error('스타일마당 항목이 바뀌었습니다. 다시 선택하세요.');
  const document=raw(wasm),styles=catalog(document),expectedStyleIds=entry.package.styles.map((_,index)=>styles.length+index);
  if(expectedStyleIds.some(id=>id>255))throw new Error('스타일마당을 적용하면 문서의 스타일 정의가 256개를 넘습니다.');
  const importedNames=importStyleNames(document,entry.package),slots:PlannedSlot[]=[];
  for(const assignment of checked.shortcuts){
    const wanted=name(assignment.styleName),packageMatches=entry.package.styles.flatMap((style,index)=>name(style.name)===wanted?[index]:[]),documentMatches=styles.filter(style=>name(style.name)===wanted);
    if(packageMatches.length+documentMatches.length!==1)throw new Error(`번호키 ${assignment.slot}의 스타일 이름이 없거나 충돌합니다.`);
    if(packageMatches.length===1){const index=packageMatches[0];slots.push({slot:assignment.slot,styleId:expectedStyleIds[index],styleName:importedNames[index].name,source:'package'});}
    else slots.push({slot:assignment.slot,styleId:documentMatches[0].id,styleName:documentMatches[0].name,source:'document'});
  }
  return {checked,entry,styles,expectedStyleIds,slots,profileSha256:digest(checked),documentSha256:digest(styles)};
}

/** Pure preview. It never imports definitions or writes profile/shortcut settings. */
export function previewStyleGallery(store:ProfileStore,wasm:any,selection:{profileId:string;profileName:string;entryId:string}):StyleGalleryPreview {
  const plan=planning(store,wasm,selection);
  return {version:1,profileId:plan.checked.id,profileName:plan.checked.name,entryId:plan.entry.id,entryLabel:plan.entry.label,profileSha256:plan.profileSha256,documentSha256:plan.documentSha256,expectedStyleIds:plan.expectedStyleIds,slots:plan.slots};
}

/** Apply the exact preview; every stale/conflict check completes before mutation. */
export function applyStyleGalleryPreview(store:ProfileStore,wasm:any,preview:StyleGalleryPreview):StyleGalleryApplyResult {
  if(!preview||preview.version!==1||!/^[0-9a-f]{64}$/u.test(preview.profileSha256)||!/^[0-9a-f]{64}$/u.test(preview.documentSha256))throw new Error('스타일마당 미리보기 정보가 올바르지 않습니다.');
  const plan=planning(store,wasm,{profileId:preview.profileId,profileName:preview.profileName,entryId:preview.entryId});
  if(plan.profileSha256!==preview.profileSha256||plan.documentSha256!==preview.documentSha256||digest(plan.expectedStyleIds)!==digest(preview.expectedStyleIds)||digest(plan.slots)!==digest(preview.slots))throw new Error('프로필, 번호키 또는 문서 스타일이 바뀌었습니다. 다시 미리 보세요.');
  const document=raw(wasm),checkpoint=document.saveSnapshot();
  try{
    const styleIds=importStylePackage(document,plan.entry.package);
    if(digest(styleIds)!==digest(plan.expectedStyleIds))throw new Error('가져온 스타일 ID가 미리보기와 다릅니다.');
    const after=catalog(document);
    for(const slot of plan.slots)if(!after.some(style=>style.id===slot.styleId&&style.name===slot.styleName))throw new Error('번호키 대상 스타일이 가져오기 결과와 다릅니다.');
    return {styleIds,slots:plan.slots};
  }catch(error){
    const restored=parsed(document.restoreSnapshot(checkpoint));
    if(restored?.ok===false)throw new Error('실패한 스타일마당 적용을 원래 문서로 되돌리지 못했습니다.');
    throw error;
  }finally{document.discardSnapshot(checkpoint);}
}
