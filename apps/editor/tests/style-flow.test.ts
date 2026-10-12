import test from 'node:test';
import assert from 'node:assert/strict';
import {characterStyleSpans,applySelectedCharacterStyle,nextParagraphStyle} from '../src/adapters/rhwp/style-flow.ts';
const pos=(paragraphIndex:number,charOffset:number)=>({sectionIndex:0,paragraphIndex,charOffset});
const wasm={getSectionCount:()=>1,getParagraphCount:()=>3,getParagraphLength:()=>10,getStyleList:()=>[{id:0,type:0,nextStyleId:2},{id:1,type:1,charShapeId:8},{id:2,type:0,nextStyleId:2}],getStyleAt:()=>({id:0})};
test('character style applies only selected text across paragraphs, preserving outside text and paragraph style',()=>{
 const writes:any[]=[];let history=0;
 const input={cursor:Object.fromEntries(['isInHeaderFooter','isInFootnote','isInTextBox','isInCellSelectionMode','isInTableObjectSelection','isInPictureObjectSelection'].map(k=>[k,()=>false])),getSelection:()=>({start:pos(0,3),end:pos(2,2)}),getPosition:()=>pos(2,2),executeOperation:(op:any)=>{history++;op.operation({...wasm,setCharShapeRuns:(...args:any[])=>{writes.push(args);return '{"ok":true}';}});}};
 assert.equal(applySelectedCharacterStyle(input,wasm,1),true);assert.equal(history,1);
 assert.deepEqual(writes.map(a=>a.slice(0,4)),[[0,0,3,10],[0,1,0,10],[0,2,0,2]]);
 assert.ok(writes.every(a=>a[4][0].charShapeId===8));
});
test('invalid end is checked before any mutation, and different cells are rejected',()=>{
 assert.throws(()=>characterStyleSpans(wasm,pos(0,3),pos(2,20)));
 const cell=(cellIndex:number)=>({...pos(0,2),parentParaIndex:0,controlIndex:0,cellIndex,cellParaIndex:0});
 assert.throws(()=>characterStyleSpans(wasm,cell(0),cell(1)));
});
test('same nested cell range resolves paths per selected paragraph',()=>{
 const p=(paragraph:number,offset:number)=>({...pos(paragraph,offset),parentParaIndex:0,cellPath:[{controlIndex:0,cellIndex:1,cellParaIndex:0},{controlIndex:0,cellIndex:2,cellParaIndex:paragraph}]});
 const spans=characterStyleSpans({...wasm,getCellParagraphLengthByPath:()=>10},p(0,3),p(1,7));
 assert.deepEqual(spans.map(s=>[s.start,s.end,s.path?.at(-1)?.cellParaIndex]),[[3,10,0],[0,7,1]]);
});
test('next style follows only end-of-paragraph valid edges, without confusing character styles',()=>{
 assert.equal(nextParagraphStyle(wasm,0,0,10),2);assert.equal(nextParagraphStyle(wasm,0,0,5),undefined);
 assert.equal(nextParagraphStyle({...wasm,getStyleAt:()=>({id:2})},0,0,10),undefined);
 assert.equal(nextParagraphStyle({...wasm,getStyleList:()=>[{id:0,type:0,nextStyleId:1},{id:1,type:1}]},0,0,10),undefined);
});
