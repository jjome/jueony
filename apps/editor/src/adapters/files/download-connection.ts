import {rememberSavedFormat} from './saved-format.ts';

type Format = 'hwp'|'hwpx'|'hml';
type DocumentConnection = {documentGeneration:number;fileName:string;currentFileHandle:object|null};
const acknowledged=new WeakMap<object,{generation:number;name:string;format:Format}>();

/** A download has no writable backing handle. Only the user's final download
 * acknowledgement may replace its name/format; no picker or confirmation does. */
export function acknowledgeDownloadedFile(document:DocumentConnection,name:string,format:Format):void {
 rememberSavedFormat(document.currentFileHandle,undefined);
 document.currentFileHandle=null;
 document.fileName=name;
 acknowledged.set(document,{generation:document.documentGeneration,name,format});
}

export function readDownloadedFormat(document:DocumentConnection):Format|undefined {
 const saved=acknowledged.get(document);
 if(!saved||document.currentFileHandle||saved.generation!==document.documentGeneration||saved.name!==document.fileName)return undefined;
 return saved.format;
}
