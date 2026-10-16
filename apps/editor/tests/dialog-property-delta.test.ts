import test from 'node:test';
import assert from 'node:assert/strict';
import {changedDialogProperties} from '../src/adapters/rhwp/dialog-property-delta.ts';

test('unchanged 0.5mm display retains native 141 HU instead of writing rounded 142', () => {
  assert.deepEqual(changedDialogProperties({paddingTop:142,width:2835},{paddingTop:142,width:2835},{paddingTop:141,width:2834}),{});
});
test('a cell edit emits just its requested padding while untouched dimensions and flags remain absent', () => {
  assert.deepEqual(changedDialogProperties({paddingTop:142,width:2835,cellProtect:true},{paddingTop:567,width:2835,cellProtect:true},{paddingTop:141,width:2834,cellProtect:true}),{paddingTop:567});
});
test('new optional settings and actual false/empty values remain changes', () => {
  assert.deepEqual(changedDialogProperties({fieldName:'old',repeatHeader:true},{fieldName:'',repeatHeader:false,width:9000},{fieldName:'old',repeatHeader:true,width:8000}),{fieldName:'',repeatHeader:false,width:9000});
});
test('switching a border target without changing its source values does not rewrite resources', () => {
  const border={type:1,width:2,color:'#000000'};
  assert.deepEqual(changedDialogProperties({}, {borderLeft:{color:'#000000',width:2,type:1}}, {borderLeft:border}),{});
  const result=changedDialogProperties({}, {borderLeft:{...border,width:3}}, {borderLeft:border});
  assert.deepEqual(result,{borderLeft:{...border,width:3}});
  (result.borderLeft as any).type=7;assert.equal(border.type,1);
});
test('unknown unrepresented fields and invalid untouched display values are never normalized as a side effect', () => {
  assert.deepEqual(changedDialogProperties({pageBreak:NaN},{pageBreak:NaN},{pageBreak:3,rawFlags:2147483648}),{});
});
test('enabling inner margin preserves precise unchanged values from previously inactive controls', () => {
  assert.deepEqual(changedDialogProperties({applyInnerMargin:false,paddingTop:142,paddingLeft:142},{applyInnerMargin:true,paddingTop:567,paddingLeft:142},{applyInnerMargin:false,paddingTop:141,paddingLeft:141}),{applyInnerMargin:true,paddingTop:567});
});
