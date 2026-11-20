import test from 'node:test';
import assert from 'node:assert/strict';
import {bootstrapPreferenceRuntimeN017} from '../src/composition/preference-bootstrap-n017.ts';
import {defaultDocumentDefaults} from '../src/modules/preferences/domain/document-defaults.ts';

const origin = 'https://jueony.local';
const scope = (profileId = 'default') => ({origin, profileId});

function records(calendar = 'date-iso'): Map<string, string> {
  return new Map([
    ['rhwp-settings', JSON.stringify({version: 1, autosave: {recoveryEnabled: true, recoveryIntervalMinutes: 15, idleSaveEnabled: false, idleDelaySeconds: 20}})],
    ['jueony-document-defaults', JSON.stringify(defaultDocumentDefaults())],
    ['jueony-editor-chrome-v1', JSON.stringify({version: 1, stylePanelOpen: false, ribbonTab: 'format'})],
    ['jueony-style-panel', 'false'],
    ['jueony-recent-fonts-v1', JSON.stringify({version: 1, names: ['함초롬바탕']})],
    ['jueony-calendar-format', JSON.stringify({version: 1, format: calendar})],
    ['jueony-common-snippets', JSON.stringify({version: 1, snippets: []})],
    ['jueony-document-view-journal-v1', JSON.stringify({version: 1, entries: []})],
  ]);
}

test('one-call bootstrap uses only the exact origin/profile read port and exposes a read-only facade', () => {
  const values = records();
  const requests: unknown[] = [];
  const storage = {
    read(request: {scope: {origin: string; profileId: string}; key: string}) {
      requests.push(structuredClone(request));
      const value = values.get(request.key);
      return value === undefined ? {status: 'missing' as const} : {status: 'found' as const, value};
    },
  };
  const boot = bootstrapPreferenceRuntimeN017({scope: scope('official'), storage});

  assert.equal(boot.status, 'ready');
  assert.equal(boot.reason, 'ready');
  assert.deepEqual(boot.scope, scope('official'));
  assert.ok(requests.length > 0);
  assert.ok(requests.every(request => JSON.stringify((request as any).scope) === JSON.stringify(scope('official'))));
  assert.deepEqual(boot.preferences.read('jueony-calendar-format', 'user'), {
    status: 'active', source: 'stored', value: 'date-iso',
  });
  assert.deepEqual(Object.keys(boot.preferences).sort(), ['inspect', 'read', 'readUnknown']);
  assert.deepEqual(Object.keys(storage), ['read']);
  assert.equal(boot.storageWritesAllowed, false);
  assert.equal(boot.rawStorageExposed, false);
});

test('missing values activate only memory defaults and never materialize through the read port', () => {
  const requests: unknown[] = [];
  const storage = {read(request: unknown) { requests.push(structuredClone(request)); return {status: 'missing' as const}; }};
  const boot = bootstrapPreferenceRuntimeN017({scope: scope(), storage});

  assert.equal(boot.status, 'ready');
  assert.equal(boot.reason, 'defaults-in-memory');
  assert.deepEqual(boot.preferences.read('jueony-calendar-format', 'user'), {
    status: 'active', source: 'memory-default', value: 'date-dots',
  });
  assert.deepEqual(boot.preferences.read('jueony-document-view-journal-v1', 'document'), {
    status: 'active', source: 'memory-default', value: {version: 1, entries: []},
  });
  assert.equal(requests.length, 8);
  assert.deepEqual(Object.keys(storage), ['read']);
});

test('boot snapshots every scoped key once so a changing host cannot split diagnostic and activation', () => {
  const values = records();
  const reads = new Map<string, number>();
  const boot = bootstrapPreferenceRuntimeN017({
    scope: scope(),
    storage: {read(request) {
      const count = (reads.get(request.key) ?? 0) + 1;
      reads.set(request.key, count);
      const value = values.get(request.key)!;
      return {status: 'found', value: count === 1 ? value : '{"version":999}'};
    }},
  });
  assert.equal(boot.status, 'ready');
  assert.deepEqual([...reads.values()], Array(8).fill(1));
  assert.deepEqual(boot.preferences.read('jueony-calendar-format', 'user'), {
    status: 'active', source: 'stored', value: 'date-iso',
  });
});

test('profile and origin are part of every read authority and cannot bleed values', () => {
  const data = new Map([
    [`${origin}|alpha`, records('date-iso')],
    [`${origin}|beta`, records('date-korean')],
  ]);
  const storage = {
    read(request: {scope: {origin: string; profileId: string}; key: string}) {
      const value = data.get(`${request.scope.origin}|${request.scope.profileId}`)?.get(request.key);
      return value === undefined ? {status: 'missing' as const} : {status: 'found' as const, value};
    },
  };
  const alpha = bootstrapPreferenceRuntimeN017({scope: scope('alpha'), storage});
  const beta = bootstrapPreferenceRuntimeN017({scope: scope('beta'), storage});
  assert.deepEqual(alpha.preferences.read('jueony-calendar-format', 'user'), {status: 'active', source: 'stored', value: 'date-iso'});
  assert.deepEqual(beta.preferences.read('jueony-calendar-format', 'user'), {status: 'active', source: 'stored', value: 'date-korean'});
});

test('read error blocks only its key while valid keys remain available without raw error leakage', () => {
  const values = records();
  const boot = bootstrapPreferenceRuntimeN017({
    scope: scope(),
    storage: {read(request) {
      if (request.key === 'jueony-common-snippets') return {status: 'read-error'};
      return {status: 'found', value: values.get(request.key)!};
    }},
  });
  assert.equal(boot.status, 'degraded');
  assert.equal(boot.reason, 'diagnostic-blocked');
  assert.deepEqual(boot.preferences.read('jueony-common-snippets', 'user'), {status: 'blocked', reason: 'read-error'});
  assert.equal(boot.preferences.read('jueony-document-defaults', 'user').status, 'active');
  assert.doesNotMatch(JSON.stringify(boot), /common-snippets.*\{|private|token/u);
});

test('unknown key, wrong scope, invalid authority and startup contract drift fail closed', () => {
  const ready = bootstrapPreferenceRuntimeN017({scope: scope(), storage: {read: () => ({status: 'missing'})}});
  assert.deepEqual(ready.preferences.readUnknown('unknown-setting', 'user'), {status: 'blocked', reason: 'unknown-key'});
  assert.deepEqual(ready.preferences.readUnknown('jueony-document-defaults', 'document'), {status: 'blocked', reason: 'scope-mismatch'});

  for (const invalidScope of [
    {origin: 'https://jueony.local/path', profileId: 'default'},
    {origin: 'https://user:secret@jueony.local', profileId: 'default'},
    {origin, profileId: '../other'},
  ]) {
    let reads = 0;
    const boot = bootstrapPreferenceRuntimeN017({scope: invalidScope, storage: {read() { reads += 1; return {status: 'missing'}; }}});
    assert.equal(boot.status, 'blocked');
    assert.equal(boot.reason, 'invalid-scope');
    assert.equal(reads, 0);
    assert.deepEqual(boot.preferences.readUnknown('jueony-calendar-format', 'user'), {status: 'blocked', reason: 'startup-blocked'});
  }

  const drift = bootstrapPreferenceRuntimeN017({
    scope: scope(), storage: {read: () => ({status: 'missing'})},
    start: () => ({startup: {schema: 'future-schema'}, preferences: {}}) as never,
  });
  assert.equal(drift.status, 'blocked');
  assert.equal(drift.reason, 'startup-gate-failed');
  assert.deepEqual(drift.preferences.inspect(), {user: {activeKeys: [], blockedKeys: []}, workspace: {activeKeys: [], blockedKeys: []}, document: {activeKeys: [], blockedKeys: []}});
});
