import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import init, {HwpDocument} from '@rhwp/core';
import {
  KEYBOARD_PROFILE_KEY_B148,
  KeyboardProfileErrorB148,
  createKeyboardProfileControllerB148,
} from '../src/adapters/browser/keyboard-profile-b148.ts';

await init({module_or_path: await readFile(new URL('../node_modules/@rhwp/core/rhwp_bg.wasm', import.meta.url))});

class MemoryStorage {
  values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

function fixture(storage = new MemoryStorage()) {
  let current: unknown = {identity: 'document-b148', instance: 'instance-b148', active: true, composing: false};
  const projected: unknown[] = [];
  const controller = createKeyboardProfileControllerB148({storage, readOwner: () => current,
    project: value => projected.push(value)});
  return {controller, storage, projected, setOwner: (value: unknown) => { current = value; }};
}

test('B148 stores one bounded user-global app keyboard profile and reopens it', () => {
  const first = fixture();
  assert.equal(first.controller.snapshot().preference.profile, 'system-ime');
  assert.deepEqual(first.controller.snapshot().profiles,
    ['system-ime', 'two-set-korean', 'three-set-390', 'roman']);
  first.controller.select('three-set-390');
  assert.equal(first.storage.getItem(KEYBOARD_PROFILE_KEY_B148),
    '{"version":1,"scope":"user-global","profile":"three-set-390"}');
  const second = fixture(first.storage);
  assert.equal(second.controller.snapshot().preference.profile, 'three-set-390');
  second.controller.select('roman');
  assert.equal(second.controller.snapshot().preference.profile, 'roman');
});

test('B148 rejects corrupt, oversized, secret-shaped and unsupported stored preferences', () => {
  const storage = new MemoryStorage();
  for (const raw of [
    'not-json',
    '{"version":2,"scope":"user-global","profile":"system-ime"}',
    '{"version":1,"scope":"workspace","profile":"system-ime"}',
    '{"version":1,"scope":"user-global","profile":"custom"}',
    '{"version":1,"scope":"user-global","profile":"system-ime","apiKey":"secret"}',
    'x'.repeat(513),
  ]) {
    storage.setItem(KEYBOARD_PROFILE_KEY_B148, raw);
    assert.throws(() => fixture(storage), KeyboardProfileErrorB148);
  }
  const value = fixture(new MemoryStorage());
  assert.throws(() => value.controller.select('custom' as never), KeyboardProfileErrorB148);
});

test('B148 fails closed for composition, inactive/replaced documents, storage errors and disposed sessions', () => {
  const value = fixture();
  value.setOwner({identity: 'document-b148', instance: 'instance-b148', active: true, composing: true});
  assert.throws(() => value.controller.select('two-set-korean'), (error: unknown) =>
    error instanceof KeyboardProfileErrorB148 && error.code === 'composition-active');
  value.setOwner({identity: 'document-b148', instance: 'instance-b148', active: false, composing: false});
  assert.throws(() => value.controller.snapshot(), (error: unknown) =>
    error instanceof KeyboardProfileErrorB148 && error.code === 'inactive-document');
  value.setOwner({identity: 'document-other', instance: 'instance-other', active: true, composing: false});
  assert.throws(() => value.controller.snapshot(), (error: unknown) =>
    error instanceof KeyboardProfileErrorB148 && error.code === 'stale-document');

  const failing = createKeyboardProfileControllerB148({
    storage: {getItem: () => null, setItem: () => { throw new Error('quota'); }},
    readOwner: () => ({identity: 'document-b148', instance: 'instance-b148', active: true, composing: false}),
    project() {},
  });
  assert.throws(() => failing.select('two-set-korean'), (error: unknown) =>
    error instanceof KeyboardProfileErrorB148 && error.code === 'write-failed');
  assert.equal(failing.snapshot().preference.profile, 'system-ime');
  failing.dispose();
  assert.throws(() => failing.snapshot(), (error: unknown) =>
    error instanceof KeyboardProfileErrorB148 && error.code === 'disposed');
});

test('B148 app preference never changes real HWP/HWPX bytes or an existing undo snapshot', () => {
  const document = HwpDocument.createEmpty(); document.createBlankDocument();
  document.insertText(0, 0, 0, '글자판 프로필은 문서 내용이 아닙니다.');
  try {
    const beforeHwp = document.exportHwp(), beforeHwpx = document.exportHwpx(), undo = document.saveSnapshot();
    const value = fixture();
    value.controller.select('two-set-korean'); value.controller.select('three-set-390');
    assert.deepEqual(document.exportHwp(), beforeHwp); assert.deepEqual(document.exportHwpx(), beforeHwpx);
    assert.notEqual(JSON.parse(document.restoreSnapshot(undo)).ok, false); document.discardSnapshot(undo);
    assert.deepEqual(document.exportHwp(), beforeHwp); assert.deepEqual(document.exportHwpx(), beforeHwpx);
    for (const bytes of [beforeHwp, beforeHwpx]) {
      const reopened = new HwpDocument(bytes);
      try {
        assert.equal(reopened.getTextRange(0, 0, 0, reopened.getParagraphLength(0, 0)),
          '글자판 프로필은 문서 내용이 아닙니다.');
      } finally { reopened.free(); }
    }
  } finally { document.free(); }
});
