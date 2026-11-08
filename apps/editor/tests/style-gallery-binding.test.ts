import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import init,{HwpDocument} from '../node_modules/@rhwp/core/rhwp.js';
import {createStyleGalleryProfileStore} from '../src/adapters/browser/style-gallery-profile.ts';
import {createStyleShortcutProfileStore} from '../src/adapters/browser/style-shortcut-profile.ts';
import {applyAndBindStyleGalleryPreview,previewStyleGallery,StyleGalleryBindingError} from '../src/adapters/rhwp/style-gallery-controller.ts';
import {resolveStoredStyleShortcut} from '../src/adapters/rhwp/style-shortcut-consumer.ts';

const character=()=>({fontFamilies:Array(7).fill('함초롬바탕'),fontSize:1000,bold:true,italic:false,underline:false,strikethrough:false,subscript:false,superscript:false,emboss:false,engrave:false,kerning:false,underlineColor:'#000000',strikeColor:'#000000',textColor:'#112233',shadeColor:'#ffffff',shadowColor:'#000000',underlineType:'None',shadowType:0,outlineType:0,emphasisDot:0,underlineShape:0,strikeShape:0,shadowOffsetX:0,shadowOffsetY:0,ratios:Array(7).fill(100),spacings:Array(7).fill(0),relativeSizes:Array(7).fill(100),charOffsets:Array(7).fill(0)});
const paragraph=()=>({alignment:'justify',lineSpacingType:'Percent',lineSpacing:160,marginLeft:0,marginRight:0,indent:0,spacingBefore:0,spacingAfter:0,widowOrphan:false,keepWithNext:false,keepLines:false,pageBreakBefore:false,fontLineHeight:false,singleLine:false,autoSpaceKrEn:false,autoSpaceKrNum:false,verticalAlign:0,englishBreakUnit:0,koreanBreakUnit:0,borderConnect:false,borderIgnoreMargin:false});
const value=()=>({format:'jueony-style-gallery-profile',version:1,id:'ministry.report',name:'기관 보고서',organization:'시험 기관',gallery:[{id:'annual',label:'연간 계획서',package:{format:'jueony-styles',version:1,styles:[{name:'기관 제목',englishName:'AgencyTitle',type:0,next:0,char:character(),para:paragraph()}]}}],shortcuts:[{slot:0,styleName:'기관 제목'}]});
function stores(failShortcut=false){let profileRaw:string|null=null,shortcutRaw:string|null=null;const profileStorage={getItem:()=>profileRaw,setItem:(_k:string,v:string)=>{profileRaw=v;}},shortcutStorage={getItem:()=>shortcutRaw,setItem:(_k:string,v:string)=>{if(failShortcut)throw new Error('quota');shortcutRaw=v;},removeItem:()=>{shortcutRaw=null;}},profiles=createStyleGalleryProfileStore(profileStorage),shortcuts=createStyleShortcutProfileStore(shortcutStorage);profiles.save(value());return{profiles,shortcuts,shortcut:()=>shortcutRaw};}
const selection={profileId:'ministry.report',profileName:'기관 보고서',entryId:'annual'};

test('post-import digest binds settings consumed after HWP and HWPX reopen',async()=>{
  await init({module_or_path:await readFile(new URL('../node_modules/@rhwp/core/rhwp_bg.wasm',import.meta.url))});
  for(const method of ['exportHwp','exportHwpx'] as const){const doc:any=HwpDocument.createEmpty();doc.createBlankDocument();const state=stores(),preview=previewStyleGallery(state.profiles,doc,selection);let persisted:Uint8Array|undefined;try{const result=applyAndBindStyleGalleryPreview(state.profiles,state.shortcuts,doc,preview,{persistDocument:()=>{persisted=doc[method]();const check:any=new HwpDocument(persisted);check.free();}}),saved=state.shortcuts.read()!;assert.equal(saved.documentSha256,result.documentSha256);assert.equal(saved.slots[0].styleType,0);const reopened:any=new HwpDocument(persisted!);try{assert.deepEqual(resolveStoredStyleShortcut(reopened,saved,{profileId:selection.profileId,entryId:selection.entryId,profileSha256:preview.profileSha256},0),{kind:'apply-stored-style',slot:0,styleId:result.styleIds[0],styleName:'기관 제목',styleType:0,source:'package'});}finally{reopened.free();}}finally{doc.free();}}
});

test('document apply and settings failures rollback when no external save committed',async()=>{
  await init({module_or_path:await readFile(new URL('../node_modules/@rhwp/core/rhwp_bg.wasm',import.meta.url))});
  for(const failure of ['apply','settings'] as const){const doc:any=HwpDocument.createEmpty();doc.createBlankDocument();const state=stores(failure==='settings'),preview=previewStyleGallery(state.profiles,doc,selection),beforeHwp=doc.exportHwp(),beforeHwpx=doc.exportHwpx(),update=doc.updateStyleShapes.bind(doc);if(failure==='apply')doc.updateStyleShapes=()=>false;try{assert.throws(()=>applyAndBindStyleGalleryPreview(state.profiles,state.shortcuts,doc,preview),(error:any)=>error instanceof StyleGalleryBindingError&&error.documentState==='rolled-back'&&error.settingsState==='unchanged');assert.deepEqual(doc.exportHwp(),beforeHwp);assert.deepEqual(doc.exportHwpx(),beforeHwpx);assert.equal(state.shortcut(),null);}finally{doc.updateStyleShapes=update;doc.free();}}
});

test('external save uncertainty and post-save setting failure report disconnected state',async()=>{
  await init({module_or_path:await readFile(new URL('../node_modules/@rhwp/core/rhwp_bg.wasm',import.meta.url))});
  {const doc:any=HwpDocument.createEmpty();doc.createBlankDocument();const state=stores(),preview=previewStyleGallery(state.profiles,doc,selection);try{assert.throws(()=>applyAndBindStyleGalleryPreview(state.profiles,state.shortcuts,doc,preview,{persistDocument:()=>{throw new Error('disk');}}),(error:any)=>error instanceof StyleGalleryBindingError&&error.documentState==='disconnected'&&error.settingsState==='unchanged');assert.equal(state.shortcut(),null);}finally{doc.free();}}
  {const doc:any=HwpDocument.createEmpty();doc.createBlankDocument();const state=stores(true),preview=previewStyleGallery(state.profiles,doc,selection);try{assert.throws(()=>applyAndBindStyleGalleryPreview(state.profiles,state.shortcuts,doc,preview,{persistDocument:()=>{new HwpDocument(doc.exportHwpx()).free();}}),(error:any)=>error instanceof StyleGalleryBindingError&&error.documentState==='applied'&&error.settingsState==='unchanged');assert.ok(JSON.parse(doc.getStyleList()).some((style:any)=>style.name==='기관 제목'));assert.equal(state.shortcut(),null);}finally{doc.free();}}
});
