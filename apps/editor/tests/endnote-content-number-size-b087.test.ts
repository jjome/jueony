import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import init, {HwpDocument} from '@rhwp/core';
import {
  applyEndnoteContentNumberSizeB087,
  auditNoteShapeCapabilityB087,
  captureEndnoteContentNumberSizeB087,
  type EndnoteShapeContextB087,
  type EndnoteShapeHostB087,
} from '../src/adapters/rhwp/endnote-content-number-size-b087.ts';

await init({module_or_path: await readFile(new URL('../node_modules/@rhwp/core/rhwp_bg.wasm', import.meta.url))});

const digest = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const identity = '42'.repeat(32);
const shape = (document: any) => JSON.parse(document.getEndnoteShape(0));
const revisionPort = (document: any): EndnoteShapeContextB087 => ({
  documentIdentity: () => identity,
  revision: () => digest(document.exportHwp()),
});

test('capability is exact: section-owned endnote number size is supported, footnote is fail-closed', () => {
  const document = HwpDocument.createEmpty();
  try {
    document.createBlankDocument();
    assert.deepEqual(auditNoteShapeCapabilityB087(document as unknown as EndnoteShapeHostB087, 'endnote'), {
      supported: true,
      scope: 'section',
      option: 'content-number-small',
    });
    assert.deepEqual(auditNoteShapeCapabilityB087(document as unknown as EndnoteShapeHostB087, 'footnote'), {
      supported: false,
      reason: 'unsupported-note-kind',
    });
    assert.deepEqual(auditNoteShapeCapabilityB087({}, 'endnote'), {
      supported: false,
      reason: 'api-unavailable',
    });
    assert.equal(captureEndnoteContentNumberSizeB087(document as any, revisionPort(document), 1).status, 'blocked');
  } finally { document.free(); }
});

test('actual Rust/WASM applies small endnote content numbers, restores exact snapshots, and persists in HWP/HWPX', () => {
  const document = HwpDocument.createEmpty();
  try {
    document.createBlankDocument();
    document.insertText(0, 0, 0, '미주가 있는 본문');
    const reference = JSON.parse(document.insertEndnote(0, 0, 4));
    document.insertTextInFootnote(0, reference.paraIdx, reference.controlIdx, 0, 2, '미주 내용');
    const port = revisionPort(document);
    const beforeBytes = document.exportHwp();
    const capture = captureEndnoteContentNumberSizeB087(document as any, port, 0);
    assert.equal(capture.status, 'ready');
    if (capture.status !== 'ready') return;
    assert.equal(capture.seal.small, false);

    const result = applyEndnoteContentNumberSizeB087(document as any, port, capture.seal, true);
    assert.equal(result.status, 'applied');
    if (result.status !== 'applied') return;
    assert.equal(shape(document).numberCodeSuperscript, true);
    const afterBytes = document.exportHwp();
    assert.notDeepEqual(afterBytes, beforeBytes);

    for (const [format, bytes] of [['hwp', afterBytes], ['hwpx', document.exportHwpx()]] as const) {
      const reopened = new HwpDocument(bytes);
      try {
        assert.equal(shape(reopened).numberCodeSuperscript, true, format);
        const beforeRead = format === 'hwp' ? reopened.exportHwp() : reopened.exportHwpx();
        shape(reopened);
        assert.deepEqual(format === 'hwp' ? reopened.exportHwp() : reopened.exportHwpx(), beforeRead, `${format} read is non-mutating`);
      } finally { reopened.free(); }
    }

    assert.deepEqual(result.command.undo(), {status: 'restored', small: false});
    assert.deepEqual(document.exportHwp(), beforeBytes);
    assert.deepEqual(result.command.redo(), {status: 'restored', small: true});
    assert.deepEqual(document.exportHwp(), afterBytes);
    assert.deepEqual(result.command.redo(), {status: 'blocked', reason: 'history-state-mismatch'});
    result.command.dispose();
    result.command.dispose();
  } finally { document.free(); }
});

test('stale seals and post-mutation verification failure never overwrite the current shape', () => {
  const document = HwpDocument.createEmpty();
  try {
    document.createBlankDocument();
    const port = revisionPort(document);
    const capture = captureEndnoteContentNumberSizeB087(document as any, port, 0);
    assert.equal(capture.status, 'ready');
    if (capture.status !== 'ready') return;
    const changed = {...shape(document), suffixChar: ']'};
    assert.deepEqual(JSON.parse(document.applyEndnoteShape(0, JSON.stringify(changed))), {ok: true});
    const externallyChanged = document.exportHwp();
    assert.deepEqual(applyEndnoteContentNumberSizeB087(document as any, port, capture.seal, true), {
      status: 'blocked', reason: 'stale-document',
    });
    assert.deepEqual(document.exportHwp(), externallyChanged);

    const fresh = captureEndnoteContentNumberSizeB087(document as any, port, 0);
    assert.equal(fresh.status, 'ready');
    if (fresh.status !== 'ready') return;
    const sabotaged = new Proxy(document as any, {
      get(target, key, receiver) {
        if (key === 'applyEndnoteShape') return () => JSON.stringify({ok: true});
        const value = Reflect.get(target, key, receiver);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
    assert.deepEqual(applyEndnoteContentNumberSizeB087(sabotaged, port, fresh.seal, true), {
      status: 'blocked', reason: 'verification-failed',
    });
    assert.deepEqual(document.exportHwp(), externallyChanged);
  } finally { document.free(); }
});

test('unknown shape schema is blocked before snapshot or mutation', () => {
  let snapshots = 0;
  const host = {
    getSectionCount: () => 1,
    getEndnoteShape: () => ({ok: true, unexpected: true}),
    applyEndnoteShape: () => ({ok: true}),
    saveSnapshot: () => { snapshots++; return 1; },
    restoreSnapshot: () => ({ok: true}),
    discardSnapshot: () => undefined,
  };
  const fixed = {documentIdentity: () => identity, revision: () => '24'.repeat(32)};
  assert.deepEqual(captureEndnoteContentNumberSizeB087(host, fixed, 0), {status: 'blocked', reason: 'invalid-shape'});
  assert.equal(snapshots, 0);
});
