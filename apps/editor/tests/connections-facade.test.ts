import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LocalModelGateway } from '../src/adapters/http/local-model-gateway.ts';
import type { ModelConfig, ModelInput, ConnectionFacade, ModelGatewayPort } from '../src/modules/connections/public/index.ts';

const config: ModelConfig = { id: 'selected', adapterId: 'anthropic', label: 'Fixture', endpoint: 'https://fixture.invalid/v1', modelId: 'fixture-model' };
const input: ModelInput = { request: 'fixture', document: { revision: 'r1', name: 'fixture', nodes: [], limitations: [] }, references: [], history: [] };

test('connection facade and model port share one HTTP adapter without leaking credentials into generation', async () => {
  const requests: { url: string; init?: RequestInit }[] = [];
  const fetcher = (async (url: string | URL | Request, init?: RequestInit) => {
    requests.push({ url: String(url), init });
    const response = String(url).endsWith('/session') ? { token: 'fixture-session', documentControlVersion: 1, providerCatalogVersion: 1 } : String(url).endsWith('/generate') ? { result: { message: 'done', operations: [], sourceIds: [] } } : { configured: true };
    return new Response(JSON.stringify(response), { status: 200 });
  }) as typeof fetch;
  const adapter = new LocalModelGateway(fetcher), connections: ConnectionFacade = adapter, model: ModelGatewayPort = adapter;
  await connections.configure(config, 'fake-key', true);
  const signal = new AbortController().signal;
  const result = await model.generate(input, config, signal);
  assert.deepEqual(requests.map(r => r.url), ['/api/session', '/api/configure', '/api/generate']);
  assert.deepEqual(JSON.parse(String(requests[2].init?.body)), { configId: 'selected', input });
  assert.doesNotMatch(String(requests[2].init?.body), /fake-key|fixture.invalid|fixture-model/);
  assert.equal(requests[2].init?.signal, signal);
  assert.equal((requests[2].init?.headers as Record<string, string>)['X-Jueony-Token'], 'fixture-session');
  assert.deepEqual(result, { message: 'done', operations: [], sourceIds: [] });
});

test('unsupported session contracts never receive connection credentials', async () => {
  const calls: string[] = [];
  const fetcher = (async (url: string | URL | Request) => { calls.push(String(url)); return new Response(JSON.stringify({ token: '', documentControlVersion: 1, providerCatalogVersion: 1 })); }) as typeof fetch;
  await assert.rejects(new LocalModelGateway(fetcher).configure(config, 'fake-key'), /이전 AI 서버/);
  assert.deepEqual(calls, ['/api/session']);
});
