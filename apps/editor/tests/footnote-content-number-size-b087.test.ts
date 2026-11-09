import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import test from 'node:test';
import {
  applyFootnoteContentNumberSizeB087,
  auditFootnoteContentNumberSizeB087,
  captureFootnoteContentNumberSizeB087,
} from '../src/adapters/rhwp/footnote-content-number-size-b087.ts';

const packageRoot = process.env.JUEONY_ENGINE_PACKAGE;
const engine = packageRoot ? await import(pathToFileURL(join(packageRoot, 'rhwp.js')).href) : undefined;
if (engine && packageRoot) await engine.default({module_or_path: await readFile(join(packageRoot, 'rhwp_bg.wasm'))});

const identity = '57'.repeat(32);
const digest = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const shape = (document: any) => JSON.parse(document.getFootnoteShape(0));
const revisionPort = (document: any) => ({
  documentIdentity: () => identity,
  revision: () => digest(document.exportHwp()),
});

test('B087 footnote capability is unavailable without the narrow Rust API', () => {
  assert.deepEqual(auditFootnoteContentNumberSizeB087({}), {supported: false, reason: 'api-unavailable'});
});

test('B087 footnote small content numbers persist in HWP/HWPX and undo exactly', {
  skip: !engine,
}, () => {
  const document = engine.HwpDocument.createEmpty();
  try {
    document.createBlankDocument();
    document.insertText(0, 0, 0, '각주가 있는 본문');
    const reference = JSON.parse(document.insertFootnote(0, 0, 4));
    document.insertTextInFootnote(0, reference.paraIdx, reference.controlIdx, 0, 2, '각주 내용');
    assert.deepEqual(auditFootnoteContentNumberSizeB087(document), {
      supported: true, scope: 'section', option: 'content-number-small',
    });
    const port = revisionPort(document);
    const before = document.exportHwp();
    const capture = captureFootnoteContentNumberSizeB087(document, port, 0);
    assert.equal(capture.status, 'ready');
    if (capture.status !== 'ready') return;
    assert.equal(capture.seal.small, false);
    const applied = applyFootnoteContentNumberSizeB087(document, port, capture.seal, true);
    assert.equal(applied.status, 'applied', JSON.stringify(applied));
    if (applied.status !== 'applied') return;
    assert.equal(shape(document).numberCodeSuperscript, true);
    const after = document.exportHwp();
    assert.notDeepEqual(after, before);
    for (const [format, bytes] of [['hwp', after], ['hwpx', document.exportHwpx()]] as const) {
      const reopened = new engine.HwpDocument(bytes);
      try { assert.equal(shape(reopened).numberCodeSuperscript, true, format); }
      finally { reopened.free(); }
    }
    assert.deepEqual(applied.command.undo(), {status: 'restored', small: false});
    assert.deepEqual(document.exportHwp(), before);
    assert.deepEqual(applied.command.redo(), {status: 'restored', small: true});
    assert.deepEqual(document.exportHwp(), after);
    applied.command.dispose();
  } finally { document.free(); }
});

test('B087 malformed footnote shape is blocked before snapshot or mutation', () => {
  let snapshots = 0;
  let mutations = 0;
  const host: any = {
    getSectionCount: () => 1,
    getFootnoteShape: () => JSON.stringify({ok: true, unexpected: true}),
    applyFootnoteContentNumberSize: () => { mutations++; return {ok: true}; },
    saveSnapshot: () => { snapshots++; return 1; },
    restoreSnapshot: () => ({ok: true}),
    discardSnapshot: () => undefined,
  };
  const capture = captureFootnoteContentNumberSizeB087(host, {
    documentIdentity: () => identity, revision: () => '42'.repeat(32),
  }, 0);
  assert.deepEqual(capture, {status: 'blocked', reason: 'invalid-shape'});
  assert.equal(snapshots, 0);
  assert.equal(mutations, 0);
});
