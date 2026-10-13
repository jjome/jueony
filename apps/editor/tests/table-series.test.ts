import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import init, { HwpDocument } from '../node_modules/@rhwp/core/rhwp.js';
import { planTableSeries } from '../src/modules/document/public/table-auto-fill.ts';
import { executeAutoFill, readAutoFillPlan } from '../src/adapters/rhwp/table-auto-fill-native.ts';

test('date fill crosses leap days, year boundaries, decreases and uses UTC days', () => {
  assert.deepEqual(planTableSeries('2024-02-28', '2024-02-29', 4).values, ['2024-02-28', '2024-02-29', '2024-03-01', '2024-03-02']);
  assert.deepEqual(planTableSeries('2026.12.31', '2027.01.02', 3).values, ['2026.12.31', '2027.01.02', '2027.01.04']);
  assert.deepEqual(planTableSeries('2026/03/10', '2026/03/09', 3).values, ['2026/03/10', '2026/03/09', '2026/03/08']);
  assert.equal(planTableSeries('2026-03-08', '2026-03-09', 1000).step, 1);
});
test('numbered labels keep literal Unicode prefix/suffix, zero padding and seed text', () => {
  assert.deepEqual(planTableSeries('제001호', '제003호', 4).values, ['제001호', '제003호', '제005호', '제007호']);
  assert.deepEqual(planTableSeries('😀 3차', '😀 2차', 4).values, ['😀 3차', '😀 2차', '😀 1차', '😀 0차']);
  assert.deepEqual(planTableSeries('2', '0', 4).values, ['2', '0', '-2', '-4']);
});

test('explicit month/year fill uses the first day anchor without end-of-month or leap-year drift', () => {
  assert.deepEqual(planTableSeries('2026-01-31', '2026-02-28', 4, 'months').values, ['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30']);
  assert.deepEqual(planTableSeries('2024.03.31', '2024.02.29', 3, 'months').values, ['2024.03.31', '2024.02.29', '2024.01.31']);
  assert.deepEqual(planTableSeries('2024/02/29', '2025/02/28', 5, 'years').values, ['2024/02/29', '2025/02/28', '2026/02/28', '2027/02/28', '2028/02/29']);
  assert.throws(() => planTableSeries('2026-02-28', '2026-03-31', 3, 'months'), /맞지 않습니다/);
  assert.throws(() => planTableSeries('1', '2', 3, 'months'), /날짜 셀/);
  assert.throws(() => planTableSeries('제1호', '제2호', 3, 'years'), /날짜 셀/);
  assert.throws(() => planTableSeries('1001-01-01', '1000-01-01', 3, 'years'), /범위/);
  assert.throws(() => planTableSeries('1000-01-01', '9999-01-01', 1000, 'days'), /범위/);
});
test('bad dates, mixed patterns, formulas and ambiguous multiple numbers fail before editing', () => {
  for (const [a, b] of [['2023-02-29', '2023-03-01'], ['2026-04-31', '2026-05-01'], ['2026-01-01', '2026.01.02'], ['제1호', '제2차'], ['2026년 1월', '2026년 2월'], ['=1', '=2'], ['제01호', '제002호'], ['제2호', '제1호'], ['9999-12-30', '9999-12-31']]) assert.throws(() => planTableSeries(a, b, 4));
  for (const count of [2, 1001, 3.5]) assert.throws(() => planTableSeries('제1호', '제2호', count));
});
test('dates and supplementary-Unicode labels roundtrip through native HWP/HWPX with target formatting', async () => {
  await init({ module_or_path: await readFile(new URL('../node_modules/@rhwp/core/rhwp_bg.wasm', import.meta.url)) });
  for (const [seeds, unit] of [[['2024-02-28', '2024-02-29'], 'days'], [['😀 제001호', '😀 제003호'], 'days'], [['2026-01-31', '2026-02-28'], 'months'], [['2024-02-29', '2025-02-28'], 'years']] as const) {
    const doc: any = HwpDocument.createEmpty(); doc.createBlankDocument();
    try {
      const t = JSON.parse(doc.createTable(0, 0, 0, 1, 4));
      [...seeds, '기존', '기존'].forEach((value, cell) => doc.insertTextInCell(0, t.paraIdx, t.controlIdx, cell, 0, 0, value));
      doc.applyCharFormatInCell(0, t.paraIdx, t.controlIdx, 2, 0, 0, 2, JSON.stringify({ bold: true }));
      const block = { sec: 0, ppi: t.paraIdx, ci: t.controlIdx, anchor: { row: 0, col: 0 }, focus: { row: 0, col: 3 } };
      const plan = readAutoFillPlan(doc, block, unit); executeAutoFill(doc, plan);
      assert.throws(() => executeAutoFill(doc, plan), /바뀌었습니다/);
      for (const format of ['exportHwp', 'exportHwpx']) {
        const reopened: any = new HwpDocument(doc[format]());
        try {
          for (let cell = 0; cell < 4; cell++) assert.equal(reopened.getTextInCell(0, t.paraIdx, t.controlIdx, cell, 0, 0, reopened.getCellParagraphLength(0, t.paraIdx, t.controlIdx, cell, 0)), plan.values[cell]);
          for (let at = 0; at < Array.from(plan.values[2]).length; at++) assert.equal(JSON.parse(reopened.getCellCharPropertiesAt(0, t.paraIdx, t.controlIdx, 2, 0, at)).bold, true);
        } finally { reopened.free(); }
      }
    } finally { doc.free(); }
  }
});
