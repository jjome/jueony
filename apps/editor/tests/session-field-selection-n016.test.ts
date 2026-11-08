import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {captureRootClickHereFieldSelectionN016,restoreRootClickHereFieldSelectionN016,validateRootClickHereFieldSelectionN016} from '../src/adapters/rhwp/session-field-selection-n016.ts';
import {captureSessionCursor,restoreSessionCursor} from '../src/adapters/rhwp/session-cursor.ts';
import {validateDocumentView,validateSessionCursor} from '../src/modules/preferences/public/index.ts';

const pkg=process.env.JUEONY_ENGINE_PACKAGE??fileURLToPath(new URL('../node_modules/@rhwp/core/',import.meta.url));
const {default:init,HwpDocument}=await import(pathToFileURL(resolve(pkg,'rhwp.js')).href);
await init({module_or_path:await readFile(resolve(pkg,'rhwp_bg.wasm'))});

function document(){
 const value=HwpDocument.createEmpty();
 value.createBlankDocument();value.insertText(0,0,0,'앞뒤');
 value.insertClickHereField(0,0,1,'입력 안내','설명','성명',true);
 value.setFieldValueByName('성명','김민수');
 return value;
}
function input(native:any,direction:'forward'|'backward'='forward'){
 const field=JSON.parse(native.getFieldList())[0],start=field.startCharIdx,end=field.endCharIdx;
 let anchor={sectionIndex:0,paragraphIndex:0,charOffset:direction==='forward'?start:end};
 let focus={sectionIndex:0,paragraphIndex:0,charOffset:direction==='forward'?end:start};
 let calls=0,restored:any;
 const session:any={
  getCursorPosition:()=>focus,
  restoreSessionSelection:(f:any,a:any,phase:any,block:any)=>{calls++;focus=structuredClone(f);anchor=structuredClone(a);restored={focus:f,anchor:a,phase,block};return true;},
  cursor:{hasSelection:()=>true,getSelection:()=>({anchor,focus}),isInHeaderFooter:()=>false,isInFootnote:()=>false,isInTextBox:()=>false,
   isInTableObjectSelection:()=>false,isInPictureObjectSelection:()=>false},
  wasm:{borrowDocumentHandle:()=>native,requiresPasswordForSave:false},
 };
 return {session,calls:()=>calls,restored:()=>restored};
}
const bytes=(native:any,format:'hwp'|'hwpx'):Uint8Array=>format==='hwp'?native.exportHwp():native.exportHwpx();
function fieldState(native:any){
 const field=JSON.parse(native.getFieldList())[0];
 return {field,text:native.getTextRange(0,0,0,native.getParagraphLength(0,0)),value:JSON.parse(native.getFieldValue(field.fieldId)),
  start:JSON.parse(native.getFieldInfoAt(0,0,field.startCharIdx)),end:JSON.parse(native.getFieldInfoAt(0,0,field.endCharIdx))};
}

test('root click-here field selection preserves structure across HWP/HWPX reopen and restore is byte-read-only',()=>{
 const source=document();
 try{
  const sourceFixture=input(source),sourceSelection=captureSessionCursor(sourceFixture.session),sourceField=fieldState(source);
  assert.ok(sourceSelection);
  for(const format of ['hwp','hwpx'] as const){
   const savedBytes=bytes(source,format),reopened=new HwpDocument(savedBytes);
   try{
    const fixture=input(reopened),before=bytes(reopened,format),saved=captureSessionCursor(fixture.session);
    assert.ok(saved,format);assert.deepEqual(validateRootClickHereFieldSelectionN016(saved),saved);
    assert.doesNotMatch(JSON.stringify(saved),/김민수|성명|입력 안내|설명/u);
    assert.deepEqual(validateSessionCursor(saved),saved);
    assert.deepEqual(fieldState(reopened),sourceField,`${format} field identity/value/address`);
    assert.deepEqual(saved,sourceSelection,`${format} field and selection fingerprints`);
    const view=validateDocumentView({version:1,zoom:1,fitMode:'none',scrollX:0,scrollY:0,cursor:saved});
    assert.deepEqual(view?.cursor,saved);
    assert.equal(restoreSessionCursor(fixture.session,view?.cursor),true,format);
    assert.deepEqual(fixture.restored(),{focus:{sectionIndex:0,paragraphIndex:0,charOffset:4},anchor:{sectionIndex:0,paragraphIndex:0,charOffset:1},phase:null,block:undefined});
    assert.equal(fixture.calls(),1);
    assert.deepEqual(captureSessionCursor(fixture.session),saved,`${format} restored selection readback`);
    assert.deepEqual(bytes(reopened,format),before,`${format} restore is byte-read-only on the same reopened handle`);
    const secondReopen=new HwpDocument(before);try{
     assert.deepEqual(fieldState(secondReopen),sourceField,`${format} reserialized field structure`);
     assert.deepEqual(captureSessionCursor(input(secondReopen).session),sourceSelection,`${format} reserialized field fingerprint`);
    }finally{secondReopen.free();}
    if(format==='hwp')assert.deepEqual(before,savedBytes,'HWP exact reopen/export roundtrip');
   }finally{reopened.free();}
  }
 }finally{source.free();}
});

test('backward field selection preserves direction',()=>{
 const native=document();try{
  const fixture=input(native,'backward'),saved=captureRootClickHereFieldSelectionN016(fixture.session);
  assert.equal(saved?.direction,'backward');assert.equal(restoreRootClickHereFieldSelectionN016(fixture.session,saved),true);
  assert.deepEqual(fixture.restored()?.focus,{sectionIndex:0,paragraphIndex:0,charOffset:1});
  assert.deepEqual(fixture.restored()?.anchor,{sectionIndex:0,paragraphIndex:0,charOffset:4});
 }finally{native.free();}
});

test('stale, missing and ambiguous field evidence fails closed before the callback',()=>{
 for(const fault of ['stale','missing','ambiguous'] as const){
  const native=document();try{
   const fixture=input(native),saved=captureRootClickHereFieldSelectionN016(fixture.session)!;
   if(fault==='stale')native.setFieldValueByName('성명','이순신');
   else{
    const original=native.getFieldList.bind(native);
    native.getFieldList=()=>fault==='missing'?'[]':JSON.stringify([...JSON.parse(original()),...JSON.parse(original())]);
   }
   assert.equal(restoreRootClickHereFieldSelectionN016(fixture.session,saved),false,fault);
   assert.equal(fixture.calls(),0,fault);
  }finally{native.free();}
 }
});

test('partial, empty, cell and special-story selections are never advertised as restorable',()=>{
 const native=document();try{
  const partial=input(native);partial.session.cursor.getSelection=()=>({anchor:{sectionIndex:0,paragraphIndex:0,charOffset:2},focus:{sectionIndex:0,paragraphIndex:0,charOffset:4}});
  assert.equal(captureSessionCursor(partial.session),undefined);
  const special=input(native);special.session.cursor.isInHeaderFooter=()=>true;
  assert.equal(captureRootClickHereFieldSelectionN016(special.session),undefined);
  const nested=input(native);nested.session.cursor.getSelection=()=>({anchor:{sectionIndex:0,paragraphIndex:0,charOffset:1,parentParaIndex:0},focus:{sectionIndex:0,paragraphIndex:0,charOffset:4,parentParaIndex:0}});
  nested.session.getCursorPosition=()=>({sectionIndex:0,paragraphIndex:0,charOffset:4,parentParaIndex:0});
  assert.equal(captureRootClickHereFieldSelectionN016(nested.session),undefined);
 }finally{native.free();}
 const empty=HwpDocument.createEmpty();try{
  empty.createBlankDocument();empty.insertClickHereField(0,0,0,'','','빈필드',true);
  const fixture=input(empty);assert.equal(captureRootClickHereFieldSelectionN016(fixture.session),undefined);
 }finally{empty.free();}
});

test('unsupported or forged bookmarks fail without exposing a false success',()=>{
 const native=document();try{
  const fixture=input(native),saved:any=captureRootClickHereFieldSelectionN016(fixture.session)!;
  assert.equal(restoreRootClickHereFieldSelectionN016(fixture.session,{...saved,end:saved.end+1}),false);
  fixture.session.restoreSessionSelection=()=>false;
  assert.equal(restoreRootClickHereFieldSelectionN016(fixture.session,saved),false);
 }finally{native.free();}
});
