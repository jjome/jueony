import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import init,{HwpDocument} from '@rhwp/core';
import {HangulKeyResolver} from '../src/shortcuts/keymap.ts';

await init({module_or_path:await readFile(new URL('../node_modules/@rhwp/core/rhwp_bg.wasm',import.meta.url))});

type Control={ctrlId:string;list:number;para:number;controlIndex:number};
const controls=(document:any):Control[]=>JSON.parse(document.getControls());
const shapes=(document:any)=>controls(document).filter(item=>item.ctrlId==='gso'&&item.list===0);
const zOrder=(document:any,item:Control):number=>JSON.parse(document.getShapeProperties(0,item.para,item.controlIndex)).zOrder;
const makeShape=(document:any,shapeType:string)=>JSON.parse(document.createShapeControl(JSON.stringify({
 sectionIdx:0,paraIdx:0,charOffset:0,width:6000,height:3000,shapeType,
})));

test('B177 shape front/back is invertible and survives HWP/HWPX reopen',()=>{
 for(const format of ['Hwp','Hwpx'] as const){
  const document:any=HwpDocument.createEmpty();document.createBlankDocument();let reopened:any;
  try{
   const first=makeShape(document,'rectangle'),second=makeShape(document,'ellipse');
   assert.equal(first.ok,true);assert.equal(second.ok,true);
   const before=shapes(document);assert.equal(before.length,2);
   const firstBefore=before.find(item=>item.controlIndex===first.controlIdx)!;
   const secondBefore=before.find(item=>item.controlIndex===second.controlIdx)!;
   const firstBeforeZ=zOrder(document,firstBefore),secondBeforeZ=zOrder(document,secondBefore);
   assert.ok(Number.isInteger(firstBeforeZ));assert.ok(Number.isInteger(secondBeforeZ));

   const raw=document.changeShapeZOrder(0,first.paraIdx,first.controlIdx,'front');
   const receipt=typeof raw==='string'?JSON.parse(raw):raw;
   assert.equal(receipt.ok,true);assert.ok(Array.isArray(receipt.moves)&&receipt.moves.length>0);
   const arranged=shapes(document),firstAfter=arranged.find(item=>item.controlIndex===first.controlIdx)!;
   const secondAfter=arranged.find(item=>item.controlIndex===second.controlIdx)!;
   assert.ok(zOrder(document,firstAfter)>zOrder(document,secondAfter));

   reopened=new HwpDocument(document[`export${format}`]());
   const stored=shapes(reopened),storedFirst=stored.find(item=>item.controlIndex===first.controlIdx)!;
   const storedSecond=stored.find(item=>item.controlIndex===second.controlIdx)!;
   assert.ok(zOrder(reopened,storedFirst)>zOrder(reopened,storedSecond),format);
   reopened.free();reopened=undefined;

   const undo=receipt.moves.map((move:any)=>({ppi:move.ppi,ci:move.ci,z:move.before}));
   const restored=JSON.parse(document.applyShapeZOrderPairs(0,JSON.stringify(undo)));
   assert.equal(restored.ok,true);assert.equal(restored.applied,undo.length);
   const afterUndo=shapes(document);
   assert.equal(zOrder(document,afterUndo.find(item=>item.controlIndex===first.controlIdx)!),firstBeforeZ);
   assert.equal(zOrder(document,afterUndo.find(item=>item.controlIndex===second.controlIdx)!),secondBeforeZ);
  }finally{reopened?.free();document.free();}
 }
});

test('B177 object shortcuts never fall through to body selection behavior',()=>{
 const object={table:false,cells:false,object:true} as const;
 for(const [key,command] of [['PageUp','insert:arrange-front'],['PageDown','insert:arrange-back']] as const){
  const resolved=new HangulKeyResolver().resolve({key,code:key,ctrlKey:false,altKey:false,shiftKey:true,metaKey:false,repeat:false,isComposing:false},object);
  assert.equal(resolved.handled,true);assert.equal(resolved.binding?.command,command);assert.equal(resolved.binding?.scope,'object');
  const body=new HangulKeyResolver().resolve({key,code:key,ctrlKey:false,altKey:false,shiftKey:true,metaKey:false,repeat:false,isComposing:false},{table:false,cells:false,object:false});
  assert.equal(body.handled,false);assert.equal(body.binding,undefined);
 }
});
