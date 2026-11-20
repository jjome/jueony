import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertPreferenceStartupContractN017,
  diagnosePreferenceStartupN017,
  PreferenceStartupContractErrorN017,
} from '../src/adapters/browser/preference-startup-diagnostic-n017.ts';
import { defaultDocumentDefaults } from '../src/modules/preferences/domain/document-defaults.ts';
import { preferenceLifetimeContracts } from '../src/modules/preferences/domain/preference-lifetime.ts';

const validRecords = (): Map<string, string> => new Map([
  ['rhwp-settings', JSON.stringify({ version: 1, autosave: { recoveryEnabled: true, recoveryIntervalMinutes: 10, idleSaveEnabled: true, idleDelaySeconds: 10 } })],
  ['jueony-document-defaults', JSON.stringify(defaultDocumentDefaults())],
  ['jueony-editor-chrome-v1', JSON.stringify({ version: 1, stylePanelOpen: true, ribbonTab: 'edit' })],
  ['jueony-style-panel', 'true'],
  ['jueony-recent-fonts-v1', JSON.stringify({ version: 1, names: ['함초롬바탕'] })],
  ['jueony-calendar-format', JSON.stringify({ version: 1, format: 'date-dots' })],
  ['jueony-common-snippets', JSON.stringify({ version: 1, snippets: [{ name: '인사', text: '안녕하세요.' }] })],
  ['jueony-document-view-journal-v1', JSON.stringify({ version: 1, entries: [{ documentId: 'd1', workspaceId: 'w1', checkpointAt: 1, recordedAt: 2, view: { version: 1, zoom: 1, fitMode: 'none', scrollX: 0, scrollY: 0 } }] })],
]);

test('N017 startup diagnostic accepts all stable values and exposes exact scope/backup boundaries', () => {
  const values = validRecords(), reads: string[] = [];
  let writes = 0;
  const storage = {
    getItem(key: string) { reads.push(key); return values.get(key) ?? null; },
    setItem() { writes += 1; throw new Error('startup diagnostic must not write'); },
    removeItem() { writes += 1; throw new Error('startup diagnostic must not remove'); },
  };
  const diagnostic = diagnosePreferenceStartupN017(storage);

  assert.equal(diagnostic.state, 'ready');
  assert.equal(diagnostic.automaticRepair, 'forbidden');
  assert.deepEqual(diagnostic.counts, { missing: 0, valid: 8, corrupt: 0, 'unsupported-version': 0, 'read-error': 0 });
  assert.equal(new Set(reads).size, 8);
  assert.ok([...new Set(reads)].every(key => reads.filter(value => value === key).length === 1));
  assert.equal(writes, 0);
  assert.deepEqual(diagnostic.scopes.workspace, ['jueony-document-view-journal-v1']);
  assert.deepEqual(diagnostic.scopes.document, ['jueony-document-view-journal-v1']);
  assert.deepEqual(diagnostic.backup.projectionOnlyKeys, ['rhwp-settings']);
  assert.deepEqual(diagnostic.backup.includedKeys, ['jueony-document-defaults', 'jueony-editor-chrome-v1', 'jueony-style-panel']);
  assert.deepEqual(new Set(diagnostic.backup.approvedKeys), new Set([...diagnostic.backup.includedKeys, ...diagnostic.backup.projectionOnlyKeys]));
  assert.ok(diagnostic.backup.excludedKeys.every(key => !diagnostic.backup.approvedKeys.includes(key)));
  assert.ok(diagnostic.items.every(item => item.decision === 'use-stored-value' && !item.automaticWriteAllowed));
});

test('missing preferences use defaults in memory without creating storage records', () => {
  let reads = 0;
  const diagnostic = diagnosePreferenceStartupN017({ getItem() { reads += 1; return null; } });

  assert.equal(reads, 8);
  assert.equal(diagnostic.state, 'defaults-in-memory');
  assert.deepEqual(diagnostic.counts, { missing: 8, valid: 0, corrupt: 0, 'unsupported-version': 0, 'read-error': 0 });
  assert.ok(diagnostic.items.every(item => item.decision === 'use-default-in-memory' && !item.automaticWriteAllowed));
});

test('corrupt, future and unreadable preferences remain blocked and are never repaired', () => {
  const values = validRecords();
  values.set('jueony-common-snippets', '{');
  values.set('jueony-calendar-format', JSON.stringify({ version: 2, format: 'date-dots' }));
  const before = structuredClone([...values]);
  const diagnostic = diagnosePreferenceStartupN017({
    getItem(key) {
      if (key === 'jueony-recent-fonts-v1') throw new Error('access denied');
      return values.get(key) ?? null;
    },
  });

  assert.equal(diagnostic.state, 'blocked');
  assert.equal(diagnostic.items.find(item => item.key === 'jueony-common-snippets')?.decision, 'preserve-and-review');
  assert.equal(diagnostic.items.find(item => item.key === 'jueony-calendar-format')?.decision, 'preserve-and-upgrade');
  assert.equal(diagnostic.items.find(item => item.key === 'jueony-recent-fonts-v1')?.decision, 'preserve-and-retry-read');
  assert.deepEqual([...values], before);
  assert.equal(diagnostic.counts.corrupt, 1);
  assert.equal(diagnostic.counts['unsupported-version'], 1);
  assert.equal(diagnostic.counts['read-error'], 1);
});

test('schema or backup allow-list drift fails closed before storage is read', () => {
  assert.throws(
    () => assertPreferenceStartupContractN017(preferenceLifetimeContracts.slice(1)),
    (error: unknown) => error instanceof PreferenceStartupContractErrorN017 && error.code === 'n017-contract-drift',
  );
  assert.throws(
    () => assertPreferenceStartupContractN017(preferenceLifetimeContracts, ['rhwp-settings', 'jueony-recent-fonts-v1']),
    PreferenceStartupContractErrorN017,
  );
  assert.throws(
    () => assertPreferenceStartupContractN017([...preferenceLifetimeContracts, preferenceLifetimeContracts[0]]),
    /중복 키/u,
  );
});
