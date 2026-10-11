import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createModelService } from '../services/model-service.mjs';

const config = { id: 'fixture', adapterId: 'fixture', label: 'Fixture', endpoint: 'https://fixture.invalid/v1', modelId: 'model-a' };
const result = { message: 'connected', operations: [], sourceIds: [] };
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
function fixture(overrides = {}) {
  const calls = [], writes = [];
  const store = { available: true, load: async () => [], save: async records => { writes.push(structuredClone(records)); }, clear: async () => { writes.push([]); }, ...overrides };
  const registry = new Map([['fixture', (selected, key) => ({ generate: async (input, signal) => { calls.push({ config: selected, key, input, signal }); return result; } })]]);
  return { store, registry, calls, writes };
}

test('service keeps key reuse, metadata isolation, and probe context independent of HTTP', async () => {
  const f = fixture(), service = await createModelService({ registry: f.registry, connectionStore: f.store });
  await service.configure({ config: { ...config, secret: 'not-metadata' }, key: 'fake-only', remember: true });
  const metadata = service.connections();
  assert.doesNotMatch(JSON.stringify(metadata), /fake-only|not-metadata/);
  metadata.connections[0].config.endpoint = 'https://other.invalid';
  await service.configure({ config: { ...config, modelId: 'model-b' }, remember: true });
  const signal = new AbortController().signal;
  await service.generate(config.id, { custom: 'document' }, signal);
  assert.equal(f.calls[0].key, 'fake-only');
  assert.equal(f.calls[0].config.modelId, 'model-b');
  assert.equal(f.calls[0].signal, signal);
  await assert.rejects(service.configure({ config: { ...config, endpoint: 'https://other.invalid' } }), /새 API 키/);
  assert.deepEqual(await service.testConnection({ config, input: { private: 'must-not-send' } }, signal), { connected: true, documentSent: false });
  assert.deepEqual(f.calls[1].input.references, []);
  assert.doesNotMatch(JSON.stringify(f.calls[1].input), /must-not-send|custom/);
});

test('serialized mutations preserve existing connections when encrypted save fails', async () => {
  let fail = false;
  const f = fixture({ save: async records => { if (fail) throw new Error('fixture-store-failure'); f.writes.push(structuredClone(records)); } });
  const service = await createModelService({ registry: f.registry, connectionStore: f.store });
  await service.configure({ config, key: 'first-fake', remember: true });
  fail = true;
  await assert.rejects(service.configure({ config, key: 'replacement-fake', remember: true }), /fixture-store-failure/);
  await service.generate(config.id, {}, new AbortController().signal);
  assert.equal(f.calls[0].key, 'first-fake');
  fail = false;
  await Promise.all([
    service.configure({ config: { ...config, id: 'second' }, key: 'second-fake', remember: true }),
    service.removeConnection(config.id),
  ]);
  assert.deepEqual(service.connections().connections.map(c => c.config.id), ['second']);
  assert.deepEqual(f.writes.at(-1).map(c => c.config.id), ['second']);
});

test('corrupt restoration blocks writes until explicit clear, without leaking partial records', async () => {
  const f = fixture({ load: async () => [{ config, key: 'fake' }, { config: { ...config, id: 'invalid', adapterId: 'missing' }, key: 'fake' }] });
  const service = await createModelService({ registry: f.registry, connectionStore: f.store });
  assert.deepEqual(service.connections().connections, []);
  assert.ok(service.connections().warning);
  await assert.rejects(service.configure({ config, key: 'new-fake', remember: true }), /복원하지/);
  await assert.rejects(service.removeConnection(config.id), /복원하지/);
  assert.equal(f.writes.length, 0);
  await service.clearCredentials();
  await service.configure({ config, key: 'new-fake', remember: true });
  assert.equal(service.connections().warning, '');
});

test('active request budget releases on provider failure and cancellation is forwarded', async () => {
  const gate = deferred();
  let call = 0, observed;
  const registry = new Map([['fixture', () => ({ generate: async (_, signal) => { observed = signal; call++; if (call === 1) { await gate.promise; throw new Error('fixture-provider-failure'); } return result; } })]]);
  const service = await createModelService({ registry, connectionStore: fixture().store, maxActive: 1 });
  await service.configure({ config, key: 'fake' });
  const abort = new AbortController();
  const pending = service.generate(config.id, {}, abort.signal);
  await assert.rejects(service.generate(config.id, {}, abort.signal), error => error.statusCode === 429);
  abort.abort();
  assert.equal(observed.aborted, true);
  gate.resolve();
  await assert.rejects(pending, /fixture-provider-failure/);
  assert.deepEqual(await service.generate(config.id, {}, new AbortController().signal), { result });
});
