import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import init, { HwpDocument } from '../node_modules/@rhwp/core/rhwp.js';
import { planIntegerSeries } from '../src/modules/document/public/table-auto-fill.ts';
import { readAutoFillPlan, executeAutoFill } from '../src/adapters/rhwp/table-auto-fill-native.ts';

test('integer series derives explicit step, keeps seeds and consistent zero padding', () => {
  assert.deepEqual(planIntegerSeries('001', '003', 4), { step: 2, values: ['001', '003', '005', '007'] });
  assert.deepEqual(planIntegerSeries('2', '0', 4).values, ['2', '0', '-2', '-4']);
  assert.deepEqual(planIntegerSeries('-002', '-001', 4).values, ['-002', '-001', '000', '001']);
  assert.deepEqual(planIntegerSeries('7', '7', 3).values, ['7', '7', '7']);
});
test('series rejects inferred dates/formulas/prefixes, invalid count, padding and overflowing output', () => {
  for (const [a, b] of [['2026년', '2027년'], ['1.0', '2.0'], [' 1', '2'], ['=1', '=2'], ['01', '002'], ['999999999998', '999999999999']]) assert.throws(() => planIntegerSeries(a, b, 4));
  for (const count of [0, 2, 1001, 3.5]) assert.throws(() => planIntegerSeries('1', '2', count));
});
test('native selected row auto fill preserves seeds, target formats, geometry, other rows and saved documents', async () => {
  await init({ module_or_path: await readFile(new URL('../node_modules/@rhwp/core/rhwp_bg.wasm', import.meta.url)) });
  const d: any = HwpDocument.createEmpty(); d.createBlankDocument();
  try {
    const t = JSON.parse(d.createTable(0, 0, 0, 2, 3)), values = ['다른', '행', '유지', '001', '003', '기존😀'];
    values.forEach((v, cell) => d.insertTextInCell(0, t.paraIdx, t.controlIdx, cell, 0, 0, v));
    d.applyCharFormatInCell(0, t.paraIdx, t.controlIdx, 5, 0, 0, 3, JSON.stringify({ bold: true }));
    const block = { sec: 0, ppi: t.paraIdx, ci: t.controlIdx, anchor: { row: 1, col: 2 }, focus: { row: 1, col: 0 }, excluded: [] };
    const beforeGeometry = Array.from({ length: 6 }, (_, cell) => JSON.parse(d.getCellProperties(0, t.paraIdx, t.controlIdx, cell))), plan = readAutoFillPlan(d, block);
    assert.equal(plan.step, 2); executeAutoFill(d, plan);
    const actual = Array.from({ length: 6 }, (_, cell) => d.getTextInCell(0, t.paraIdx, t.controlIdx, cell, 0, 0, d.getCellParagraphLength(0, t.paraIdx, t.controlIdx, cell, 0)));
    assert.deepEqual(actual, ['다른', '행', '유지', '001', '003', '005']);
    assert.equal(JSON.parse(d.getCellCharPropertiesAt(0, t.paraIdx, t.controlIdx, 5, 0, 0)).bold, true);
    assert.deepEqual(Array.from({ length: 6 }, (_, cell) => JSON.parse(d.getCellProperties(0, t.paraIdx, t.controlIdx, cell))), beforeGeometry);
    for (const method of ['exportHwp', 'exportHwpx']) {
      const reopened: any = new HwpDocument(d[method]());
      try { assert.equal(reopened.getTextInCell(0, t.paraIdx, t.controlIdx, 5, 0, 0, 3), '005'); assert.equal(JSON.parse(reopened.getCellCharPropertiesAt(0, t.paraIdx, t.controlIdx, 5, 0, 0)).bold, true); }
      finally { reopened.free(); }
    }
    const equal = readAutoFillPlan(d, block), before = d.exportHwpx(); executeAutoFill(d, equal); assert.deepEqual(d.exportHwpx(), before);
    assert.throws(() => executeAutoFill(d, plan), /바뀌었습니다/);
    assert.throws(() => readAutoFillPlan(d, { ...block, anchor: { row: 0, col: 0 }, focus: { row: 1, col: 2 } }), /한 행/);
    d.setCellProperties(0, t.paraIdx, t.controlIdx, 5, JSON.stringify({ cellProtect: true })); assert.throws(() => readAutoFillPlan(d, block), /보호/);
  } finally { d.free(); }
});
