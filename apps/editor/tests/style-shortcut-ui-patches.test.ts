import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parse} from '@babel/parser';
import init,{HwpDocument} from '../node_modules/@rhwp/core/rhwp.js';
import {patchStyleShortcutUiSource} from '../scripts/integration/style-shortcut-ui-patches.mjs';
import {currentStyleCatalogSha256,resolveStoredStyleShortcut} from '../src/adapters/rhwp/style-shortcut-consumer.ts';

const installUrl=new URL('../src/shortcuts/install.ts',import.meta.url);

test('generated shortcut integration is fail-closed and only dispatches the existing style command',async()=>{
  const source=await readFile(installUrl,'utf8'),patched=patchStyleShortcutUiSource(source);
  assert.match(patched,/jueony-style-shortcut-ui-v1/);
  assert.match(patched,/event\.isComposing\|\|event\.keyCode===229/);
  assert.match(patched,/target!==ih\?\.textarea/);
  assert.match(patched,/context\.inTable\|\|!!context\.inCellSelectionMode/);
  assert.match(patched,/isInHeaderFooter/);assert.match(patched,/isInFootnote/);assert.match(patched,/isInTextBox/);
  assert.match(patched,/if\(prepared\.state\.configured&&prepared\.assigned\)/);
  assert.match(patched,/slots\.some\(value=>value\.slot===slot\)\)return\{state,assigned:false/);
  assert.match(patched,/if\(!command\).*return;/s);
  assert.match(patched,/automation\.execute\('format:apply-style',\{styleId:command\.styleId\}\)/);
  assert.match(patched,/기본 번호키로 재설정/);assert.match(patched,/clear\.textContent='해제'/);
  assert.match(patched,/스타일마당 JSON 가져오기·내보내기/);
  assert.match(patched,/profileExport\.textContent='프로필 내보내기'/);
  assert.match(patched,/packageExport\.textContent='선택 패키지 내보내기'/);
  assert.match(patched,/importButton\.textContent='검증 후 가져오기'/);
  assert.match(patched,/previewPortableStyleGalleryImport\(localStorage,source\.value/);
  assert.match(patched,/commitPortableStyleGalleryImport\(localStorage,preview\)/);
  assert.match(patched,/styleGalleryPortableButton\.textContent='스타일마당 JSON'/);
  assert.match(patched,/file\.type='file'/);assert.match(patched,/new Blob\(\[value\]/);
  assert.doesNotThrow(()=>parse(patched,{sourceType:'module',plugins:['typescript']}));
  assert.throws(()=>patchStyleShortcutUiSource(patched),/already applied/);
  assert.throws(()=>patchStyleShortcutUiSource(source.replace('  const resolver = new HangulKeyResolver();','  const resolver = createResolver();')),/seam drift/);
});

test('stored shortcut applies through persisted HWP and HWPX style IDs and snapshot undo restores exact bytes',async()=>{
  await init({module_or_path:await readFile(new URL('../node_modules/@rhwp/core/rhwp_bg.wasm',import.meta.url))});
  const original:any=HwpDocument.createEmpty();original.createBlankDocument();original.insertText(0,0,0,'번호키 스타일');
  const styleId=original.createStyle(JSON.stringify({name:'기관 제목',englishName:'AgencyTitle',type:0,nextStyleId:0}));
  try{
    for(const format of ['hwp','hwpx'] as const){
      const method=format==='hwp'?'exportHwp':'exportHwpx',doc:any=new HwpDocument(original[method]()),before=doc[method](),profileSha256='a'.repeat(64);
      const stored={format:'jueony-style-shortcut-profile' as const,version:1 as const,profileId:'ministry.report',profileName:'기관 보고서',entryId:'annual',profileSha256,documentSha256:currentStyleCatalogSha256(doc),slots:[{slot:0,styleId,styleName:'기관 제목',styleType:0 as const,source:'package' as const}]};
      const scope={profileId:stored.profileId,entryId:stored.entryId,profileSha256},undo=doc.saveSnapshot();
      try{
        const command=resolveStoredStyleShortcut(doc,stored,scope,0);assert.ok(command);assert.notEqual(doc.applyStyle(0,0,command.styleId),false);
        const saved=doc[method](),reopened:any=new HwpDocument(saved);try{assert.equal(JSON.parse(reopened.getStyleAt(0,0)).name,'기관 제목');}finally{reopened.free();}
        doc.restoreSnapshot(undo);assert.deepEqual(doc[method](),before);
      }finally{doc.discardSnapshot(undo);doc.free();}
    }
  }finally{original.free();}
});

test('stale document evidence produces no command and leaves both file formats unchanged',async()=>{
  await init({module_or_path:await readFile(new URL('../node_modules/@rhwp/core/rhwp_bg.wasm',import.meta.url))});
  const doc:any=HwpDocument.createEmpty();doc.createBlankDocument();const styleId=doc.createStyle(JSON.stringify({name:'기관 제목',englishName:'AgencyTitle',type:0,nextStyleId:0}));
  try{
    const beforeHwp=doc.exportHwp(),beforeHwpx=doc.exportHwpx(),profileSha256='b'.repeat(64),stored={format:'jueony-style-shortcut-profile' as const,version:1 as const,profileId:'ministry.report',profileName:'기관 보고서',entryId:'annual',profileSha256,documentSha256:'0'.repeat(64),slots:[{slot:0,styleId,styleName:'기관 제목',styleType:0 as const,source:'package' as const}]};
    assert.equal(resolveStoredStyleShortcut(doc,stored,{profileId:stored.profileId,entryId:stored.entryId,profileSha256},0),undefined);
    assert.deepEqual(doc.exportHwp(),beforeHwp);assert.deepEqual(doc.exportHwpx(),beforeHwpx);
  }finally{doc.free();}
});
