import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {STYLE_GALLERY_PROFILE_KEY,createStyleGalleryProfileStore} from '../src/adapters/browser/style-gallery-profile.ts';
import {commitPortableStyleGalleryImport,exportPortableStyleGalleryPackage,exportPortableStyleGalleryProfile,previewPortableStyleGalleryImport,StyleGalleryPortableStorageError} from '../src/adapters/browser/style-gallery-portable.ts';
import {applyStyleGalleryPreview,previewStyleGallery} from '../src/adapters/rhwp/style-gallery-controller.ts';

const character=()=>({fontFamilies:Array(7).fill('함초롬바탕'),fontSize:1000,bold:false,italic:false,underline:false,strikethrough:false,subscript:false,superscript:false,emboss:false,engrave:false,kerning:false,underlineColor:'#000000',strikeColor:'#000000',textColor:'#000000',shadeColor:'#ffffff',shadowColor:'#000000',underlineType:'None',shadowType:0,outlineType:0,emphasisDot:0,underlineShape:0,strikeShape:0,shadowOffsetX:0,shadowOffsetY:0,ratios:Array(7).fill(100),spacings:Array(7).fill(0),relativeSizes:Array(7).fill(100),charOffsets:Array(7).fill(0)});
const paragraph=()=>({alignment:'justify',lineSpacingType:'Percent',lineSpacing:160,marginLeft:0,marginRight:0,indent:0,spacingBefore:0,spacingAfter:0,widowOrphan:false,keepWithNext:false,keepLines:false,pageBreakBefore:false,fontLineHeight:false,singleLine:false,autoSpaceKrEn:false,autoSpaceKrNum:false,verticalAlign:0,englishBreakUnit:0,koreanBreakUnit:1});
const stylePackage=(name='기관 제목')=>({format:'jueony-styles',version:1,styles:[{name,englishName:'AgencyTitle',type:0,next:0,char:character(),para:paragraph()}]});
const profile=(name='기관 보고서')=>({format:'jueony-style-gallery-profile',version:1,id:'ministry.report',name,organization:'시험 기관',gallery:[{id:'annual',label:'연간 계획서',package:stylePackage()}],shortcuts:[{slot:0,styleName:'기관 제목'}]});
function memory(initial:string|null=null){let value=initial,fail:'throw'|'mismatch'|null=null;return{storage:{getItem:()=>value,setItem:(_key:string,next:string)=>{if(fail==='throw'){fail=null;throw new Error('quota');}if(fail==='mismatch'){fail=null;value=next+' ';return;}value=next;},removeItem:()=>{value=null;}},raw:()=>value,set:(next:string|null)=>value=next,fail:(next:'throw'|'mismatch')=>fail=next};}

test('portable profile and package JSON import/export are validated and deterministic',()=>{
  const state=memory(),profilePreview=previewPortableStyleGalleryImport(state.storage,JSON.stringify(profile()));
  assert.equal(profilePreview.kind,'profile');const imported=commitPortableStyleGalleryImport(state.storage,profilePreview);
  assert.deepEqual(JSON.parse(exportPortableStyleGalleryProfile(state.storage)),imported);
  assert.deepEqual(JSON.parse(exportPortableStyleGalleryPackage(state.storage,'annual')),imported.gallery[0].package);
  const packagePreview=previewPortableStyleGalleryImport(state.storage,JSON.stringify(stylePackage('기관 본문')),{id:'body',label:'기관 본문 모음'});
  assert.equal(packagePreview.kind,'package');const extended=commitPortableStyleGalleryImport(state.storage,packagePreview);assert.equal(extended.gallery.length,2);
  assert.deepEqual(JSON.parse(exportPortableStyleGalleryPackage(state.storage,'body')),extended.gallery[1].package);
});

test('invalid, duplicate and stale imports never replace the current profile',()=>{
  const before=JSON.stringify(profile()),state=memory(before);
  assert.throws(()=>previewPortableStyleGalleryImport(state.storage,'{broken'),/JSON/);assert.equal(state.raw(),before);
  assert.throws(()=>previewPortableStyleGalleryImport(state.storage,before),/동일한/);assert.equal(state.raw(),before);
  assert.throws(()=>previewPortableStyleGalleryImport(state.storage,JSON.stringify(stylePackage()),{id:'annual',label:'다른 이름'}),/이미/);assert.equal(state.raw(),before);
  assert.throws(()=>previewPortableStyleGalleryImport(state.storage,JSON.stringify(stylePackage()),{id:'other',label:'연간 계획서'}),/이미/);assert.equal(state.raw(),before);
  const preview=previewPortableStyleGalleryImport(state.storage,JSON.stringify(profile('변경 프로필')));const newer=JSON.stringify(profile('다른 변경'));state.set(newer);
  assert.throws(()=>commitPortableStyleGalleryImport(state.storage,preview),/미리보기 후 바뀌/);assert.equal(state.raw(),newer);
});

test('write and readback failures restore the exact previous profile or report uncertainty',()=>{
  for(const failure of ['throw','mismatch'] as const){const before=JSON.stringify(profile()),state=memory(before),preview=previewPortableStyleGalleryImport(state.storage,JSON.stringify(profile('교체 프로필')));state.fail(failure);
    assert.throws(()=>commitPortableStyleGalleryImport(state.storage,preview),(error:any)=>error instanceof StyleGalleryPortableStorageError&&error.settingsState==='unchanged');assert.equal(state.raw(),before,failure);}
});

test('UI-imported profile drives the existing preview/apply path and survives HWP/HWPX reopen', {skip:!process.env.JUEONY_ENGINE_PACKAGE}, async()=>{
  const root=resolve(process.env.JUEONY_ENGINE_PACKAGE!),engine:any=await import(pathToFileURL(resolve(root,'rhwp.js')).href+`?n013=${Date.now()}`);await engine.default({module_or_path:await readFile(resolve(root,'rhwp_bg.wasm'))});
  const state=memory(),importPreview=previewPortableStyleGalleryImport(state.storage,JSON.stringify(profile()));commitPortableStyleGalleryImport(state.storage,importPreview);
  const doc=engine.HwpDocument.createEmpty();doc.createBlankDocument();doc.insertText(0,0,0,'기존 본문');
  try{
    const beforeText=doc.getTextFileUnicode(),beforeHwp=doc.exportHwp(),beforeHwpx=doc.exportHwpx();
    assert.throws(()=>previewPortableStyleGalleryImport(state.storage,JSON.stringify(stylePackage()),{id:'annual',label:'다른 이름'}),/이미/);
    assert.deepEqual(doc.exportHwp(),beforeHwp);assert.deepEqual(doc.exportHwpx(),beforeHwpx);
    const store=createStyleGalleryProfileStore(state.storage),preview=previewStyleGallery(store,doc,{profileId:'ministry.report',profileName:'기관 보고서',entryId:'annual'}),result=applyStyleGalleryPreview(store,doc,preview);
    assert.equal(doc.getTextFileUnicode(),beforeText);assert.equal(result.styleIds.length,1);
    for(const method of ['exportHwp','exportHwpx']){const reopened=new engine.HwpDocument(doc[method]());try{const styles=JSON.parse(reopened.getStyleList());assert.equal(styles[result.styleIds[0]].name,'기관 제목');assert.equal(reopened.getTextFileUnicode(),beforeText);}finally{reopened.free();}}
  }finally{doc.free();}
});
