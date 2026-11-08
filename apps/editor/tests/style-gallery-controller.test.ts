import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import init,{HwpDocument} from '../node_modules/@rhwp/core/rhwp.js';
import {createStyleGalleryProfileStore,STYLE_GALLERY_PROFILE_KEY} from '../src/adapters/browser/style-gallery-profile.ts';
import {applyStyleGalleryPreview,previewStyleGallery} from '../src/adapters/rhwp/style-gallery-controller.ts';

const character=()=>({fontFamilies:Array(7).fill('함초롬바탕'),fontSize:1000,bold:true,italic:false,underline:false,strikethrough:false,subscript:false,superscript:false,emboss:false,engrave:false,kerning:false,underlineColor:'#000000',strikeColor:'#000000',textColor:'#112233',shadeColor:'#ffffff',shadowColor:'#000000',underlineType:'None',shadowType:0,outlineType:0,emphasisDot:0,underlineShape:0,strikeShape:0,shadowOffsetX:0,shadowOffsetY:0,ratios:Array(7).fill(100),spacings:Array(7).fill(0),relativeSizes:Array(7).fill(100),charOffsets:Array(7).fill(0)});
const paragraph=()=>({alignment:'justify',lineSpacingType:'Percent',lineSpacing:160,marginLeft:0,marginRight:0,indent:0,spacingBefore:0,spacingAfter:0,widowOrphan:false,keepWithNext:false,keepLines:false,pageBreakBefore:false,fontLineHeight:false,singleLine:false,autoSpaceKrEn:false,autoSpaceKrNum:false,verticalAlign:0,englishBreakUnit:0,koreanBreakUnit:0,borderConnect:false,borderIgnoreMargin:false});
const value=(name='기관 보고서')=>({format:'jueony-style-gallery-profile',version:1,id:'ministry.report',name,organization:'시험 기관',gallery:[{id:'annual',label:'연간 계획서',package:{format:'jueony-styles',version:1,styles:[{name:'기관 제목',englishName:'AgencyTitle',type:0,next:0,char:character(),para:paragraph()}]}}],shortcuts:[{slot:0,styleName:'기관 제목'}]});
function fixture(){let stored:string|null=null;const storage={getItem:()=>stored,setItem:(_key:string,next:string)=>{stored=next;}},store=createStyleGalleryProfileStore(storage);store.save(value());return{store,storage,raw:()=>stored!,replace:(next:any)=>{stored=JSON.stringify(next);}};}

test('preview is pure and apply survives HWP/HWPX reopen with exact slot style IDs',async()=>{
  await init({module_or_path:await readFile(new URL('../node_modules/@rhwp/core/rhwp_bg.wasm',import.meta.url))});
  const doc:any=HwpDocument.createEmpty();doc.createBlankDocument();doc.insertText(0,0,0,'기존 본문');const settings=fixture(),beforeSettings=settings.raw(),beforeHwp=doc.exportHwp(),beforeHwpx=doc.exportHwpx();
  try{
    const preview=previewStyleGallery(settings.store,doc,{profileId:'ministry.report',profileName:'기관 보고서',entryId:'annual'});
    assert.deepEqual(doc.exportHwp(),beforeHwp);assert.deepEqual(doc.exportHwpx(),beforeHwpx);assert.equal(settings.raw(),beforeSettings);
    const result=applyStyleGalleryPreview(settings.store,doc,preview);assert.equal(result.styleIds.length,1);assert.deepEqual(result.slots,[{slot:0,styleId:result.styleIds[0],styleName:'기관 제목',source:'package'}]);assert.equal(settings.raw(),beforeSettings);
    for(const method of ['exportHwp','exportHwpx'] as const){const reopened:any=new HwpDocument(doc[method]());try{const styles=JSON.parse(reopened.getStyleList());assert.equal(styles[result.styleIds[0]].name,'기관 제목');assert.equal(JSON.parse(reopened.getStyleDetail(result.styleIds[0])).charProps.bold,true);assert.equal(reopened.getTextRange(0,0,0,5),'기존 본문');}finally{reopened.free();}}
  }finally{doc.free();}
});

test('stale profile name, slots, style IDs and name conflicts fail before mutation',async()=>{
  await init({module_or_path:await readFile(new URL('../node_modules/@rhwp/core/rhwp_bg.wasm',import.meta.url))});
  for(const change of ['profile','slot','document','conflict'] as const){const doc:any=HwpDocument.createEmpty();doc.createBlankDocument();const settings=fixture();try{
    const preview=previewStyleGallery(settings.store,doc,{profileId:'ministry.report',profileName:'기관 보고서',entryId:'annual'}),beforeHwp=doc.exportHwp(),beforeHwpx=doc.exportHwpx(),beforeSettings=settings.raw();
    if(change==='profile')settings.replace(value('변경된 프로필'));if(change==='slot'){const changed=value();changed.shortcuts[0].slot=1;settings.replace(changed);}if(change==='document')doc.createStyle(JSON.stringify({name:'다른 스타일',englishName:'Other',type:0,nextStyleId:0}));
    if(change==='conflict'){doc.createStyle(JSON.stringify({name:'기관 제목',englishName:'Existing',type:0,nextStyleId:0}));const conflictHwp=doc.exportHwp(),conflictHwpx=doc.exportHwpx(),conflictSettings=settings.raw();assert.throws(()=>previewStyleGallery(settings.store,doc,{profileId:'ministry.report',profileName:'기관 보고서',entryId:'annual'}),/충돌/);assert.deepEqual(doc.exportHwp(),conflictHwp);assert.deepEqual(doc.exportHwpx(),conflictHwpx);assert.equal(settings.raw(),conflictSettings);continue;}
    const changedHwp=change==='document'?doc.exportHwp():beforeHwp,changedHwpx=change==='document'?doc.exportHwpx():beforeHwpx,changedSettings=settings.raw();assert.throws(()=>applyStyleGalleryPreview(settings.store,doc,preview),/바뀌었습니다|다시 선택/);assert.deepEqual(doc.exportHwp(),changedHwp);assert.deepEqual(doc.exportHwpx(),changedHwpx);assert.equal(settings.raw(),changedSettings);assert.notEqual(beforeSettings.length,0);
  }finally{doc.free();}}
});

test('mid-import failure rolls back document bytes and never writes profile settings',async()=>{
  await init({module_or_path:await readFile(new URL('../node_modules/@rhwp/core/rhwp_bg.wasm',import.meta.url))});
  const doc:any=HwpDocument.createEmpty();doc.createBlankDocument();const settings=fixture(),preview=previewStyleGallery(settings.store,doc,{profileId:'ministry.report',profileName:'기관 보고서',entryId:'annual'}),beforeHwp=doc.exportHwp(),beforeHwpx=doc.exportHwpx(),beforeSettings=settings.raw(),update=doc.updateStyleShapes.bind(doc);doc.updateStyleShapes=()=>false;
  try{assert.throws(()=>applyStyleGalleryPreview(settings.store,doc,preview),/모양 또는 다음 스타일/);assert.deepEqual(doc.exportHwp(),beforeHwp);assert.deepEqual(doc.exportHwpx(),beforeHwpx);assert.equal(settings.raw(),beforeSettings);assert.equal(JSON.parse(beforeSettings).format,'jueony-style-gallery-profile');assert.equal(STYLE_GALLERY_PROFILE_KEY,'jueony-style-gallery-profile');}finally{doc.updateStyleShapes=update;doc.free();}
});
