import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { loadReviewEngine } from './lib/hancom-review.mjs';

const repo = resolve(import.meta.dirname, '../../..');
const samples = resolve(repo, 'upstream/rhwp-source/samples');
const out = resolve(process.env.JUEONY_TEST_OUTPUT ?? resolve(repo, 'build/native-formula-fields'));
const { HwpDocument, metadata } = await loadReviewEngine(process.env.JUEONY_ENGINE_PACKAGE);
const raw = path => JSON.parse(execFileSync('python', [
  resolve(import.meta.dirname, 'lib/read-native-formula-fields.py'), path,
], { encoding: 'utf8' }));
const model = doc => JSON.parse(doc.getFieldList()).filter(f => f.fieldType === 'formula')
  .map(({ fieldId, command, value, location }) => ({ fieldId, command, value, location }));
await mkdir(out, { recursive: true });

const results = [];
for (const [hwp, hwpx] of [
  ['tac-img-02.hwp', 'tac-img-02.hwpx'],
  ['143E433F503322BD33.hwp', 'hwpx/143E433F503322BD33.hwpx'],
]) {
  const source = { hwp: resolve(samples, hwp), hwpx: resolve(samples, hwpx) };
  const originals = { hwp: raw(source.hwp), hwpx: raw(source.hwpx) };
  assert.ok(originals.hwp.fields.length > 0);
  assert.equal(originals.hwp.fields.length, originals.hwpx.length);
  for (const [from, path] of Object.entries(source)) {
    const doc = new HwpDocument(await readFile(path));
    try {
      const before = model(doc);
      assert.equal(before.length, originals.hwpx.length);
      for (const to of ['hwp', 'hwpx']) {
        const artifact = doc[to === 'hwp' ? 'exportHwpWithReport' : 'exportHwpxWithReport']();
        try {
          const bytes = artifact.takeBytes(), target = resolve(out, `${hwp}-${from}.${to}`);
          await writeFile(target, bytes);
          // Compare wire properties to the author's paired file, including
          // field markers and named parameters not exposed by getFieldList.
          assert.deepEqual(raw(target), originals[to], `${hwp} ${from}→${to} native field metadata`);
          const reopened = new HwpDocument(bytes);
          try { assert.deepEqual(model(reopened), before); } finally { reopened.free(); }
          results.push({ file: hwp, from, to, fields: before.length, exportLossCount: JSON.parse(artifact.contentLoss()).count });
        } finally { artifact.free(); }
      }
    } finally { doc.free(); }
  }
}
await writeFile(resolve(out, 'result.json'), JSON.stringify({
  engine: metadata.sourceId, wasmSha256: metadata.wasmSha256, results,
  scope: 'Paired source-file FORMULA metadata and reopened model only. Other reported document losses remain subject to the ordinary save guard.',
}, null, 2) + '\n');
console.log(`PASS ${results.length} native formula-field format comparisons`);
