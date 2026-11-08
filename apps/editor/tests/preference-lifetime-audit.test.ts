import test from 'node:test';
import assert from 'node:assert/strict';
import { auditPreferenceLifetimes } from '../src/adapters/browser/preference-lifetime-audit.ts';
import { nonPersistentStateContracts, preferenceLifetimeContracts } from '../src/modules/preferences/domain/preference-lifetime.ts';
import { SETTINGS_BACKUP_KEYS } from '../src/modules/preferences/application/settings-backup.ts';
import { defaultDocumentDefaults } from '../src/modules/preferences/domain/document-defaults.ts';

const valid = () => new Map<string, string>([
  ['rhwp-settings', JSON.stringify({ version: 1, autosave: { recoveryEnabled: true, recoveryIntervalMinutes: 10, idleSaveEnabled: true, idleDelaySeconds: 10 } })],
  ['jueony-document-defaults', JSON.stringify(defaultDocumentDefaults())],
  ['jueony-editor-chrome-v1', JSON.stringify({ version: 1, stylePanelOpen: true, ribbonTab: 'edit' })],
  ['jueony-style-panel', 'true'],
  ['jueony-recent-fonts-v1', JSON.stringify({ version: 1, names: ['함초롬바탕'] })],
  ['jueony-calendar-format', JSON.stringify({ version: 1, format: 'date-dots' })],
  ['jueony-common-snippets', JSON.stringify({ version: 1, snippets: [{ name: '인사', text: '안녕하세요.' }] })],
  ['jueony-document-view-journal-v1', JSON.stringify({ version: 1, entries: [{ documentId: 'd1', workspaceId: 'w1', checkpointAt: 1, recordedAt: 2, view: { version: 1, zoom: 1, fitMode: 'none', scrollX: 0, scrollY: 0 } }] })],
]);
const storage = (values: Map<string, string>) => ({ getItem: (key: string) => values.get(key) ?? null });

test('lifetime contracts separate user, workspace-document, document/section and temporary ownership', () => {
  assert.equal(new Set(preferenceLifetimeContracts.map(value => value.key)).size, preferenceLifetimeContracts.length);
  assert.ok(preferenceLifetimeContracts.every(value => value.survivesRestart && !value.documentDirty && !value.documentUndo));
  assert.deepEqual(nonPersistentStateContracts.find(value => value.id === 'document-section-state'), { id: 'document-section-state', scope: ['document', 'section'], owner: 'hwp-hwpx', documentDirty: true, documentUndo: true, reset: 'document-close' });
  assert.deepEqual(nonPersistentStateContracts.find(value => value.id === 'dialog-draft'), { id: 'dialog-draft', scope: ['temporary'], owner: 'memory', documentDirty: false, documentUndo: false, reset: 'dialog-close' });
  const backup = preferenceLifetimeContracts.filter(value => value.backup === 'included' || value.backup === 'projection-only').map(value => value.key);
  assert.deepEqual(new Set(backup), new Set(SETTINGS_BACKUP_KEYS));
});

test('all current records pass a read-only restart audit without changing storage', () => {
  const values = valid(), before = structuredClone([...values]);
  const results = auditPreferenceLifetimes(storage(values));
  assert.equal(results.length, preferenceLifetimeContracts.length);
  assert.ok(results.every(value => value.status === 'valid'), JSON.stringify(results));
  assert.deepEqual([...values], before);
});

test('missing, corrupt and future settings are distinguished and never rewritten', () => {
  const empty = auditPreferenceLifetimes(storage(new Map())); assert.ok(empty.every(value => value.status === 'missing'));
  for (const contract of preferenceLifetimeContracts) {
    const values = valid(), original = contract.version === 'unversioned' ? 'broken' : JSON.stringify({ version: 2 });
    values.set(contract.key, original);
    const result = auditPreferenceLifetimes(storage(values)).find(value => value.contract.key === contract.key)!;
    assert.equal(result.status, contract.version === 'unversioned' ? 'corrupt' : 'unsupported-version', contract.key);
    assert.equal(values.get(contract.key), original);
  }
  const broken = valid(); broken.set('jueony-common-snippets', '{');
  assert.equal(auditPreferenceLifetimes(storage(broken)).find(value => value.contract.id === 'snippets')!.status, 'corrupt');
  assert.equal(broken.get('jueony-common-snippets'), '{');
});

test('one blocked key reports read error without hiding the remaining settings', () => {
  const values = valid(), results = auditPreferenceLifetimes({ getItem(key) { if (key === 'jueony-calendar-format') throw new Error('blocked'); return values.get(key) ?? null; } });
  assert.equal(results.find(value => value.contract.id === 'calendar-format')!.status, 'read-error');
  assert.ok(results.filter(value => value.contract.id !== 'calendar-format').every(value => value.status === 'valid'));
});
