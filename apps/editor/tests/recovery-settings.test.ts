import test from 'node:test';
import assert from 'node:assert/strict';
import { createRecoveryCoordinator, normalizeRecoverySettings, recoveryDeadline } from '../src/modules/preferences/public/index.ts';
import type { RecoveryClock, RecoverySettings } from '../src/modules/preferences/public/index.ts';
import { readRecoverySettings, watchRecoverySettings } from '../src/adapters/browser/recovery-settings.ts';

class Clock implements RecoveryClock {
  time = 0;
  next = 1;
  tasks = new Map<number, { at: number; callback: () => void }>();
  now = () => this.time;
  schedule(callback: () => void, delayMs: number): number {
    const id = this.next++; this.tasks.set(id, { at: this.time + delayMs, callback }); return id;
  }
  cancel(id: number): void { this.tasks.delete(id); }
  async advance(ms: number): Promise<void> {
    const target = this.time + ms;
    for (;;) {
      const next = [...this.tasks].filter(([, t]) => t.at <= target).sort((a, b) => a[1].at - b[1].at)[0];
      if (!next) break;
      this.time = next[1].at; this.tasks.delete(next[0]); next[1].callback();
      // Checkpoint promises complete before another simulated timer fires.
      for (let i = 0; i < 8; i++) await Promise.resolve();
    }
    this.time = target;
  }
}
const disabled = { recoveryEnabled: false, recoveryIntervalMinutes: 1, idleSaveEnabled: false, idleDelaySeconds: 5 };
const state = (revision: string, dirty = true, identity = 'doc1') => ({ identity, revision, dirty });
function fixture(settings: RecoverySettings = normalizeRecoverySettings(undefined), result: () => Promise<boolean> = async () => true) {
  const clock = new Clock(), writes: number[] = [], errors: unknown[] = [];
  const coordinator = createRecoveryCoordinator({ settings, clock, checkpoint: () => { writes.push(clock.now()); return result(); }, onError: e => errors.push(e) });
  return { clock, writes, errors, coordinator };
}

test('recovery settings retain Studio defaults, bounds and legacy numeric strings', () => {
  assert.deepEqual(normalizeRecoverySettings({ recoveryIntervalMinutes: '3', idleDelaySeconds: 2 }), {
    recoveryEnabled: true, recoveryIntervalMinutes: 3, idleSaveEnabled: true, idleDelaySeconds: 5,
  });
  assert.equal(normalizeRecoverySettings({ recoveryIntervalMinutes: 999 }).recoveryIntervalMinutes, 120);
  assert.equal(normalizeRecoverySettings({ idleDelaySeconds: 'invalid' }).idleDelaySeconds, 10);
  assert.equal(recoveryDeadline(disabled, 0, 0), undefined);
});

test('unchanged status and selection do not delay recovery or serialize again', async () => {
  const { clock, writes, coordinator } = fixture();
  coordinator.observe(state('1')); await clock.advance(4000);
  coordinator.observe(state('1')); await clock.advance(5999); assert.deepEqual(writes, []);
  await clock.advance(1); assert.deepEqual(writes, [10000]);
  coordinator.observe(state('1')); await clock.advance(600000); assert.deepEqual(writes, [10000]);
});

test('typing postpones idle checkpoint but periodic checkpoint is not starved', async () => {
  const { clock, writes, coordinator } = fixture({ ...disabled, recoveryEnabled: true, idleSaveEnabled: true });
  coordinator.observe(state('0'));
  for (let i = 1; i <= 15; i++) { await clock.advance(4000); coordinator.observe(state(String(i))); }
  assert.deepEqual(writes, [60000]);
  await clock.advance(5000); assert.deepEqual(writes, [60000, 65000]);
});

test('both toggles disable scheduling and boundary flush without deleting older checkpoints', async () => {
  const { clock, writes, coordinator } = fixture();
  coordinator.observe(state('1')); await clock.advance(3000);
  coordinator.updateSettings(disabled);
  await clock.advance(600000); assert.deepEqual(writes, []);
  assert.equal(await coordinator.flush(), true); assert.deepEqual(writes, []);
  coordinator.updateSettings({ ...disabled, idleSaveEnabled: true });
  await clock.advance(0); assert.equal(writes.length, 1);
});

test('one remaining toggle still creates recovery snapshots at its own interval', async () => {
  const { clock, writes, coordinator } = fixture({ ...disabled, recoveryEnabled: true });
  coordinator.observe(state('1')); await clock.advance(59000); assert.deepEqual(writes, []);
  await clock.advance(1000); assert.deepEqual(writes, [60000]);
});

test('clean document and explicit checkpoint cancel pending dirty snapshot', async () => {
  const { clock, writes, coordinator } = fixture();
  coordinator.observe(state('1')); coordinator.observe(state('2', false));
  await clock.advance(600000); assert.deepEqual(writes, []);
  coordinator.observe(state('3')); coordinator.checkpointed(state('3'));
  await clock.advance(600000); assert.deepEqual(writes, []);
});

test('document replacement and dispose cancel old timers', async () => {
  const { clock, writes, coordinator } = fixture();
  coordinator.observe(state('1')); await clock.advance(5000);
  coordinator.observe(state('1', false, 'doc2'));
  await clock.advance(600000); assert.deepEqual(writes, []);
  coordinator.observe(state('2', true, 'doc2')); coordinator.dispose();
  await clock.advance(600000); assert.deepEqual(writes, []);
});

test('busy checkpoint retries without tight loop; disabling cancels retry', async () => {
  const { clock, writes, coordinator } = fixture(undefined, async () => false);
  coordinator.observe(state('1')); await clock.advance(10000); assert.deepEqual(writes, [10000]);
  await clock.advance(1499); assert.equal(writes.length, 1);
  coordinator.updateSettings(disabled); await clock.advance(600000); assert.equal(writes.length, 1);
});

test('failed checkpoint reports once and does not repeatedly serialize unchanged content', async () => {
  const { clock, writes, errors, coordinator } = fixture(undefined, async () => { throw new Error('quota'); });
  coordinator.observe(state('1')); await clock.advance(600000);
  assert.equal(errors.length, 1); assert.equal(writes.length, 1);
  coordinator.observe(state('2')); await clock.advance(10000); assert.equal(errors.length, 2);
});

test('mutation during awaited write keeps a subsequent checkpoint pending', async () => {
  let finish: (saved: boolean) => void = () => {};
  const { clock, writes, coordinator } = fixture(undefined, () => new Promise(resolve => { finish = resolve; }));
  coordinator.observe(state('1')); await clock.advance(10000);
  coordinator.observe(state('2')); finish(true);
  for (let i = 0; i < 8; i++) await Promise.resolve();
  await clock.advance(9999); assert.equal(writes.length, 1);
  await clock.advance(1); assert.equal(writes.length, 2); finish(true);
});

test('settings reader leaves unrelated data alone, accepts legacy version and rejects corrupt/future records', () => {
  const read = (raw: string | null) => readRecoverySettings({ getItem: () => raw });
  assert.deepEqual(read(null), normalizeRecoverySettings(undefined));
  assert.deepEqual(read(JSON.stringify({ autosave: disabled, extra: 'kept' })), disabled);
  assert.throws(() => read('{'), /손상/);
  assert.throws(() => read(JSON.stringify({ version: 2 })), /새로운 버전/);
  assert.throws(() => readRecoverySettings({ getItem: () => { throw new Error('blocked'); } }), /읽지 못/);
});

test('settings watcher responds to iframe storage event and preserves last known settings on failure', () => {
  const events = new EventTarget(), changed: RecoverySettings[] = [], errors: unknown[] = [];
  let raw = JSON.stringify({ version: 1, autosave: disabled });
  const watcher = watchRecoverySettings({ storage: { getItem: () => raw }, events, onChange: s => changed.push(s), onError: e => errors.push(e) });
  const send = (key: string | null) => { const e = new Event('storage'); Object.assign(e, { key }); events.dispatchEvent(e); };
  assert.equal(changed.length, 1);
  raw = JSON.stringify({ version: 1, autosave: { ...disabled, idleSaveEnabled: true } });
  send('unrelated'); assert.equal(changed.length, 1);
  send('rhwp-settings'); assert.equal(changed.length, 2);
  raw = '{'; send(null); assert.equal(changed.length, 2); assert.equal(errors.length, 1);
  watcher.dispose(); send('rhwp-settings'); assert.equal(errors.length, 1);
});
