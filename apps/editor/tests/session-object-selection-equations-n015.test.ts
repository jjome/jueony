import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {captureObjectSelection,restoreObjectSelection} from '../src/adapters/rhwp/session-object-selection.ts';
import {captureSessionCursor,restoreSessionCursor} from '../src/adapters/rhwp/session-cursor.ts';
import {validateSessionCursor} from '../src/modules/preferences/public/index.ts';

const enginePackage=process.env.JUEONY_ENGINE_PACKAGE;

async function engine(){
  const root=enginePackage ? new URL(`file:///${enginePackage.replace(/\\/gu,'/')}/`) : new URL('../node_modules/@rhwp/core/',import.meta.url);
  const {default:init,HwpDocument}=await import(new URL('rhwp.js',root).href);
  await init({module_or_path:await readFile(new URL('rhwp_bg.wasm',root))});
  return HwpDocument;
}

function refs(document:any){
  return JSON.parse(document.getObjects()).filter((object:any)=>object.kind==='equation')
    .map((object:any)=>({sec:0,ppi:object.para,ci:object.controlIndex,type:'equation'}));
}

function inputFor(document:any,selected=refs(document)){
  let restored:any,calls=0;
  const input:any={
    wasm:{requiresPasswordForSave:false,borrowDocumentHandle:()=>document},
    cursor:{
      isInPictureObjectSelection:()=>true,isInTableObjectSelection:()=>false,isInHeaderFooter:()=>false,isInFootnote:()=>false,isInTextBox:()=>false,
      getSelectedPictureRefs:()=>selected,getSelectedPictureRef:()=>selected.at(-1)??null,
    },
    restoreSessionObjectSelection:(value:any)=>{calls++;restored=structuredClone(value);return true;},
  };
  return {input,calls:()=>calls,restored:()=>restored};
}

async function twoEquations(){
  const HwpDocument=await engine(),seed=HwpDocument.createEmpty();
  seed.createBlankDocument();
  const document=new HwpDocument(seed.exportHwpx());
  seed.free();
  const first=JSON.parse(document.insertEquation(0,0,0,'x^2 + y^2',1000,0));
  const second=JSON.parse(document.insertEquation(0,0,1,'a over b',1100,255));
  assert.equal(first.ok,true);assert.equal(second.ok,true);
  assert.equal(refs(document).length,2);
  return document;
}

test('two root equations capture ordered private fingerprints and restore through the Studio picture-object port',async()=>{
  const document=await twoEquations();
  try{
    const fixture=inputFor(document),saved=captureObjectSelection(fixture.input)!;
    assert.equal(saved.kind,'object-selection');assert.equal(saved.objects.length,2);assert.equal(saved.active,1);
    assert.deepEqual(saved.objects.map(object=>object.type),['equation','equation']);
    assert.deepEqual(captureSessionCursor(fixture.input),saved);
    assert.deepEqual(validateSessionCursor(saved),saved);
    assert.equal(restoreObjectSelection(fixture.input,saved),true);
    assert.equal(restoreSessionCursor(fixture.input,saved),true);
    assert.deepEqual(fixture.restored(),refs(document).map((ref:any)=>({section:ref.sec,paragraph:ref.ppi,control:ref.ci,type:'equation'})));
    assert.doesNotMatch(JSON.stringify(saved),/x\^2|a over b|HYhwpEQ/u);
  }finally{document.free();}
});

test('equation bookmark survives HWP and HWPX save/reopen without mutating bytes',async()=>{
  const document=await twoEquations();
  try{
    const saved=captureObjectSelection(inputFor(document).input)!;
    for(const format of ['hwp','hwpx'] as const){
      const bytes=format==='hwp'?document.exportHwp():document.exportHwpx();
      const HwpDocument=await engine(),reopened=new HwpDocument(bytes);
      try{
        const fixture=inputFor(reopened),before=format==='hwp'?reopened.exportHwp():reopened.exportHwpx();
        assert.equal(restoreObjectSelection(fixture.input,saved),true,format);
        assert.equal(fixture.calls(),1,format);
        assert.deepEqual(format==='hwp'?reopened.exportHwp():reopened.exportHwpx(),before,format);
        assert.deepEqual(captureObjectSelection(fixture.input),saved,format);
      }finally{reopened.free();}
    }
  }finally{document.free();}
});

test('changed equation script, owner identity or stale document fails before Studio restore',async()=>{
  const document=await twoEquations();
  try{
    const selected=refs(document),saved=captureObjectSelection(inputFor(document,selected).input)!;
    for(const mode of ['properties','owner','document'] as const){
      const proxy=new Proxy(document,{get(target,key){
        if(mode==='properties'&&key==='getEquationProperties')return(...args:any[])=>JSON.stringify({...JSON.parse(target.getEquationProperties(...args)),script:'changed'});
        if(mode==='owner'&&key==='getObjects')return()=>JSON.stringify(JSON.parse(target.getObjects()).map((value:any,index:number)=>index===0?{...value,kind:'shape'}:value));
        if(mode==='document'&&key==='getControls')return()=>JSON.stringify([...JSON.parse(target.getControls()),{ctrlId:'unrelated',list:0,para:0,controlIndex:999,props:{}}]);
        const value=target[key];return typeof value==='function'?value.bind(target):value;
      }});
      const fixture=inputFor(proxy,selected);
      assert.equal(restoreObjectSelection(fixture.input,saved),false,mode);
      assert.equal(fixture.calls(),0,mode);
    }
  }finally{document.free();}
});

test('single, mixed, nested, OLE and table selections remain fail-closed',async()=>{
  const document=await twoEquations();
  try{
    const base=refs(document);
    assert.equal(captureObjectSelection(inputFor(document,[base[0]]).input),undefined);
    assert.equal(captureObjectSelection(inputFor(document,[base[0],{...base[1],type:'image'}]).input),undefined);
    assert.equal(captureObjectSelection(inputFor(document,[{...base[0],cellPath:[{}]},base[1]]).input),undefined);
    assert.equal(captureObjectSelection(inputFor(document,base.map((ref:any)=>({...ref,type:'ole'}))).input),undefined);
    const tableFixture=inputFor(document,base);tableFixture.input.cursor.isInTableObjectSelection=()=>true;
    assert.equal(captureObjectSelection(tableFixture.input),undefined);
  }finally{document.free();}
});
