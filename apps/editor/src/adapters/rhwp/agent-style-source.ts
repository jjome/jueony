import {sha256} from '@noble/hashes/sha2.js';
import {nativeDocument,parsed} from './structure.ts';
import {readStoredStyleMetadata} from './preservation.ts';
type Source={editable:boolean;fingerprint?:string;reason?:string};
const canonical=(v:any):any=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const fingerprint=(v:any)=>Array.from(sha256(new TextEncoder().encode(JSON.stringify(canonical(v)))),n=>n.toString(16).padStart(2,'0')).join('');
/** Shared eligibility for metadata edits; no handles or raw bytes cross the public facade. */
export function readAgentStyleState(wasm:any):{styles:any[];sources:Record<string,Source>;targets:Record<string,{fingerprint:string}>}|undefined {
 const d=nativeDocument(wasm);if(typeof d.updateStyle!=='function'||typeof d.getStoredStyleDetail!=='function'||typeof d.getAgentStyleMetadata!=='function'||typeof d.getFieldList!=='function')return;
 try{const fields=parsed(d.getFieldList()),fieldFree=Array.isArray(fields)&&fields.length===0,styles=parsed(d.getStyleList());if(!Array.isArray(styles)||styles.length>256||styles.some((v,i)=>v.id!==i))return;
 const sources:Record<string,Source>={},targets:Record<string,{fingerprint:string}>={};
 for(const style of styles){const details=parsed(d.getStoredStyleDetail(style.id)),native=parsed(d.getAgentStyleMetadata(style.id)),metadata=readStoredStyleMetadata(d,style.id);
 const eligible=style.type===0&&native.rawCanonical===true&&metadata?.lockForm===false&&details?.charProps&&details?.paraProps;
 const hash=eligible?fingerprint({style,details,metadata}):undefined;
 sources[String(style.id)]=fieldFree&&style.id>0&&hash?{editable:true,fingerprint:hash}:{editable:false,reason:'필드 문서와 바탕글·글자·잠금·비정규 원본은 AI 스타일 메타데이터 편집에서 보호합니다.'};
 if(hash)targets[String(style.id)]={fingerprint:hash};
 }
 return {styles,sources,targets};
 }catch{return;}
}
