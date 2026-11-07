import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { loadReviewEngine } from './lib/hancom-review.mjs';
import { verifyPreservedExport } from '../src/adapters/rhwp/preservation.ts';

const repo = resolve(import.meta.dirname, '../../..');
const out = resolve(process.env.JUEONY_TEST_OUTPUT ?? resolve(repo, 'build/native-formula-update'));
const { HwpDocument, metadata } = await loadReviewEngine(process.env.JUEONY_ENGINE_PACKAGE);
const original = await readFile(resolve(repo, 'upstream/rhwp-source/samples/calc-cell.hwp'));
const originalDoc = new HwpDocument(original);
const hwpx = originalDoc.exportHwpx(); originalDoc.free();
const all = d => JSON.parse(d.getFieldList()).filter(f => f.fieldType === 'formula');
const raw = path => JSON.parse(execFileSync('python', [
  resolve(import.meta.dirname, 'lib/read-native-formula-fields.py'), path,
], { encoding: 'utf8' }));
const results = [];
await mkdir(out, { recursive: true });

for (const [ext, input] of [['hwp', original], ['hwpx', hwpx]]) {
  const doc = new HwpDocument(input);
  try {
    const fields = all(doc), field = fields[0], { sectionIndex, paraIndex, path } = field.location;
    const { controlIndex, cellIndex } = path[0], target = [sectionIndex, paraIndex, controlIndex, cellIndex, field.fieldId];
    const expr = '=SUM(A1:B2)', format = '%.1f,';
    const originalHwp = doc.exportHwp();
    const before = doc.saveSnapshot();
    const preview = JSON.parse(doc.previewTableFormulaField(...target, field.command, expr, format));
    const { dependentChanges, ...previewRoot } = preview;
    if (dependentChanges !== undefined) assert.deepEqual(dependentChanges, []);
    assert.deepEqual(previewRoot, { ok: true, fieldId: field.fieldId, formula: expr, command: '=SUM(A1:B2)??%.1f,;;13.0', result: 13, value: '13.0' });
    assert.deepEqual(doc.exportHwp(), originalHwp);
    for (const invalid of ['=A3', '=SUM(A1:A999999999)', '=1+', '=SUM(1,,2)', '=1junk', '=3/0', '=1$2', '=SUM(A1:', '=1.2.3', '=3 4']) {
      assert.throws(() => doc.updateTableFormulaField(...target, field.command, invalid, format), undefined, invalid);
    }
    assert.throws(() => doc.updateTableFormulaField(...target, 'stale', expr, format));
    assert.throws(() => doc.updateTableFormulaField(...target, field.command, expr, '%x'));
    assert.deepEqual(doc.exportHwp(), originalHwp);
    assert.deepEqual(JSON.parse(doc.updateTableFormulaField(...target, field.command, expr, format)), preview);
    assert.deepEqual(all(doc).slice(1), fields.slice(1));
    assert.equal(all(doc)[0].command, preview.command);
    assert.equal(all(doc)[0].value, preview.value);
    assert.throws(() => doc.updateTableFormulaField(...target, field.command, expr, format));
    const after = doc.saveSnapshot();
    doc.restoreSnapshot(before); assert.deepEqual(all(doc), fields);
    doc.restoreSnapshot(after); assert.equal(all(doc)[0].value, preview.value);
    doc.discardSnapshot(before); doc.discardSnapshot(after);

    const artifact = doc[ext === 'hwp' ? 'exportHwpWithReport' : 'exportHwpxWithReport']();
    try {
      const loss = artifact.contentLoss(), bytes = artifact.takeBytes();
      verifyPreservedExport(doc, bytes, ext, loss, b => new HwpDocument(b));
      const file = resolve(out, 'updated.' + ext);
      await writeFile(file, bytes); const wire = raw(file);
      if (ext === 'hwp') {
        assert.equal(wire.fields[0].command, preview.command); assert.equal(wire.endProps[0], 8);
      } else {
        const values = Object.fromEntries(wire[0].params.map(([, key, v]) => [key, v]));
        assert.deepEqual(values, { Prop: '8', Command: preview.command, Formula: expr, ResultFormat: format, LastResult: preview.value });
      }
      const reopened = new HwpDocument(await readFile(file));
      try { assert.deepEqual(all(reopened).map(f => [f.fieldId, f.command, f.value]), all(doc).map(f => [f.fieldId, f.command, f.value])); }
      finally { reopened.free(); }
    } finally { artifact.free(); }

    // A1 changes from 1 to 11. The first field still displays the cached
    // 13.0, but D3's formula must use its current inputs (23 * 2).
    doc.insertTextInCell(sectionIndex, paraIndex, controlIndex, 0, 0, 1, '1');
    const last = fields.at(-1);
    const end = [sectionIndex, paraIndex, controlIndex, last.location.path[0].cellIndex, last.fieldId, last.command];
    const result = JSON.parse(doc.updateTableFormulaField(...end, '=A3*2', '%g'));
    assert.equal(result.value, '46');
    if (dependentChanges === undefined) {
      const beforeRejected = doc.exportHwp();
      assert.throws(() => doc.updateTableFormulaField(...target, preview.command, '=7', '%g'), /참조|연쇄/);
      assert.deepEqual(doc.exportHwp(), beforeRejected);
    } else {
      // A3 feeds two branches and D3 reads both. The shared descendant must
      // be evaluated once from the new inputs, regardless of physical order.
      const update = (i, expression) => {
        const current = all(doc)[i];
        return JSON.parse(doc.updateTableFormulaField(sectionIndex, paraIndex, controlIndex, current.location.path[0].cellIndex,
          current.fieldId, current.command, expression, '%g'));
      };
      update(0, '=9');
      update(1, '=A3+3');
      update(2, '=1/(A3-1)');
      update(3, '=SUM(A3:B3)+C3*12');
      const previous = all(doc), undo = doc.saveSnapshot(), beforeBytes = doc.exportHwp();
      const args = [...target, previous[0].command, '=5', '%g'];
      const cascade = JSON.parse(doc.previewTableFormulaField(...args));
      assert.deepEqual(doc.exportHwp(), beforeBytes);
      assert.deepEqual(cascade.dependentChanges.map(c => [c.cellIndex, c.fieldId, c.previousCommand, c.value]),
        previous.slice(1).map((f, i) => [f.location.path[0].cellIndex, f.fieldId, f.command, ['8', '0.25', '16'][i]]));
      assert.deepEqual(JSON.parse(doc.updateTableFormulaField(...args)), cascade);
      const changed = all(doc);
      assert.deepEqual(changed.map(f => f.value), ['5', '8', '0.25', '16']);
      assert.deepEqual(changed.slice(1).map(f => f.command), cascade.dependentChanges.map(c => c.command));
      const redo = doc.saveSnapshot();
      doc.restoreSnapshot(undo); assert.deepEqual(all(doc), previous);
      doc.restoreSnapshot(redo); assert.deepEqual(all(doc), changed);
      doc.discardSnapshot(undo); doc.discardSnapshot(redo);
      const sealed = doc.exportHwp();
      assert.throws(() => update(0, '=D3+1'), /순환/);
      assert.throws(() => update(0, '=1'), /0/);
      assert.deepEqual(doc.exportHwp(), sealed);
      for (const to of ['hwp', 'hwpx']) {
        const artifact = doc[to === 'hwp' ? 'exportHwpWithReport' : 'exportHwpxWithReport']();
        try {
          const loss = artifact.contentLoss(), bytes = artifact.takeBytes();
          verifyPreservedExport(doc, bytes, to, loss, b => new HwpDocument(b));
          const output = resolve(out, 'cascade-' + ext + '.' + to);
          await writeFile(output, bytes);
          const onDisk = raw(output);
          const encoded = to === 'hwp' ? onDisk.fields.map(f => f.command)
            : onDisk.map(f => Object.fromEntries(f.params.map(([, k, v]) => [k, v])).Command);
          assert.deepEqual(encoded, changed.map(f => f.command));
          const reopened = new HwpDocument(await readFile(output));
          try { assert.deepEqual(all(reopened).map(f => f.value), changed.map(f => f.value)); }
          finally { reopened.free(); }
        } finally { artifact.free(); }
      }
      doc.setCellProperties(sectionIndex, paraIndex, controlIndex, end[3], '{"cellProtect":true}');
      const protectedBytes = doc.exportHwp();
      assert.throws(() => update(0, '=3'), /보호/);
      assert.deepEqual(doc.exportHwp(), protectedBytes);
    }
    doc.setCellProperties(sectionIndex, paraIndex, controlIndex, end[3], '{"cellProtect":true}');
    assert.throws(() => doc.updateTableFormulaField(...end.slice(0, 5), result.command, '=1', '%g'), /보호/);
    results.push({ ext, fieldId: field.fieldId, cached: preview.value, dependentCalculation: result.value });
  } finally { doc.free(); }
}
await writeFile(resolve(out, 'result.json'), JSON.stringify({ engine: metadata.sourceId, results }, null, 2) + '\n');
console.log('PASS stored field preview, guarded edits, dependency values, undo/redo and verified HWP/HWPX save/reopen');
