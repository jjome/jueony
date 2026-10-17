import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {resolve,join,isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadReviewEngine,differences,hash} from '../../apps/editor/scripts/lib/hancom-review.mjs';
import {readSessionHeaderFooterStory,readSessionFootnoteStory} from '../../apps/editor/src/adapters/rhwp/session-story.ts';
import {captureSessionCursor,restoreSessionCursor} from '../../apps/editor/src/adapters/rhwp/session-cursor.ts';
const absolute=(v,n)=>{assert.ok(typeof v==='string'&&isAbsolute(v),n+' must be absolute');return resolve(v);};
const old=await loadReviewEngine(absolute(process.env.JUEONY_LEGACY_ENGINE_PACKAGE,'JUEONY_LEGACY_ENGINE_PACKAGE'));
const fresh=await loadReviewEngine(absolute(process.env.JUEONY_ENGINE_PACKAGE,'JUEONY_ENGINE_PACKAGE'));
const out=absolute(process.env.JUEONY_TEST_OUTPUT,'JUEONY_TEST_OUTPUT');await mkdir(out,{recursive:true});assert.equal((await readdir(out)).length,0);
// This is exactly the pre-existing session-story canonical contract. It retains
// every font/paragraph/metadata field and all present direction/type values.
function meaning(v){if(Array.isArray(v))return v.map(meaning);if(v&&typeof v==='object')return Object.fromEntries(Object.keys(v).sort().filter(k=>!(v.fillType==='none'&&['fillColor','patternColor','patternType'].includes(k))).map(k=>[k,meaning(v[k])]));return v;}
function canonical(raw){const v=JSON.parse(raw);assert.equal(v.version,1);assert.equal(v.complete,true);assert.equal(v.provenance.kind,'generated-paragraph-record-identities');assert.deepEqual(Object.keys(v.provenance).sort(),['context','kind','story']);const {provenance,...semantic}=v;return meaning(semantic);}
function own(engine,kind){const d=engine.HwpDocument.createEmpty();d.createBlankDocument();d.insertText(0,0,0,'본문');let request;if(kind==='footnote'){const ref=JSON.parse(d.insertFootnote(0,0,1));assert.equal(ref.ok,true);d.insertTextInFootnote(0,ref.paraIdx,ref.controlIdx,0,2,'각😀주');request={kind,section:0,parent:ref.paraIdx,control:ref.controlIdx};}else{d.createHeaderFooter(0,kind==='header',2);d.insertTextInHeaderFooter(0,kind==='header',2,0,0,'머😀리말');request={kind,section:0,applyTo:2};}return {d,request};}
function cursorInput(d,request){let calls=0;const note=request.kind==='footnote',cursor={isInHeaderFooter:()=>!note,isInFootnote:()=>note,isInTextBox:()=>false,isInTableObjectSelection:()=>false,isInPictureObjectSelection:()=>false,hasSelection:()=>false,getSelection:()=>null,captureCellSelection:()=>null,blockSelectionPhase:null,headerFooterMode:note?'none':request.kind,hfSectionIdx:0,hfApplyTo:2,hfParaIdx:0,hfCharOffset:2,getHeaderFooterSelectionOrdered:()=>null,fnSectionIdx:0,fnParaIdx:request.parent,fnControlIdx:request.control,fnInnerParaIdx:0,fnCharOffset:4,fnPageNum:0,fnFootnoteIndex:0,getFootnoteSelection:()=>null};const wasm=new Proxy(d,{get:(target,key)=>{if(note&&['getFootnoteInfo','getPageFootnoteInfo'].includes(key))return(...args)=>JSON.parse(target[key](...args));return typeof target[key]==='function'?target[key].bind(target):target[key];}});return {input:{getCursorPosition:()=>({sectionIndex:0,paragraphIndex:0,charOffset:0}),cursor,wasm,restoreSessionSelection:()=>{throw Error('Wrong body restoration branch.');},restoreSessionHeaderFooter:()=>{assert.ok(!note);calls++;return true;},restoreSessionFootnote:()=>{assert.ok(note);calls++;return true;}},calls:()=>calls};}
function restoreLegacyCursor(oldDocument,newDocument,request){const origin=cursorInput(oldDocument,request),saved=captureSessionCursor(origin.input);assert.ok(saved);assert.equal(saved.kind,request.kind==='footnote'?'footnote':'header-footer');const freshInput=cursorInput(newDocument,request),before=newDocument.exportHwpx();assert.equal(restoreSessionCursor(freshInput.input,saved),true);assert.equal(freshInput.calls(),1);assert.deepEqual(newDocument.exportHwpx(),before);const formats=[];for(const [producer,sourceDocument] of [['old83',oldDocument],['new-final',newDocument]])for(const format of ['hwp','hwpx']){const bytes=sourceDocument[format==='hwp'?'exportHwp':'exportHwpx'](),d=new fresh.HwpDocument(bytes);try{const state=cursorInput(d,request),snapshot=d.exportHwpx();assert.equal(restoreSessionCursor(state.input,saved),true);assert.equal(state.calls(),1);assert.deepEqual(d.exportHwpx(),snapshot);formats.push({producer,format,status:'PASS',restoreCallbackCalls:state.calls(),exportBytesUnchangedByRestore:true});}finally{d.free();}}return {savedOn:'actual old83 WASM',newFreshDocument:'PASS',reopenedFormats:formats,actualWasmMetadataAndBindings:true,hostCaretApplication:'Synthetic callback only; no DOM or native UI caret command.'};}
const rows=[],failures=[];
for(const kind of ['header','footer','footnote']){
 const a=own(old,kind),b=own(fresh,kind);
 try{
  assert.deepEqual(a.request,b.request);const rawA=a.d.getSessionStoryEvidence(JSON.stringify(a.request)),rawB=b.d.getSessionStoryEvidence(JSON.stringify(b.request));
  const rawDiff=differences(JSON.parse(rawA),JSON.parse(rawB),0),semDiff=differences(canonical(rawA),canonical(rawB),0);
  const actualFingerprint=x=>kind==='footnote'?readSessionFootnoteStory({wasm:x.d},0,x.request.parent,x.request.control,0,0)?.fingerprint:readSessionHeaderFooterStory({wasm:x.d},0,kind==='header',2)?.fingerprint;
  const before=actualFingerprint(a),after=actualFingerprint(b);assert.ok(before&&after);
  const record={kind,version:1,rawJsonSha256:{before:hash(Buffer.from(rawA)),after:hash(Buffer.from(rawB))},rawDifferences:rawDiff,semanticDifferences:semDiff,productionFingerprint:{before,after,equal:before===after},scope:'Entire existing JS semantic canonical graph, exact numbers/strings/keys. No new font/direction fields removed by verifier.'};
  rows.push(record);assert.equal(semDiff.length,0);assert.equal(after,before);record.cursorCompatibility=restoreLegacyCursor(a.d,b.d,a.request);
 }catch(error){failures.push({kind,name:error.name,message:error.message});}
 finally{a.d.free();b.d.free();}
}
const result={oldEngine:old.metadata,newEngine:fresh.metadata,counts:{passed:3-failures.length,failed:failures.length},rows,failures,scriptSha256:hash(await readFile(fileURLToPath(import.meta.url))),actualNativeHancomExecution:false,actualOSFileWrite:false,arbitraryFontMetadataIgnored:false,coordinateTolerance:0};
await writeFile(join(out,'result.json'),JSON.stringify(result,null,2),{flag:'wx'});console.log(JSON.stringify(result.counts));if(failures.length)process.exitCode=1;
