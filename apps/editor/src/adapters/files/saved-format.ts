import type {DocumentFormat} from '../../modules/document-files/public/index.ts';

// The import format still belongs to the document engine. A successful Save As
// establishes the format for this file connection without relabeling the model.
const savedFormats=new WeakMap<object,DocumentFormat>();
export function rememberSavedFormat(handle:object|null|undefined,format:unknown):void {
 if(!handle)return;
 if(format==='hwp'||format==='hwpx')savedFormats.set(handle,format);
 else savedFormats.delete(handle);
}
export function readSavedFormat(handle:object|null|undefined):DocumentFormat|undefined {
 return handle?savedFormats.get(handle):undefined;
}
