import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import init, {HwpDocument} from '@rhwp/core';
import {
  OFFLINE_TOOL_PANE_KEY_B060,
  OfflineToolPaneErrorB060,
  createOfflineToolPaneControllerB060,
} from '../src/adapters/browser/offline-tool-pane-b060.ts';

await init({module_or_path: await readFile(new URL('../node_modules/@rhwp/core/rhwp_bg.wasm', import.meta.url))});

const tools = [
  {kind: 'translation', id: 'offline.translate.v1', label: '오프라인 번역', version: '1', offline: true},
  {kind: 'dictionary', id: 'offline.dictionary.v1', label: '오프라인 사전', version: '1', offline: true},
  {kind: 'script-macro', id: 'local.macro.v1', label: '스크립트 매크로', version: '1', offline: true},
] as const;

class MemoryStorage {
  values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

function fixture(storage = new MemoryStorage()) {
  let owner: any = {identity: 'document-1', instance: 'instance-1', revision: 'revision-1', active: true};
  const projected: unknown[] = [];
  const controller = createOfflineToolPaneControllerB060({capabilities: tools, storage,
    readOwner: () => owner, project: value => projected.push(value)});
  return {controller, storage, projected, setOwner: (value: unknown) => { owner = value; }};
}

test('B060 registers only offline tools and persists close, reopen and selected tab', () => {
  const first = fixture();
  assert.deepEqual(first.controller.snapshot().tools.map(value => value.kind), ['dictionary', 'translation', 'script-macro']);
  first.controller.open('translation');
  assert.equal(first.controller.snapshot().open, true);
  assert.equal(first.controller.snapshot().activeTool, 'translation');
  first.controller.select('dictionary');
  first.controller.close();
  assert.equal(first.storage.getItem(OFFLINE_TOOL_PANE_KEY_B060),
    '{"version":1,"open":false,"activeTool":"dictionary"}');
  const second = fixture(first.storage);
  assert.equal(second.controller.snapshot().activeTool, 'dictionary');
  second.controller.open();
  assert.equal(second.controller.snapshot().open, true);
});

test('B060 rejects online, secret-shaped, duplicated and corrupt registrations or preferences', () => {
  const owner = () => ({identity: 'document-1', instance: 'instance-1', revision: 'revision-1', active: true});
  const storage = new MemoryStorage();
  const make = (capabilities: readonly unknown[]) => createOfflineToolPaneControllerB060({capabilities, storage,
    readOwner: owner, project() {}});
  for (const invalid of [
    [],
    [{...tools[0], offline: false}],
    [{...tools[0], apiKey: 'secret'}],
    [tools[0], {...tools[0], id: 'other'}],
    [{...tools[0], kind: 'ai-chat'}],
    [{...tools[0], label: 'bad\nlabel'}],
  ]) assert.throws(() => make(invalid), OfflineToolPaneErrorB060);
  for (const raw of ['not-json', '{"version":2,"open":false,"activeTool":"dictionary"}',
    '{"version":1,"open":false,"activeTool":"ai-chat"}',
    '{"version":1,"open":false,"activeTool":"dictionary","apiKey":"secret"}', 'x'.repeat(1025)]) {
    storage.setItem(OFFLINE_TOOL_PANE_KEY_B060, raw);
    assert.throws(() => make([tools[0], tools[1]]), OfflineToolPaneErrorB060);
  }
});

test('B060 fails closed on inactive, replaced or revised document ownership and storage failure', () => {
  const value = fixture();
  value.setOwner({identity: 'document-1', instance: 'instance-1', revision: 'revision-2', active: true});
  assert.throws(() => value.controller.open(), (error: unknown) =>
    error instanceof OfflineToolPaneErrorB060 && error.code === 'stale-document');
  value.setOwner({identity: 'document-1', instance: 'instance-1', revision: 'revision-1', active: false});
  assert.throws(() => value.controller.snapshot(), (error: unknown) =>
    error instanceof OfflineToolPaneErrorB060 && error.code === 'inactive-document');
  const failing = createOfflineToolPaneControllerB060({capabilities: tools, readOwner: () =>
    ({identity: 'document-1', instance: 'instance-1', revision: 'revision-1', active: true}),
  storage: {getItem: () => null, setItem: () => { throw new Error('quota'); }}, project() {}});
  assert.throws(() => failing.open('dictionary'), (error: unknown) =>
    error instanceof OfflineToolPaneErrorB060 && error.code === 'write');
  assert.equal(failing.snapshot().open, false);
  failing.dispose();
  assert.throws(() => failing.snapshot(), /이미 끝난/);
});

test('B060 pane state never changes real HWP/HWPX bytes or an existing undo snapshot', () => {
  const document = HwpDocument.createEmpty(); document.createBlankDocument();
  document.insertText(0, 0, 0, '작업 창 상태는 문서 내용이 아닙니다.');
  try {
    const beforeHwp = document.exportHwp(), beforeHwpx = document.exportHwpx(), undo = document.saveSnapshot();
    const value = fixture();
    value.controller.open('dictionary'); value.controller.select('translation'); value.controller.close();
    assert.deepEqual(document.exportHwp(), beforeHwp); assert.deepEqual(document.exportHwpx(), beforeHwpx);
    assert.notEqual(JSON.parse(document.restoreSnapshot(undo)).ok, false); document.discardSnapshot(undo);
    assert.deepEqual(document.exportHwp(), beforeHwp); assert.deepEqual(document.exportHwpx(), beforeHwpx);
    for (const bytes of [beforeHwp, beforeHwpx]) {
      const reopened = new HwpDocument(bytes);
      try { assert.equal(reopened.getTextRange(0, 0, 0, reopened.getParagraphLength(0, 0)), '작업 창 상태는 문서 내용이 아닙니다.'); }
      finally { reopened.free(); }
    }
  } finally { document.free(); }
});
