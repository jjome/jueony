import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import init,{HwpDocument} from '../node_modules/@rhwp/core/rhwp.js';
import {deleteRootPageHideControl,readRootPageHideControl} from '../src/adapters/rhwp/page-hide-control-delete.ts';

await init({module_or_path:await readFile(new URL('../node_modules/@rhwp/core/rhwp_bg.wasm',import.meta.url))});
type Format='hwp'|'hwpx';
const bytes=(doc:any,format:Format):Uint8Array=>doc[format==='hwp'?'exportHwp':'exportHwpx']();
function fixture(){
 const doc:any=HwpDocument.createEmpty();doc.createBlankDocument();doc.insertText(0,0,0,'B031 감추기 조판 부호');
 assert.equal(JSON.parse(doc.setPageHide(0,0,true,false,false,true,false,true)).ok,true);return doc;
}
function pageHide(doc:any){return JSON.parse(doc.getPageHide(0,0));}
function controls(doc:any){return JSON.parse(doc.getControls());}

for(const format of ['hwp','hwpx'] as const)test(`one root-body PageHide control deletes, reopens and undoes exactly in ${format.toUpperCase()}`,()=>{
 const doc=fixture();try{
  const original=bytes(doc,format),proof=readRootPageHideControl(doc,{section:0,paragraph:0},'document:1');
  assert.equal(proof.control.ctrlId,'pghd');assert.equal(proof.control.list,0);assert.equal(proof.flags.hideHeader,true);assert.equal(proof.flags.hideBorder,true);
  const tx=deleteRootPageHideControl(doc,proof,()=> 'document:1'),saved=bytes(doc,format);
  assert.equal(pageHide(doc).exists,false);assert.equal(controls(doc).some((item:any)=>item.ctrlId==='pghd'),false);
  const reopened:any=new HwpDocument(saved);try{
   assert.equal(pageHide(reopened).exists,false);assert.equal(controls(reopened).some((item:any)=>item.ctrlId==='pghd'),false);
   assert.equal(reopened.getTextRange(0,0,0,reopened.getParagraphLength(0,0)),'B031 감추기 조판 부호');
  }finally{reopened.free();}
  const restored=tx.undo();assert.deepEqual(restored,proof);assert.deepEqual(bytes(doc,format),original);assert.equal(pageHide(doc).exists,true);
  assert.throws(()=>tx.undo(),/이미 종료/);
  const restoredReopen:any=new HwpDocument(bytes(doc,format));try{assert.equal(pageHide(restoredReopen).hideHeader,true);assert.equal(pageHide(restoredReopen).hideBorder,true);}finally{restoredReopen.free();}
 }finally{doc.free();}
});

test('stale revision, stale identity and unsupported controls fail before mutation',()=>{
 const doc=fixture();try{
  const before=doc.exportHwpx(),proof=readRootPageHideControl(doc,{section:0,paragraph:0},'document:1');
  assert.throws(()=>deleteRootPageHideControl(doc,proof,()=> 'document:2'),/버전/);assert.deepEqual(doc.exportHwpx(),before);
  assert.throws(()=>deleteRootPageHideControl(doc,{...proof,control:{...proof.control,userDesc:'다른 부호' as any}},()=> 'document:1'),/바뀌었습니다/);assert.deepEqual(doc.exportHwpx(),before);
  assert.throws(()=>readRootPageHideControl(doc,{section:0,paragraph:1},'document:1'),/문단/);assert.deepEqual(doc.exportHwpx(),before);
  doc.setPageHide(0,0,false,true,false,true,false,true);const changed=doc.exportHwpx();
  assert.throws(()=>deleteRootPageHideControl(doc,proof,()=> 'document:1'),/바뀌었습니다/);assert.deepEqual(doc.exportHwpx(),changed);assert.equal(pageHide(doc).hideFooter,true);
 }finally{doc.free();}
});

test('one snapshot rolls back an engine result failure and commit retires that snapshot',()=>{
 const doc=fixture();try{
  const before=doc.exportHwpx(),proof=readRootPageHideControl(doc,{section:0,paragraph:0},'document:1');let saves=0,restores=0,discards=0;
  const proxy=new Proxy(doc,{get(target,key){
   if(key==='saveSnapshot')return()=>{saves++;return target.saveSnapshot();};
   if(key==='restoreSnapshot')return(token:number)=>{restores++;return target.restoreSnapshot(token);};
   if(key==='discardSnapshot')return(token:number)=>{discards++;return target.discardSnapshot(token);};
   if(key==='deleteControlAt')return(...args:any[])=>{target.deleteControlAt(...args);return'{"ok":false}';};
   const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;
  }});
  assert.throws(()=>deleteRootPageHideControl(proxy,proof,()=> 'document:1'),/삭제하지 못했습니다/);
  assert.deepEqual({saves,restores,discards},{saves:1,restores:1,discards:1});assert.deepEqual(doc.exportHwpx(),before);assert.equal(pageHide(doc).exists,true);
  const tx=deleteRootPageHideControl(doc,proof,()=> 'document:1');tx.commit();assert.throws(()=>tx.undo(),/이미 종료/);assert.equal(pageHide(doc).exists,false);
 }finally{doc.free();}
});
