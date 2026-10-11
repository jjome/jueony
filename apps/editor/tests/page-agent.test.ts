import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import init,{HwpDocument} from '@rhwp/core';
import {readStructure} from '../src/adapters/rhwp/structure.ts';
import {executeDocumentOperations} from '../src/adapters/rhwp/execute.ts';
import {validateEditOperations} from '../src/modules/document/public/index.ts';
import type {Snapshot} from '../src/modules/document/public/index.ts';
import {verifyPreservedExport} from '../src/adapters/rhwp/preservation.ts';
await init({module_or_path:await readFile(new URL('../node_modules/@rhwp/core/rhwp_bg.wasm',import.meta.url))});
function snapshot(doc:HwpDocument):Snapshot {return {revision:'test:1',name:'test.hwpx',limitations:[],nodes:[{id:'s0p0',section:0,paragraph:0,text:doc.getTextRange(0,0,0,doc.getParagraphLength(0,0)),editable:true}],structure:readStructure(doc)};}
for(const format of ['hwp','hwpx'] as const)test(`${format}: agent style/columns/hide batch saves, reopens, restores snapshot`,()=>{
 const doc=HwpDocument.createEmpty();doc.createBlankDocument();doc.insertText(0,0,0,'업무 계획');
 try{const before=snapshot(doc),id=doc.saveSnapshot();
  const ops=validateEditOperations([{kind:'apply_paragraph_style',target:'s0p0',styleId:1},{kind:'set_columns',section:0,count:2,spacingMm:8},{kind:'set_page_hide',target:'s0p0',properties:{hideHeader:true,hidePageNum:true}}],before);
  executeDocumentOperations(doc,before,ops);
  assert.equal(JSON.parse(doc.getStyleAt(0,0)).id,1);
  const artifact=format==='hwp'?doc.exportHwpWithReport():doc.exportHwpxWithReport();
  try{const bytes=artifact.takeBytes();verifyPreservedExport(doc,bytes,format,artifact.contentLoss(),b=>new HwpDocument(b));const reopened=new HwpDocument(bytes);try{assert.equal(JSON.parse(reopened.getColumnDef(0)).columnCount,2);assert.equal(JSON.parse(reopened.getPageHide(0,0)).hideHeader,true);assert.equal(JSON.parse(reopened.getPageHide(0,0)).hidePageNum,true);}finally{reopened.free();}}finally{artifact.free();}
  doc.restoreSnapshot(id);assert.deepEqual(snapshot(doc),before);doc.discardSnapshot(id);
 }finally{doc.free();}
});
test('agent rejects unknown/character styles, impossible columns and nonboolean flags before mutation',()=>{
 const doc=HwpDocument.createEmpty();doc.createBlankDocument();try{const before=snapshot(doc);for(const op of [{kind:'apply_paragraph_style',target:'s0p0',styleId:999},{kind:'apply_paragraph_style',target:'s0p0',styleId:12},{kind:'set_columns',section:0,count:6,spacingMm:100},{kind:'set_columns',section:2,count:2,spacingMm:8},{kind:'set_page_hide',target:'s0p0',properties:{hideHeader:'yes'}},{kind:'set_page_hide',target:'s0p0',properties:{execute:'script'}}])assert.throws(()=>validateEditOperations([op],before));assert.deepEqual(snapshot(doc),before);}finally{doc.free();}
});

test('page setup cannot invalidate columns earlier in a batch or already in the document',()=>{
 const doc=HwpDocument.createEmpty();doc.createBlankDocument();
 try{
  const before=snapshot(doc);
  const columns={kind:'set_columns',section:0,count:6,spacingMm:8};
  const narrow={kind:'set_page_setup',section:0,properties:{widthMm:80,marginLeftMm:10,marginRightMm:10}};
  assert.throws(()=>validateEditOperations([columns,narrow],before),/단의 너비/);
  assert.throws(()=>validateEditOperations([narrow,columns],before),/단의 너비/);
  assert.deepEqual(snapshot(doc),before);
  executeDocumentOperations(doc,before,validateEditOperations([columns],before));
  assert.throws(()=>validateEditOperations([narrow],snapshot(doc)),/단의 너비/);
 }finally{doc.free();}
});
