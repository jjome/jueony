import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {exportPasswordTransitionB128} from '../src/adapters/files/password-transition-b128.ts';

const enginePackage = process.env.JUEONY_ENGINE_PACKAGE
  ? resolve(process.env.JUEONY_ENGINE_PACKAGE)
  : fileURLToPath(new URL('../node_modules/@rhwp/core/', import.meta.url));
const {default: init, HwpDocument} = await import(pathToFileURL(`${enginePackage}/rhwp.js`).href);
await init({module_or_path: await readFile(`${enginePackage}/rhwp_bg.wasm`)});

const text = 'B128 암호 설정 변경 해제 검증 원문';
const blank = () => {
  const document = HwpDocument.createEmpty();
  document.createBlankDocument();
  document.insertText(0, 0, 0, text);
  return document;
};
const fingerprint = (document: any) => JSON.stringify({
  text: document.getTextFileUnicode(),
  sections: document.getSectionCount(),
  paragraphs: document.getParagraphCount(0),
  events: document.getEventLog?.() ?? '',
});
const dependencies = (document: any, identity = 'document:b128', revision = 'revision:1') => ({
  source: document,
  currentIdentity: () => identity,
  currentRevision: () => revision,
  sourceFingerprint: () => fingerprint(document),
  openPlain: (bytes: Uint8Array) => new HwpDocument(bytes),
  openWithPassword: (bytes: Uint8Array, password: string) => HwpDocument.openWithPassword(bytes, password),
});

for (const format of ['hwp', 'hwpx'] as const) test(`${format}: password set exports a verified encrypted copy without changing the source`, () => {
  const document = blank();
  try {
    const before = fingerprint(document);
    const result = exportPasswordTransitionB128(dependencies(document), {
      mode: 'set', format, currentProtected: false, nextPassword: 'B128-set-password',
      expectedIdentity: 'document:b128', expectedRevision: 'revision:1',
    });
    assert.equal(result.encrypted, true);
    assert.equal('password' in result, false);
    assert.equal(fingerprint(document), before);
    assert.throws(() => new HwpDocument(result.bytes));
    const reopened = HwpDocument.openWithPassword(result.bytes, 'B128-set-password');
    try { assert.match(reopened.getTextFileUnicode(), /B128 암호 설정 변경 해제 검증 원문/u); }
    finally { reopened.free(); }
  } finally { document.free(); }
});

for (const format of ['hwp', 'hwpx'] as const) test(`${format}: password change re-encrypts a verified copy with only the new password`, () => {
  const plain = blank();
  let source: any;
  try {
    const initial = format === 'hwp'
      ? plain.exportHwpWithPasswordAndReport('B128-old-password')
      : plain.exportHwpxWithPasswordAndReport('B128-old-password');
    let bytes: Uint8Array;
    try { bytes = initial.takeBytes(); }
    finally { initial.free(); }
    source = HwpDocument.openWithPassword(bytes!, 'B128-old-password');
    const result = exportPasswordTransitionB128(dependencies(source), {
      mode: 'change', format, currentProtected: true, nextPassword: 'B128-new-password',
      expectedIdentity: 'document:b128', expectedRevision: 'revision:1',
    });
    assert.throws(() => HwpDocument.openWithPassword(result.bytes, 'B128-old-password'));
    const reopened = HwpDocument.openWithPassword(result.bytes, 'B128-new-password');
    try { assert.match(reopened.getTextFileUnicode(), /B128 암호 설정 변경 해제 검증 원문/u); }
    finally { reopened.free(); }
  } finally { source?.free(); plain.free(); }
});

for (const format of ['hwp', 'hwpx'] as const) test(`${format}: password clear exports a verified plain copy`, () => {
  const plain = blank();
  let source: any;
  try {
    const initial = format === 'hwp'
      ? plain.exportHwpWithPasswordAndReport('B128-clear-password')
      : plain.exportHwpxWithPasswordAndReport('B128-clear-password');
    let bytes: Uint8Array;
    try { bytes = initial.takeBytes(); }
    finally { initial.free(); }
    source = HwpDocument.openWithPassword(bytes!, 'B128-clear-password');
    const result = exportPasswordTransitionB128(dependencies(source), {
      mode: 'clear', format, currentProtected: true,
      expectedIdentity: 'document:b128', expectedRevision: 'revision:1',
    });
    assert.equal(result.encrypted, false);
    const reopened = new HwpDocument(result.bytes);
    try { assert.match(reopened.getTextFileUnicode(), /B128 암호 설정 변경 해제 검증 원문/u); }
    finally { reopened.free(); }
  } finally { source?.free(); plain.free(); }
});

test('invalid transitions and stale identity/revision/fingerprint fail before bytes are returned', () => {
  let exports = 0;
  const artifact = {takeBytes: () => new Uint8Array([1]), contentLoss: () => ({}), free() {}};
  const source: any = {
    exportHwpWithReport() { exports++; return artifact; },
    exportHwpxWithReport() { exports++; return artifact; },
    exportHwpWithPasswordAndReport() { exports++; return artifact; },
    exportHwpxWithPasswordAndReport() { exports++; return artifact; },
  };
  const base = {
    source, currentIdentity: () => 'identity', currentRevision: () => 'revision',
    sourceFingerprint: () => 'fingerprint', openPlain: () => { throw new Error('unreachable'); },
    openWithPassword: () => { throw new Error('unreachable'); },
  };
  const request = {mode: 'set' as const, format: 'hwp' as const, currentProtected: false, nextPassword: 'valid-password', expectedIdentity: 'identity', expectedRevision: 'revision'};
  assert.throws(() => exportPasswordTransitionB128(base, {...request, currentProtected: true}));
  assert.throws(() => exportPasswordTransitionB128(base, {...request, nextPassword: ''}));
  assert.throws(() => exportPasswordTransitionB128(base, {...request, expectedIdentity: 'stale'}), /바뀌었습니다/u);
  assert.throws(() => exportPasswordTransitionB128(base, {...request, expectedRevision: 'stale'}), /바뀌었습니다/u);
  assert.equal(exports, 0);
});

test('drift immediately after export is rejected and the native artifact is freed', () => {
  let revision = 'revision:1', freed = 0;
  const source: any = {
    exportHwpWithPasswordAndReport() {
      revision = 'revision:2';
      return {takeBytes: () => new Uint8Array([1]), contentLoss: () => ({}), free: () => { freed++; }};
    },
  };
  assert.throws(() => exportPasswordTransitionB128({
    source, currentIdentity: () => 'identity', currentRevision: () => revision,
    sourceFingerprint: () => 'fingerprint', openPlain: () => { throw new Error('unreachable'); },
    openWithPassword: () => { throw new Error('unreachable'); },
  }, {
    mode: 'set', format: 'hwp', currentProtected: false, nextPassword: 'valid-password',
    expectedIdentity: 'identity', expectedRevision: 'revision:1',
  }), /바뀌었습니다/u);
  assert.equal(freed, 1);
});
