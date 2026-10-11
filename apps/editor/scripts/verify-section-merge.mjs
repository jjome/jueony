// Fresh-engine functional diagnostics, not independent Hancom rendering goldens.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { capturePreservationEvidence, verifyPreservedExport } from '../src/adapters/rhwp/preservation.ts';

const app = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repo = resolve(app, '../..');
if (!process.env.JUEONY_ENGINE_PACKAGE) throw new Error('JUEONY_ENGINE_PACKAGE must name the fresh patched engine pkg');
const pkg = resolve(repo, process.env.JUEONY_ENGINE_PACKAGE);
const out = resolve(app, process.env.JUEONY_TEST_OUTPUT ?? 'evidence/section-merge');
const build = JSON.parse(await readFile(join(pkg, 'jueony-engine-build.json'), 'utf8'));
const wasm = await readFile(join(pkg, 'rhwp_bg.wasm'));
assert.equal(createHash('sha256').update(wasm).digest('hex'), build.wasmSha256, 'engine manifest must match the actual WASM');
const { default: init, HwpDocument } = await import(pathToFileURL(join(pkg, 'rhwp.js')).href);
await init({ module_or_path: wasm });
assert.equal(typeof HwpDocument.prototype.insertSectionBreak, 'function');
assert.equal(typeof HwpDocument.prototype.mergeSectionBoundary, 'function', 'fresh engine must export mergeSectionBoundary');
await mkdir(out, { recursive: true });

const parse = value => typeof value === 'string' ? JSON.parse(value) : value;
const sections = doc => Array.from({ length: doc.getSectionCount() }, (_, s) =>
  Array.from({ length: doc.getParagraphCount(s) }, (_, p) => doc.getTextRange(s, p, 0, doc.getParagraphLength(s, p))));
function blank(texts) {
  const doc = HwpDocument.createEmpty();
  doc.createBlankDocument();
  for (let p = 0; p < texts.length; p++) {
    if (p) doc.splitParagraph(0, p - 1, doc.getParagraphLength(0, p - 1));
    doc.insertText(0, p, 0, texts[p]);
  }
  doc.setSectionDef(0, JSON.stringify({ defaultTabSpacing: 8000 }));
  return doc;
}
function fingerprint(doc) {
  const evidence = capturePreservationEvidence(doc);
  assert.deepEqual(evidence.issues, [], 'diagnostic must be able to read the original state');
  return evidence.values;
}
function joinBoundary(doc, right) {
  const before = sections(doc), left = right - 1;
  const paraIdx = before[left].length - 1;
  const charOffset = doc.getParagraphLength(left, paraIdx);
  const result = parse(doc.mergeSectionBoundary(right));
  assert.equal(result.ok, true);
  assert.equal(result.sectionIdx, left);
  assert.equal(result.paraIdx, paraIdx);
  assert.equal(result.charOffset, charOffset, 'returned cursor must be the pre-merge logical character boundary');
  assert.equal(result.pageCount, parse(doc.getDocumentInfo()).pageCount);
  const expected = before.map(paras => [...paras]);
  expected[left].splice(paraIdx, 1, before[left][paraIdx] + before[right][0], ...before[right].slice(1));
  expected.splice(right, 1);
  assert.deepEqual(sections(doc), expected);
  return result;
}

const results = [], failures = [], documents = [];
async function run(name, action) {
  try { const data = await action(); results.push({ name, data }); console.log('PASS', name); }
  catch (error) { failures.push({ name, error: String(error), stack: error.stack }); console.error('FAIL', name, error); }
}
async function roundtrip(doc, name) {
  const original = sections(doc);
  for (const format of ['hwp', 'hwpx']) {
    const artifact = doc[format === 'hwp' ? 'exportHwpWithReport' : 'exportHwpxWithReport']();
    let bytes, report;
    try {
      bytes = artifact.takeBytes();
      report = verifyPreservedExport(doc, bytes, format, artifact.contentLoss(), data => new HwpDocument(data));
    } finally { artifact.free(); }
    assert.equal(report.status, 'checked');
    const reopened = new HwpDocument(bytes);
    try { assert.deepEqual(sections(reopened), original); assert.equal(reopened.getSectionCount(), doc.getSectionCount()); }
    finally { reopened.free(); }
    // Never write a document rejected by the application's preservation gate.
    const file = `${name}.${format}`;
    await writeFile(join(out, file), bytes);
    documents.push(file);
  }
}

await run('empty/start/middle/end paragraph boundaries and exact snapshot undo', async () => {
  const cases = [
    { text: [''], p: 0, offset: 0 },
    { text: ['ABC', 'DEF'], p: 0, offset: 0 },
    { text: ['ABC', 'DEF'], p: 0, offset: 1 },
    { text: ['ABC', 'DEF'], p: 0, offset: 3 },
    { text: ['ABC', 'DEF'], p: 1, offset: 0 },
    { text: ['ABC', 'DEF'], p: 1, offset: 3 },
    { text: ['ABC', '', 'DEF'], p: 1, offset: 0 },
  ];
  const observations = [];
  for (let i = 0; i < cases.length; i++) {
    const entry = cases[i], doc = blank(entry.text);
    try {
      doc.insertSectionBreak(0, entry.p, entry.offset);
      await roundtrip(doc, `merge-before-boundary-${i}`);
      const before = fingerprint(doc), snapshot = doc.saveSnapshot();
      observations.push(joinBoundary(doc, 1));
      await roundtrip(doc, `merge-boundary-${i}`);
      doc.restoreSnapshot(snapshot);
      assert.deepEqual(fingerprint(doc), before, 'undo must restore both sections and their properties');
      doc.discardSnapshot(snapshot);
    } finally { doc.free(); }
  }
  return { cases: cases.length, observations };
});

await run('mixed Korean emoji tabs and character format runs retain order', async () => {
  const doc = blank(['머리 문단', '가😀나\t다\t끝', '마지막 문단']);
  try {
    doc.applyCharFormat(0, 1, 0, 2, JSON.stringify({ bold: true }));
    doc.applyCharFormat(0, 1, 3, 5, JSON.stringify({ italic: true }));
    const text = sections(doc)[0][1];
    const flags = Array.from(text, (_, i) => {
      const p = parse(doc.getCharPropertiesAt(0, 1, i)); return { bold: p.bold, italic: p.italic };
    });
    doc.insertSectionBreak(0, 1, 2);
    const result = joinBoundary(doc, 1);
    assert.deepEqual(sections(doc), [['머리 문단', text, '마지막 문단']]);
    assert.deepEqual(Array.from(text, (_, i) => {
      const p = parse(doc.getCharPropertiesAt(0, 1, i)); return { bold: p.bold, italic: p.italic };
    }), flags);
    await roundtrip(doc, 'merge-korean-emoji-tabs-runs');
    return { result, text, flags };
  } finally { doc.free(); }
});

await run('three sections retain untouched later settings while left page/tab settings win', async () => {
  const doc = blank(['ONE', 'TWO', 'THREE', 'FOUR']);
  try {
    doc.insertSectionBreak(0, 1, 0);
    doc.insertSectionBreak(1, 1, 0);
    doc.setSectionDef(0, JSON.stringify({ defaultTabSpacing: 4000, pageNum: 3 }));
    doc.setSectionDef(1, JSON.stringify({ defaultTabSpacing: 12000, pageNum: 9 }));
    doc.setSectionDef(2, JSON.stringify({ defaultTabSpacing: 16000, pageNum: 17 }));
    doc.setColumnDef(0, 2, 0, 1, 1000);
    doc.setColumnDef(1, 3, 0, 1, 2000);
    const page = parse(doc.getPageDef(0));
    doc.setPageDef(0, JSON.stringify({ ...page, marginLeft: page.marginLeft + 1000 }));
    const leftPage = parse(doc.getPageDef(0)), leftDef = parse(doc.getSectionDef(0));
    const leftColumns = parse(doc.getColumnDef(0));
    const laterPage = parse(doc.getPageDef(2)), laterDef = parse(doc.getSectionDef(2));
    await roundtrip(doc, 'merge-before-three-section-settings');
    const result = joinBoundary(doc, 1);
    assert.deepEqual(parse(doc.getPageDef(0)), leftPage);
    assert.deepEqual(parse(doc.getSectionDef(0)), leftDef);
    assert.deepEqual(parse(doc.getColumnDef(0)), leftColumns);
    assert.deepEqual(parse(doc.getPageDef(1)), laterPage);
    assert.deepEqual(parse(doc.getSectionDef(1)), laterDef);
    assert.deepEqual(sections(doc), [['ONETWO'], ['THREE', 'FOUR']]);
    await roundtrip(doc, 'merge-three-section-settings');
    return { result, leftDef, laterDef, leftPage, laterPage, leftColumns };
  } finally { doc.free(); }
});

await run('merge middle and last boundaries leaves unrelated section content unchanged', async () => {
  const observations = [];
  for (const right of [1, 2]) {
    const doc = blank(['FIRST', 'SECOND', 'THIRD']);
    try {
      doc.insertSectionBreak(0, 1, 0); doc.insertSectionBreak(1, 1, 0);
      const result = joinBoundary(doc, right);
      assert.deepEqual(sections(doc), right === 1 ? [['FIRSTSECOND'], ['THIRD']] : [['FIRST'], ['SECONDTHIRD']]);
      await roundtrip(doc, `merge-three-at-${right}`);
      observations.push(result);
    } finally { doc.free(); }
  }
  return { observations };
});

await run('invalid bounds and boundary controls/fields reject without partial mutation', async () => {
  const observations = [];
  for (const kind of ['bounds', 'left-table', 'right-table', 'left-field', 'right-field', 'right-header']) {
    const doc = blank(['LEFT', 'RIGHT', 'LATER']);
    try {
      doc.insertSectionBreak(0, 1, 0);
      const side = kind.startsWith('left') ? 0 : 1;
      if (kind === 'left-table') {
        const table = parse(doc.createTable(0, 0, 0, 2, 2));
        // Floating table creation adds a trailing body paragraph. Put the actual
        // table owner at the boundary before checking the rejection contract.
        while (doc.getParagraphCount(0) - 1 > table.paraIdx) doc.deleteParagraph(0, doc.getParagraphCount(0) - 1);
        assert.equal(table.paraIdx, doc.getParagraphCount(0) - 1);
      }
      if (kind === 'right-table') {
        const table = parse(doc.createTableEx(JSON.stringify({ sectionIdx: 1, paraIdx: 0, charOffset: 1, rowCount: 2, colCount: 2, treatAsChar: true })));
        assert.equal(table.paraIdx, 0, 'inline table must belong to the actual first right paragraph');
      }
      if (kind.endsWith('field')) doc.insertClickHereField(side, 0, 1, '안내', '설명', '검사 필드', true);
      if (kind === 'right-header') doc.createHeaderFooter(1, true, 0);
      const boundaryPara = side === 0 ? doc.getParagraphCount(0) - 1 : 0;
      const flatBoundary = (side === 1 ? doc.getParagraphCount(0) : 0) + boundaryPara;
      const boundaryControls = parse(doc.getControls()).filter(control => control.list === 0 && control.para === flatBoundary);
      if (kind.endsWith('table')) assert.ok(boundaryControls.some(control => control.ctrlId === 'tbl'), `${kind} fixture must really put its table at the rejected boundary`);
      if (kind.endsWith('field')) {
        const fields = parse(doc.getFieldList());
        assert.ok(fields.some(field => field.location.sectionIndex === side && field.location.paraIndex === boundaryPara), `${kind} fixture must really anchor its field at the rejected boundary`);
        assert.ok(boundaryControls.some(control => !['secd', 'cold'].includes(control.ctrlId)), `${kind} boundary must contain the field control`);
      }
      const before = fingerprint(doc);
      const targets = kind === 'bounds' ? [0, 2, 99] : [1];
      for (const target of targets) {
        assert.throws(() => doc.mergeSectionBoundary(target), `${kind} must reject boundary ${target}`);
        assert.deepEqual(fingerprint(doc), before, `${kind} rejection must leave all readable content and properties unchanged`);
      }
      observations.push({ kind, rejected: targets, boundaryPara, boundaryControls });
    } finally { doc.free(); }
  }
  return { observations };
});

await run('left own header survives an eligible merge and both strict saves', async () => {
  const doc = blank(['HEADER ANCHOR', 'LEFT', 'RIGHT', 'END']);
  try {
    doc.createHeaderFooter(0, true, 0);
    doc.insertTextInHeaderFooter(0, true, 0, 0, 0, '왼쪽 공통 머리말');
    doc.insertSectionBreak(0, 2, 0);
    const header = parse(doc.getHeaderFooter(0, true, 0));
    const result = joinBoundary(doc, 1);
    assert.deepEqual(parse(doc.getHeaderFooter(0, true, 0)), header);
    await roundtrip(doc, 'merge-preserved-left-header');
    return { result, header };
  } finally { doc.free(); }
});

await run('later table moves with contents and properties; snapshot restores its original section', async () => {
  const doc = blank(['LEFT', 'RIGHT', 'TABLE', 'END']);
  try {
    const table = parse(doc.createTable(0, 2, 0, 2, 2));
    const cellText = '업무\t표 😀';
    doc.insertTextInCell(0, table.paraIdx, table.controlIdx, 0, 0, 0, cellText);
    doc.insertSectionBreak(0, 1, 0);
    doc.setSectionDef(0, JSON.stringify({ defaultTabSpacing: 4000 }));
    doc.setSectionDef(1, JSON.stringify({ defaultTabSpacing: 12000 }));
    const before = fingerprint(doc), saved = doc.saveSnapshot();
    const oldProperties = parse(doc.getTableProperties(1, 1, table.controlIdx));
    const rightCursor = parse(doc.getCursorRectInCell(1, 1, table.controlIdx, 0, 0, 3));
    const result = joinBoundary(doc, 1);
    assert.equal(doc.getTextInCell(0, 1, table.controlIdx, 0, 0, 0, 100), cellText);
    assert.deepEqual(parse(doc.getTableProperties(0, 1, table.controlIdx)), oldProperties);
    const leftCursor = parse(doc.getCursorRectInCell(0, 1, table.controlIdx, 0, 0, 3));
    assert.ok(leftCursor.x < rightCursor.x, 'moved table tab must use the surviving left 20pt setting instead of removed right 60pt');
    assert.ok(parse(doc.getControls()).some(control => control.ctrlId === 'tbl'));
    await roundtrip(doc, 'merge-preserved-later-table');
    doc.restoreSnapshot(saved); assert.deepEqual(fingerprint(doc), before); doc.discardSnapshot(saved);
    return { result, table, properties: oldProperties, rightCursor, leftCursor };
  } finally { doc.free(); }
});

await writeFile(join(out, 'engine-result.json'), JSON.stringify({
  build, results, failures, documents, nativeHancom: 'NOT_RUN',
  unverified: ['RangeTag-only boundary rejection has no public creation API and is not synthesized by these diagnostics.', 'Right-section additional ColumnDef controls require a separate imported fixture.'],
  note: 'Fresh WASM functional diagnostics and strict engine round-trips. No new rendering fixture/golden or claim of native Hancom equivalence.',
}, null, 2));
if (failures.length) process.exitCode = 1;
