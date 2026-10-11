import test from 'node:test';
import assert from 'node:assert/strict';
import {recoveryBytes} from '../src/mvp/recovery-export.ts';
import {exportRecovery} from '../src/modules/document-files/public/index.ts';
import {readFile} from 'node:fs/promises';
import init,{HwpDocument} from '@rhwp/core';
await init({module_or_path:await readFile(new URL('../node_modules/@rhwp/core/rhwp_bg.wasm',import.meta.url))});
const artifact=(format:string,count=0)=>({bytes:new Uint8Array([1,2]),contentLoss:{schemaVersion:1,outputFormat:format,count,losses:Array.from({length:count},()=>({code:'controlOmitted'}))}});
test('recovery chooses the actual document format and returns only a loss-free export',()=>{
 const seen:string[]=[];const port={isPasswordProtected:()=>false,export:(format:'hwp'|'hwpx')=>{seen.push(format);return artifact(format);}};
 assert.deepEqual(exportRecovery(port,'계획.HWPX'),new Uint8Array([1,2]));
 assert.deepEqual(exportRecovery(port,'계획.hwp'),new Uint8Array([1,2]));assert.deepEqual(seen,['hwpx','hwp']);
});
test('loss, missing/mismatched reports and empty bytes never become a new recovery record',()=>{
 for(const bad of [artifact('hwpx',1),artifact('hwp'),{...artifact('hwpx'),bytes:new Uint8Array()},{...artifact('hwpx'),contentLoss:{...artifact('hwpx').contentLoss,count:1}}]){
  assert.throws(()=>exportRecovery({isPasswordProtected:()=>false,export:()=>bad},'계획.hwpx'));
 }
});

test('native recovery adapter really reopens exported content before returning bytes',()=>{
 const doc=HwpDocument.createEmpty();doc.createBlankDocument();doc.insertText(0,0,0,'검수 원문');let corrupt=false;
 const exportArtifact=(format:'hwp'|'hwpx')=>{const value=format==='hwp'?doc.exportHwpWithReport():doc.exportHwpxWithReport();try{return {bytes:corrupt?new Uint8Array([1,2]):value.takeBytes(),contentLoss:JSON.parse(value.contentLoss())};}finally{value.free();}};
 const source={borrowDocumentHandle:()=>doc,getWasmModuleExports:()=>({HwpDocument}),exportHwpWithReport:()=>exportArtifact('hwp'),exportHwpxWithReport:()=>exportArtifact('hwpx')};
 try{for(const name of ['계획.hwp','계획.HWPX']){const recovered=new HwpDocument(recoveryBytes(source,name));try{assert.equal(recovered.getTextRange(0,0,0,5),'검수 원문');}finally{recovered.free();}}corrupt=true;assert.throws(()=>recoveryBytes(source,'계획.hwp'),/보존 검사/);}finally{doc.free();}
});

test('password-protected document never invokes an unencrypted recovery exporter',()=>{
 let calls=0;const exportPlain=()=>{calls++;return artifact('hwp');};
 assert.throws(()=>recoveryBytes({requiresPasswordForSave:true,exportHwpWithReport:exportPlain,exportHwpxWithReport:exportPlain},'protected.hwp'),/암호/);
 assert.equal(calls,0);
});
