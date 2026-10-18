import assert from 'node:assert/strict';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {resolve, join, isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadReviewEngine, snapshot, compareSnapshots, hash} from './lib/hancom-review.mjs';
import {verifyPreservedExport} from '../src/adapters/rhwp/preservation.ts';

for (const key of ['JUEONY_ENGINE_PACKAGE', 'JUEONY_BASELINE_ENGINE_PACKAGE', 'JUEONY_TEST_SOURCE', 'JUEONY_TEST_OUTPUT']) {
  assert.ok(isAbsolute(process.env[key] ?? ''), `${key} requires an absolute path`);
}
const out = resolve(process.env.JUEONY_TEST_OUTPUT); await mkdir(out, {recursive: true});
const sourcePath = resolve(process.env.JUEONY_TEST_SOURCE), source = await readFile(sourcePath);
assert.equal(hash(source), 'c61a13b249183a675d38d5badfa3af610edcf99a403622440fc81b7f52b348f2');
const engine = await loadReviewEngine(process.env.JUEONY_ENGINE_PACKAGE);
const baseline = await loadReviewEngine(process.env.JUEONY_BASELINE_ENGINE_PACKAGE);
assert.equal(baseline.metadata.sourceId, '625990fd59af9440');
assert.equal(baseline.metadata.wasmSha256, 'f52bcba9f0a19be7a427de401d14f7f1920d32552293e9e95282e64d4805f2e8');
const app = resolve(fileURLToPath(new URL('..', import.meta.url)));
const guards = ['preservation.ts', 'document-save-layout.ts', 'overlap-save-layout.ts'];
const fingerprints = async () => Promise.all(guards.map(async p => ({path: 'src/adapters/rhwp/' + p, sha256: hash(await readFile(join(app, 'src/adapters/rhwp', p)))})));
const beforeGuards = await fingerprints(), results = [], failures = [], observations = [];
function same(before, after) {
  const c = compareSnapshots(before, after);
  assert.equal(c.status, 'SAME_WITHIN_PUBLISHED_CONTRACT', JSON.stringify({pages: c.pages,
    semantic: c.semantic.count, geometry: c.geometry.count, first: c.geometry.differences.slice(0, 5), readIssues: c.semantic.readIssues}));
}
async function checked(doc, format, name) {
  const before = snapshot(doc), text = doc.getTextFileUnicode();
  const artifact = doc[format === 'hwp' ? 'exportHwpWithReport' : 'exportHwpxWithReport']();
  try {
    const bytes = artifact.takeBytes(), losses = JSON.parse(artifact.contentLoss());
    assert.equal(losses.count, 0); assert.equal(losses.outputFormat, format);
    const path = join(out, `${name}.${format}`); await writeFile(path, bytes);
    const disk = await readFile(path); assert.equal(hash(disk), hash(bytes));
    const guard = verifyPreservedExport(doc, disk, format, losses, b => new engine.HwpDocument(b));
    assert.equal(guard.status, 'checked', 'protected refusal is not storage success');
    const reopened = new engine.HwpDocument(disk);
    try {same(before, snapshot(reopened)); assert.equal(reopened.getTextFileUnicode(), text);}
    finally {reopened.free();}
    assert.deepEqual(snapshot(doc), before, 'export must not mutate live state');
    return {bytes: disk, record: {format, sha256: hash(disk), guard: 'checked', losses: 0, semantic: 0, geometry: 0}};
  } finally {artifact.free();}
}
const old = new baseline.HwpDocument(source), seedDoc = new engine.HwpDocument(source);
let xmlSeed;
try {
  same(snapshot(old), snapshot(seedDoc));
  const seed = await checked(seedDoc, 'hwpx', 'native-clean-seed'); xmlSeed = seed.bytes;
  observations.push({name: 'initial baseline and clean regenerated XML seed', status: 'PASS', storage: seed.record});
} finally {old.free(); seedDoc.free();}
async function record() {
  await writeFile(join(out, 'result.json'), JSON.stringify({engine: engine.metadata, baseline: baseline.metadata,
    sourceSha256: hash(source), sourceHashes: beforeGuards, verifierSha256: hash(await readFile(new URL(import.meta.url))), observations, results, failures,
    passed: results.filter(r => r.status === 'PASS').length,
    scope: 'Native HWP and its actual regenerated HWPX; 32 edit paths, full unchanged production preservation guard, three disk save/reopen cycles, reopened follow-up edit and both output formats, original-instance undo/redo. No Hancom GUI comparison.'}, null, 2));
}
for (const [input, bytes] of [['native', source], ['regenerated-xml', xmlSeed]]) {
  for (const p of [43, 44, 47, 48]) for (const at of ['start', 'end']) for (const mode of ['insert-delete', 'retained-insert']) {
    const name = `${input}-p${p}-${at}-${mode}`, doc = new engine.HwpDocument(bytes);
    let current = doc, original, edited, undo, redo;
    const row = {name, input, paragraph: p, at, mode, status: 'FAIL', exports: []};
    try {
      original = snapshot(doc); undo = doc.saveSnapshot();
      const length = doc.getParagraphLength(0, p), offset = at === 'start' ? 0 : length;
      doc.insertText(0, p, offset, '가'); assert.equal(doc.getParagraphLength(0, p), length + 1);
      if (mode === 'insert-delete') {doc.deleteText(0, p, offset, 1); assert.equal(doc.getParagraphLength(0, p), length);}
      edited = snapshot(doc); redo = doc.saveSnapshot();
      for (let cycle = 1; cycle <= 3; cycle++) {
        const exported = await checked(current, 'hwpx', `${name}-cycle${cycle}`);
        const reopened = new engine.HwpDocument(exported.bytes);
        try {same(edited, snapshot(reopened));} catch (error) {reopened.free(); throw error;}
        if (current !== doc) current.free(); current = reopened;
        row.exports.push({stage: `cycle${cycle}`, ...exported.record});
      }
      // Follow-up is applied to the reopened document itself, never a snapshot
      // identifier belonging to a different engine instance.
      const beforeFollow = snapshot(current), followUndo = current.saveSnapshot();
      const followOffset = at === 'start' ? current.getParagraphLength(0, p) : 0;
      current.insertText(0, p, followOffset, '나');
      const afterFollow = snapshot(current), followRedo = current.saveSnapshot();
      for (const format of ['hwpx', 'hwp']) {
        const saved = await checked(current, format, `${name}-followup`);
        row.exports.push({stage: 'reopened-followup', ...saved.record});
      }
      current.restoreSnapshot(followUndo); same(beforeFollow, snapshot(current));
      current.restoreSnapshot(followRedo); same(afterFollow, snapshot(current));
      row.followupHistory = 'PASS'; row.status = 'PASS';
    } catch (error) {
      row.error = String(error); row.productionIssues = error.report?.issues;
      row.guard = error.report?.status; failures.push({name, error: String(error)});
    } finally {
      if (undo !== undefined && redo !== undefined) {
        try {doc.restoreSnapshot(undo); same(original, snapshot(doc)); doc.restoreSnapshot(redo); same(edited, snapshot(doc)); row.originalHistory = 'PASS';}
        catch (error) {row.originalHistory = 'FAIL'; row.status = 'FAIL'; row.historyError = String(error); failures.push({name, error: String(error)});}
      }
      if (current !== doc) current.free(); doc.free();
    }
    results.push(row); console.log(row.status, name, row.exports.length, row.error ?? ''); await record();
  }
}
assert.equal(hash(await readFile(sourcePath)), hash(source)); assert.deepEqual(await fingerprints(), beforeGuards);
observations.push({name: 'source and full production guard source unchanged', status: 'PASS'}); await record();
assert.equal(results.length, 32); if (failures.length || results.some(r => r.status !== 'PASS')) process.exitCode = 1;
