import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';
import { pathToFileURL } from 'node:url';

// Runs before the manifest is written. A matching hash alone cannot tell that
// Cargo selected an artifact compiled from a different patched source tree.
const [pkg, fixture] = process.argv.slice(2);
if (!pkg || !fixture || !isAbsolute(pkg) || !isAbsolute(fixture)) {
  throw new Error('Usage: node verify-document-engine-package.mjs <absolute pkg> <absolute calc-cell.hwp>');
}
const { default: initialize, HwpDocument } = await import(pathToFileURL(join(pkg, 'rhwp.js')).href);
await initialize({ module_or_path: await readFile(join(pkg, 'rhwp_bg.wasm')) });
for (const method of ['splitCellParagraphs', 'previewTableFormulaField', 'updateTableFormulaField', 'insertTableFormulaField']) {
  assert.equal(typeof HwpDocument.prototype[method], 'function', 'Missing WASM binding ' + method);
}
const json = JSON.parse;

const table = HwpDocument.createEmpty();
try {
  table.createBlankDocument();
  const { paraIdx, controlIdx } = json(table.createTable(0, 0, 0, 1, 2));
  const at = [0, paraIdx, controlIdx];
  table.insertTextInCell(...at, 0, 0, 0, 'A');
  table.insertTextInCell(...at, 1, 0, 0, 'B');
  assert.equal(json(table.mergeTableCells(...at, 0, 0, 0, 1)).ok, true);
  assert.equal(json(table.splitCellParagraphs(...at, 0, 0, 1, 2)).ok, true);
  for (const [i, text] of ['A', 'B'].entries()) {
    assert.equal(table.getCellParagraphLength(...at, i, 0), 1);
    assert.equal(table.getTextInCell(...at, i, 0, 0, 1), text);
  }
  const first = json(table.insertTableFormulaField(...at, 0, 'A', '=2+3', '%g'));
  const second = json(table.insertTableFormulaField(...at, 1, 'B', '=A1*2', '%.1f'));
  assert.equal(first.value, '5');
  assert.equal(second.value, '10.0');
  assert.notEqual(first.fieldId, second.fieldId);
  for (const bytes of [table.exportHwp(), table.exportHwpx()]) {
    const reopened = new HwpDocument(bytes);
    try {
      const stored = json(reopened.getFieldList()).filter(f => f.fieldType === 'formula');
      assert.deepEqual(stored.map(f => [f.fieldId, f.command, f.value]), [
        [first.fieldId, '=2+3??%g;;5', '5'], [second.fieldId, '=A1*2??%.1f;;10.0', '10.0'],
      ]);
    } finally { reopened.free(); }
  }
} finally { table.free(); }

const formulas = new HwpDocument(await readFile(fixture));
const source = HwpDocument.createEmpty();
try {
  source.createBlankDocument();
  const t = json(source.createTable(0, 0, 0, 1, 3));
  const at = [0, t.paraIdx, t.controlIdx];
  source.insertTextInCell(...at, 0, 0, 0, '2');
  source.insertTableFormulaField(...at, 1, '', '=A1*2', '%.1f');
  source.insertTableFormulaField(...at, 2, '', '=B1+1', '%g');
  assert.equal(source.tableFormulaInputHasDependents(...at, 0), true);
  source.insertTextInCell(...at, 0, 0, 1, '3');
  assert.deepEqual(json(source.refreshTableFormulaInput(...at, 0)), {ok:true, changed:2});
  for (const bytes of [source.exportHwp(), source.exportHwpx()]) {
    const reopened = new HwpDocument(bytes);
    try {
      assert.deepEqual(json(reopened.getFieldList()).map(f=>f.command), ['=A1*2??%.1f;;46.0', '=B1+1??%g;;47']);
    } finally { reopened.free(); }
  }
} finally { source.free(); }
try {
  const fields = () => json(formulas.getFieldList()).filter(f => f.fieldType === 'formula');
  const originals = fields();
  const primary = originals.find(f => f.command.startsWith('=AVG(ABOVE)??'));
  const dependent = originals.find(f => f.command.startsWith('=SUM(A2,C1,D2)??'));
  assert.ok(primary && dependent, 'The fixture must contain the known A3 and D3 calculation fields');
  function edit(field, expression) {
    const { sectionIndex, paraIndex, path: [cell] } = field.location;
    const args = [sectionIndex, paraIndex, cell.controlIndex, cell.cellIndex, field.fieldId, field.command, expression, '%g'];
    const before = fields();
    const preview = json(formulas.previewTableFormulaField(...args));
    assert.equal(preview.ok, true);
    assert.ok(Array.isArray(preview.dependentChanges), 'Compiled engine lacks dependent recalculation');
    assert.deepEqual(fields(), before, 'Preview changed a field');
    assert.deepEqual(json(formulas.updateTableFormulaField(...args)), preview);
    return preview;
  }
  assert.equal(edit(dependent, '=A3*2').value, '4');
  const changed = edit(primary, '=3');
  assert.equal(changed.value, '3');
  assert.deepEqual(changed.dependentChanges.map(c => [c.fieldId, c.command, c.value]),
    [[dependent.fieldId, '=A3*2??%g;;6', '6']]);
  const stored = fields().find(f => f.fieldId === dependent.fieldId);
  assert.equal(stored.command, '=A3*2??%g;;6');
  assert.equal(stored.value, '6');
} finally { formulas.free(); }
console.log('PASS compiled WASM split-cell paragraph distribution, native formula creation, dependency update and save/reopen');
