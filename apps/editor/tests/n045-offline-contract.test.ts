import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { auditN045OfflineBundle, classifyN045OfflineFailure, compileN045EndpointAllowlist, validateN045OfflinePolicy } from '../scripts/lib/n045-offline-contract.mjs';

const fixture = () => JSON.parse(readFileSync(new URL('./fixtures/n045-offline-policy/manifest.json', import.meta.url), 'utf8'));
const sha = (value: Buffer) => createHash('sha256').update(value).digest('hex');

async function syntheticBundle() {
  const root = await mkdtemp(join(tmpdir(), 'jueony-n045-'));
  const policy = fixture();
  for (const group of ['runtimeFiles', 'fonts', 'noticeFiles']) for (const entry of policy[group]) {
    entry.minBytes = 1;
    const target = join(root, ...entry.path.split('/'));
    await mkdir(join(target, '..'), { recursive: true });
    await writeFile(target, entry.path.endsWith('.html') ? '<script src="./local.js"></script>' : 'local');
  }
  await mkdir(join(root, 'assets'), { recursive: true });
  const rhwp = Buffer.from('rhwp-local');
  await writeFile(join(root, 'assets/rhwp_bg-fixture.wasm'), rhwp);
  await writeFile(join(root, 'assets/canvaskit-fixture.wasm'), 'canvas-local');
  policy.wasmAssets.forEach(entry => { entry.minBytes = 1; });
  await writeFile(join(root, 'build-evidence.json'), JSON.stringify({ engineWasmSha256: sha(rhwp) }));
  return { root, policy };
}

test('N045 offline manifest is exact and covers runtime, WASM, fonts and notices', () => {
  const policy = validateN045OfflinePolicy(fixture());
  assert.deepEqual(policy.wasmAssets.map(entry => entry.kind).sort(), ['canvaskit', 'rhwp-engine']);
  const extra = fixture(); extra.unexpected = true;
  assert.throws(() => validateN045OfflinePolicy(extra));
  const traversal = fixture(); traversal.fonts[0].path = '../secret.woff2';
  assert.throws(() => validateN045OfflinePolicy(traversal));
});

test('N045 bundle audit hashes local assets and rejects external literals and evidence mismatch', async () => {
  const { root, policy } = await syntheticBundle();
  try {
    const report = await auditN045OfflineBundle(root, policy);
    assert.equal(report.status, 'PASS_OFFLINE_BUNDLE');
    assert.equal(report.wasm.length, 2);
    assert.equal(report.externalNetworkLiterals.length, 0);
    assert.equal(report.inertNamespaceLiterals.length, 0);
    await writeFile(join(root, 'jueony-boot.js'), 'fetch("https://outside.invalid/x")');
    await assert.rejects(auditN045OfflineBundle(root, policy), /external network literal rejected/u);
    await writeFile(join(root, 'jueony-boot.js'), 'local');
    const evidence = JSON.parse(await readFile(join(root, 'build-evidence.json'), 'utf8'));
    evidence.engineWasmSha256 = '0'.repeat(64);
    await writeFile(join(root, 'build-evidence.json'), JSON.stringify(evidence));
    await assert.rejects(auditN045OfflineBundle(root, policy), /WASM evidence hash mismatch/u);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('N045 endpoint allowlist rejects empty, wildcard, sibling host and path escape', () => {
  assert.equal(compileN045EndpointAllowlist([])('https://api.example.invalid/v1/chat'), false);
  assert.throws(() => compileN045EndpointAllowlist([{ origin: 'https://*.example.invalid', pathPrefix: '/v1' }]));
  const allowed = compileN045EndpointAllowlist([{ origin: 'https://api.example.invalid', pathPrefix: '/v1' }]);
  assert.equal(allowed('https://api.example.invalid/v1/chat?trace=1'), true);
  for (const value of ['http://api.example.invalid/v1/chat', 'https://evil.example.invalid/v1/chat', 'https://api.example.invalid/v10/chat', 'https://user@api.example.invalid/v1/chat', 'https://api.example.invalid/other']) assert.equal(allowed(value), false);
});

test('N045 audit failures use explicit bounded classifications', () => {
  assert.equal(classifyN045OfflineFailure(new Error('external network literal rejected (2): x.js https://x.invalid')).code, 'EXTERNAL_NETWORK_LITERAL');
  assert.equal(classifyN045OfflineFailure(new Error('WASM evidence hash mismatch: rhwp-engine')).code, 'WASM_HASH_MISMATCH');
  assert.equal(classifyN045OfflineFailure('x'.repeat(3000)).message.length, 2048);
});
