import test from 'node:test';
import assert from 'node:assert/strict';
import {captureStoredCharacterStyle,verifyStoredCharacterStyle} from '../src/adapters/rhwp/character-style-reference.ts';
import {applySelectedCharacterStyle} from '../src/adapters/rhwp/style-flow.ts';

const catalog=()=>[{id:0,name:'바탕글',type:0,charShapeId:0},{id:1,name:'강조',type:1,charShapeId:8}];
const document=(styles=catalog())=>({getStyleList:()=>styles,getStyleDetail:(id:number)=>({id,charProps:{bold:true}})});
const cursor=Object.fromEntries(['isInHeaderFooter','isInFootnote','isInTextBox','isInCellSelectionMode','isInTableObjectSelection','isInPictureObjectSelection'].map(key=>[key,()=>false]));

test('stored definition reference is distinct from direct formatting and verifies exactly',()=>{
  const doc=document(),reference=captureStoredCharacterStyle(doc,1);
  assert.deepEqual({...reference,definitionSha256:'hash'},{kind:'stored-character-style',version:1,styleId:1,charShapeId:8,definitionSha256:'hash'});
  assert.deepEqual(verifyStoredCharacterStyle(doc,reference),{styleId:1,charShapeId:8});
  assert.throws(()=>verifyStoredCharacterStyle(doc,{kind:'direct-character-formatting',properties:{bold:true}} as any),/참조/);
});

test('stale or shared definitions fail before opening a mutation transaction',()=>{
  const styles=catalog(),doc=document(styles),reference=captureStoredCharacterStyle(doc,1);let transactions=0;
  styles[1]={...styles[1],charShapeId:9};
  const input={cursor,getSelection:()=>({start:{sectionIndex:0,paragraphIndex:0,charOffset:0},end:{sectionIndex:0,paragraphIndex:0,charOffset:1}}),getPosition:()=>({}),executeOperation:()=>{transactions++;}};
  assert.throws(()=>applySelectedCharacterStyle(input,{...doc,getSectionCount:()=>1,getParagraphCount:()=>1,getParagraphLength:()=>1},reference),/바뀌었습니다/);
  assert.equal(transactions,0);
  assert.throws(()=>captureStoredCharacterStyle(document([...catalog(),{id:2,name:'공유',type:0,charShapeId:8}]),1),/공유/);
});

test('definition is reverified inside the transaction before the first range write',()=>{
  const doc=document(),reference=captureStoredCharacterStyle(doc,1);let writes=0;
  const stale=document([{id:0,name:'바탕글',type:0,charShapeId:0},{id:1,name:'강조 변경',type:1,charShapeId:8}]);
  const input={cursor,getSelection:()=>({start:{sectionIndex:0,paragraphIndex:0,charOffset:0},end:{sectionIndex:0,paragraphIndex:0,charOffset:1}}),getPosition:()=>({}),executeOperation:(operation:any)=>operation.operation({...stale,setCharShapeRuns:()=>{writes++;return '{"ok":true}';}})};
  assert.throws(()=>applySelectedCharacterStyle(input,{...doc,getSectionCount:()=>1,getParagraphCount:()=>1,getParagraphLength:()=>1},reference),/바뀌었습니다/);
  assert.equal(writes,0);
});
