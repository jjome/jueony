import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPreferencesPersistence, PreferenceStorageError } from '../src/preferences/persistence.ts';
import { bindPreferencesPersistence } from '../src/preferences/binding.ts';

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
function defaults() {
  return {
    version: 1, view: { marks: false, fit: 'none', arrangement: { kind: 'single' } },
    font: { recent: 3, sets: [] as { name: string }[] }, theme: { mode: 'light' },
  };
}
type Settings = ReturnType<typeof defaults>;
class MemoryStorage {
  raw: string | null = null;
  writes = 0;
  readFailure = false;
  writeFailure = false;
  getItem(_key: string) { if (this.readFailure) throw new Error('denied'); return this.raw; }
  setItem(_key: string, value: string) { if (this.writeFailure) throw new Error('quota'); this.raw = value; this.writes++; }
}
function setup(storage = new MemoryStorage()) {
  const load = (): Settings => {
    const base = defaults();
    const parsed = JSON.parse(storage.getItem('settings') ?? '{}');
    return { ...base, ...parsed, view: { ...base.view, ...parsed.view }, font: { ...base.font, ...parsed.font }, theme: { ...base.theme, ...parsed.theme } };
  };
  const options = { storage, key: 'settings', supportedVersion: 1, initial: load(), load };
  return { storage, load, options, persistence: createPreferencesPersistence(options) };
}

test('stale iframe saves only changed fields and keeps another iframe preferences', () => {
  const first = setup(), second = setup(first.storage);
  const firstEdit = first.persistence.snapshot(); firstEdit.view.marks = true;
  first.persistence.commit(firstEdit);
  const staleSecond = second.persistence.snapshot(); staleSecond.font.recent = 5;
  const secondResult = second.persistence.commit(staleSecond);
  assert.equal(secondResult.view.marks, true);
  assert.equal(secondResult.font.recent, 5);
  const stored = JSON.parse(first.storage.raw!);
  assert.equal(stored.view.marks, true);
  assert.equal(stored.font.recent, 5);
  assert.equal(first.persistence.refresh().value.font.recent, 5);
});

test('field-level merge preserves different properties in the same section and latest same-field edit wins', () => {
  const a = setup(), b = setup(a.storage);
  const first = a.persistence.snapshot(); first.view.fit = 'width'; a.persistence.commit(first);
  const second = b.persistence.snapshot(); second.view.marks = true; b.persistence.commit(second);
  const third = a.persistence.snapshot(); third.view.fit = 'page'; a.persistence.commit(third);
  assert.deepEqual(a.load().view, { marks: true, fit: 'page', arrangement: { kind: 'single' } });
});

test('unknown stored sections are retained when a normalizer drops them', () => {
  const memory = new MemoryStorage(); memory.raw = JSON.stringify({ version: 1, plugin: { custom: true }, view: { marks: true } });
  const load = () => ({ ...defaults(), view: { ...defaults().view, ...JSON.parse(memory.raw!).view } });
  const persistence = createPreferencesPersistence({ storage: memory, key: 'settings', supportedVersion: 1, initial: load(), load });
  const next = persistence.snapshot(); next.font.recent = 4; persistence.commit(next);
  assert.deepEqual(JSON.parse(memory.raw!).plugin, { custom: true });
  assert.equal(JSON.parse(memory.raw!).view.marks, true);
});

test('legacy unversioned settings migrate on an actual write without replacing other fields', () => {
  const memory = new MemoryStorage(); memory.raw = JSON.stringify({ theme: { mode: 'dark' }, unknown: 7 });
  const service = setup(memory), next = service.persistence.snapshot(); next.view.marks = true;
  service.persistence.commit(next);
  const raw = JSON.parse(memory.raw!);
  assert.equal(raw.version, 1); assert.equal(raw.theme.mode, 'dark'); assert.equal(raw.unknown, 7);
});

test('no-change save reloads latest value without writing stale data', () => {
  const a = setup(), b = setup(a.storage);
  const next = a.persistence.snapshot(); next.view.fit = 'width'; a.persistence.commit(next);
  const writes = a.storage.writes, result = b.persistence.commit(b.persistence.snapshot());
  assert.equal(result.view.fit, 'width'); assert.equal(a.storage.writes, writes);
});

test('arrays are edited atomically while unrelated remote settings survive', () => {
  const a = setup(), b = setup(a.storage);
  const nextA = a.persistence.snapshot(); nextA.view.marks = true; a.persistence.commit(nextA);
  const nextB = b.persistence.snapshot(); nextB.font.sets.push({ name: '행정문서' }); b.persistence.commit(nextB);
  assert.deepEqual(a.load().font.sets, [{ name: '행정문서' }]); assert.equal(a.load().view.marks, true);
});

test('snapshot and committed results cannot mutate the internal baseline by reference', () => {
  const service = setup();
  const next = service.persistence.snapshot(); next.view.marks = true;
  assert.equal(service.persistence.snapshot().view.marks, false);
  const committed = service.persistence.commit(next); committed.font.recent = 99;
  assert.equal(service.persistence.snapshot().font.recent, 3);
});

test('read failure and quota failure preserve previous raw and baseline, then permit retry', () => {
  const service = setup(), next = service.persistence.snapshot(); next.view.marks = true;
  service.storage.raw = JSON.stringify(defaults());
  const previous = service.storage.raw;
  service.storage.readFailure = true;
  assert.throws(() => service.persistence.commit(next), (e: unknown) => e instanceof PreferenceStorageError && e.code === 'read');
  service.storage.readFailure = false; service.storage.writeFailure = true;
  assert.throws(() => service.persistence.commit(next), (e: unknown) => e instanceof PreferenceStorageError && e.code === 'write');
  assert.equal(service.storage.raw, previous); assert.equal(service.persistence.snapshot().view.marks, false);
  service.storage.writeFailure = false;
  assert.equal(service.persistence.commit(next).view.marks, true);
});

for (const raw of ['{broken', 'null', '[]', '42']) {
  test('corrupt persisted input is retained rather than silently reset: ' + raw, () => {
    const service = setup(), next = service.persistence.snapshot(); next.font.recent = 4; service.storage.raw = raw;
    assert.throws(() => service.persistence.commit(next), (e: unknown) => e instanceof PreferenceStorageError && e.code === 'corrupt');
    assert.equal(service.storage.raw, raw); assert.equal(service.storage.writes, 0);
  });
}
for (const version of [2, 0, -1, 1.5, '1', null]) {
  test('unsupported version is preserved without writes: ' + String(version), () => {
    const service = setup(), next = service.persistence.snapshot(); next.font.recent = 4;
    const raw = JSON.stringify({ version, future: true }); service.storage.raw = raw;
    assert.throws(() => service.persistence.commit(next), (e: unknown) => e instanceof PreferenceStorageError && e.code === 'version');
    assert.equal(service.storage.raw, raw); assert.equal(service.storage.writes, 0);
  });
}

test('settings reset in another tab is accepted on refresh without restoring deleted fields', () => {
  const memory = new MemoryStorage(); memory.raw = JSON.stringify({ version: 1, view: { marks: true } });
  const service = setup(memory); memory.raw = null;
  const update = service.persistence.refresh();
  assert.equal(update.value.view.marks, false); assert.ok(update.changedPaths.includes('view.marks'));
  assert.equal(memory.raw, null);
});

test('special object keys do not change Object.prototype', () => {
  const memory = new MemoryStorage();
  memory.raw = '{"version":1,"__proto__":{"jueonyPolluted":true},"future":{"constructor":5}}';
  const service = setup(memory); const next = service.persistence.snapshot(); next.view.marks = true;
  service.persistence.commit(next);
  assert.equal(({} as any).jueonyPolluted, undefined);
  assert.equal(JSON.parse(memory.raw!).__proto__.jueonyPolluted, true);
  assert.equal(JSON.parse(memory.raw!).future.constructor, 5);
});

test('binding rolls back unsaved memory changes and reports a write failure once', () => {
  const service = setup(); let current = service.persistence.snapshot(); const errors: Error[] = [];
  const binding = bindPreferencesPersistence({ ...service.options, replace: value => { current = value; }, onError: error => errors.push(error) });
  service.storage.writeFailure = true; current.view.marks = true;
  assert.throws(() => binding.save(current), /저장하지 못했습니다/);
  assert.equal(current.view.marks, false); assert.equal(errors.length, 1);
  service.storage.writeFailure = false; current.view.marks = true; binding.save(current);
  assert.equal(current.view.marks, true);
});

test('binding listens only for its settings key, refreshes another iframe, and disposes listener', () => {
  const service = setup(), events = new EventTarget(); let current = defaults(); const changed: string[] = [], errors: Error[] = [];
  const binding = bindPreferencesPersistence({ ...service.options, events, replace: value => { current = value; }, onError: e => errors.push(e), onChange: event => changed.push(...event.changedPaths) });
  const emit = (key: string | null) => { const event = new Event('storage'); Object.defineProperty(event, 'key', { value: key }); events.dispatchEvent(event); };
  service.storage.raw = JSON.stringify({ version: 1, view: { marks: true } });
  emit('other'); assert.equal(current.view.marks, false);
  emit('settings'); assert.equal(current.view.marks, true); assert.deepEqual(changed, ['view.marks']);
  service.storage.raw = 'broken'; emit('settings'); assert.equal(errors.length, 1); assert.equal(current.view.marks, true);
  binding.dispose(); service.storage.raw = null; emit(null); assert.equal(current.view.marks, true);
});
test('binding reports only missed remote fields after a local command commits stale state', () => {
  const a = setup(), b = setup(a.storage), updates: { source: string; changedPaths: string[] }[] = [];
  let currentB = b.persistence.snapshot();
  const binding = bindPreferencesPersistence({ ...b.options, replace: value => { currentB = value; }, onError: error => { throw error; }, onChange: update => updates.push(update) });
  const first = a.persistence.snapshot(); first.view.marks = true; a.persistence.commit(first);
  currentB.font.recent = 4;
  binding.save(currentB);
  assert.equal(currentB.view.marks, true);
  assert.deepEqual(updates.map(update => ({ source: update.source, changedPaths: update.changedPaths })), [{ source: 'local', changedPaths: ['view.marks'] }]);
});

test('two iframe bindings keep repeated same-turn sequential writes without delivering storage events', () => {
  const a = setup(), b = setup(a.storage); let dataA = a.persistence.snapshot(), dataB = b.persistence.snapshot();
  const errors: Error[] = [];
  const boundA = bindPreferencesPersistence({ ...a.options, replace: value => { dataA = value; }, onError: error => errors.push(error) });
  const boundB = bindPreferencesPersistence({ ...b.options, replace: value => { dataB = value; }, onError: error => errors.push(error) });
  dataA.view.marks = true; boundA.save(dataA);
  dataB.font.recent = 4; boundB.save(dataB);
  dataA.theme.mode = 'dark'; boundA.save(dataA);
  dataB.view.fit = 'width'; boundB.save(dataB);
  assert.deepEqual(a.load(), { ...defaults(), view: { ...defaults().view, marks: true, fit: 'width' }, font: { recent: 4, sets: [] }, theme: { mode: 'dark' } });
  assert.equal(errors.length, 0);
});

test('deleted known field does not remove another writer unknown nested field', () => {
  const memory = new MemoryStorage(); memory.raw = JSON.stringify({ version: 1, view: { marks: true, custom: { enabled: true } } });
  const service = setup(memory), next = service.persistence.snapshot() as Settings & {view: {custom?: unknown}};
  delete next.view.custom;
  const raw = JSON.parse(memory.raw); raw.view.remoteFlag = 'new'; memory.raw = JSON.stringify(raw);
  service.persistence.commit(next);
  assert.equal(JSON.parse(memory.raw!).view.custom, undefined);
  assert.equal(JSON.parse(memory.raw!).view.remoteFlag, 'new');
});