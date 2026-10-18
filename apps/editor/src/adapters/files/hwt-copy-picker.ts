import type {RestorableFileHandle} from './file-connection.ts';
type PickerSurface={showSaveFilePicker?:(options:{suggestedName:string;types:{description:string;accept:Record<string,string[]>}[]})=>Promise<RestorableFileHandle>};
/** Optional File System Access capability; never substitute a download receipt. */
export function browserHwtCopyPicker(surface:Window):((name:string)=>Promise<RestorableFileHandle>)|undefined {
 const picker=(surface as PickerSurface).showSaveFilePicker;
 if(typeof picker!=='function')return undefined;
 return name=>picker.call(surface,{suggestedName:name,types:[{description:'HWT 일반 필드 사본',accept:{'application/octet-stream':['.hwt']}}]});
}
