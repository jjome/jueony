import assert from 'node:assert/strict';
import test from 'node:test';
import { planPrintImposition } from '../src/modules/document/public/index.ts';

test('2-up and 4-up print leave empty slots while preserving filtered and reversed page order', () => {
  const options={perSheet:2 as const,orientation:'landscape' as const,paper:'a4' as const,marginMm:8,parity:'all' as const,reverse:false};
  const two=planPrintImposition(5,options);
  assert.deepEqual([two.widthMm,two.heightMm,two.columns,two.rows],[297,210,2,1]);
  assert.deepEqual(two.sheets.map(sheet=>sheet.map(slot=>slot.page)),[[0,1],[2,3],[4]]);
  const four=planPrintImposition(9,{...options,perSheet:4,orientation:'portrait',parity:'odd',reverse:true});
  assert.deepEqual([four.widthMm,four.heightMm,four.columns,four.rows],[210,297,2,2]);
  assert.deepEqual(four.sheets.map(sheet=>sheet.map(slot=>slot.page)),[[8,6,4,2],[0]]);
  assert.deepEqual(planPrintImposition(1,{...options,parity:'even'}).sheets,[]);
  assert.throws(()=>planPrintImposition(61,options),/60쪽/);
});
