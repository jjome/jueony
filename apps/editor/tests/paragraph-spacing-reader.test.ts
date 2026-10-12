import test from 'node:test';
import assert from 'node:assert/strict';
import {createParagraphSpacingReader} from '../src/adapters/rhwp/paragraph-spacing.ts';
test('exact raw spacing resolves root section offsets and cell lists without rounded display data',()=>{
 const calls:number[][]=[],doc={getSectionCount:()=>2,getParagraphCount:(s:number)=>s===0?3:2,getCursorModel:()=>JSON.stringify({lists:[{listId:5,isCell:true,hostListId:0,sectionIndex:1,hostPara:1,controlIndex:2,cellIndex:3}]}),getParaShapeSet:(list:number,p:number)=>{calls.push([list,p]);return JSON.stringify({LeftMargin:2005,RightMargin:4011,Indentation:-97});}};
 const read=createParagraphSpacingReader({borrowDocumentHandle:()=>doc});
 assert.deepEqual(read({kind:'body',sec:1,para:1}),{marginLeft:2005,marginRight:4011,indent:-97});
 assert.deepEqual(read({kind:'cell',sec:1,parentPara:1,controlIdx:2,cellIdx:3,cellParaIdx:1}),{marginLeft:2005,marginRight:4011,indent:-97});
 assert.deepEqual(calls,[[0,4],[5,1]]);
 assert.throws(()=>read({kind:'cell',sec:1,parentPara:1,controlIdx:2,cellIdx:4,cellParaIdx:0}));
 assert.throws(()=>read({kind:'body',sec:99,para:0}));assert.throws(()=>read({kind:'body',sec:1,para:-1}));
 assert.throws(()=>createParagraphSpacingReader({borrowDocumentHandle:()=>null}));
});
test('absent native shape values never fall back to approximate px values',()=>{
 const doc={getSectionCount:()=>1,getParagraphCount:()=>1,getCursorModel:()=>'{"lists":[]}',getParaShapeSet:()=>'{"marginLeft":13.3}'};
 assert.throws(()=>createParagraphSpacingReader({borrowDocumentHandle:()=>doc})({kind:'body',sec:0,para:0}));
});
