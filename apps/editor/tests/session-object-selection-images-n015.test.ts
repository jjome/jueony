import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {captureObjectSelection,restoreObjectSelection} from '../src/adapters/rhwp/session-object-selection.ts';

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4AWPgmnbnPwAEpgJ8+MzEcgAAAABJRU5ErkJggg==','base64');

async function engine() {
  const {default:init,HwpDocument}=await import('../node_modules/@rhwp/core/rhwp.js');
  await init({module_or_path:await readFile(new URL('../node_modules/@rhwp/core/rhwp_bg.wasm',import.meta.url))});
  return HwpDocument;
}

function refs(document:any) {
  return JSON.parse(document.getObjects()).filter((object:any)=>object.kind==='picture')
    .map((object:any)=>({sec:0,ppi:object.para,ci:object.controlIndex,type:'image'}));
}

function inputFor(document:any, selected=refs(document)) {
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

async function twoPictures() {
  const HwpDocument=await engine(),document=HwpDocument.createEmpty();
  document.createBlankDocument();
  const first=JSON.parse(document.insertPicture(0,0,0,'',PNG,7200,7200,1,1,'png','first-private-description'));
  const second=JSON.parse(document.insertPicture(0,0,1,'',PNG,8000,8000,1,1,'png','second-private-description'));
  assert.equal(first.ok,true);assert.equal(second.ok,true);
  return document;
}

test('two top-level embedded images capture ordered owner identity without exposing image bytes or properties',async()=>{
  const document=await twoPictures();
  try{
    const fixture=inputFor(document),saved=captureObjectSelection(fixture.input)!;
    assert.equal(saved.kind,'object-selection');assert.equal(saved.objects.length,2);assert.equal(saved.active,1);
    assert.deepEqual(saved.objects.map(object=>object.type),['image','image']);
    assert.equal(restoreObjectSelection(fixture.input,saved),true);
    assert.deepEqual(fixture.restored(),refs(document).map((ref:any)=>({section:ref.sec,paragraph:ref.ppi,control:ref.ci,type:'image'})));
    const serialized=JSON.stringify(saved);
    assert.doesNotMatch(serialized,/private-description|iVBOR|137,80,78,71/u);
  }finally{document.free();}
});

test('multi-image bookmark survives HWP and HWPX save/reopen with byte-invariant restore',async()=>{
  const document=await twoPictures();
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

test('changed image payload, properties or owner identity fail before Studio restore callback',async()=>{
  const document=await twoPictures();
  try{
    const saved=captureObjectSelection(inputFor(document).input)!;
    for(const mode of ['payload','properties','owner'] as const){
      const proxy=new Proxy(document,{get(target,key){
        if(mode==='payload'&&key==='getControlImageData')return()=>new Uint8Array([1,2,3]);
        if(mode==='properties'&&key==='getPictureProperties')return(...args:any[])=>JSON.stringify({...JSON.parse(target.getPictureProperties(...args)),width:9999});
        if(mode==='owner'&&key==='getObjects')return()=>JSON.stringify(JSON.parse(target.getObjects()).map((value:any,index:number)=>index===0?{...value,kind:'shape'}:value));
        const value=target[key];return typeof value==='function'?value.bind(target):value;
      }});
      const fixture=inputFor(proxy,refs(document));
      assert.equal(restoreObjectSelection(fixture.input,saved),false,mode);
      assert.equal(fixture.calls(),0,mode);
    }
  }finally{document.free();}
});

test('single image, mixed vector/image, nested, captioned, locked and missing payload selections remain gated',async()=>{
  const document=await twoPictures();
  try{
    const base=refs(document);
    assert.equal(captureObjectSelection(inputFor(document,[base[0]]).input),undefined);
    assert.equal(captureObjectSelection(inputFor(document,[base[0],{...base[1],type:'shape'}]).input),undefined);
    assert.equal(captureObjectSelection(inputFor(document,[{...base[0],cellPath:[{}]},base[1]]).input),undefined);
    for(const mode of ['caption','lock','missing'] as const){
      const proxy=new Proxy(document,{get(target,key){
        if(mode==='caption'&&key==='getPictureProperties')return(...args:any[])=>JSON.stringify({...JSON.parse(target.getPictureProperties(...args)),hasCaption:true});
        if(mode==='lock'&&key==='getControls')return()=>JSON.stringify(JSON.parse(target.getControls()).map((value:any)=>value.controlIndex===base[0].ci?{...value,props:{...value.props,Lock:1}}:value));
        if(mode==='missing'&&key==='getControlImageData')return()=>new Uint8Array();
        const value=target[key];return typeof value==='function'?value.bind(target):value;
      }});
      assert.equal(captureObjectSelection(inputFor(proxy,base).input),undefined,mode);
    }
  }finally{document.free();}
});
