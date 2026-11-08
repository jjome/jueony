import test from 'node:test';
import assert from 'node:assert/strict';
import {
  runPreferenceStartupGateN017,
  type PreferenceActivationDirectiveN017,
} from '../src/adapters/browser/preference-startup-gate-n017.ts';
import { defaultDocumentDefaults } from '../src/modules/preferences/domain/document-defaults.ts';

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

function fixture(values = validRecords()) {
  const calls = { reads: [] as string[], writes: 0, applies: 0 };
  let applied: readonly PreferenceActivationDirectiveN017[] = [];
  const result = () => runPreferenceStartupGateN017({
    storage: {
      getItem(key) { calls.reads.push(key); return values.get(key) ?? null; },
      setItem() { calls.writes += 1; throw new Error('must not write'); },
    },
    activation: {
      apply(directives) { calls.applies += 1; applied = structuredClone(directives); return 'applied'; },
    },
  });
  return { values, calls, result, applied: () => applied };
}

test('ready startup activates only stored keys and exposes scope/backup projections without values', () => {
  const f = fixture(), result = f.result();
  assert.equal(result.state, 'ready');
  assert.equal(result.activation, 'applied');
  assert.equal(result.reason, 'ready');
  assert.equal(f.calls.writes, 0);
  assert.equal(f.calls.applies, 1);
  assert.equal(f.calls.reads.length, 8);
  assert.ok(result.directives.every(directive => directive.source === 'stored'));
  assert.deepEqual(result.scopes.workspace.activeKeys, ['jueony-document-view-journal-v1']);
  assert.deepEqual(result.scopes.document.activeKeys, ['jueony-document-view-journal-v1']);
  assert.deepEqual(new Set(result.backup.approvedKeys), new Set(['rhwp-settings', 'jueony-document-defaults', 'jueony-editor-chrome-v1', 'jueony-style-panel']));
  assert.equal(result.rawValuesExposed, false);
  assert.equal(result.storageWritesAllowed, false);
  assert.doesNotMatch(JSON.stringify(result), /안녕하세요|recoveryIntervalMinutes/u);
});

test('missing records inject memory defaults through one atomic port call and never persist', () => {
  const f = fixture(new Map()), result = f.result();
  assert.equal(result.state, 'defaults-in-memory');
  assert.equal(result.reason, 'defaults-in-memory');
  assert.equal(f.calls.writes, 0);
  assert.equal(f.calls.applies, 1);
  assert.equal(f.applied().length, 8);
  assert.ok(f.applied().every(directive => directive.source === 'memory-default'));
  assert.deepEqual(result.scopes.workspace.defaultKeys, ['jueony-document-view-journal-v1']);
  assert.deepEqual(result.scopes.document.defaultKeys, ['jueony-document-view-journal-v1']);
});

test('corrupt, future and read-error records are individually blocked while originals remain unchanged', () => {
  const values = validRecords();
  values.set('jueony-common-snippets', '{');
  values.set('jueony-calendar-format', JSON.stringify({ version: 2, format: 'date-dots' }));
  const before = structuredClone([...values]);
  let writes = 0;
  let applied: readonly PreferenceActivationDirectiveN017[] = [];
  const result = runPreferenceStartupGateN017({
    storage: {
      getItem(key) {
        if (key === 'jueony-recent-fonts-v1') throw new Error('C:\\private\\token-file');
        return values.get(key) ?? null;
      },
      setItem() { writes += 1; throw new Error('must not write'); },
    },
    activation: { apply(directives) { applied = structuredClone(directives); return 'applied'; } },
  });
  assert.equal(result.state, 'blocked');
  assert.equal(result.activation, 'applied');
  assert.equal(result.reason, 'diagnostic-blocked');
  assert.deepEqual([...values], before);
  assert.equal(writes, 0);
  assert.deepEqual(
    applied.filter(directive => directive.source === 'blocked').map(directive => [directive.key, directive.blockReason]),
    [
      ['jueony-recent-fonts-v1', 'read-error'],
      ['jueony-calendar-format', 'unsupported-version'],
      ['jueony-common-snippets', 'corrupt'],
    ],
  );
  assert.doesNotMatch(JSON.stringify(result), /private|token-file|date-dots/u);
});

test('unknown diagnostic schema and thrown contract drift block every activation and backup key', () => {
  for (const diagnose of [
    () => { throw new Error('C:\\private\\schema-secret'); },
    () => ({ schema: 'n017-stable-preferences-v2' }) as never,
  ]) {
    let applies = 0, reads = 0;
    const result = runPreferenceStartupGateN017({
      storage: { getItem() { reads += 1; return null; } },
      activation: { apply() { applies += 1; return 'applied'; } },
      diagnose,
    });
    assert.equal(result.state, 'blocked');
    assert.equal(result.activation, 'not-applied');
    assert.equal(result.reason, 'contract-drift');
    assert.equal(applies, 0);
    assert.equal(reads, 0);
    assert.deepEqual(result.directives, []);
    assert.deepEqual(result.backup.approvedKeys, []);
    assert.doesNotMatch(JSON.stringify(result), /private|schema-secret/u);
  }
});

test('memory activation rejection or exception fails closed without reporting partial activation', () => {
  for (const apply of [
    () => 'rejected' as const,
    () => { throw new Error('raw default contains secret'); },
  ]) {
    const result = runPreferenceStartupGateN017({
      storage: { getItem: key => validRecords().get(key) ?? null },
      activation: { apply },
    });
    assert.equal(result.state, 'blocked');
    assert.equal(result.activation, 'not-applied');
    assert.equal(result.reason, 'activation-rejected');
    assert.deepEqual(result.directives, []);
    assert.deepEqual(result.scopes.user.activeKeys, []);
    assert.deepEqual(result.backup.approvedKeys, []);
    assert.doesNotMatch(JSON.stringify(result), /raw default|secret/u);
  }
});
