import {sha256} from '@noble/hashes/sha2.js';
import type {StoredStyleShortcutProfile} from '../browser/style-shortcut-profile.ts';

type Style={id:number;name:string;type:0|1;[key:string]:unknown};
export type CurrentStyleShortcutScope=Readonly<{profileId:string;entryId:string;profileSha256:string}>;
export type ResolvedStyleShortcutCommand=Readonly<{kind:'apply-stored-style';slot:number;styleId:number;styleName:string;styleType:0|1;source:'package'|'document'}>;
const parsed=(value:any):any=>typeof value==='string'?JSON.parse(value):value;
const canonical=(value:any):any=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
const hash=(value:unknown)=>Array.from(sha256(new TextEncoder().encode(JSON.stringify(canonical(value)))),byte=>byte.toString(16).padStart(2,'0')).join('');
const digest=(value:unknown)=>typeof value==='string'&&/^[0-9a-f]{64}$/u.test(value);
const integer=(value:unknown,min:number,max:number)=>Number.isSafeInteger(value)&&(value as number)>=min&&(value as number)<=max;
const normalized=(value:string)=>value.normalize('NFC');

function catalog(document:any):Style[]{
  const value=parsed(document?.getStyleList?.());
  if(!Array.isArray(value)||value.length<1||value.length>256)throw new Error('catalog');
  return value.map((style:any,index:number)=>{if(!style||typeof style!=='object'||style.id!==index||typeof style.name!=='string'||style.name.length<1||![0,1].includes(style.type))throw new Error('catalog');return style as Style;});
}

/** Exact digest used by the read-only consumer. Producers must bind settings to this current catalog. */
export function currentStyleCatalogSha256(document:any):string{return hash(catalog(document));}

/**
 * Resolve only. No document or preference mutation is performed here.
 * Any malformed, stale, missing or ambiguous evidence returns no command.
 */
export function resolveStoredStyleShortcut(document:any,stored:StoredStyleShortcutProfile|undefined,scope:CurrentStyleShortcutScope,slot:unknown):ResolvedStyleShortcutCommand|undefined{
  try{
    if(!stored||stored.format!=='jueony-style-shortcut-profile'||stored.version!==1||!scope||stored.profileId!==scope.profileId||stored.entryId!==scope.entryId||!digest(scope.profileSha256)||stored.profileSha256!==scope.profileSha256||!digest(stored.documentSha256)||!integer(slot,0,9))return;
    const styles=catalog(document);if(hash(styles)!==stored.documentSha256)return;
    if(!Array.isArray(stored.slots)||stored.slots.length>10||new Set(stored.slots.map(value=>value.slot)).size!==stored.slots.length)return;
    const assignments=stored.slots.filter(value=>value?.slot===slot);if(assignments.length!==1)return;
    const assignment=assignments[0];if(!integer(assignment.styleId,0,255)||typeof assignment.styleName!=='string'||!['package','document'].includes(assignment.source))return;
    const style=styles[assignment.styleId];if(!style||normalized(style.name)!==normalized(assignment.styleName))return;
    if(styles.filter(value=>normalized(value.name)===normalized(assignment.styleName)).length!==1)return;
    return{kind:'apply-stored-style',slot:slot as number,styleId:style.id,styleName:style.name,styleType:style.type,source:assignment.source};
  }catch{return;}
}
