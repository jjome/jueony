import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createPreferenceMemoryActivationN017,
} from '../src/adapters/browser/preference-memory-activation-n017.ts';
import {
  runPreferenceStartupGateN017,
  type PreferenceActivationDirectiveN017,
} from '../src/adapters/browser/preference-startup-gate-n017.ts';
import {defaultDocumentDefaults} from '../src/modules/preferences/domain/document-defaults.ts';

const keys = [
  'rhwp-settings',
  'jueony-document-defaults',
  'jueony-editor-chrome-v1',
  'jueony-style-panel',
  'jueony-recent-fonts-v1',
  'jueony-calendar-format',
  'jueony-common-snippets',
  'jueony-document-view-journal-v1',
] as const;

const scopes = (key: string) => key === 'jueony-document-view-journal-v1'
  ? ['workspace', 'document'] as const
  : ['user'] as const;

function directives(source: 'stored' | 'memory-default'): readonly PreferenceActivationDirectiveN017[] {
  return keys.map(key => Object.freeze({key, scopes: scopes(key), source}));
}

function validRecords(): Map<string, string> {
  return new Map([
    ['rhwp-settings', JSON.stringify({version: 1, autosave: {recoveryEnabled: true, recoveryIntervalMinutes: 10, idleSaveEnabled: true, idleDelaySeconds: 10}})],
    ['jueony-document-defaults', JSON.stringify(defaultDocumentDefaults())],
    ['jueony-editor-chrome-v1', JSON.stringify({version: 1, stylePanelOpen: false, ribbonTab: 'view'})],
    ['jueony-style-panel', 'false'],
    ['jueony-recent-fonts-v1', JSON.stringify({version: 1, names: ['함초롬바탕']})],
    ['jueony-calendar-format', JSON.stringify({version: 1, format: 'date-korean'})],
    ['jueony-common-snippets', JSON.stringify({version: 1, snippets: [{name: '인사', text: '안녕하세요.'}]})],
    ['jueony-document-view-journal-v1', JSON.stringify({version: 1, entries: []})],
  ]);
}

test('missing preferences become memory-only defaults through the real startup gate', () => {
  const values = new Map<string, string>();
  let reads = 0;
  const storage = {getItem(key: string) { reads += 1; return values.get(key) ?? null; }};
  const activation = createPreferenceMemoryActivationN017(storage);
  const result = runPreferenceStartupGateN017({storage, activation});

  assert.equal(result.reason, 'defaults-in-memory');
  assert.equal(result.activation, 'applied');
  assert.equal(reads, 16);
  assert.deepEqual(activation.lookup('user', 'jueony-calendar-format'), {
    status: 'active', source: 'memory-default', value: 'date-dots',
  });
  assert.deepEqual(activation.lookup('workspace', 'jueony-document-view-journal-v1'), {
    status: 'active', source: 'memory-default', value: {version: 1, entries: []},
  });
  assert.deepEqual(activation.lookup('document', 'jueony-document-view-journal-v1'), {
    status: 'active', source: 'memory-default', value: {version: 1, entries: []},
  });
  assert.equal(values.size, 0);
});

test('stored values are revalidated and atomically projected into their declared scopes', () => {
  const values = validRecords();
  const activation = createPreferenceMemoryActivationN017({getItem: key => values.get(key) ?? null});
  const result = runPreferenceStartupGateN017({storage: {getItem: key => values.get(key) ?? null}, activation});

  assert.equal(result.reason, 'ready');
  assert.deepEqual(activation.lookup('user', 'jueony-editor-chrome-v1'), {
    status: 'active', source: 'stored', value: {version: 1, stylePanelOpen: false, ribbonTab: 'view'},
  });
  assert.deepEqual(activation.lookup('workspace', 'jueony-editor-chrome-v1'), {status: 'absent'});
  assert.deepEqual(activation.inspect().workspace.activeKeys, ['jueony-document-view-journal-v1']);

  const first = activation.lookup('user', 'jueony-common-snippets');
  assert.equal(first.status, 'active');
  if (first.status === 'active') (first.value as {snippets: unknown[]}).snippets.length = 0;
  const second = activation.lookup('user', 'jueony-common-snippets');
  assert.equal(second.status, 'active');
  if (second.status === 'active') assert.equal((second.value as {snippets: unknown[]}).snippets.length, 1);
});

test('blocked corrupt, future and unreadable keys remain inactive while safe keys activate', () => {
  const values = validRecords();
  values.set('jueony-common-snippets', '{');
  values.set('jueony-calendar-format', JSON.stringify({version: 2, format: 'date-dots'}));
  const reads = new Map<string, number>();
  const storage = {
    getItem(key: string) {
      reads.set(key, (reads.get(key) ?? 0) + 1);
      if (key === 'jueony-recent-fonts-v1') throw new Error('C:\\secret\\token');
      return values.get(key) ?? null;
    },
  };
  const activation = createPreferenceMemoryActivationN017(storage);
  const result = runPreferenceStartupGateN017({storage, activation});

  assert.equal(result.reason, 'diagnostic-blocked');
  assert.deepEqual(activation.lookup('user', 'jueony-common-snippets'), {status: 'blocked', reason: 'corrupt'});
  assert.deepEqual(activation.lookup('user', 'jueony-calendar-format'), {status: 'blocked', reason: 'unsupported-version'});
  assert.deepEqual(activation.lookup('user', 'jueony-recent-fonts-v1'), {status: 'blocked', reason: 'read-error'});
  assert.equal(activation.lookup('user', 'jueony-document-defaults').status, 'active');
  assert.equal(reads.get('jueony-common-snippets'), 1);
  assert.equal(reads.get('jueony-calendar-format'), 1);
  assert.equal(reads.get('jueony-recent-fonts-v1'), 1);
  assert.doesNotMatch(JSON.stringify([result, activation.inspect()]), /secret|token|안녕하세요/u);
});

test('TOCTOU, reader failure, duplicate keys and scope drift reject atomically and retain the prior table', () => {
  const values = new Map<string, string>();
  const activation = createPreferenceMemoryActivationN017({getItem: key => values.get(key) ?? null});
  assert.equal(activation.apply(directives('memory-default')), 'applied');
  const before = activation.inspect();

  assert.equal(activation.apply(directives('stored')), 'rejected');
  assert.deepEqual(activation.inspect(), before);

  values.set('jueony-calendar-format', '{');
  const mixed = directives('memory-default');
  assert.equal(activation.apply(mixed), 'rejected');
  assert.deepEqual(activation.inspect(), before);

  const duplicate = [...directives('memory-default')];
  duplicate[7] = duplicate[0];
  assert.equal(activation.apply(duplicate), 'rejected');
  assert.deepEqual(activation.inspect(), before);

  const wrongScope = [...directives('memory-default')];
  wrongScope[0] = {key: 'rhwp-settings', scopes: ['workspace'], source: 'memory-default'};
  assert.equal(activation.apply(wrongScope), 'rejected');
  assert.deepEqual(activation.inspect(), before);
});

test('explicit blocked directives never read their storage records', () => {
  const readKeys: string[] = [];
  const activation = createPreferenceMemoryActivationN017({
    getItem(key) { readKeys.push(key); return null; },
  });
  const all = directives('memory-default').map(directive => directive.key === 'jueony-common-snippets'
    ? {key: directive.key, scopes: directive.scopes, source: 'blocked' as const, blockReason: 'corrupt' as const}
    : directive);
  assert.equal(activation.apply(all), 'applied');
  assert.equal(readKeys.includes('jueony-common-snippets'), false);
  assert.deepEqual(activation.lookup('user', 'jueony-common-snippets'), {status: 'blocked', reason: 'corrupt'});
});
