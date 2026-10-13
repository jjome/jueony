import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import init, { HwpDocument } from '../node_modules/@rhwp/core/rhwp.js';
import { tablePresetCell, tablePresets } from '../src/modules/document/public/table-presets.ts';
import { readTablePresetPlan, executeTablePreset, preflightTablePreset } from '../src/adapters/rhwp/table-presets-native.ts';

test('table preset definitions change only borders and fills with explicit header and stripe choices', () => {
  assert.equal(tablePresetCell('blue', 0, true).fillColor, '#dceaf7');
  assert.equal(tablePresetCell('blue', 0, false).fillColor, '#ffffff');
  assert.equal(tablePresetCell('blue', 1, false).fillColor, '#f1f6fb');
  assert.equal(tablePresetCell('clear', 0, true).fillType, 'none');
  assert.throws(() => tablePresetCell('invalid' as any, 0, true));
  assert.throws(() => tablePresetCell('grid', -1, true));
  assert.equal(Object.hasOwn(tablePresetCell('grid', 0, true), 'width'), false);
});

test('all table presets preserve Unicode mixed formats and geometry through scratch and two formats', async () => {
  await init({ module_or_path: await readFile(new URL('../node_modules/@rhwp/core/rhwp_bg.wasm', import.meta.url)) });
  for (const preset of tablePresets) for (const ext of ['Hwp', 'Hwpx']) {
    let doc: any = HwpDocument.createEmpty(); doc.createBlankDocument(); let reopened: any;
    try {
      const t = JSON.parse(doc.createTable(0, 0, 0, 3, 2));
      let target = { sec: 0, ppi: t.paraIdx, ci: t.controlIdx };
      doc.insertTextInCell(0, target.ppi, target.ci, 0, 0, 0, '가😀나');
      doc.applyCharFormatInCell(0, target.ppi, target.ci, 0, 0, 1, 2, JSON.stringify({ bold: true }));
      // The npm reference lacks the production metadata-order patch. Model a
      // file opened by the editor; fresh production documents are tested separately.
      const loaded: any = new HwpDocument(doc['export' + ext]()); doc.free(); doc = loaded;
      const table = JSON.parse(doc.getControls()).find((c: any) => c.ctrlId === 'tbl'); target = { sec: 0, ppi: table.para, ci: table.controlIndex };
      const bridge = { fileName: 'preset.' + ext.toLowerCase(), borrowDocumentHandle: () => doc, getWasmModuleExports: () => ({ HwpDocument }) };
      const plan = readTablePresetPlan(doc, target, preset.id, true), before = doc.exportHwpx();
      preflightTablePreset(bridge, plan); assert.deepEqual(doc.exportHwpx(), before);
      executeTablePreset(doc, plan);
      assert.equal(doc.getTextInCell(0, target.ppi, target.ci, 0, 0, 0, 3), '가😀나');
      assert.equal(JSON.parse(doc.getCellCharPropertiesAt(0, target.ppi, target.ci, 0, 0, 1)).bold, true);
      assert.equal(JSON.parse(doc.getCellProperties(0, target.ppi, target.ci, 0)).width, plan.cells[0].properties.width);
      reopened = new HwpDocument(doc['export' + ext]());
      const actual = JSON.parse(reopened.getCellProperties(0, target.ppi, target.ci, 0));
      assert.equal(actual.fillType, preset.id === 'clear' ? 'none' : 'solid');
      if (preset.id !== 'clear') assert.equal(actual.fillColor, preset.header);
      assert.equal(JSON.parse(reopened.getCellCharPropertiesAt(0, target.ppi, target.ci, 0, 0, 1)).bold, true);
    } finally { reopened?.free(); doc.free(); }
  }
});

test('protected cells and stale table properties are refused; whole merged cells keep their first row color', async () => {
  await init({ module_or_path: await readFile(new URL('../node_modules/@rhwp/core/rhwp_bg.wasm', import.meta.url)) });
  const doc: any = HwpDocument.createEmpty(); doc.createBlankDocument();
  try {
    const t = JSON.parse(doc.createTable(0, 0, 0, 2, 2)), target = { sec: 0, ppi: t.paraIdx, ci: t.controlIdx };
    const plan = readTablePresetPlan(doc, target, 'blue', true);
    doc.setCellProperties(0, target.ppi, target.ci, 0, JSON.stringify({ paddingLeft: 200 }));
    const before = doc.exportHwpx(); assert.throws(() => executeTablePreset(doc, plan), /바뀌었습니다/); assert.deepEqual(doc.exportHwpx(), before);
    doc.setCellProperties(0, target.ppi, target.ci, 0, JSON.stringify({ cellProtect: true }));
    assert.throws(() => readTablePresetPlan(doc, target, 'blue', true), /보호/);
    doc.setCellProperties(0, target.ppi, target.ci, 0, JSON.stringify({ cellProtect: false })); doc.mergeTableCells(0, target.ppi, target.ci, 0, 0, 1, 0);
    const merged = readTablePresetPlan(doc, target, 'blue', true); executeTablePreset(doc, merged);
    assert.equal(JSON.parse(doc.getCellInfo(0, target.ppi, target.ci, 0)).rowSpan, 2);
    assert.equal(JSON.parse(doc.getCellProperties(0, target.ppi, target.ci, 0)).fillColor, '#dceaf7');
  } finally { doc.free(); }
});

test('a reversed rectangular cell block changes only selected cells and refuses partial merged footprints', async () => {
  await init({ module_or_path: await readFile(new URL('../node_modules/@rhwp/core/rhwp_bg.wasm', import.meta.url)) });
  const doc: any = HwpDocument.createEmpty(); doc.createBlankDocument();
  try {
    const t = JSON.parse(doc.createTable(0, 0, 0, 2, 3)), target = { sec: 0, ppi: t.paraIdx, ci: t.controlIdx };
    doc.setCellProperties(0, target.ppi, target.ci, 0, JSON.stringify({ cellProtect: true }));
    const block = { anchor: { row: 1, col: 2 }, focus: { row: 1, col: 1 } }, plan = readTablePresetPlan(doc, { ...target, block }, 'blue', true);
    assert.deepEqual(plan.cells.map(c => c.index), [4, 5]);
    const before = Array.from({ length: 6 }, (_, i) => JSON.parse(doc.getCellProperties(0, target.ppi, target.ci, i)));
    executeTablePreset(doc, plan);
    for (let i = 0; i < 4; i++) assert.deepEqual(JSON.parse(doc.getCellProperties(0, target.ppi, target.ci, i)), before[i]);
    for (let i = 4; i < 6; i++) assert.equal(JSON.parse(doc.getCellProperties(0, target.ppi, target.ci, i)).fillColor, '#dceaf7');
    doc.mergeTableCells(0, target.ppi, target.ci, 1, 1, 1, 2);
    assert.throws(() => readTablePresetPlan(doc, { ...target, block: { anchor: { row: 1, col: 2 }, focus: { row: 1, col: 2 } } }, 'blue', true), /병합 셀 전체/);
    const whole = readTablePresetPlan(doc, { ...target, block }, 'clear', false); executeTablePreset(doc, whole);
    assert.equal(whole.cells.length, 1); assert.equal(JSON.parse(doc.getCellProperties(0, target.ppi, target.ci, whole.cells[0].index)).fillType, 'none');
    assert.throws(() => readTablePresetPlan(doc, { ...target, block: { ...block, excluded: [0] } }, 'blue', true), /직사각형/);
  } finally { doc.free(); }
});
