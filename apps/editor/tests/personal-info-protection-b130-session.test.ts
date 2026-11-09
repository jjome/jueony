import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import init, {HwpDocument} from '../node_modules/@rhwp/core/rhwp.js';
import {
  PersonalInfoProtectionSessionB130,
  type PersonalInfoProtectionContextB130,
} from '../src/adapters/rhwp/personal-info-protection-b130-session.ts';

await init({module_or_path: await readFile(new URL('../node_modules/@rhwp/core/rhwp_bg.wasm', import.meta.url))});
const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const text = (document: HwpDocument) => document.getTextRange(0, 0, 0, document.getParagraphLength(0, 0));

function fixture(source = '연락 010-1234-5678 / user@example.go.kr') {
  const document = HwpDocument.createEmpty(); document.createBlankDocument(); document.insertText(0, 0, 0, source);
  let identity = 'document-b130', instance = 'instance-b130', revisionOverride: string | undefined;
  let protectedDocument = false;
  const context: PersonalInfoProtectionContextB130 = {
    documentIdentity: () => identity,
    documentInstance: () => instance,
    revision: () => revisionOverride ?? sha(document.exportHwp()),
    story: () => 'body', editable: () => true, protected: () => protectedDocument,
    selection: () => ({sectionIndex: 0, paragraphIndex: 0, startOffset: 0, endOffset: Array.from(text(document)).length}),
  };
  return {document, context, setIdentity(value: string) { identity = value; },
    setInstance(value: string) { instance = value; }, setRevision(value?: string) { revisionOverride = value; },
    setProtected(value: boolean) { protectedDocument = value; }};
}

test('B130 exposes metadata-only receipt and exact same-session HWP/HWPX undo and redo', () => {
  const f = fixture();
  try {
    const beforeHwp = f.document.exportHwp(), beforeHwpx = f.document.exportHwpx();
    const session = new PersonalInfoProtectionSessionB130(f.document, f.context);
    const protectedResult = session.protect(['phone', 'email']);
    assert.equal(protectedResult.status, 'protected'); if (protectedResult.status !== 'protected') return;
    const receipt = protectedResult.receipt;
    const serialized = JSON.stringify(receipt);
    assert.equal(serialized.includes('010-1234-5678'), false);
    assert.equal(serialized.includes('user@example.go.kr'), false);
    assert.deepEqual(Object.keys(receipt).sort(), [
      'after', 'afterRevision', 'before', 'beforeRevision', 'documentIdentity', 'documentInstance', 'range', 'version',
    ]);
    const afterHwp = f.document.exportHwp(), afterHwpx = f.document.exportHwpx();
    assert.equal(text(f.document), '연락 ***-****-5678 / ****@example.go.kr');
    assert.equal(receipt.before.hwpSha256, sha(beforeHwp)); assert.equal(receipt.before.hwpxSha256, sha(beforeHwpx));
    assert.equal(receipt.after.hwpSha256, sha(afterHwp)); assert.equal(receipt.after.hwpxSha256, sha(afterHwpx));
    for (const bytes of [afterHwp, afterHwpx]) {
      const reopened = new HwpDocument(bytes); try { assert.equal(text(reopened), text(f.document)); } finally { reopened.free(); }
    }
    assert.equal(session.unprotect(receipt).status, 'unprotected');
    assert.deepEqual(f.document.exportHwp(), beforeHwp); assert.deepEqual(f.document.exportHwpx(), beforeHwpx);
    for (const bytes of [beforeHwp, beforeHwpx]) {
      const reopened = new HwpDocument(bytes); try { assert.equal(text(reopened), '연락 010-1234-5678 / user@example.go.kr'); } finally { reopened.free(); }
    }
    assert.equal(session.reprotect(receipt).status, 'reprotected');
    assert.deepEqual(f.document.exportHwp(), afterHwp); assert.deepEqual(f.document.exportHwpx(), afterHwpx);
    session.dispose();
    assert.deepEqual(f.document.exportHwp(), afterHwp);
  } finally { f.document.free(); }
});

test('B130 rejects cloned receipts, another session, restart-equivalent disposal and stale documents', () => {
  for (const stale of ['clone', 'session', 'identity', 'instance', 'revision', 'protected', 'dispose'] as const) {
    const f = fixture();
    try {
      const session = new PersonalInfoProtectionSessionB130(f.document, f.context);
      const result = session.protect(['phone']);
      assert.equal(result.status, 'protected'); if (result.status !== 'protected') continue;
      let active = session;
      let receipt = result.receipt;
      if (stale === 'clone') receipt = structuredClone(receipt);
      if (stale === 'session') active = new PersonalInfoProtectionSessionB130(f.document, f.context);
      if (stale === 'identity') f.setIdentity('other-document');
      if (stale === 'instance') f.setInstance('other-instance');
      if (stale === 'revision') f.setRevision('stale-revision');
      if (stale === 'protected') f.setProtected(true);
      if (stale === 'dispose') session.dispose();
      const transition = active.unprotect(receipt);
      assert.equal(transition.status, 'blocked', stale);
      if (stale !== 'dispose') session.dispose();
      if (active !== session) active.dispose();
    } finally { f.document.free(); }
  }
});

test('B130 rolls back rejected writes and does not leak source through a blocked result', () => {
  const f = fixture();
  try {
    const beforeHwp = f.document.exportHwp(), beforeHwpx = f.document.exportHwpx();
    const host = new Proxy(f.document, {get(target, key) {
      if (key === 'replaceText') return () => '{"ok":false}';
      const value = Reflect.get(target, key, target);
      return typeof value === 'function' ? value.bind(target) : value;
    }});
    const session = new PersonalInfoProtectionSessionB130(host, f.context);
    const result = session.protect(['phone']);
    assert.deepEqual(result, {status: 'blocked', reason: 'mutation-rejected'});
    assert.equal(JSON.stringify(result).includes('010-1234-5678'), false);
    assert.deepEqual(f.document.exportHwp(), beforeHwp); assert.deepEqual(f.document.exportHwpx(), beforeHwpx);
    session.dispose();
  } finally { f.document.free(); }
});
