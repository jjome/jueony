import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { loadReviewEngine } from './lib/hancom-review.mjs';
import { verifyPreservedExport } from '../src/adapters/rhwp/preservation.ts';

const { HwpDocument, metadata } = await loadReviewEngine(process.env.JUEONY_ENGINE_PACKAGE);
const out = resolve(process.env.JUEONY_TEST_OUTPUT ?? 'build/native-formula-insert');
await mkdir(out, { recursive: true });
const fields = doc => JSON.parse(doc.getFieldList()).filter(f => f.fieldType === 'formula');
const raw = path => JSON.parse(execFileSync('python', [resolve(import.meta.dirname, 'lib/read-native-formula-fields.py'), path], { encoding: 'utf8' }));
const results = [];

for (const ext of ['hwp', 'hwpx']) {
  const seed = HwpDocument.createEmpty(); seed.createBlankDocument();
  const {paraIdx, controlIdx} = JSON.parse(seed.createTable(0, 0, 0, 2, 3));
  const table = [0, paraIdx, controlIdx], loc = i => [...table, i];
  for (const [i, text] of ['12','7','초안😀','','','다른 셀'].entries()) {
    if (text) seed.insertTextInCell(...loc(i), 0, 0, text);
  }
  seed.applyParaFormatInCell(...loc(2), 0, '{"alignment":"right"}');
  seed.applyCharFormatInCell(...loc(2), 0, 0, 3, '{"bold":true}');
  seed.applyCharFormatInCell(...loc(5), 0, 0, 1, '{"italic":true}');
  const exportName = ext === 'hwp' ? 'exportHwp' : 'exportHwpx';
  const doc = new HwpDocument(seed[exportName]()); seed.free();
  try {
    const src = doc[exportName](), before = doc.saveSnapshot(), style = d => [
      JSON.parse(d.getCellCharPropertiesAt(...loc(2), 0, 0)), JSON.parse(d.getCellParaPropertiesAt(...loc(2), 0)),
      JSON.parse(d.getCellProperties(...loc(2))),
    ];
    const originalStyle = style(doc);
    assert.equal(originalStyle[0].bold, true);
    assert.equal(originalStyle[1].alignment, 'right');
    for (const [source, formula] of [['stale', '=A1'], ['초안😀', '=C1'], ['초안😀', '=1/0'], ['초안😀', '=A99999']]) {
      assert.throws(() => doc.insertTableFormulaField(...loc(2), source, formula, '%g'));
      assert.deepEqual(doc[exportName](), src); assert.deepEqual(fields(doc), []);
    }
    assert.throws(() => doc.insertTableFormulaField(...loc(5), '다른 셀', '=A1', '%g'));
    assert.deepEqual(doc[exportName](), src);
    const insert = (i, expected, expr, fmt) => JSON.parse(doc.insertTableFormulaField(...loc(i), expected, expr, fmt));
    const created = insert(2, '초안😀', '=SUM(A1:B1)', '%.1f');
    assert.equal(created.value, '19.0'); assert.deepEqual(style(doc), originalStyle);
    const empty = insert(3, '', '=C1*2', '%.0f');
    assert.equal(empty.value, '38'); assert.notEqual(created.fieldId, empty.fieldId);
    assert.throws(() => insert(2, '19.0', '=7', '%g'));
    const edited = JSON.parse(doc.updateTableFormulaField(...loc(2), created.fieldId, created.command, '=A1-B1', '%.1f'));
    assert.equal(edited.value, '5.0'); assert.equal(edited.dependentChanges[0].value, '10');
    doc.setCellProperties(...loc(4), '{"cellProtect":true}');
    const protectedBytes = doc[exportName]();
    assert.throws(() => insert(4, '', '=0', '%g'), /보호/); assert.deepEqual(doc[exportName](), protectedBytes);
    const after = doc.saveSnapshot(); doc.restoreSnapshot(before);
    assert.deepEqual(doc[exportName](), src); assert.deepEqual(fields(doc), []);
    doc.restoreSnapshot(after); doc.discardSnapshot(after); doc.discardSnapshot(before);
    const artifact = doc[exportName + 'WithReport']();
    try {
      const bytes = artifact.takeBytes();
      verifyPreservedExport(doc, bytes, ext, artifact.contentLoss(), b => new HwpDocument(b));
      const file = resolve(out, 'created.' + ext); await writeFile(file, bytes);
      const stored = raw(file);
      if (ext === 'hwp') {
        assert.deepEqual(stored.fields.map(f => [f.id, f.prop, f.command]), [[created.fieldId, 8, edited.command],[empty.fieldId, 8, edited.dependentChanges[0].command]]);
        assert.deepEqual(stored.endProps, [8,8]);
      } else {
        for (const [i, original] of [edited, edited.dependentChanges[0]].entries()) {
          assert.equal(stored[i].id, original.fieldId); assert.equal(stored[i].fieldid, '627469685');
          assert.equal(stored[i].endFieldid, '627469685');
          const params = Object.fromEntries(stored[i].params.map(([,key,v]) => [key, v]));
          assert.equal(params.Command, original.command); assert.equal(params.LastResult, original.value);
          assert.equal(params.Formula, i === 0 ? '=A1-B1' : '=C1*2');
        }
      }
      const reopened = new HwpDocument(await readFile(file));
      try {
        assert.deepEqual(fields(reopened).map(f => [f.fieldId, f.command, f.value]), fields(doc).map(f => [f.fieldId, f.command, f.value]));
        assert.deepEqual(style(reopened), originalStyle);
      } finally { reopened.free(); }
    } finally { artifact.free(); }
    results.push({ ext, created: created.fieldId, dependent: empty.fieldId, display: [edited.value, edited.dependentChanges[0].value] });
  } finally { doc.free(); }
}
const nativeSample = new HwpDocument(await readFile(resolve(import.meta.dirname, '../../../upstream/rhwp-source/samples/calc-cell.hwp')));
try {
  const old = fields(nativeSample), owner = old[0].location;
  const add = JSON.parse(nativeSample.insertTableFormulaField(owner.sectionIndex, owner.paraIndex, owner.path[0].controlIndex, 0, '1', '=11', '%g'));
  assert.ok(old.every(f => f.fieldId < add.fieldId));
  assert.deepEqual(new Set(fields(nativeSample).map(f => f.fieldId)), new Set([...old.map(f => f.fieldId), add.fieldId]));
  assert.ok(add.dependentChanges.length >= 1);
} finally { nativeSample.free(); }
await writeFile(resolve(out, 'result.json'), JSON.stringify({ engine: metadata.sourceId, results }, null, 2) + '\n');
console.log('PASS insertion into empty and styled plain cells, distinct IDs, rollback, dependencies, style and verified HWP/HWPX save/reopen');
