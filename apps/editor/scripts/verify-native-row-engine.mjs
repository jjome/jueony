// Actual native-input storage/history regression; never writes a user file.
import assert from 'node:assert/strict';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {resolve, dirname, isAbsolute, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {inflateRawSync} from 'node:zlib';
import {loadReviewEngine, snapshot, compareSnapshots, hash} from './lib/hancom-review.mjs';
import {verifyPreservedExport} from '../src/adapters/rhwp/preservation.ts';

for (const key of ['JUEONY_ENGINE_PACKAGE', 'JUEONY_TEST_OUTPUT']) {
  assert.ok(isAbsolute(process.env[key] ?? ''), `${key} must be absolute`);
}
const app = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repo = resolve(app, '../..'), out = resolve(process.env.JUEONY_TEST_OUTPUT);
const sourcePaths = ['scripts/lib/hancom-review.mjs', 'src/adapters/rhwp/preservation.ts', 'src/adapters/rhwp/document-save-layout.ts', 'src/adapters/rhwp/overlap-save-layout.ts'];
const fingerprintSources = () => Promise.all(sourcePaths.map(async path => ({path, sha256: hash(await readFile(join(app, path)))})));
const initialSourceHashes = await fingerprintSources();
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
// Independent ZIP inspection catches column fields absent from the public
// semantic getter, even when cached source rows conceal a bad width in layout.
function sectionXml(value) {
  const b = Buffer.from(value); let end = -1, found;
  for (let p = b.length - 22; p >= Math.max(0, b.length - 65557); p--) if (b.readUInt32LE(p) === 0x06054b50) {end = p; break;}
  assert.ok(end >= 0, 'ZIP end directory'); let p = b.readUInt32LE(end + 16);
  for (let i = 0; i < b.readUInt16LE(end + 10); i++) {
    assert.equal(b.readUInt32LE(p), 0x02014b50);
    const method = b.readUInt16LE(p + 10), size = b.readUInt32LE(p + 20), length = b.readUInt32LE(p + 24);
    const nl = b.readUInt16LE(p + 28), el = b.readUInt16LE(p + 30), cl = b.readUInt16LE(p + 32), local = b.readUInt32LE(p + 42);
    const name = b.subarray(p + 46, p + 46 + nl).toString('utf8');
    if (name === 'Contents/section0.xml') {
      assert.equal(found, undefined, 'duplicate section entry'); assert.equal(b.readUInt32LE(local), 0x04034b50);
      const offset = local + 30 + b.readUInt16LE(local + 26) + b.readUInt16LE(local + 28), packed = b.subarray(offset, offset + size);
      found = method === 0 ? Buffer.from(packed) : method === 8 ? inflateRawSync(packed, {maxOutputLength: 4 * 1024 * 1024}) : assert.fail('ZIP compression');
      assert.equal(found.length, length);
      let crc = 0xffffffff;
      for (const byte of found) {crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = (crc & 1) ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;}
      assert.equal((crc ^ 0xffffffff) >>> 0, b.readUInt32LE(p + 16));
    }
    p += 46 + nl + el + cl;
  }
  assert.ok(found, 'section0.xml missing'); return found.toString('utf8');
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
        assert.notDeepEqual(edited.semantic.values, before.semantic.values, 'prefix edit must actually change the document');
        assert.ok(doc.getTextFileUnicode().includes(text), 'the entire requested prefix text must be present');
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
await scenario('native unequal column weights become actual HWPX units in independent XML', async () => {
  const input = await readFile(join(fixtureRoot, 'baseline-unequal_columns.hwp'));
  assert.equal(hash(input), pinned.unequal_columns);
  const doc = new engine.HwpDocument(input);
  try {
    const saved = exported(doc, 'hwpx'), xml = sectionXml(saved.bytes);
    // The pinned generator's 42520HU body and native [12000,20768]+1000
    // weights have sum33768. These are the independent expected whole units.
    const sizes = [...xml.matchAll(/<hp:colSz\b[^>]*width="(\d+)"[^>]*gap="(\d+)"[^>]*\/>/g)].map(m => [Number(m[1]), Number(m[2])]);
    assert.deepEqual(sizes, [[15110, 1259], [26150, 0]]);
    observations.push({phase: 'independent-column-XML', sourceSha256: hash(input), columnSizes: sizes, export: saved.record});
  } finally {doc.free();}
});
const sourceHashes = await fingerprintSources();
assert.deepEqual(sourceHashes, initialSourceHashes, 'verification dependencies changed during the run');
await writeFile(join(out, 'result.json'), JSON.stringify({engine: engine.metadata, results, failures, observations, fixtureHashes: pinned, verifierSha256: hash(await readFile(fileURLToPath(import.meta.url))), sourceHashes, scope: 'Actual WASM mixed storage and native text/history regression on six pinned owned HWP fixtures. Every published semantic/control/text field; unchanged production preservation guard. Prefix safety may PASS by refusing an independently detected mismatch, which does NOT mean the unsupported export is implemented. No OS/Hancom UI, user files, font resources or real API calls.'}, null, 2));
if (failures.length) process.exitCode = 1;
