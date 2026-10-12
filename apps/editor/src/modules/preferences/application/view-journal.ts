import type {DocumentViewState} from '../public/contracts.ts';
import {PreferenceStorageError} from '../public/contracts.ts';
import type {PreferenceStorage} from '../ports/storage.ts';
import {validateDocumentView} from '../domain/document-view.ts';
export const VIEW_JOURNAL_KEY='jueony-document-view-journal-v1';
export type ViewJournalEntry={documentId:string;workspaceId:string;checkpointAt:number;recordedAt:number;view:DocumentViewState};
const stamp=(v:unknown):v is number=>Number.isSafeInteger(v)&&(v as number)>=0;
const id=(v:unknown):v is string=>typeof v==='string'&&v.length>0&&v.length<=128;
function entry(value:any):ViewJournalEntry|undefined{
 if(!value||!id(value.documentId)||!id(value.workspaceId)||typeof value.checkpointAt!=='number'||!Number.isFinite(value.checkpointAt)||value.checkpointAt<0||!stamp(value.recordedAt))return;
 const view=validateDocumentView(value.view);if(!view)return;
 return {documentId:value.documentId,workspaceId:value.workspaceId,checkpointAt:value.checkpointAt,recordedAt:value.recordedAt,view};
}
/** Only a small synchronous exit fallback; document bytes remain owned by IndexedDB. */
export function createDocumentViewJournal(storage:PreferenceStorage){
 function load():ViewJournalEntry[]{
  let raw:string|null;try{raw=storage.getItem(VIEW_JOURNAL_KEY);}catch{throw new PreferenceStorageError('read');}
  if(!raw)return [];
  let parsed:any;try{if(raw.length>1000000||new TextEncoder().encode(raw).byteLength>1000000)throw 0;parsed=JSON.parse(raw);}catch{throw new PreferenceStorageError('corrupt');}
  if(!parsed||typeof parsed!=='object'||!Number.isSafeInteger(parsed.version))throw new PreferenceStorageError('corrupt');
  if(parsed.version!==1)throw new PreferenceStorageError('version');
  if(!Array.isArray(parsed.entries)||parsed.entries.length>64)throw new PreferenceStorageError('corrupt');
  const entries=parsed.entries.map(entry);if(entries.some((v:unknown)=>!v))throw new PreferenceStorageError('corrupt');return entries;
 }
 function checkpoint(values:ViewJournalEntry[]){
  const existing=load().sort((a,b)=>a.recordedAt-b.recordedAt),next=new Map(existing.map(e=>[JSON.stringify([e.workspaceId,e.documentId]),e]));
  for(const value of values){const clean=entry(value);if(!clean)throw new PreferenceStorageError('corrupt');const key=JSON.stringify([clean.workspaceId,clean.documentId]);if(!next.has(key)||next.get(key)!.recordedAt<=clean.recordedAt){next.delete(key);next.set(key,clean);}}
  const entries=[...next.values()].slice(-64);
  const raw=JSON.stringify({version:1,entries});if(new TextEncoder().encode(raw).byteLength>1000000)throw new PreferenceStorageError('write');
  try{storage.setItem(VIEW_JOURNAL_KEY,raw);}catch{throw new PreferenceStorageError('write');}
 }
 function readRecord(documentId:string,workspaceId:string,checkpointAt:number,minimumStamp:number=0):ViewJournalEntry|undefined{
  const found=load().find(e=>e.documentId===documentId&&e.workspaceId===workspaceId&&e.checkpointAt===checkpointAt&&e.recordedAt>=minimumStamp);
  return found?entry(found):undefined;
 }
 const read=(documentId:string,workspaceId:string,checkpointAt:number,minimumStamp:number=0)=>readRecord(documentId,workspaceId,checkpointAt,minimumStamp)?.view;
 function remove(documentId:string,workspaceId:string){
  const entries=load().filter(e=>e.documentId!==documentId||e.workspaceId!==workspaceId);
  try{storage.setItem(VIEW_JOURNAL_KEY,JSON.stringify({version:1,entries}));}catch{throw new PreferenceStorageError('write');}
 }
 return {checkpoint,read,readRecord,remove};
}
