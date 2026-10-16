import {sha256} from '@noble/hashes/sha2.js';
import {validateBodyCaret} from '../../modules/preferences/public/index.ts';
import type {BodyCaret} from '../../modules/preferences/public/index.ts';
export type SessionStoryInput={wasm:{requiresPasswordForSave?:boolean;borrowDocumentHandle?():any;[key:string]:any}};
export type SessionStory={fingerprint:string;caret(paragraph:number,offset:number):BodyCaret|undefined;sourceType?:'body'};
const integer=(v:unknown):v is number=>Number.isSafeInteger(v)&&(v as number)>=0&&(v as number)<=2147483647;
const object=(v:any):v is Record<string,any>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const json=(v:any):any=>typeof v==='string'?JSON.parse(v):v;
function meaning(v:any):any{if(Array.isArray(v))return v.map(meaning);if(object(v))return Object.fromEntries(Object.keys(v).sort().filter(k=>!(v.fillType==='none'&&['fillColor','patternColor','patternType'].includes(k))).map(k=>[k,meaning(v[k])]));return v;}
function complete(input:SessionStoryInput,request:Record<string,unknown>){
 if(input.wasm.requiresPasswordForSave)return;
 const d=input.wasm.borrowDocumentHandle?.()??input.wasm;if(typeof d.getSessionStoryEvidence!=='function')return;
 const raw=d.getSessionStoryEvidence(JSON.stringify(request));if(typeof raw==='string'&&raw.length>32*1024*1024)return;const v=json(raw);
 if(!object(v)||v.version!==1||v.complete!==true||v.identityKnown!==true||v.kind!==request.kind||v.section!==request.section||!integer(v.parent)||!integer(v.control)||!object(v.identity)||!['semantic','instance'].includes(v.identity.mode)||v.identity.mode==='semantic'&&v.identity.instance!==null||v.identity.mode==='instance'&&(!Number.isSafeInteger(v.identity.instance)||v.identity.instance<1||v.identity.instance>4294967295)||!object(v.owner)||!Array.isArray(v.context)||v.context.length<1||v.context.length>3||!v.context.some((c:any)=>c.paragraph===v.parent)||!Array.isArray(v.paragraphs)||v.paragraphs.length<1||v.paragraphs.length>1024)return;
 if(request.kind==='header'||request.kind==='footer'){if(v.applyTo!==request.applyTo)return;}else if(v.parent!==request.parent||v.control!==request.control)return;
 let size=0,count=0;for(const p of v.paragraphs){if(!object(p)||typeof p.text!=='string'||(size+=[...p.text].length)>100000||!object(p.paragraph)||!object(p.endCharacters)||!object(p.metadata)||!object(p.style)||!Array.isArray(p.controls)||p.controls.some((c:any)=>!object(c)||Object.keys(c).length!==1||!object(c.AutoNumber))||!Array.isArray(p.characters)||(count+=p.characters.length)>4096)return;const length=[...p.text].length;let offset=0;for(const run of p.characters){if(!object(run)||!integer(run.start)||run.start!==offset||!integer(run.end)||run.end<=run.start||run.end>length||!object(run.properties))return;offset=run.end;}if(offset!==length||length===0&&!object(p.emptyCharacters))return;}
 for(const c of v.context)if(!object(c)||!integer(c.paragraph)||typeof c.text!=='string'||[...c.text].length>100000||!object(c.paragraphProperties)||!Array.isArray(c.controlKinds)||!c.controlKinds.every((k:any)=>object(k))||!object(c.host))return;
 // Only this explicitly typed root provenance is outside cursor semantic identity.
 // Real story-owner identity, ordinal, formats and surrounding content remain hashed.
 let semantic=v;if(v.provenance!==undefined){const p=v.provenance,id=(x:any)=>object(x)&&Object.keys(x).length===2&&['semantic','instance'].includes(x.mode)&&(x.mode==='semantic'?x.instance===null:Number.isSafeInteger(x.instance)&&x.instance>0&&x.instance<=4294967295);if(!object(p)||Object.keys(p).length!==3||p.kind!=='generated-paragraph-record-identities'||!Array.isArray(p.story)||p.story.length!==v.paragraphs.length||!p.story.every(id)||!Array.isArray(p.context)||p.context.length!==v.context.length||!p.context.every((c:any,i:number)=>object(c)&&Object.keys(c).length===2&&c.paragraph===v.context[i].paragraph&&id(c.identity)))return;const {provenance,...rest}=v;semantic=rest;}
 const bytes=new TextEncoder().encode(JSON.stringify(meaning(semantic))),fingerprint=Array.from(sha256(bytes),n=>n.toString(16).padStart(2,'0')).join('');return {d,v,fingerprint};
}
function points(section:number,paragraphs:any[],rect:(p:number,o:number)=>unknown){return (paragraph:number,offset:number):BodyCaret|undefined=>{
 if(!integer(paragraph)||paragraph>=paragraphs.length||!integer(offset))return;const chars=[...paragraphs[paragraph].text];if(offset>chars.length)return;
 try{const r=json(rect(paragraph,offset));if(!object(r)||!integer(r.pageIndex)||!['x','y','height'].every(k=>Number.isFinite(r[k]))||r.height<=0)return;
 return validateBodyCaret({section,paragraph,offset,paragraphLength:chars.length,before:chars.slice(Math.max(0,offset-32),offset).join(''),after:chars.slice(offset,offset+32).join('')});}catch{return;}
 };}
export function readSessionHeaderFooterStory(input:SessionStoryInput,section:number,isHeader:boolean,applyTo:number):SessionStory|undefined{
 if(!integer(section)||typeof isHeader!=='boolean'||![0,1,2].includes(applyTo))return;try{const s=complete(input,{kind:isHeader?'header':'footer',section,applyTo});if(!s)return;
 const definition=json(s.d.getHeaderFooter(section,isHeader,applyTo));if(!definition?.ok||!definition.exists||definition.applyTo!==applyTo||definition.paraIndex!==s.v.parent||definition.controlIndex!==s.v.control||definition.paraCount!==s.v.paragraphs.length)return;
 return {fingerprint:s.fingerprint,caret:points(section,s.v.paragraphs,(p,o)=>s.d.getCursorRectInHeaderFooter(section,isHeader,applyTo,p,o,-1))};}catch{return;}
}
export function readSessionFootnoteStory(input:SessionStoryInput,section:number,parent:number,control:number,page:number,index:number):SessionStory|undefined{
 if(![section,parent,control,page,index].every(integer))return;try{const d=input.wasm.borrowDocumentHandle?.()??input.wasm,location=json(d.getPageFootnoteInfo(page,index));if(!location?.ok||location.sectionIdx!==section||location.paraIdx!==parent||location.controlIdx!==control||location.sourceType!=='body')return;
 const s=complete(input,{kind:'footnote',section,parent,control});if(!s)return;return {fingerprint:s.fingerprint,sourceType:location.sourceType,caret:points(section,s.v.paragraphs,(p,o)=>s.d.getCursorRectInFootnote(page,index,p,o))};}catch{return;}
}
