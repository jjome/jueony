import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertSaveRevision, writeSnapshot, rememberFileSnapshot } from '../src/save-guard.ts';

test('저장 대기 중 문서 교체나 수정이 발생하면 거절한다', () => {
  assert.doesNotThrow(() => assertSaveRevision('1:8', '1:8'));
  assert.throws(() => assertSaveRevision('1:8', '1:9'));
  assert.throws(() => assertSaveRevision('1:8', '2:8'));
  assert.throws(() => assertSaveRevision(undefined, '1:8'));
});

test('외부 프로그램이 원본을 바꾸면 덮어쓰기를 시작하지 않는다', async () => {
  let disk = new Blob(['원본']);
  let writes = 0;
  const handle = {
    getFile: async () => disk,
    createWritable: async () => {
      writes++;
      return { write: async () => {}, close: async () => {} };
    },
  };
  await rememberFileSnapshot(handle, new Uint8Array(await disk.arrayBuffer()));
  disk = new Blob(['외부 수정']);
  const root = { inert: false };
  Object.assign(globalThis, {
    window: { jueonyEditor: { revision: () => '1:8' } },
    document: {
      getElementById: () => root,
      createElement: () => ({ setAttribute() {}, remove() {} }),
      body: { append() {} },
    },
  });
  await assert.rejects(writeSnapshot(handle, Object.assign(new Blob(['내 편집']), { jueonyRevision: '1:8' })), /원본 파일을 변경/);
  assert.equal(writes, 0);
  assert.equal(await disk.text(), '외부 수정');
  assert.equal(root.inert, false);
});

test('쓰기 실패와 저장 중 수정 시 close하지 않고 abort하며 입력 잠금을 복원한다', async () => {
  let revision = '1:8';
  const root = { inert: false };
  let overlays = 0;
  Object.assign(globalThis, {
    window: { jueonyEditor: { revision: () => revision } },
    document: {
      getElementById: () => root,
      createElement: () => ({ setAttribute() {}, remove() { overlays--; } }),
      body: { append() { overlays++; } },
    },
  });
  const blob = Object.assign(new Blob(['본문']), { jueonyRevision: '1:8' });
  const calls: string[] = [];
  const handle = { createWritable: async () => ({
    write: async () => { calls.push('write'); revision = '1:9'; },
    close: async () => { calls.push('close'); },
    abort: async () => { calls.push('abort'); },
  }) };
  await assert.rejects(writeSnapshot(handle, blob));
  assert.deepEqual(calls, ['write', 'abort']);
  assert.equal(root.inert, false);
  assert.equal(overlays, 0);
  // 실패 후 다음 저장을 막는 전역 잠금이 남으면 안 된다.
  revision = '1:8';
  calls.length = 0;
  const succeeding = { createWritable: async () => ({
    write: async () => { calls.push('write'); assert.equal(root.inert, true); },
    close: async () => { calls.push('close'); },
    abort: async () => { calls.push('abort'); },
  }) };
  await writeSnapshot(succeeding, blob);
  assert.deepEqual(calls, ['write', 'close']);
  assert.equal(root.inert, false);
  assert.equal(overlays, 0);
  calls.length = 0;
  const failing = { createWritable: async () => ({
    write: async () => { calls.push('write'); throw new Error('disk full'); },
    close: async () => { calls.push('close'); },
    abort: async () => { calls.push('abort'); },
  }) };
  await assert.rejects(writeSnapshot(failing, blob), /disk full/);
  assert.deepEqual(calls, ['write', 'abort']);
  assert.equal(root.inert, false);
});
