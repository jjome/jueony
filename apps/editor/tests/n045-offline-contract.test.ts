import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { auditN045OfflineBundle, classifyN045OfflineFailure, compileN045EndpointAllowlist, validateN045OfflinePolicy, validateN045WebView2RuntimeManifest } from '../scripts/lib/n045-offline-contract.mjs';

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
  const webView2Artifact = Buffer.from('synthetic WebView2 fixed-version runtime artifact');
  const webView2License = Buffer.from('synthetic WebView2 license text');
  const webView2Notice = Buffer.from('synthetic WebView2 third-party notice text');
  const webView2Manifest = {
    schemaVersion: 1,
    artifactKind: 'webview2-fixed-version-runtime',
    distributionMode: 'offline',
    version: '130.0.2849.80',
    architecture: 'x64',
    artifact: {
      path: 'runtime/webview2/Microsoft.WebView2.FixedVersionRuntime.130.0.2849.80.x64.cab',
      minBytes: webView2Artifact.byteLength,
      sha256: sha(webView2Artifact),
    },
    license: {
      path: 'runtime/webview2/LICENSE.txt',
      minBytes: webView2License.byteLength,
      sha256: sha(webView2License),
    },
    notice: {
      path: 'runtime/webview2/THIRD_PARTY_NOTICES.txt',
      minBytes: webView2Notice.byteLength,
      sha256: sha(webView2Notice),
    },
  };
  for (const [path, bytes] of [
    [webView2Manifest.artifact.path, webView2Artifact],
    [webView2Manifest.license.path, webView2License],
    [webView2Manifest.notice.path, webView2Notice],
  ]) {
    const target = join(root, ...path.split('/'));
    await mkdir(join(target, '..'), { recursive: true });
    await writeFile(target, bytes);
  }
  const webView2ManifestTarget = join(root, ...policy.webView2FixedRuntimeManifest.path.split('/'));
  await mkdir(join(webView2ManifestTarget, '..'), { recursive: true });
  await writeFile(webView2ManifestTarget, JSON.stringify(webView2Manifest));
  policy.webView2FixedRuntimeManifest.minBytes = 1;
  return { root, policy, webView2Manifest };
}

test('N045 offline manifest is exact and covers runtime, WASM, fonts and notices', () => {
  const policy = validateN045OfflinePolicy(fixture());
  assert.deepEqual(policy.wasmAssets.map(entry => entry.kind).sort(), ['canvaskit', 'rhwp-engine']);
  const extra = fixture(); extra.unexpected = true;
  assert.throws(() => validateN045OfflinePolicy(extra));
  const traversal = fixture(); traversal.fonts[0].path = '../secret.woff2';
  assert.throws(() => validateN045OfflinePolicy(traversal));
  const missingWebView2 = fixture(); delete missingWebView2.webView2FixedRuntimeManifest;
  assert.throws(() => validateN045OfflinePolicy(missingWebView2));
  const rangedWebView2 = fixture(); rangedWebView2.webView2FixedRuntimeManifest.version = '130.*';
  assert.throws(() => validateN045OfflinePolicy(rangedWebView2));
  const wrongArchitecture = fixture(); wrongArchitecture.webView2FixedRuntimeManifest.architecture = 'universal';
  assert.throws(() => validateN045OfflinePolicy(wrongArchitecture));
});

test('N045 WebView2 manifest accepts one exact fixed offline artifact and rejects ranges, unsafe paths and weak hashes', () => {
  const manifest = {
    schemaVersion: 1,
    artifactKind: 'webview2-fixed-version-runtime',
    distributionMode: 'offline',
    version: '130.0.2849.80',
    architecture: 'x64',
    artifact: { path: 'runtime/webview2/Microsoft.WebView2.FixedVersionRuntime.130.0.2849.80.x64.cab', minBytes: 1, sha256: '1'.repeat(64) },
    license: { path: 'runtime/webview2/LICENSE.txt', minBytes: 1, sha256: '2'.repeat(64) },
    notice: { path: 'runtime/webview2/THIRD_PARTY_NOTICES.txt', minBytes: 1, sha256: '3'.repeat(64) },
  };
  assert.equal(validateN045WebView2RuntimeManifest(manifest).version, '130.0.2849.80');
  for (const version of ['latest', '130.*', '130.0.2849', '130.0.2849.80-beta']) {
    assert.throws(() => validateN045WebView2RuntimeManifest({ ...manifest, version }));
  }
  assert.throws(() => validateN045WebView2RuntimeManifest({ ...manifest, architecture: 'universal' }));
  assert.throws(() => validateN045WebView2RuntimeManifest({ ...manifest, artifact: { ...manifest.artifact, path: '../runtime.cab' } }));
  assert.throws(() => validateN045WebView2RuntimeManifest({ ...manifest, artifact: { ...manifest.artifact, path: 'C:/runtime.cab' } }));
  assert.throws(() => validateN045WebView2RuntimeManifest({ ...manifest, artifact: { ...manifest.artifact, sha256: 'A'.repeat(64) } }));
  assert.throws(() => validateN045WebView2RuntimeManifest({ ...manifest, artifact: { ...manifest.artifact, path: 'runtime/webview2/wrong-name.cab' } }));
  assert.throws(() => validateN045WebView2RuntimeManifest({ ...manifest, notice: { ...manifest.license } }));
});

test('N045 bundle audit hashes local assets and rejects external literals and evidence mismatch', async () => {
  const { root, policy } = await syntheticBundle();
  try {
    const report = await auditN045OfflineBundle(root, policy);
    assert.equal(report.status, 'PASS_OFFLINE_BUNDLE');
    assert.equal(report.wasm.length, 2);
    assert.equal(report.webView2FixedRuntime.version, '130.0.2849.80');
    assert.equal(report.webView2FixedRuntime.architecture, 'x64');
    assert.equal(report.webView2FixedRuntime.distributionMode, 'offline');
    assert.equal(report.externalNetworkLiterals.length, 0);
    assert.equal(report.inertNamespaceLiterals.length, 0);
    assert.equal(report.inertHelpLiterals.length, 0);
    await writeFile(join(root, 'jueony-boot.js'), 'fetch("https://outside.invalid/x")');
    await assert.rejects(auditN045OfflineBundle(root, policy), /external network literal rejected/u);
    await writeFile(join(root, 'jueony-boot.js'), 'local');
    const evidence = JSON.parse(await readFile(join(root, 'build-evidence.json'), 'utf8'));
    evidence.engineWasmSha256 = '0'.repeat(64);
    await writeFile(join(root, 'build-evidence.json'), JSON.stringify(evidence));
    await assert.rejects(auditN045OfflineBundle(root, policy), /WASM evidence hash mismatch/u);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('N045 WebView2 bundle verification fails closed on artifact, license, notice and linkage defects', async () => {
  const cases = [
    async ({ root, webView2Manifest }) => writeFile(join(root, ...webView2Manifest.artifact.path.split('/')), 'tampered runtime'),
    async ({ root, webView2Manifest }) => writeFile(join(root, ...webView2Manifest.license.path.split('/')), 'tampered license'),
    async ({ root, webView2Manifest }) => writeFile(join(root, ...webView2Manifest.notice.path.split('/')), 'tampered notice'),
    async ({ root, policy, webView2Manifest }) => {
      policy.noticeFiles = policy.noticeFiles.filter(entry => entry.path !== webView2Manifest.notice.path);
    },
    async ({ root, policy }) => writeFile(join(root, ...policy.webView2FixedRuntimeManifest.path.split('/')), '{'),
    async ({ policy }) => { policy.webView2FixedRuntimeManifest.version = '131.0.0.0'; },
    async ({ policy }) => { policy.webView2FixedRuntimeManifest.architecture = 'arm64'; },
  ];
  for (const corrupt of cases) {
    const bundle = await syntheticBundle();
    try {
      await corrupt(bundle);
      await assert.rejects(auditN045OfflineBundle(bundle.root, bundle.policy), /N045 WebView2/u);
    } finally { await rm(bundle.root, { recursive: true, force: true }); }
  }
});

test('N045 audit distinguishes exact namespace and help text identifiers from requestable endpoints', async () => {
  const { root, policy } = await syntheticBundle();
  try {
    await writeFile(join(root, 'jueony-boot.js'), [
      'const svg="http://www.w3.org/2000/svg";',
      'const xsd="http://www.w3.org/2001/XMLSchema";',
      'const help="https://example.com";',
    ].join('\n'));
    const report = await auditN045OfflineBundle(root, policy);
    assert.equal(report.externalNetworkLiterals.length, 0);
    assert.equal(report.inertNamespaceLiterals.length, 2);
    assert.equal(report.inertHelpLiterals.length, 1);
    await writeFile(join(root, 'jueony-boot.js'), 'const endpoint="https://api.example.invalid/v1";');
    await assert.rejects(auditN045OfflineBundle(root, policy), /external network literal rejected/u);
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
  assert.equal(classifyN045OfflineFailure(new Error('N045 WebView2 artifact hash mismatch')).code, 'WEBVIEW2_FIXED_RUNTIME_REJECTED');
  assert.equal(classifyN045OfflineFailure('x'.repeat(3000)).message.length, 2048);
});
