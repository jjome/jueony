import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { captureFileConnection, restoreFileConnection } from '../src/file-connection.ts';
import { rememberFileSnapshot, rememberedFileFingerprint, writeSnapshot } from '../src/save-guard.ts';

function fixture(content = '디스크에 저장한 본문') {
  let disk = new Blob([content]);
  const calls = { query: 0, request: 0, read: 0, write: 0 };
  const handle = {
    kind: 'file' as const, name: '계획서.hwp',
    queryPermission: async (_: { mode: 'readwrite' }) => { calls.query++; return 'granted' as 'granted' | 'prompt' | 'denied'; },
    requestPermission: async (_: { mode: 'readwrite' }) => { calls.request++; return 'granted' as 'granted' | 'prompt' | 'denied'; },
    getFile: async () => { calls.read++; return disk; },
    createWritable: async () => {
      let pending: Blob;
      return { write: async (data: Blob) => { calls.write++; pending = data; }, close: async () => { disk = pending; }, abort: async () => {} };
    },
  };
  return { handle, calls, setDisk: (value: string) => { disk = new Blob([value]); }, disk: () => disk };
}
async function connection(f: ReturnType<typeof fixture>) {
  await rememberFileSnapshot(f.handle, new Uint8Array(await f.disk().arrayBuffer()));
  return { handle: f.handle, fingerprint: rememberedFileFingerprint(f.handle)! };
}
function saveDOM() {
  const root = { inert: false };
  Object.assign(globalThis, {
    window: { jueonyEditor: { revision: () => '7:4' } },
    document: { getElementById: () => root, createElement: () => ({ setAttribute() {}, remove() {} }), body: { append() {} } },
  });
  return root;
}

test('파일 handle과 마지막 디스크 fingerprint를 함께 캡처하고 복구 bytes를 쓰지 않는다', async () => {
  const f = fixture(), disk = await connection(f);
  const clone = { ...f.handle };
  const cloneCall = mock.method(globalThis, 'structuredClone', () => clone);
  try {
    const saved = captureFileConnection(f.handle)!;
    assert.equal(saved.handle, clone);
    assert.equal(saved.fingerprint, disk.fingerprint);
    assert.equal(captureFileConnection(null), undefined);
    assert.equal(captureFileConnection(fixture().handle), undefined);
  } finally { cloneCall.mock.restore(); }
});

test('네이티브 emulation handle의 함수는 캡처하지 않아 IndexedDB 전체 저장 실패를 막는다', async () => {
  const f = fixture(); await connection(f);
  assert.equal(captureFileConnection(f.handle), undefined);
});

test('자동 복원은 권한 조회만 하고 prompt이면 파일도 읽지 않는다', async () => {
  const f = fixture(), saved = await connection(f);
  f.handle.queryPermission = async () => { f.calls.query++; return 'prompt'; };
  const result = await restoreFileConnection(saved);
  assert.equal(result.status, 'permission-required');
  assert.deepEqual(f.calls, { query: 1, request: 0, read: 0, write: 0 });
});

test('명시적 재연결에서만 권한을 요청하고 원본을 검증한다', async () => {
  const f = fixture(), saved = await connection(f);
  f.handle.queryPermission = async () => { f.calls.query++; return 'prompt'; };
  const result = await restoreFileConnection(saved, { requestPermission: true });
  assert.equal(result.status, 'connected');
  assert.deepEqual(f.calls, { query: 1, request: 1, read: 1, write: 0 });
});

test('권한 거부나 취소에서 파일을 읽거나 쓰지 않는다', async () => {
  const f = fixture(), saved = await connection(f);
  f.handle.queryPermission = async () => 'denied';
  f.handle.requestPermission = async () => { throw new DOMException('cancelled', 'AbortError'); };
  assert.equal((await restoreFileConnection(saved, { requestPermission: true })).status, 'permission-required');
  assert.equal(f.calls.read, 0); assert.equal(f.calls.write, 0);
});

test('이전 디스크와 다른 dirty 복구 문서도 원본 기준으로 연결하고 저장할 수 있다', async () => {
  const f = fixture(), saved = await connection(f);
  // Reload yields a new browser-handle object; the old WeakMap entry is absent.
  const restoredHandle = { ...f.handle };
  assert.equal(rememberedFileFingerprint(restoredHandle), undefined);
  assert.equal((await restoreFileConnection({ ...saved, handle: restoredHandle })).status, 'connected');
  const root = saveDOM();
  await writeSnapshot(restoredHandle, Object.assign(new Blob(['미저장 복구 본문']), { jueonyRevision: '7:4' }));
  assert.equal(await f.disk().text(), '미저장 복구 본문');
  assert.notEqual(rememberedFileFingerprint(restoredHandle), saved.fingerprint);
  assert.equal(root.inert, false);
});

test('재시작 중 외부 수정이 있으면 권한이 있어도 연결하지 않고 기존 fingerprint를 유지한다', async () => {
  const f = fixture(), saved = await connection(f);
  f.setDisk('다른 앱에서 변경');
  const restoredHandle = { ...f.handle };
  assert.equal((await restoreFileConnection({ ...saved, handle: restoredHandle })).status, 'changed');
  assert.equal(rememberedFileFingerprint(restoredHandle), undefined);
  assert.equal(f.calls.write, 0); assert.equal(await f.disk().text(), '다른 앱에서 변경');
});

test('연결 후 다시 외부 수정이 발생해도 기존 저장 가드가 덮어쓰기를 거부한다', async () => {
  const f = fixture(), saved = await connection(f), restoredHandle = { ...f.handle };
  assert.equal((await restoreFileConnection({ ...saved, handle: restoredHandle })).status, 'connected');
  f.setDisk('연결 후 외부 수정'); saveDOM();
  await assert.rejects(writeSnapshot(restoredHandle, Object.assign(new Blob(['복구 본문']), { jueonyRevision: '7:4' })), /원본 파일을 변경/);
  assert.equal(f.calls.write, 0); assert.equal(await f.disk().text(), '연결 후 외부 수정');
});

test('파일 이동·삭제 및 손상된 연결 메타데이터를 복구 문서 실패로 전파하지 않는다', async () => {
  const f = fixture(), saved = await connection(f);
  f.handle.getFile = async () => { throw new DOMException('missing', 'NotFoundError'); };
  assert.equal((await restoreFileConnection(saved)).status, 'unavailable');
  assert.equal((await restoreFileConnection({ ...saved, fingerprint: 'invalid' })).status, 'unavailable');
  assert.equal((await restoreFileConnection(null as any)).status, 'unavailable');
});

test('다른 이름/형식으로 저장한 새 handle은 자기 디스크 기준을 사용한다', async () => {
  const old = fixture(), savedOld = await connection(old);
  const next = fixture('변환한 HWPX 문서'); next.handle.name = '계획서.hwpx';
  const savedNext = await connection(next);
  assert.notEqual(savedNext.fingerprint, savedOld.fingerprint);
  assert.equal((await restoreFileConnection({ ...savedNext, handle: { ...next.handle } })).status, 'connected');
  assert.equal((await restoreFileConnection({ ...savedOld, handle: { ...next.handle } })).status, 'changed');
  assert.equal(await old.disk().text(), '디스크에 저장한 본문');
});