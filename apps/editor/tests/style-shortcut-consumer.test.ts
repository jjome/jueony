import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import init,{HwpDocument} from '../node_modules/@rhwp/core/rhwp.js';
import {currentStyleCatalogSha256,resolveStoredStyleShortcut} from '../src/adapters/rhwp/style-shortcut-consumer.ts';

const profile='a'.repeat(64);
const scope={profileId:'ministry.report',entryId:'annual',profileSha256:profile};
const record=(document:any,styleId:number,styleName:string,source:'package'|'document'='package')=>({format:'jueony-style-shortcut-profile' as const,version:1 as const,profileId:scope.profileId,profileName:'기관 보고서',entryId:scope.entryId,profileSha256:profile,documentSha256:currentStyleCatalogSha256(document),slots:[{slot:0,styleId,styleName,source}]});

test('current catalog resolves the exact stored style after HWP and HWPX reopen without mutation',async()=>{
  await init({module_or_path:await readFile(new URL('../node_modules/@rhwp/core/rhwp_bg.wasm',import.meta.url))});
  const source:any=HwpDocument.createEmpty();source.createBlankDocument();const styleId=source.createStyle(JSON.stringify({name:'기관 제목',englishName:'AgencyTitle',type:0,nextStyleId:0}));
  try{for(const method of ['exportHwp','exportHwpx'] as const){const reopened:any=new HwpDocument(source[method]());try{const beforeHwp=reopened.exportHwp(),beforeHwpx=reopened.exportHwpx(),stored=record(reopened,styleId,'기관 제목'),command=resolveStoredStyleShortcut(reopened,stored,scope,0);assert.deepEqual(command,{kind:'apply-stored-style',slot:0,styleId,styleName:'기관 제목',styleType:0,source:'package'});assert.deepEqual(reopened.exportHwp(),beforeHwp);assert.deepEqual(reopened.exportHwpx(),beforeHwpx);}finally{reopened.free();}}}finally{source.free();}
});

test('profile and document digests, IDs, names and source are all rechecked',()=>{
  const styles=[{id:0,name:'바탕글',type:0},{id:1,name:'기관 제목',type:0}],document={getStyleList:()=>styles},stored=record(document,1,'기관 제목');
  assert.equal(resolveStoredStyleShortcut(document,stored,{...scope,profileSha256:'b'.repeat(64)},0),undefined);
  styles[1]={...styles[1],name:'이름 변경'};assert.equal(resolveStoredStyleShortcut(document,stored,scope,0),undefined);
  const refreshed=record(document,1,'기관 제목');assert.equal(resolveStoredStyleShortcut(document,refreshed,scope,0),undefined);
  assert.equal(resolveStoredStyleShortcut(document,{...record(document,1,'이름 변경'),slots:[{slot:0,styleId:2,styleName:'이름 변경',source:'package'}]} as any,scope,0),undefined);
  assert.equal(resolveStoredStyleShortcut(document,{...record(document,1,'이름 변경'),slots:[{slot:0,styleId:1,styleName:'이름 변경',source:'future'}]} as any,scope,0),undefined);
});

test('missing, duplicate and ambiguous assignments never return commands',()=>{
  const styles=[{id:0,name:'바탕글',type:0},{id:1,name:'기관 제목',type:0},{id:2,name:'기관 제목',type:1}],document={getStyleList:()=>styles},stored=record(document,1,'기관 제목');
  assert.equal(resolveStoredStyleShortcut(document,stored,scope,0),undefined);
  assert.equal(resolveStoredStyleShortcut(document,{...stored,slots:[]},scope,0),undefined);
  assert.equal(resolveStoredStyleShortcut(document,{...stored,slots:[stored.slots[0],{...stored.slots[0]}]},scope,0),undefined);
  assert.equal(resolveStoredStyleShortcut(document,stored,scope,9),undefined);
  assert.equal(resolveStoredStyleShortcut({getStyleList:()=>'{broken'},stored,scope,0),undefined);
});
