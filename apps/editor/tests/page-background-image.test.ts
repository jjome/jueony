import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultPageImage,validatePageBorderSettings,samePageBorderSettings} from '../src/modules/document/public/index.ts';
import {supportsPageBackgroundImage,resolvePageImageDrafts,collectPageImageSettings} from '../src/adapters/rhwp/page-background-image.ts';
import type {PageBorderKind,PageBorderSettings} from '../src/modules/document/public/index.ts';
const setting=():PageBorderSettings=>({fillType:'image',image:defaultPageImage(),spacingLeft:1417,spacingRight:1417,spacingTop:1417,spacingBottom:1417});
test('image settings validate display brightness/contrast, resource IDs and fill/effect modes',()=>{
 const base=setting();assert.deepEqual(validatePageBorderSettings(base),base);
 for(const patch of [{brightness:101},{brightness:-101},{contrast:1.1},{binDataId:0},{binDataId:65536},{mode:'unknown'},{effect:4}])assert.throws(()=>validatePageBorderSettings({...base,image:{...base.image!,...patch}}));
});
test('image mode, tone, effect and asset reference are part of semantic no-op comparison',()=>{
 const base=setting();for(const patch of [{brightness:70},{contrast:-50},{mode:'tile'},{effect:1},{binDataId:2}])assert.equal(samePageBorderSettings(base,{...base,image:{...base.image!,...patch}}),false);
 assert.equal(samePageBorderSettings({...base,fillType:'none'},{...base,fillType:'none',image:{...base.image!,brightness:70}}),true);
});
test('pending bytes register only in a capable transaction and materialize each shared upload once',()=>{
 let count=0;const upload={bytes:new Uint8Array([1,2,3]),extension:'png' as const,name:'test.png'},wasm={pageBackgroundImageEnabled:()=>true,registerPageBackgroundImage:(bytes:Uint8Array,ext:string)=>{assert.deepEqual(bytes,upload.bytes);assert.equal(ext,'png');count++;return '{"ok":true,"binDataId":7}';}};
 const drafts=new Map<PageBorderKind,PageBorderSettings>([['both',setting()],['odd',{...setting(),image:{...defaultPageImage(),brightness:70}}]]),pending=new Map([['both',upload],['odd',upload]] as [PageBorderKind,typeof upload][]);
 const result=resolvePageImageDrafts(wasm,drafts,pending);assert.equal(count,1);assert.equal(result.get('both')!.image!.binDataId,7);assert.equal(result.get('odd')!.image!.brightness,70);assert.equal(drafts.get('both')!.image!.binDataId,undefined);
 assert.equal(supportsPageBackgroundImage(undefined),false);assert.equal(supportsPageBackgroundImage({}),false);assert.throws(()=>resolvePageImageDrafts({},drafts,pending),/지원하지/);
});
test('inactive uploads allocate no asset and failed registration is propagated',()=>{
 let count=0;const wasm={pageBackgroundImageEnabled:()=>true,registerPageBackgroundImage:()=>{count++;return '{"ok":false}';}},pending=new Map([['both',{bytes:new Uint8Array([1]),extension:'png' as const,name:'x'}]] as const);
 const drafts=new Map<PageBorderKind,PageBorderSettings>([['both',{...setting(),fillType:'none'}]]);resolvePageImageDrafts(wasm,drafts,new Map(pending));assert.equal(count,0);
 drafts.set('both',setting());assert.throws(()=>resolvePageImageDrafts(wasm,drafts,new Map(pending)),/등록하지/);assert.equal(count,1);
});
test('collecting new images requires a picked file and does not treat blank tone as zero',()=>{
 const dialog:any={settings:setting(),wasm:{pageBackgroundImageEnabled:()=>true,registerPageBackgroundImage:()=>{}},jueonyKind:'both',jueonyImageRadio:{checked:true},jueonyImageUploads:new Map(),jueonyImageInputs:{mode:{value:'fit'},brightness:{value:'70'},contrast:{value:'-50'},effect:{value:'0'}}};
 assert.throws(()=>collectPageImageSettings(dialog),/파일/);dialog.jueonyImageUploads.set('both',{});assert.equal(collectPageImageSettings(dialog)!.brightness,70);dialog.jueonyImageInputs.brightness.value='';assert.throws(()=>collectPageImageSettings(dialog),/값을 입력/);
});
