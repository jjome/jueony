// Scoped regression: exact owned GulimChe BREAK-cell partition repair.
// These public, SHA-pinned fixtures stay external. No document/font assets are copied.
// Passing does not assert complete Hancom parity: unrelated initial differences remain.
import assert from 'node:assert/strict';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {resolve, dirname, isAbsolute, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadReviewEngine, snapshot, compareSnapshots, differences, hash} from './lib/hancom-review.mjs';
import {readOwnedZip, writeOwnedZip} from './lib/owned-zip.mjs';
import {verifyPreservedExport} from '../src/adapters/rhwp/preservation.ts';

for (const key of ['JUEONY_ENGINE_PACKAGE', 'JUEONY_BASELINE_ENGINE_PACKAGE', 'JUEONY_TEST_OUTPUT', 'JUEONY_TEST_SOURCE', 'JUEONY_TEST_ORACLE']) {
  assert.ok(isAbsolute(process.env[key] ?? ''), `${key} requires an absolute path`);
}
const app = resolve(dirname(fileURLToPath(import.meta.url)), '..'), repo = resolve(app, '../..');
const out = resolve(process.env.JUEONY_TEST_OUTPUT); await mkdir(out, {recursive: true});
const sourcePath = resolve(process.env.JUEONY_TEST_SOURCE);
const oraclePath = resolve(process.env.JUEONY_TEST_ORACLE);
const source = await readFile(sourcePath), oracleBytes = await readFile(oraclePath);
const sourceSha256 = hash(source), oracleSha256 = hash(oracleBytes);
assert.equal(sourceSha256, 'c11c90b48eb8b709cdeb91f5a2c7ecae1b89d0d1390dfc1db32865b902d0dd0f');
assert.equal(oracleSha256, '51e89075e288e36511df470ffc0fc63fa5ec38df350e606ff623b5e965704d52');
const baseline = await loadReviewEngine(process.env.JUEONY_BASELINE_ENGINE_PACKAGE);
assert.equal(baseline.metadata.sourceId, '7c10dba04ed65742');
assert.equal(baseline.metadata.wasmSha256, '5772f16df2f56b9378f0a9683f5c46b0a6901ffd68f099aa3e8c1c8c65f5e40f');
const engine = await loadReviewEngine(process.env.JUEONY_ENGINE_PACKAGE);
const originalParts = new Map(readOwnedZip(source));
const results = [], failures = [], observations = [];
const guardPaths = ['src/adapters/rhwp/preservation.ts', 'src/adapters/rhwp/document-save-layout.ts', 'src/adapters/rhwp/overlap-save-layout.ts'];
const fingerprints = () => Promise.all(guardPaths.map(async path => ({path, sha256: hash(await readFile(join(app, path)))})));
const guardsBefore = await fingerprints();
const compact = c => ({pages: c.pages, semantic: c.semantic.count, geometry: c.geometry.count, readIssues: c.semantic.readIssues.before.length + c.semantic.readIssues.after.length});
const targetRuns = state => state.layout.flatMap(p => p.text.runs
  .filter(r => r.parentParaIdx === 100 && r.cellIdx === 2 && r.paraIdx === 0)
  .map(run => ({page: p.page, ...run})));
const targetGeometry = state => {
  const runs = targetRuns(state), origin = runs[0]?.y;
  // Independent files renumber shape IDs and retain a separate table-placement gap.
  // Check complete horizontal geometry and intra-paragraph vertical spacing here.
  return runs.map(({text, charShapeId, y, ...run}) => ({...run, y: y - origin, textSha256: hash(text)}));
};
const targetStarts = state => targetRuns(state).map(r => r.charStart);
function same(before, after) {
  const c = compareSnapshots(before, after);
  assert.equal(c.status, 'SAME_WITHIN_PUBLISHED_CONTRACT', JSON.stringify(compact(c)));
}
async function scenario(name, action) {
  try {const details = await action(); results.push({name, status: 'PASS', ...details}); console.log('PASS', name);}
  catch (error) {results.push({name, status: 'FAIL'}); failures.push({name, error: String(error), stack: error.stack}); console.log('FAIL', name, String(error));}
}
function checked(doc, format) {
  const before = snapshot(doc), artifact = doc[format === 'hwp' ? 'exportHwpWithReport' : 'exportHwpxWithReport']();
  try {
    const bytes = artifact.takeBytes(), loss = JSON.parse(artifact.contentLoss());
    assert.equal(loss.count, 0); assert.equal(loss.outputFormat, format);
    const report = verifyPreservedExport(doc, bytes, format, loss, b => new engine.HwpDocument(b));
    assert.equal(report.status, 'checked', 'refusal does not satisfy a successful-storage case');
    const reopened = new engine.HwpDocument(bytes);
    try {same(before, snapshot(reopened)); assert.equal(reopened.getTextFileUnicode(), doc.getTextFileUnicode());}
    finally {reopened.free();}
    assert.deepEqual(snapshot(doc), before, 'read-only export must preserve live state');
    return {bytes, record: {format, sha256: hash(bytes), losses: 0, geometry: 0, semantic: 0, guard: report.status}};
  } finally {artifact.free();}
}
let targetText;
await scenario('independent saved Hancom target improves initially without edits', () => {
  const old = new baseline.HwpDocument(source), doc = new engine.HwpDocument(source), oracle = new engine.HwpDocument(oracleBytes);
  try {
    const before = snapshot(old), after = snapshot(doc), reference = snapshot(oracle);
    assert.deepEqual(targetStarts(before), [0, 31, 63], 'fixed baseline demonstrates the original failure');
    assert.deepEqual(targetStarts(after), [0, 31, 61]);
    assert.equal(differences(targetGeometry(after), targetGeometry(reference), 0.2).length, 0, 'horizontal geometry and local row spacing must match the independent reference');
    assert.deepEqual(targetRuns(after).map(r => r.y), targetRuns(before).map(r => r.y), 'this correction must preserve authored absolute row positions');
    const absoluteTargetDelta = targetRuns(reference)[0].y - targetRuns(after)[0].y;
    const oldDiff = compareSnapshots(before, reference), newDiff = compareSnapshots(after, reference);
    assert.equal(oldDiff.geometry.count, 731); assert.ok(newDiff.geometry.count <= 680);
    assert.equal(after.pages, reference.pages);
    targetText = targetRuns(after).map(r => r.text).join(''); assert.equal([...targetText].length, 93);
    observations.push({name: 'initial oracle', before: compact(oldDiff), after: compact(newDiff), remainingAbsoluteTargetDelta: absoluteTargetDelta, completeHancomParity: newDiff.status === 'SAME_WITHIN_PUBLISHED_CONTRACT'});
    return {baselineDifferences: oldDiff.geometry.count, candidateDifferences: newDiff.geometry.count, affectedHorizontalAndLocalRowDifferences: 0, remainingAbsoluteTargetDelta: absoluteTargetDelta};
  } finally {old.free(); doc.free(); oracle.free();}
});
assert.equal(typeof targetText, 'string', 'positive fixture control is required before negative cases');

function standardRows(bytes) {
  const xml = Buffer.from(new Map(readOwnedZip(bytes)).get('Contents/section0.xml')).toString('utf8'), matches = [];
  for (const match of xml.matchAll(/<hp:p\b[^>]*>(?:(?!<hp:p\b)[\s\S])*?<\/hp:p>/g)) {
    const text = [...match[0].matchAll(/<hp:t(?:\s[^>]*)?>([\s\S]*?)<\/hp:t>/g)].map(x => x[1]).join('');
    if (text === targetText) matches.push([...match[0].matchAll(/<hp:lineseg\b([^>]*)\/?\s*>/g)]
      .map(x => Object.fromEntries([...x[1].matchAll(/(\w+)="([^"]*)"/g)].map(a => [a[1], a[2]]))));
  }
  assert.equal(matches.length, 1, 'one exact source target, no guessed paragraph id');
  return matches[0];
}
await scenario('read-only render and both codecs preserve original standard source rows', () => {
  const doc = new engine.HwpDocument(source);
  try {
    doc.getPageTextLayout(2);
    const hwpx = checked(doc, 'hwpx'), hwp = checked(doc, 'hwp');
    const original = standardRows(source), saved = standardRows(hwpx.bytes);
    assert.deepEqual(original.map(r => r.textpos), ['0', '31', '63']);
    assert.deepEqual(saved, original, 'derived content must not rewrite authenticated source line records');
    return {exports: [hwpx.record, hwp.record], originalSourceRowsUnchanged: true};
  } finally {doc.free();}
});

const encoder = new TextEncoder(), decoder = new TextDecoder();
const policies = [
  ['cell SQUEEZE', 'Contents/section0.xml', s => s.replaceAll('lineWrap="BREAK"', 'lineWrap="SQUEEZE"')],
  ['cell KEEP', 'Contents/section0.xml', s => s.replaceAll('lineWrap="BREAK"', 'lineWrap="KEEP"')],
  ...['SQUEEZE', 'KEEP'].map(w => [`paragraph ${w}`, 'Contents/header.xml', s => s.replace(/(<hh:paraPr\b[^>]*\bid="5"[^>]*>[\s\S]*?<hh:breakSetting\b[^>]*\blineWrap=")BREAK"/, `$1${w}"`)]),
  ['authored condense', 'Contents/header.xml', s => s.replace(/(<hh:paraPr\b[^>]*\bid="5"[^>]*\bcondense=")0"/, '$120"')],
  ['grid', 'Contents/header.xml', s => s.replace(/(<hh:paraPr\b[^>]*\bid="5"[^>]*\bsnapToGrid=")0"/, '$11"')],
  ['unowned glyph', 'Contents/section0.xml', s => s.replace(targetText, '∘' + [...targetText].slice(1).join(''))],
  ['manual clipped leaders', 'Contents/section0.xml', s => s.replace(targetText, '....' + [...targetText].slice(4).join(''))],
];
for (const [name, path, mutate] of policies) await scenario(`${name} cannot acquire ordinary scalar correction`, () => {
  const parts = new Map(originalParts), before = decoder.decode(parts.get(path)), after = mutate(before);
  assert.notEqual(after, before, 'the negative input must actually change'); parts.set(path, encoder.encode(after));
  const bytes = writeOwnedZip([...parts]), old = new baseline.HwpDocument(bytes), doc = new engine.HwpDocument(bytes);
  try {
    const beforeState = snapshot(old), afterState = snapshot(doc), c = compareSnapshots(beforeState, afterState);
    assert.equal(c.geometry.count, 0, 'no new rendering ownership under an unsupported policy');
    assert.equal(doc.getTextFileUnicode(), old.getTextFileUnicode());
    assert.deepEqual(targetStarts(afterState), targetStarts(beforeState));
    return {inputSha256: hash(bytes), baselineStarts: targetStarts(beforeState), candidateStarts: targetStarts(afterState), geometry: 0};
  } finally {old.free(); doc.free();}
});

for (const atStart of [true, false]) await scenario(`${atStart ? 'prefix' : 'tail'} real edits, mixed codecs, history and caret`, () => {
  const doc = new engine.HwpDocument(source);
  try {
    const before = snapshot(doc), undo = doc.saveSnapshot(), length = doc.getCellParagraphLength(0, 100, 0, 2, 0), offset = atStart ? 0 : length;
    assert.equal(JSON.parse(doc.insertTextInCell(0, 100, 0, 2, 0, offset, 'X')).ok, true);
    assert.equal(doc.getCellParagraphLength(0, 100, 0, 2, 0), length + 1);
    assert.equal(JSON.parse(doc.deleteTextInCell(0, 100, 0, 2, 0, offset, 1)).ok, true);
    assert.equal(doc.getCellParagraphLength(0, 100, 0, 2, 0), length);
    const after = snapshot(doc), redo = doc.saveSnapshot(); same(before, after);
    const cycles = [];
    for (const first of ['hwp', 'hwpx']) {
      let current = doc, ownsCurrent = false;
      try {
        for (const format of [first, first === 'hwp' ? 'hwpx' : 'hwp', first]) {
          const result = checked(current, format), next = new engine.HwpDocument(result.bytes);
          try {same(after, snapshot(next));} catch (error) {next.free(); throw error;}
          if (ownsCurrent) current.free(); current = next; ownsCurrent = true; cycles.push(result.record);
        }
      } finally {if (ownsCurrent) current.free();}
    }
    doc.restoreSnapshot(undo); same(before, snapshot(doc));
    doc.restoreSnapshot(redo); same(after, snapshot(doc));
    let caretChecks = 0;
    for (const run of targetRuns(snapshot(doc))) for (let i = 1; i < [...run.text].length; i++) {
      const rect = JSON.parse(doc.getCursorRectInCell(0, 100, 0, 2, 0, run.charStart + i));
      assert.equal(rect.pageIndex, run.page);
      assert.ok(Math.abs(rect.x - (run.x + run.charX[i])) <= 0.2, 'caret must use the actual corrected render row'); caretChecks++;
    }
    assert.equal(caretChecks, 90);
    return {cycles, undoRedoComparisons: 2, caretChecks, sourceLogicalContentRestored: true};
  } finally {doc.free();}
});
await scenario('source files and existing strict guards remain immutable', async () => {
  assert.equal(hash(await readFile(sourcePath)), sourceSha256); assert.equal(hash(await readFile(oraclePath)), oracleSha256);
  assert.deepEqual(await fingerprints(), guardsBefore);
  return {sourcesUnchanged: true, guardsUnchanged: true};
});
const verifierSha256 = hash(await readFile(fileURLToPath(import.meta.url)));
const report = {verifierSha256, sourceHashes: guardsBefore, engine: engine.metadata, baseline: baseline.metadata, source: {path: sourcePath, sha256: sourceSha256}, oracle: {path: oraclePath, sha256: oracleSha256},
  scope: 'Owned integer GulimChe advances in ordinary horizontal BREAK cells, unchanged physical row allocation. Uses saved Hancom evidence; no Hancom/UI/COM invocation. No sample/font/document bytes written.',
  completeHancomParity: false, geometryTolerance: 0.2, results, failures, observations, guardFingerprints: guardsBefore,
  limitations: ['Remaining original Python3 differences are reported; this is not a whole-document parity completion.', 'Original MCST missing-glyph and 15-versus-16-page initial parity remain separate work.', 'Manual/unsupported glyph, wrapping, grid and compression policies do not gain new row ownership.']};
await writeFile(join(out, 'result.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({passed: results.filter(r => r.status === 'PASS').length, total: results.length, failed: failures.length}));
if (failures.length) process.exitCode = 1;
