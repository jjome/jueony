// Scoped MCST authored/mixed-axis paragraph-before regression. External SHA-pinned
// documents remain outside the repository. This does not claim complete Hancom parity.
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
const app = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(process.env.JUEONY_TEST_OUTPUT); await mkdir(out, {recursive: true});
const sourcePath = resolve(process.env.JUEONY_TEST_SOURCE), oraclePath = resolve(process.env.JUEONY_TEST_ORACLE);
const source = await readFile(sourcePath), oracle = await readFile(oraclePath);
assert.equal(hash(source), 'c61a13b249183a675d38d5badfa3af610edcf99a403622440fc81b7f52b348f2');
assert.equal(hash(oracle), '20a3960b4315626c3f97d9c5d47746e3cfadd8fe50dde43a4a424aa3a2a76936');
const baseline = await loadReviewEngine(process.env.JUEONY_BASELINE_ENGINE_PACKAGE);
assert.equal(baseline.metadata.sourceId, '2feb978b45e2964e');
assert.equal(baseline.metadata.wasmSha256, '5f40eebea9726b42d049f9f57694c0d686099cfef9ca4dc61d621ebc35e00fd8');
const engine = await loadReviewEngine(process.env.JUEONY_ENGINE_PACKAGE);
const guards = ['src/adapters/rhwp/preservation.ts', 'src/adapters/rhwp/document-save-layout.ts', 'src/adapters/rhwp/overlap-save-layout.ts'];
const fingerprints = () => Promise.all(guards.map(async path => ({path, sha256: hash(await readFile(join(app, path)))})));
const guardsBefore = await fingerprints(), results = [], failures = [], observations = [];
const body48 = state => state.layout.flatMap(page => page.text.runs
  .filter(run => run.paraIdx === 48 && run.parentParaIdx === undefined)
  .map(run => ({page: page.page, ...run})));
const compact = c => ({pages: c.pages, semantic: c.semantic.count, geometry: c.geometry.count,
  readIssues: c.semantic.readIssues.before.length + c.semantic.readIssues.after.length});
function same(before, after) {
  const comparison = compareSnapshots(before, after);
  assert.equal(comparison.status, 'SAME_WITHIN_PUBLISHED_CONTRACT', JSON.stringify(compact(comparison)));
}
function sameInitialGeometry(before, after) {
  // Baseline engines may intentionally differ in metadata API coverage. This
  // scoped initial-render assertion compares every published geometry field;
  // all actual storage/history checks below still require full semantics too.
  assert.equal(before.pages, after.pages);
  assert.equal(differences(before.layout, after.layout, 0.2).length, 0);
}
async function scenario(name, action) {
  try {results.push({name, status: 'PASS', ...await action()}); console.log('PASS', name);}
  catch (error) {results.push({name, status: 'FAIL'}); failures.push({name, error: String(error), stack: error.stack}); console.log('FAIL', name, String(error));}
}
async function checked(doc, format, label) {
  const before = snapshot(doc), artifact = doc[format === 'hwp' ? 'exportHwpWithReport' : 'exportHwpxWithReport']();
  try {
    const bytes = artifact.takeBytes(), loss = JSON.parse(artifact.contentLoss());
    assert.equal(loss.count, 0); assert.equal(loss.outputFormat, format);
    const path = join(out, label + '.' + format); await writeFile(path, bytes);
    const disk = await readFile(path); assert.equal(hash(disk), hash(bytes));
    const report = verifyPreservedExport(doc, disk, format, loss, b => new engine.HwpDocument(b));
    assert.equal(report.status, 'checked', 'a protected refusal is not successful storage');
    const opened = new engine.HwpDocument(disk);
    try {same(before, snapshot(opened)); assert.equal(opened.getTextFileUnicode(), doc.getTextFileUnicode());}
    finally {opened.free();}
    assert.deepEqual(snapshot(doc), before, 'read-only export must preserve live state');
    return {bytes: disk, record: {format, sha256: hash(disk), losses: 0, semantic: 0, geometry: 0, guard: report.status}};
  } finally {artifact.free();}
}
const xmlParts = readOwnedZip(oracle), sectionXML = new Map(xmlParts).get('Contents/section0.xml').toString('utf8');
function topParagraphs(xml) {
  const result = []; let depth = 0, start;
  for (const match of xml.matchAll(/<\/?hp:p\b[^>]*>/g)) {
    if (match[0].startsWith('</')) {assert.ok(depth > 0); if (--depth === 0) result.push({start, end: match.index + match[0].length, text: xml.slice(start, match.index + match[0].length)});}
    else {if (depth++ === 0) start = match.index;}
  }
  assert.equal(depth, 0); assert.ok(result.length > 48); return result;
}
function standardRows(xml) {
  const paragraph = topParagraphs(xml)[48].text, rows = []; let depth = 0;
  for (const match of paragraph.matchAll(/<\/?hp:(?:p|lineseg)\b[^>]*>/g)) {
    if (match[0].startsWith('</hp:p')) depth--;
    else if (match[0].startsWith('<hp:p')) depth++;
    else if (depth === 1) rows.push(Object.fromEntries([...match[0].matchAll(/(\w+)="([^"]*)"/g)].map(m => [m[1], m[2]])));
  }
  assert.equal(rows.length, 4); return rows;
}
await scenario('authored body origin improves against independent saved inputs without changing native input', () => {
  const old = new baseline.HwpDocument(oracle), doc = new engine.HwpDocument(oracle);
  const native = new engine.HwpDocument(source), oldNative = new baseline.HwpDocument(source);
  try {
    const before = snapshot(old), after = snapshot(doc), reference = snapshot(native);
    const nativeBaseline = snapshot(oldNative);
    sameInitialGeometry(nativeBaseline, reference);
    const completeMetadataAPI = typeof oldNative.getDocumentStoredInformation === 'function'
      && typeof native.getDocumentStoredInformation === 'function';
    if (completeMetadataAPI) same(nativeBaseline, reference);
    observations.push({name: 'native baseline semantic coverage', fullSemanticAsserted: completeMetadataAPI,
      baselineHasStoredInformation: typeof oldNative.getDocumentStoredInformation === 'function',
      candidateHasStoredInformation: typeof native.getDocumentStoredInformation === 'function'});
    assert.equal(differences(body48(before), body48(reference), 0.2).length, 23);
    assert.equal(differences(body48(after), body48(reference), 0.2).length, 0);
    assert.equal(differences(before.layout, after.layout, 0.2).length, 23);
    assert.equal(after.pages, before.pages);
    const remaining = compareSnapshots(reference, after);
    observations.push({name: 'remaining initial full-document difference', ...compact(remaining), completeHancomParity: false});
    return {baselineTargetDifferences: 23, candidateTargetDifferences: 0, nativeInputChanges: 0};
  } finally {old.free(); doc.free(); native.free(); oldNative.free();}
});
await scenario('read-only display and save preserve every original target standard row field', async () => {
  const doc = new engine.HwpDocument(oracle);
  try {
    snapshot(doc); const saved = await checked(doc, 'hwpx', 'unchanged-oracle');
    const emitted = new Map(readOwnedZip(saved.bytes)).get('Contents/section0.xml').toString('utf8');
    assert.deepEqual(standardRows(emitted), standardRows(sectionXML));
    return {originalRowsUnchanged: 4, storage: saved.record};
  } finally {doc.free();}
});
for (const [name, change] of [
  ['explicit page break', text => text.replace('pageBreak="0"', 'pageBreak="1"')],
  ['other wrap policy', text => text.replace('textWrap="TOP_AND_BOTTOM"', 'textWrap="SQUARE"')],
  ['overlapping host', text => text.replace('allowOverlap="0"', 'allowOverlap="1"')],
  ['wrong authored gap', text => text.replace('vertpos="51013"', 'vertpos="51014"')],
  ['imported generated flag', text => text.replace('vertpos="51013"', 'vertpos="51013"').replace(/(<hp:lineseg\b[^>]*vertpos="51013"[^>]*flags=")\d+"/, (_, head) => head + '2147876864"')],
]) {
  await scenario('excluded input: ' + name, () => {
    const target = topParagraphs(sectionXML)[48], altered = change(target.text);
    assert.notEqual(altered, target.text, 'negative must actually change its intended XML field');
    const xml = sectionXML.slice(0, target.start) + altered + sectionXML.slice(target.end);
    const bytes = writeOwnedZip(xmlParts.map(([path, data]) => [path, path === 'Contents/section0.xml' ? Buffer.from(xml) : data]));
    const old = new baseline.HwpDocument(bytes), doc = new engine.HwpDocument(bytes);
    try {
      const before = snapshot(old), after = snapshot(doc);
      sameInitialGeometry(before, after);
      if (typeof old.getDocumentStoredInformation === 'function' && typeof doc.getDocumentStoredInformation === 'function') same(before, after);
      assert.equal(old.getTextFileUnicode(), doc.getTextFileUnicode());
      return {unqualifiedGeometryChanges: 0, textUnchanged: true};
    }
    finally {old.free(); doc.free();}
  });
}
for (const retained of [false, true]) for (const para of [47, 48]) for (const atStart of [true, false]) {
  const label = `p${para}-${atStart ? 'prefix' : 'tail'}${retained ? '-insert' : ''}`;
  await scenario((retained ? 'retained text, disk save, repeated reopen and history: ' : 'actual edit, disk save, repeated reopen and history: ') + label, async () => {
    let doc = new engine.HwpDocument(oracle);
    try {
      const before = snapshot(doc), undo = doc.saveSnapshot(), offset = atStart ? 0 : doc.getParagraphLength(0, para);
      const originalText = doc.getTextRange(0, para, 0, doc.getParagraphLength(0, para));
      JSON.parse(doc.insertText(0, para, offset, '가'));
      if (!retained) JSON.parse(doc.deleteText(0, para, offset, 1));
      assert.equal(doc.getTextRange(0, para, 0, doc.getParagraphLength(0, para)),
        retained ? (atStart ? '가' + originalText : originalText + '가') : originalText);
      const edited = snapshot(doc), redo = doc.saveSnapshot(), exports = [];
      if (retained) assert.ok(compareSnapshots(before, edited).semantic.count > 0, 'new text must remain in the edited document');
      else assert.equal(compareSnapshots(before, edited).semantic.count, 0);
      let opened = null;
      try {
        for (let pass = 0; pass < 3; pass++) {
          const saved = await checked(opened ?? doc, 'hwpx', `${label}-${pass}`); exports.push(saved.record);
          opened?.free(); opened = new engine.HwpDocument(saved.bytes);
          same(edited, snapshot(opened));
        }
      } finally {opened?.free();}
      // Snapshot identifiers belong to the original editor instance, not to
      // documents reconstructed from its exported bytes.
      JSON.parse(doc.restoreSnapshot(undo)); same(before, snapshot(doc));
      JSON.parse(doc.restoreSnapshot(redo)); same(edited, snapshot(doc));
      exports.push((await checked(doc, 'hwpx', label + '-redo')).record);
      return {exports, exactUndo: true, exactRedo: true};
    } finally {doc.free();}
  });
}
for (const format of ['hwp', 'hwpx']) {
  await scenario('unmodified native source successful storage: ' + format, async () => {
    const doc = new engine.HwpDocument(source);
    try {return {storage: (await checked(doc, format, 'native-clean-' + format)).record};}
    finally {doc.free();}
  });
}
await scenario('source documents and production guards remain byte-identical', async () => {
  assert.equal(hash(await readFile(sourcePath)), hash(source)); assert.equal(hash(await readFile(oraclePath)), hash(oracle));
  assert.deepEqual(await fingerprints(), guardsBefore); return {inputsUnchanged: true, guardsUnchanged: true};
});
const report = {engine: engine.metadata, baseline: baseline.metadata,
  verifierSha256: hash(await readFile(fileURLToPath(import.meta.url))), sourceSha256: hash(source), oracleSha256: hash(oracle),
  sourceHashes: guardsBefore, guardFingerprints: guardsBefore, pass: results.filter(r => r.status === 'PASS').length,
  fail: failures.length, skipped: 0, results, failures, observations,
  scope: 'One authored/mixed-axis visible floating-host paragraph-before contract, full published 0.2 layout/semantic storage guard, actual disk bytes and exact history. Original Hancom UI comparison, remaining initial page/table/font differences and native edited-host compatibility are not claimed complete.'};
await writeFile(join(out, 'result.json'), JSON.stringify(report, null, 2) + '\n');
if (failures.length) process.exitCode = 1;
