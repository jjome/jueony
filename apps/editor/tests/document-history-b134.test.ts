import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import test from 'node:test';
import type {HwpDocument as HwpDocumentType} from '@rhwp/core';
import {
  createVerifiedHistoryReceiptB134,
  DocumentHistoryLedgerB134,
  sealDocumentHistoryOwnerB134,
  verifyDocumentHistoryViewB134,
  type DocumentHistoryOwnerInputB134,
} from '../src/adapters/rhwp/document-history-b134.ts';

const enginePackage = process.env.JUEONY_ENGINE_PACKAGE
  ? resolve(process.env.JUEONY_ENGINE_PACKAGE)
  : fileURLToPath(new URL('../node_modules/@rhwp/core/', import.meta.url));
const engine = await import(pathToFileURL(resolve(enginePackage, 'rhwp.js')).href);
const {HwpDocument} = engine as typeof import('@rhwp/core');
await engine.default({module_or_path: await readFile(resolve(enginePackage, 'rhwp_bg.wasm'))});

function input(document: HwpDocumentType, revision: string, instance = 'instance-b134'): DocumentHistoryOwnerInputB134 {
  return {documentIdentity: 'document-b134', documentInstance: instance, revision,
    hwpBytes: document.exportHwp(), hwpxBytes: document.exportHwpx()};
}

function boundedInput(index: number): DocumentHistoryOwnerInputB134 {
  return {documentIdentity: 'bounded-document', documentInstance: 'bounded-instance', revision: `r-${index}`,
    hwpBytes: new Uint8Array([0x48, index >>> 8, index & 0xff]),
    hwpxBytes: new Uint8Array([0x58, index >>> 8, index & 0xff])};
}

test('B134 records a monotonic tamper-evident digest chain without document content', () => {
  const document = HwpDocument.createEmpty(); document.createBlankDocument();
  try {
    let now = 1_700_000_000_000;
    const before = input(document, 'revision-0'), ledger = new DocumentHistoryLedgerB134(before, () => now++);
    document.insertText(0, 0, 0, '가');
    const afterOne = input(document, 'revision-1');
    ledger.append(createVerifiedHistoryReceiptB134(before, afterOne, 'insert-text'), afterOne);
    document.insertText(0, 0, 1, '나');
    const afterTwo = input(document, 'revision-2');
    ledger.append(createVerifiedHistoryReceiptB134(afterOne, afterTwo, 'insert-text', 1), afterTwo);
    const view = ledger.view();
    assert.equal(verifyDocumentHistoryViewB134(view), true);
    assert.deepEqual(view.entries.map(entry => entry.sequence), [1, 2]);
    assert.equal(view.entries[1].previousFingerprint, view.entries[0].entryFingerprint);
    const serialized = JSON.stringify(view);
    assert.doesNotMatch(serialized, /가|나|password|secret/iu);
    assert.match(view.chainFingerprint, /^[0-9a-f]{64}$/u);
    assert.equal(Object.isFrozen(view), true); assert.equal(Object.isFrozen(view.entries), true);
  } finally { document.free(); }
});

test('B134 rejects malformed receipts, wrong instances, stale heads and history forks', () => {
  const document = HwpDocument.createEmpty(); document.createBlankDocument();
  try {
    const before = input(document, 'revision-0'), ledger = new DocumentHistoryLedgerB134(before, () => 10);
    document.insertText(0, 0, 0, '변경');
    const after = input(document, 'revision-1'), receipt = createVerifiedHistoryReceiptB134(before, after, 'insert-text');
    assert.throws(() => ledger.append({...receipt, fingerprint: '0'.repeat(64)}, after), /검증/);
    assert.throws(() => ledger.append(receipt, {...after, documentInstance: 'other-instance'}), /다른/);
    ledger.append(receipt, after);
    assert.throws(() => ledger.append(receipt, after), /갈라진/);
    document.insertText(0, 0, 2, '후속');
    const fork = input(document, 'revision-fork');
    assert.throws(() => ledger.append(createVerifiedHistoryReceiptB134(before, fork, 'replace-text'), fork), /갈라진/);
    assert.throws(() => createVerifiedHistoryReceiptB134(before, after, 'raw-native-token'), /편집 종류/);
    assert.throws(() => createVerifiedHistoryReceiptB134(before, before, 'insert-text'), /변경/);
  } finally { document.free(); }
});

test('B134 copied views detect tampering in entries, links and head', () => {
  const document = HwpDocument.createEmpty(); document.createBlankDocument();
  try {
    const before = input(document, 'r0'), ledger = new DocumentHistoryLedgerB134(before, () => 20);
    document.insertText(0, 0, 0, '기록');
    const after = input(document, 'r1'); ledger.append(createVerifiedHistoryReceiptB134(before, after, 'insert-text'), after);
    const original = ledger.view(); assert.equal(verifyDocumentHistoryViewB134(structuredClone(original)), true);
    for (const mutate of [
      (copy: any) => { copy.entries[0].afterRevision = 'tampered'; },
      (copy: any) => { copy.entries[0].previousFingerprint = '0'.repeat(64); },
      (copy: any) => { copy.head.artifact.hwpSha256 = '0'.repeat(64); },
      (copy: any) => { copy.chainFingerprint = '0'.repeat(64); },
    ]) { const copy = structuredClone(original); mutate(copy); assert.equal(verifyDocumentHistoryViewB134(copy), false); }
  } finally { document.free(); }
});

test('B134 keeps at most 256 immutable session entries', () => {
  let timestamp = 0, before = boundedInput(0);
  const ledger = new DocumentHistoryLedgerB134(before, () => timestamp++);
  for (let index = 1; index <= 256; index += 1) {
    const after = boundedInput(index);
    ledger.append(createVerifiedHistoryReceiptB134(before, after, 'structure-edit'), after);
    before = after;
  }
  const view = ledger.view();
  assert.equal(view.entries.length, 256);
  assert.equal(Object.isFrozen(view.entries[255]), true);
  const overflow = boundedInput(257);
  assert.throws(() => ledger.append(createVerifiedHistoryReceiptB134(before, overflow, 'structure-edit'), overflow), /한도/);
});

test('B134 actual HWP/HWPX edit digests reopen and ledger operations leave bytes and undo untouched', () => {
  const document = HwpDocument.createEmpty(); document.createBlankDocument(); document.insertText(0, 0, 0, '원문');
  try {
    const beforeHwp = document.exportHwp(), beforeHwpx = document.exportHwpx();
    const before = input(document, 'native-0'), undo = document.saveSnapshot(), ledger = new DocumentHistoryLedgerB134(before, () => 30);
    document.insertText(0, 0, 2, ' 변경');
    const after = input(document, 'native-1'), afterHwp = document.exportHwp(), afterHwpx = document.exportHwpx();
    ledger.append(createVerifiedHistoryReceiptB134(before, after, 'insert-text'), after);
    const sealed = sealDocumentHistoryOwnerB134(after), view = ledger.view();
    assert.deepEqual(document.exportHwp(), afterHwp); assert.deepEqual(document.exportHwpx(), afterHwpx);
    assert.deepEqual(view.head.artifact, sealed.artifact);
    for (const bytes of [afterHwp, afterHwpx]) {
      const reopened = new HwpDocument(bytes);
      try { assert.equal(reopened.getTextRange(0, 0, 0, reopened.getParagraphLength(0, 0)), '원문 변경'); }
      finally { reopened.free(); }
    }
    assert.notEqual(JSON.parse(document.restoreSnapshot(undo)).ok, false); document.discardSnapshot(undo);
    assert.deepEqual(document.exportHwp(), beforeHwp); assert.deepEqual(document.exportHwpx(), beforeHwpx);
    document.insertText(0, 0, 2, ' 분기');
    const branch = input(document, 'native-branch');
    assert.throws(() => ledger.append(createVerifiedHistoryReceiptB134(before, branch, 'replace-text'), branch), /갈라진/);
  } finally { document.free(); }
});
