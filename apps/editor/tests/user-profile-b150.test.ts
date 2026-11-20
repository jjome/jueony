import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  UserProfileErrorB150,
  captureUserProfileB150,
  exportUserProfileB150,
  importUserProfileB150,
  mergeUserProfilesB150,
  normalizeUserShortcutB150,
  type UserProfileB150,
} from '../src/modules/preferences/application/user-profile-b150.ts';
import {
  UserProfileRepositoryErrorB150,
  createAtomicUserProfileRepositoryB150,
  type AtomicProfileRecordStoreB150,
} from '../src/adapters/browser/atomic-user-profile-repository-b150.ts';

const allowed = new Set(['file:save', 'edit:bold', 'view:ruler', 'insert:table', 'format:align-left']);
const policy = { commandAllowlist: allowed };
const profile = (overrides: Partial<UserProfileB150> = {}): UserProfileB150 => ({
  format: 'jueony-user-profile', version: 1, scope: 'user', profileId: 'default', revision: 2,
  menu: [{ commandId: 'file:save', visible: true, order: 0 }],
  toolbar: [{ commandId: 'edit:bold', visible: false, order: 0 }],
  keymap: [{ commandId: 'edit:bold', shortcut: 'Ctrl+Alt+B' }],
  ...overrides,
});

test('B150 portable v1 is a closed, deterministic projection without secrets, paths, or document data', () => {
  const text = exportUserProfileB150(profile(), policy);
  assert.deepEqual(importUserProfileB150(text, policy), profile());
  assert.equal(exportUserProfileB150(JSON.parse(text), policy), text);
  for (const forbidden of ['apiKey', 'path', 'document']) {
    const value = { ...profile(), [forbidden]: 'must-not-survive' };
    assert.throws(() => captureUserProfileB150(value, policy), (error: unknown) => error instanceof UserProfileErrorB150 && error.code === 'malformed');
  }
  assert.throws(() => captureUserProfileB150({ ...profile(), profileId: '../private' }, policy), UserProfileErrorB150);
});

test('B150 import fails closed for malformed, future, oversized, and non-allowlisted profiles', () => {
  assert.throws(() => importUserProfileB150('{', policy), (error: unknown) => error instanceof UserProfileErrorB150 && error.code === 'malformed');
  assert.throws(() => importUserProfileB150(JSON.stringify({ ...profile(), version: 2 }), policy), (error: unknown) => error instanceof UserProfileErrorB150 && error.code === 'version');
  assert.throws(() => importUserProfileB150(' '.repeat(128 * 1024 + 1), policy), (error: unknown) => error instanceof UserProfileErrorB150 && error.code === 'oversize');
  assert.throws(() => captureUserProfileB150({ ...profile(), menu: [{ commandId: 'shell:execute', visible: true, order: 0 }] }, policy), (error: unknown) => error instanceof UserProfileErrorB150 && error.code === 'command');
});

test('B150 normalizes shortcuts and rejects collisions plus reserved OS/Hancom keys', () => {
  assert.equal(normalizeUserShortcutB150('shift+ctrl+alt+b'), 'Ctrl+Alt+Shift+B');
  for (const shortcut of ['Alt+F4', 'ctrl+alt+delete', 'Ctrl+S', 'Ctrl+1']) {
    assert.throws(() => normalizeUserShortcutB150(shortcut), (error: unknown) => error instanceof UserProfileErrorB150 && error.code === 'reserved-shortcut');
  }
  assert.throws(() => captureUserProfileB150({ ...profile(), keymap: [
    { commandId: 'edit:bold', shortcut: 'Ctrl+Alt+B' },
    { commandId: 'view:ruler', shortcut: 'alt+ctrl+b' },
  ] }, policy), (error: unknown) => error instanceof UserProfileErrorB150 && error.code === 'shortcut-conflict');
});

test('B150 merge is add-only: current command settings win and imported settings only fill gaps', () => {
  const current = profile();
  const incoming = profile({
    revision: 91,
    menu: [
      { commandId: 'file:save', visible: false, order: 0 },
      { commandId: 'insert:table', visible: false, order: 1 },
    ],
    toolbar: [
      { commandId: 'edit:bold', visible: true, order: 0 },
      { commandId: 'view:ruler', visible: true, order: 1 },
    ],
    keymap: [
      { commandId: 'edit:bold', shortcut: 'Ctrl+Alt+X' },
      { commandId: 'view:ruler', shortcut: 'Ctrl+Alt+R' },
    ],
  });
  const merged = mergeUserProfilesB150(current, incoming, policy);
  assert.deepEqual(merged.menu, [
    { commandId: 'file:save', visible: true, order: 0 },
    { commandId: 'insert:table', visible: false, order: 1 },
  ]);
  assert.deepEqual(merged.toolbar, [
    { commandId: 'edit:bold', visible: false, order: 0 },
    { commandId: 'view:ruler', visible: true, order: 1 },
  ]);
  assert.deepEqual(merged.keymap, [
    { commandId: 'edit:bold', shortcut: 'Ctrl+Alt+B' },
    { commandId: 'view:ruler', shortcut: 'Ctrl+Alt+R' },
  ]);
  assert.equal(merged.revision, current.revision);
  assert.throws(() => mergeUserProfilesB150(current, profile({ keymap: [{ commandId: 'view:ruler', shortcut: 'Ctrl+Alt+B' }] }), policy), UserProfileErrorB150);
});

class MemoryCasStore implements AtomicProfileRecordStoreB150 {
  value: string | null = null;
  failRollback = false;
  async read(): Promise<string | null> { return this.value; }
  async compareAndSwap(_key: string, expected: string | null, next: string | null): Promise<boolean> {
    if (this.value !== expected) return false;
    if (this.failRollback && next === null) return false;
    this.value = next; return true;
  }
}

test('B150 repository performs revision CAS and never changes data after stale import', async () => {
  const store = new MemoryCasStore();
  const repository = createAtomicUserProfileRepositoryB150({ store, policy });
  const portableJson = exportUserProfileB150(profile({ revision: 0 }), policy);
  const saved = await repository.mergeImport({ scope: 'user', profileId: 'default', expectedRevision: 0, portableJson });
  assert.equal(saved.revision, 1);
  const before = store.value;
  await assert.rejects(
    repository.mergeImport({ scope: 'user', profileId: 'default', expectedRevision: 0, portableJson }),
    (error: unknown) => error instanceof UserProfileRepositoryErrorB150 && error.code === 'stale',
  );
  assert.equal(store.value, before);
  assert.deepEqual(await repository.read('user', 'default'), saved);
});

test('B150 repository rolls back its own atomic write when verification fails', async () => {
  const store = new MemoryCasStore();
  const repository = createAtomicUserProfileRepositoryB150({ store, policy, verifyWrite: () => { throw new Error('injected'); } });
  const portableJson = exportUserProfileB150(profile({ revision: 0 }), policy);
  await assert.rejects(
    repository.mergeImport({ scope: 'user', profileId: 'default', expectedRevision: 0, portableJson }),
    (error: unknown) => error instanceof UserProfileRepositoryErrorB150 && error.code === 'verification',
  );
  assert.equal(store.value, null);
  store.failRollback = true;
  await assert.rejects(
    repository.mergeImport({ scope: 'user', profileId: 'default', expectedRevision: 0, portableJson }),
    (error: unknown) => error instanceof UserProfileRepositoryErrorB150 && error.code === 'rollback-failed',
  );
});
