// Regression requires successful storage; a safe refusal is a FAIL here.
import assert from 'node:assert/strict';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {resolve, dirname, isAbsolute, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadReviewEngine, snapshot, compareSnapshots, hash} from './lib/hancom-review.mjs';
import {verifyPreservedExport} from '../src/adapters/rhwp/preservation.ts';

for (const key of ['JUEONY_ENGINE_PACKAGE', 'JUEONY_TEST_OUTPUT']) assert.ok(isAbsolute(process.env[key] ?? ''), key);
const app = resolve(dirname(fileURLToPath(import.meta.url)), '..'), repo = resolve(app, '../..');
const out = resolve(process.env.JUEONY_TEST_OUTPUT); await mkdir(out, {recursive: true});
const paths = ['scripts/lib/hancom-review.mjs', 'src/adapters/rhwp/preservation.ts', 'src/adapters/rhwp/document-save-layout.ts', 'src/adapters/rhwp/overlap-save-layout.ts'];
const fingerprints = () => Promise.all(paths.map(async path => ({path, sha256: hash(await readFile(join(app, path)))})));
const initialHashes = await fingerprints(), engine = await loadReviewEngine(process.env.JUEONY_ENGINE_PACKAGE);
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
function same(a, b) {
  const c = compareSnapshots(a, b);
  assert.equal(c.status, 'SAME_WITHIN_PUBLISHED_CONTRACT', JSON.stringify({semantic: c.semantic.count, geometry: c.geometry.count, pages: c.pages}));
}
function saved(doc, format) {
  const before = snapshot(doc), artifact = doc[format === 'hwp' ? 'exportHwpWithReport' : 'exportHwpxWithReport']();
  try {
    const bytes = artifact.takeBytes(), loss = JSON.parse(artifact.contentLoss());
    assert.equal(loss.count, 0); assert.equal(loss.outputFormat, format);
    const report = verifyPreservedExport(doc, bytes, format, loss, b => new engine.HwpDocument(b));
    assert.equal(report.status, 'checked', 'refusal does not satisfy this regression');
    const reopened = new engine.HwpDocument(bytes);
    try {same(before, snapshot(reopened)); assert.equal(reopened.getTextFileUnicode(), doc.getTextFileUnicode());}
    finally {reopened.free();}
    assert.deepEqual(snapshot(doc), before, 'read-only save must preserve live state');
    return {bytes, record: {format, sha256: hash(bytes), semantic: 0, geometry: 0, losses: 0, guard: report.status}};
  } finally {artifact.free();}
}
for (const [name, sha] of Object.entries(pinned)) for (const [kind, text] of [
  ['wrap', '앞 문단 줄바꿈을 유발하는 본문입니다. '.repeat(25)],
  ['page', '쪽 경계까지 다시 조판하는 앞 문단입니다. '.repeat(500)],
]) {
  const label = `${name} ${kind}: actual prefix edit, both formats, reopen, history and follow-up`;
  const input = await readFile(join(fixtureRoot, `baseline-${name}.hwp`)); assert.equal(hash(input), sha);
  const doc = new engine.HwpDocument(input), exports = [];
  try {
    const original = snapshot(doc), originalBytes = doc.exportHwp(), undo = doc.saveSnapshot();
    doc.insertText(0, 0, doc.getParagraphLength(0, 0), text);
    const edited = snapshot(doc), editedBytes = doc.exportHwp(), redo = doc.saveSnapshot();
    assert.notDeepEqual(edited.semantic.values, original.semantic.values);
    assert.ok(doc.getTextFileUnicode().includes(text));
    if (kind === 'page') assert.ok(edited.pages > original.pages, 'page stress must actually repaginate');
    for (const format of ['hwp', 'hwpx']) {
      const first = saved(doc, format); exports.push({...first.record, phase: 'edited'});
      await writeFile(join(out, `${name}-${kind}-edited.${format}`), first.bytes);
      const reopened = new engine.HwpDocument(first.bytes);
      try {
        exports.push({...saved(reopened, format).record, phase: 'repeat-after-reopen'});
        reopened.insertText(0, reopened.getParagraphCount(0) - 1, 0, '후속 요청 ');
        assert.ok(reopened.getTextFileUnicode().includes('후속 요청 '));
        for (const output of ['hwp', 'hwpx']) {
          const follow = saved(reopened, output);
          exports.push({...follow.record, phase: 'follow-up-from-' + format});
          const crossed = new engine.HwpDocument(follow.bytes);
          try {
            const other = output === 'hwp' ? 'hwpx' : 'hwp';
            exports.push({...saved(crossed, other).record, phase: `cross-again-from-${format}-${output}`});
          } finally {crossed.free();}
        }
      } finally {reopened.free();}
    }
    doc.restoreSnapshot(undo); assert.deepEqual(snapshot(doc), original); assert.deepEqual(doc.exportHwp(), originalBytes);
    doc.restoreSnapshot(redo); assert.deepEqual(snapshot(doc), edited); assert.deepEqual(doc.exportHwp(), editedBytes);
    exports.push({...saved(doc, 'hwpx').record, phase: 'after-redo'});
    doc.discardSnapshot(undo); doc.discardSnapshot(redo);
    assert.equal(hash(await readFile(join(fixtureRoot, `baseline-${name}.hwp`))), sha);
    observations.push({name, kind, sourceSha256: sha, textLength: text.length, pages: edited.pages, exports, sourceUnchanged: true, undoRedoExact: true});
    results.push({name: label, status: 'PASS'}); console.log('PASS', label);
  } catch (error) {
    failures.push({name: label, error: String(error), stack: error.stack, report: error.report});
    results.push({name: label, status: 'FAIL'}); observations.push({name, kind, exports}); console.log('FAIL', label, String(error));
  } finally {doc.free();}
}
const sourceHashes = await fingerprints(); assert.deepEqual(sourceHashes, initialHashes);
await writeFile(join(out, 'result.json'), JSON.stringify({engine: engine.metadata, results, failures, observations, fixtureHashes: pinned, sourceHashes, verifierSha256: hash(await readFile(fileURLToPath(import.meta.url))), scope: 'Twelve successful prefix wrap/page-storage regressions required on actual WASM; unchanged strict production guard, independent full semantic/published geometry comparison, both formats, repeated reopening, follow-up edits and exact snapshot history. A refused conversion FAILS. Own pinned files only; no user/OS/Hancom UI.'}, null, 2));
if (failures.length) process.exitCode = 1;
