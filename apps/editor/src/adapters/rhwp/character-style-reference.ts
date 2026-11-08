import {sha256} from '@noble/hashes/sha2.js';
import type {StoredCharacterStyleReference} from '../../modules/document/public/character-style-reference.ts';

type Style = {id:number;type:number;charShapeId:number;name:string;[key:string]:unknown};
const integer=(value:unknown):value is number=>Number.isSafeInteger(value)&&(value as number)>=0;
const parsed=(value:unknown):unknown=>typeof value==='string'?JSON.parse(value):value;
const canonical=(value:any):any=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
const digest=(value:unknown)=>Array.from(sha256(new TextEncoder().encode(JSON.stringify(canonical(value)))),byte=>byte.toString(16).padStart(2,'0')).join('');

function state(document:any,styleId:number){
  if(!document||typeof document.getStyleList!=='function'||typeof document.getStyleDetail!=='function'||!integer(styleId)||styleId>255)throw new Error('저장 글자 스타일 정의를 확인할 수 없습니다.');
  const raw=parsed(document.getStyleList());
  if(!Array.isArray(raw)||raw.length<1||raw.length>256)throw new Error('저장 스타일 목록이 올바르지 않습니다.');
  const styles:Style[]=raw.map((value:any,index:number)=>{
    if(!value||typeof value!=='object'||value.id!==index||![0,1].includes(value.type)||!integer(value.charShapeId)||value.charShapeId>0xffff||typeof value.name!=='string')throw new Error('저장 스타일 정의가 손상되었습니다.');
    return value as Style;
  });
  const style=styles[styleId];
  if(!style||style.type!==1)throw new Error('적용할 저장 글자 스타일을 다시 선택하세요.');
  if(styles.some(other=>other.id!==style.id&&other.charShapeId===style.charShapeId))throw new Error('여러 스타일이 같은 글자 모양 정의를 공유하여 안전하게 연결할 수 없습니다.');
  const detail=parsed(document.getStyleDetail(styleId));
  if(!detail||typeof detail!=='object')throw new Error('저장 글자 스타일의 모양 정의를 확인할 수 없습니다.');
  return {style,definitionSha256:digest({styles,detail})};
}

/** Capture the exact stored definition selected by the user. */
export function captureStoredCharacterStyle(document:any,styleId:number):StoredCharacterStyleReference {
  const current=state(document,styleId);
  return {kind:'stored-character-style',version:1,styleId,charShapeId:current.style.charShapeId,definitionSha256:current.definitionSha256};
}

/** Re-read and compare immediately before mutation; stale and ambiguous links fail closed. */
export function verifyStoredCharacterStyle(document:any,reference:StoredCharacterStyleReference):{styleId:number;charShapeId:number} {
  if(!reference||reference.kind!=='stored-character-style'||reference.version!==1||!integer(reference.styleId)||!integer(reference.charShapeId)||reference.charShapeId>0xffff||!/^[0-9a-f]{64}$/u.test(reference.definitionSha256))throw new Error('저장 글자 스타일 참조가 올바르지 않습니다.');
  const current=state(document,reference.styleId);
  if(current.style.charShapeId!==reference.charShapeId||current.definitionSha256!==reference.definitionSha256)throw new Error('글자 스타일 정의가 바뀌었습니다. 최신 목록에서 다시 선택하세요.');
  return {styleId:reference.styleId,charShapeId:reference.charShapeId};
}
