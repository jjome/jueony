import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createPreferenceRuntimeFacadeN017,
  startPreferenceRuntimeN017,
} from '../src/composition/preference-runtime-n017.ts';
import {createPreferenceMemoryActivationN017} from '../src/adapters/browser/preference-memory-activation-n017.ts';
import type {PreferenceActivationDirectiveN017} from '../src/adapters/browser/preference-startup-gate-n017.ts';
import {defaultDocumentDefaults} from '../src/modules/preferences/domain/document-defaults.ts';

const stableKeys = [
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
  return stableKeys.map(key => ({key, scopes: scopes(key), source}));
}

function storedValues(): Map<string, string> {
  return new Map([
    ['rhwp-settings', JSON.stringify({version: 1, autosave: {recoveryEnabled: true, recoveryIntervalMinutes: 15, idleSaveEnabled: false, idleDelaySeconds: 20}})],
    ['jueony-document-defaults', JSON.stringify(defaultDocumentDefaults())],
    ['jueony-editor-chrome-v1', JSON.stringify({version: 1, stylePanelOpen: false, ribbonTab: 'format'})],
    ['jueony-style-panel', 'false'],
    ['jueony-recent-fonts-v1', JSON.stringify({version: 1, names: ['함초롬바탕']})],
    ['jueony-calendar-format', JSON.stringify({version: 1, format: 'date-iso'})],
    ['jueony-common-snippets', JSON.stringify({version: 1, snippets: [{name: '보고', text: '보고드립니다.'}]})],
    ['jueony-document-view-journal-v1', JSON.stringify({version: 1, entries: []})],
  ]);
}

test('startup gate, memory activation and typed facade expose stored values end to end', () => {
  const values = storedValues();
  const runtime = startPreferenceRuntimeN017({getItem: key => values.get(key) ?? null});

  assert.equal(runtime.startup.reason, 'ready');
  const recovery = runtime.preferences.read('rhwp-settings', 'user');
  assert.equal(recovery.status, 'active');
  if (recovery.status === 'active') {
    assert.equal(recovery.source, 'stored');
    assert.equal(recovery.value.recoveryIntervalMinutes, 15);
  }
  const calendar = runtime.preferences.read('jueony-calendar-format', 'user');
  assert.deepEqual(calendar, {status: 'active', source: 'stored', value: 'date-iso'});
  assert.deepEqual(runtime.preferences.inspect().workspace.activeKeys, ['jueony-document-view-journal-v1']);
});

test('missing settings retain memory-default provenance and never materialize storage', () => {
  const values = new Map<string, string>();
  const runtime = startPreferenceRuntimeN017({getItem: key => values.get(key) ?? null});

  assert.equal(runtime.startup.reason, 'defaults-in-memory');
  assert.deepEqual(runtime.preferences.read('jueony-calendar-format', 'user'), {
    status: 'active', source: 'memory-default', value: 'date-dots',
  });
  assert.deepEqual(runtime.preferences.read('jueony-document-view-journal-v1', 'workspace'), {
    status: 'active', source: 'memory-default', value: {version: 1, entries: []},
  });
  assert.equal(values.size, 0);
});

test('blocked keys remain typed blocked while unrelated keys and scopes remain available', () => {
  const values = storedValues();
  values.set('jueony-common-snippets', '{');
  values.set('jueony-calendar-format', JSON.stringify({version: 2, format: 'date-iso'}));
  const runtime = startPreferenceRuntimeN017({
    getItem(key) {
      if (key === 'jueony-recent-fonts-v1') throw new Error('private token');
      return values.get(key) ?? null;
    },
  });

  assert.equal(runtime.startup.reason, 'diagnostic-blocked');
  assert.deepEqual(runtime.preferences.read('jueony-common-snippets', 'user'), {status: 'blocked', reason: 'corrupt'});
  assert.deepEqual(runtime.preferences.read('jueony-calendar-format', 'user'), {status: 'blocked', reason: 'unsupported-version'});
  assert.deepEqual(runtime.preferences.read('jueony-recent-fonts-v1', 'user'), {status: 'blocked', reason: 'read-error'});
  assert.equal(runtime.preferences.read('jueony-document-defaults', 'user').status, 'active');
  assert.deepEqual(runtime.preferences.inspect().workspace.blockedKeys, []);
  assert.doesNotMatch(JSON.stringify([runtime.startup, runtime.preferences.inspect()]), /private|token/u);
});

test('facade returns clone-isolated values and exposes no storage mutation operation', () => {
  const values = storedValues();
  const runtime = startPreferenceRuntimeN017({getItem: key => values.get(key) ?? null});
  const first = runtime.preferences.read('jueony-common-snippets', 'user');
  assert.equal(first.status, 'active');
  if (first.status === 'active') first.value.snippets[0].text = 'mutated';
  const second = runtime.preferences.read('jueony-common-snippets', 'user');
  assert.equal(second.status, 'active');
  if (second.status === 'active') assert.equal(second.value.snippets[0].text, '보고드립니다.');
  assert.deepEqual(Object.keys(runtime.preferences).sort(), ['inspect', 'read']);
});

test('wrong-scope or absent activation reads fail closed as absent', () => {
  const activation = createPreferenceMemoryActivationN017({getItem: () => null});
  const facade = createPreferenceRuntimeFacadeN017(activation);
  assert.deepEqual(facade.read('jueony-document-defaults', 'user'), {status: 'absent'});

  assert.equal(activation.apply(directives('memory-default')), 'applied');
  const wrongScope = (facade.read as (key: 'jueony-document-defaults', scope: 'workspace') => unknown)(
    'jueony-document-defaults',
    'workspace',
  );
  assert.deepEqual(wrongScope, {status: 'absent'});
});
