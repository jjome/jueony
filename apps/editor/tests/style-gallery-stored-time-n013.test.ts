import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createStyleGalleryProfileStore} from '../src/adapters/browser/style-gallery-profile.ts';
import {applyStyleGalleryPreview,previewStyleGallery} from '../src/adapters/rhwp/style-gallery-controller.ts';
import {inspectStyleStoredTimeGuard} from '../src/adapters/rhwp/style-stored-time-warning-n013.ts';

const character=()=>({fontFamilies:Array(7).fill('함초롬바탕'),fontSize:1000,bold:false,italic:false,underline:false,strikethrough:false,subscript:false,superscript:false,emboss:false,engrave:false,kerning:false,underlineColor:'#000000',strikeColor:'#000000',textColor:'#000000',shadeColor:'#ffffff',shadowColor:'#000000',underlineType:'None',shadowType:0,outlineType:0,emphasisDot:0,underlineShape:0,strikeShape:0,shadowOffsetX:0,shadowOffsetY:0,ratios:Array(7).fill(100),spacings:Array(7).fill(0),relativeSizes:Array(7).fill(100),charOffsets:Array(7).fill(0)});
const paragraph=()=>({alignment:'justify',lineSpacingType:'Percent',lineSpacing:160,marginLeft:0,marginRight:0,indent:0,spacingBefore:0,spacingAfter:0,widowOrphan:false,keepWithNext:false,keepLines:false,pageBreakBefore:false,fontLineHeight:false,singleLine:false,autoSpaceKrEn:false,autoSpaceKrNum:false,verticalAlign:0,englishBreakUnit:0,koreanBreakUnit:1});
const profile=()=>({format:'jueony-style-gallery-profile',version:1,id:'ministry.report',name:'기관 보고서',organization:'시험 기관',gallery:[{id:'annual',label:'연간 계획서',package:{format:'jueony-styles',version:1,styles:[{name:'기관 제목',englishName:'AgencyTitle',type:0,next:0,char:character(),para:paragraph()}]}}],shortcuts:[{slot:0,styleName:'기관 제목'}]});
const selection={profileId:'ministry.report',profileName:'기관 보고서',entryId:'annual'};
const store=()=>{let raw:string|null=null;const storage={getItem:()=>raw,setItem:(_key:string,value:string)=>{raw=value;}};const value=createStyleGalleryProfileStore(storage);value.save(profile() as any);return value;};
const absent=(fingerprint='a'.repeat(64))=>JSON.stringify({editable:true,fingerprint,reason:null,information:{schemaVersion:1,sourceFormat:'hwp',created:{state:'absent'},modified:{state:'absent'},lastPrinted:{state:'absent'},editingDuration:{state:'absent'},issues:[]}});
const proxy=(document:any,state:()=>string)=>new Proxy(document,{get(target,key){if(key==='getDocumentStoredInformationEditState')return state;const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;}});

test('initialized blank document carries no warning and preserves exact stored information through HWP/HWPX reopen',{skip:!process.env.JUEONY_ENGINE_PACKAGE},async()=>{
  const root=resolve(process.env.JUEONY_ENGINE_PACKAGE!),engine:any=await import(pathToFileURL(resolve(root,'rhwp.js')).href+`?n013time=${Date.now()}`);await engine.default({module_or_path:await readFile(resolve(root,'rhwp_bg.wasm'))});
  const document=engine.HwpDocument.createEmpty();document.createBlankDocument();
  try{
    const before=JSON.parse(document.getDocumentStoredInformation()),preview=previewStyleGallery(store(),document,selection);
    assert.deepEqual(preview.storedTime.warnings,[]);
    const result=applyStyleGalleryPreview(store(),document,preview);assert.deepEqual(result.warnings,[]);assert.deepEqual(JSON.parse(document.getDocumentStoredInformation()),before);
    for(const method of ['exportHwp','exportHwpx']){const reopened=new engine.HwpDocument(document[method]());try{const after=JSON.parse(reopened.getDocumentStoredInformation());assert.deepEqual({...after,sourceFormat:before.sourceFormat},before);}finally{reopened.free();}}
  }finally{document.free();}
});

test('absent blank stored dates require typed acknowledgement and stale evidence fails before style mutation',{skip:!process.env.JUEONY_ENGINE_PACKAGE},async()=>{
  const root=resolve(process.env.JUEONY_ENGINE_PACKAGE!),engine:any=await import(pathToFileURL(resolve(root,'rhwp.js')).href+`?n013absent=${Date.now()}`);await engine.default({module_or_path:await readFile(resolve(root,'rhwp_bg.wasm'))});
  for(const mode of ['unacknowledged','stale','acknowledged'] as const){const document=engine.HwpDocument.createEmpty();document.createBlankDocument();let fingerprint='a'.repeat(64);const wrapped=proxy(document,()=>absent(fingerprint));try{
    const settings=store(),preview=previewStyleGallery(settings,wrapped,selection),beforeHwp=document.exportHwp(),beforeHwpx=document.exportHwpx();
    assert.deepEqual(preview.storedTime.warnings.map(value=>value.code),['new-document-stored-time-initialization']);
    if(mode==='stale')fingerprint='b'.repeat(64);
    if(mode!=='acknowledged')assert.throws(()=>applyStyleGalleryPreview(settings,wrapped,preview,mode==='stale'?{acknowledgeWarnings:['new-document-stored-time-initialization']}:{}),/저장 날짜 상태가 바뀌|작성·수정 날짜/);
    else assert.deepEqual(applyStyleGalleryPreview(settings,wrapped,preview,{acknowledgeWarnings:['new-document-stored-time-initialization']}).warnings,preview.storedTime.warnings);
    if(mode!=='acknowledged'){assert.deepEqual(document.exportHwp(),beforeHwp);assert.deepEqual(document.exportHwpx(),beforeHwpx);}
  }finally{document.free();}}
});

test('documents with body content never receive the blank-document warning even without stored-time capability',{skip:!process.env.JUEONY_ENGINE_PACKAGE},async()=>{
  const root=resolve(process.env.JUEONY_ENGINE_PACKAGE!),engine:any=await import(pathToFileURL(resolve(root,'rhwp.js')).href+`?n013body=${Date.now()}`);await engine.default({module_or_path:await readFile(resolve(root,'rhwp_bg.wasm'))});
  const document=engine.HwpDocument.createEmpty();document.createBlankDocument();document.insertText(0,0,0,'기존 본문');
  try{const wrapped=proxy(document,()=>{throw new Error('must not read');}),settings=store(),preview=previewStyleGallery(settings,wrapped,selection);assert.deepEqual(preview.storedTime.warnings,[]);assert.deepEqual(applyStyleGalleryPreview(settings,wrapped,preview).warnings,[]);}finally{document.free();}
});

test('legacy blank capability is reported without pretending timestamps were inspected',{skip:!process.env.JUEONY_ENGINE_PACKAGE},async()=>{
  const root=resolve(process.env.JUEONY_ENGINE_PACKAGE!),engine:any=await import(pathToFileURL(resolve(root,'rhwp.js')).href+`?n013legacy=${Date.now()}`);await engine.default({module_or_path:await readFile(resolve(root,'rhwp_bg.wasm'))});
  const document=engine.HwpDocument.createEmpty();document.createBlankDocument();const wrapped=new Proxy(document,{get(target,key){if(key==='getDocumentStoredInformationEditState')return undefined;const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;}});
  try{const guard=inspectStyleStoredTimeGuard(wrapped);assert.equal(guard.status,'unavailable');assert.deepEqual(guard.warnings.map(value=>value.code),['stored-time-capability-unavailable']);assert.throws(()=>inspectStyleStoredTimeGuard(wrapped,{requireCapability:true}),/현재 엔진/);
    const settings=store(),preview=previewStyleGallery(settings,wrapped,selection);assert.equal(preview.storedTime.status,'unavailable');
    assert.deepEqual(applyStyleGalleryPreview(settings,wrapped,preview).warnings,guard.warnings);
  }finally{document.free();}
});
