// Actual native-input storage/history regression; never writes a user file.
import assert from 'node:assert/strict';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {resolve, dirname, isAbsolute, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadReviewEngine, snapshot, compareSnapshots, hash} from './lib/hancom-review.mjs';
import {verifyPreservedExport} from '../src/adapters/rhwp/preservation.ts';

for (const key of ['JUEONY_ENGINE_PACKAGE', 'JUEONY_TEST_OUTPUT']) {
  assert.ok(isAbsolute(process.env[key] ?? ''), `${key} must be absolute`);
}
const app = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repo = resolve(app, '../..'), out = resolve(process.env.JUEONY_TEST_OUTPUT);
await mkdir(out, {recursive: true});
const engine = await loadReviewEngine(process.env.JUEONY_ENGINE_PACKAGE);
const pinned = {
  single_column: '9778d66926e3138ce4bb51fadfd16173ee3d439aeec0a02a8f0af34b7fac0f3b',
  three_columns: 'db5e90e7217912d928d26d87d0e2877bf2682e90d1812bdef274aee83972cb79',
  rtl: 'f48a715a8ea47cb8081b735f89512dbac9209a0e99ab5d68877396d030056742',
  distribute: '9b35480c316ee54c1d5ef0ecbe4a2d5223b7321143aded0dbab43b1d5f569452',
  unequal_columns: '2ee00d6ef1ea96b9c5fb7fd4f2a4a278b0d676dcb964afdae2dcb49b0ab4016e',
  asymmetric_margin: '3ba817fe20afa035739168eddcd1eae6fa08e7bd28b4322db3ec7f6f1f85830e',
};
const fixtureRoot = join(repo, 'docs/evidence/file-completion-2026-10-18/engine76/columns-native/fixtures/build/file-closure69-public/column2-candidate74/valid-negative-disk');
const results = [], failures = [], observations = [];
async function scenario(name, run) {
  try {await run(); results.push({name, status: 'PASS'}); console.log('PASS', name);}
  catch (error) {results.push({name, status: 'FAIL'}); failures.push({name, error: String(error), stack: error.stack}); console.log('FAIL', name, String(error));}
}
function same(before, after) {
  const comparison = compareSnapshots(before, after);
  assert.equal(comparison.status, 'SAME_WITHIN_PUBLISHED_CONTRACT', JSON.stringify({semantic: comparison.semantic.count, geometry: comparison.geometry.count, pages: comparison.pages}));
  return comparison;
}
function exported(doc, format, permitRefusal = false) {
  const before = snapshot(doc), artifact = doc[format === 'hwp' ? 'exportHwpWithReport' : 'exportHwpxWithReport']();
  let reopened;
  try {
    const bytes = artifact.takeBytes(), loss = JSON.parse(artifact.contentLoss());
    assert.equal(loss.outputFormat, format); assert.equal(loss.count, 0);
    reopened = new engine.HwpDocument(bytes);
    const comparison = compareSnapshots(before, snapshot(reopened));
    let report, refusal;
    try {report = verifyPreservedExport(doc, bytes, format, loss, b => new engine.HwpDocument(b));}
    catch (error) {
      if (!permitRefusal) throw error;
      assert.ok(error.report?.issues?.length, 'a documented preservation refusal is required');
      assert.equal(comparison.status, 'DIFFERENT_OR_UNREADABLE', 'refusal must correspond to an independently visible difference');
      refusal = error.report.issues;
    }
    if (!refusal) {assert.equal(report.status, 'checked'); same(before, snapshot(reopened));}
    // Export/validation must not silently mutate the open document.
    assert.deepEqual(snapshot(doc), before);
    return {bytes, record: {format, sha256: hash(bytes), status: refusal ? 'REFUSED_BEFORE_WRITE' : 'checked', semantic: comparison.semantic.count, geometry: comparison.geometry.count, pagesEqual: comparison.pages.equal, loss: loss.count, refusal}};
  } finally {reopened?.free(); artifact.free();}
}
for (const [name, sha] of Object.entries(pinned)) {
  const input = await readFile(join(fixtureRoot, `baseline-${name}.hwp`));
  assert.equal(hash(input), sha);
  await scenario(name + ' mixed HWPX/HWP/HWPX storage preserves every published field', async () => {
    let doc = new engine.HwpDocument(input);
    try {
      const original = snapshot(doc), exports = [];
      for (const format of ['hwpx', 'hwp', 'hwpx']) {
        const saved = exported(doc, format); exports.push(saved.record);
        doc.free(); doc = new engine.HwpDocument(saved.bytes); same(original, snapshot(doc));
      }
      observations.push({name, phase: 'mixed', exports});
    } finally {doc.free();}
  });
  await scenario(name + ' native body edit, both formats and exact snapshot history', async () => {
    const doc = new engine.HwpDocument(input);
    try {
      const before = snapshot(doc), undo = doc.saveSnapshot();
      doc.insertText(0, doc.getParagraphCount(0) - 1, 0, '후속 편집 ');
      const edited = snapshot(doc), redo = doc.saveSnapshot();
      assert.notDeepEqual(edited.semantic.values, before.semantic.values);
      const exports = ['hwp', 'hwpx'].map(format => exported(doc, format).record);
      doc.restoreSnapshot(undo); assert.deepEqual(snapshot(doc), before);
      doc.restoreSnapshot(redo); assert.deepEqual(snapshot(doc), edited);
      doc.discardSnapshot(undo); doc.discardSnapshot(redo);
      observations.push({name, phase: 'native-tail', exports, undoRedoExact: true});
    } finally {doc.free();}
  });
  await scenario(name + ' prefix wrap/page reflow never bypasses preservation and history', async () => {
    const stress = [];
    for (const [kind, text] of [['wrap', '앞 문단 줄바꿈을 유발하는 본문입니다. '.repeat(25)], ['page', '쪽 경계까지 다시 조판하는 앞 문단입니다. '.repeat(500)]]) {
      const doc = new engine.HwpDocument(input);
      try {
        const before = snapshot(doc), undo = doc.saveSnapshot();
        doc.insertText(0, 0, doc.getParagraphLength(0, 0), text);
        const edited = snapshot(doc), redo = doc.saveSnapshot();
        const exports = ['hwp', 'hwpx'].map(format => exported(doc, format, true).record);
        doc.restoreSnapshot(undo); assert.deepEqual(snapshot(doc), before);
        doc.restoreSnapshot(redo); assert.deepEqual(snapshot(doc), edited);
        doc.discardSnapshot(undo); doc.discardSnapshot(redo);
        stress.push({kind, exports, undoRedoExact: true});
      } finally {doc.free();}
    }
    assert.equal(hash(await readFile(join(fixtureRoot, `baseline-${name}.hwp`))), sha);
    observations.push({name, phase: 'prefix-safety', stress, sourceUnchanged: true});
  });
}
const sourceHashes = await Promise.all(['scripts/lib/hancom-review.mjs', 'src/adapters/rhwp/preservation.ts', 'src/adapters/rhwp/document-save-layout.ts', 'src/adapters/rhwp/overlap-save-layout.ts'].map(async path => ({path, sha256: hash(await readFile(join(app, path)))})));
await writeFile(join(out, 'result.json'), JSON.stringify({engine: engine.metadata, results, failures, observations, fixtureHashes: pinned, verifierSha256: hash(await readFile(fileURLToPath(import.meta.url))), sourceHashes, scope: 'Actual WASM mixed storage and native text/history regression on six pinned owned HWP fixtures. Every published semantic/control/text field; unchanged production preservation guard. Prefix safety may PASS by refusing an independently detected mismatch, which does NOT mean the unsupported export is implemented. No OS/Hancom UI, user files, font resources or real API calls.'}, null, 2));
if (failures.length) process.exitCode = 1;
