import { createHash } from 'node:crypto';
import { lstat, readFile, readdir } from 'node:fs/promises';
import { basename, extname, relative, resolve, sep } from 'node:path';
export {compileInstitutionEndpoints as compileN045EndpointAllowlist} from '../../../launcher/providers/endpoint-policy.mjs';

const ROOT_KEYS = ['schemaVersion', 'policyId', 'runtimeFiles', 'wasmAssets', 'fonts', 'noticeFiles', 'webView2FixedRuntimeManifest', 'scanExtensions'];
const FILE_KEYS = ['path', 'minBytes'];
const WASM_KEYS = ['kind', 'minBytes', 'evidenceSha256Key'];
const WEBVIEW2_MANIFEST_KEYS = ['schemaVersion', 'artifactKind', 'distributionMode', 'version', 'architecture', 'artifact', 'license', 'notice'];
const WEBVIEW2_POLICY_KEYS = ['path', 'minBytes', 'version', 'architecture'];
const HASHED_FILE_KEYS = ['path', 'minBytes', 'sha256'];
const WASM_KINDS = new Set(['rhwp-engine', 'canvaskit']);
const WEBVIEW2_ARCHITECTURES = new Set(['x64', 'x86', 'arm64']);
const WASM_PATTERNS = {
  'rhwp-engine': /^assets\/rhwp_bg-[A-Za-z0-9_-]+\.wasm$/u,
  canvaskit: /^assets\/canvaskit-[A-Za-z0-9_-]+\.wasm$/u,
};
const HASH = /^[a-f0-9]{64}$/u;
const NETWORK_LITERAL = /\b(?:https?|wss?):\/\/[^\s"'`<>\\)]+/giu;
const INERT_NAMESPACE_IDENTIFIERS = new Set([
  'http://www.w3.org/2000/svg',
  'http://www.w3.org/1999/xlink',
  'http://www.w3.org/TR/REC-html40',
  'http://www.w3.org/2001/XMLSchema',
  'http://www.w3.org/2000/xmlns/',
  'http://www.mozilla.org/newlayout/xml/parsererror.xml',
  'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
  'http://schemas.openxmlformats.org/package/2006/relationships',
  'http://schemas.openxmlformats.org/spreadsheetml/2006/main',
  'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
  'http://purl.oclc.org/ooxml/officeDocument/relationships',
  'http://purl.oclc.org/ooxml/spreadsheetml/main',
  'http://purl.oclc.org/ooxml/wordprocessingml/main',
  'http://www.w3.org/1999/XSL/Transform',
  'http://www.w3.org/1999/xhtml',
  'http://www.w3.org/2000/09/xmldsig#',
  'http://ns.adobe.com/xdp/',
  'http://ns.adobe.com/xdp/pdf/',
  'http://ns.adobe.com/xfdf/',
  'http://ns.adobe.com/xmpmeta/',
  ...['xfa-connection-set','xfa-data','xfa-data/1.0','xfa-form','xfa-locale-set','xfa-source-set','xfa-template','xci','xdc']
    .map(namespace=>`http://www.xfa.org/schema/${namespace}/`),
]);
const INERT_HELP_LITERALS = new Set(['https://example.com', 'https://로']);
const PDF_PARSER_LITERALS=new Set(['http://${e}','http://example.com','https://foo.bar','http://www.apache.org/licenses/LICENSE-2.0']);
const OCR_METADATA_LITERALS=new Set([
  'http://localhost:3000/dist/tesseract.min.js','https://github.com/naptha/tesseract.js.git',
  'https://github.com/naptha/tesseract.js/issues','https://github.com/naptha/tesseract.js','https://opencollective.com/tesseractjs',
]);
function isDependencyReference(path,value){
  if(path==='pdfjs/pdf.worker.min.mjs'||/^assets\/pdf-[\w-]+\.js$/u.test(path))return PDF_PARSER_LITERALS.has(value);
  if(/^assets\/src-[\w-]+\.js$/u.test(path))return OCR_METADATA_LITERALS.has(value);
  return /^assets\/rolldown-runtime-[\w-]+\.js$/u.test(path)&&value==='https://rolldown.rs/in-depth/bundling-cjs#require-external-modules';
}
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const exact = (value, keys) => Object.keys(value).sort().join(',') === [...keys].sort().join(',');
const text = (value, max = 200) => typeof value === 'string' && value.length > 0 && value.length <= max && !/[\u0000-\u001f]/u.test(value);
const safePath = value => text(value, 240) && !value.includes('\\') && !value.startsWith('/') && !value.split('/').includes('..');
const safeArtifactPath = value => safePath(value) && !value.includes(':') && !value.includes('?') && !value.includes('#')
  && value.split('/').every(segment => segment !== '' && segment !== '.' && /^[A-Za-z0-9._-]+$/u.test(segment));
const positive = value => Number.isSafeInteger(value) && value > 0;
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const fixedVersion = value => typeof value === 'string' && /^[1-9][0-9]{0,3}(?:\.[0-9]{1,5}){3}$/u.test(value);

function validateFile(value) {
  if (!record(value) || !exact(value, FILE_KEYS) || !safePath(value.path) || !positive(value.minBytes)) throw Error('N045 required file contract mismatch');
  return { path: value.path, minBytes: value.minBytes };
}

function validateHashedFile(value) {
  if (!record(value) || !exact(value, HASHED_FILE_KEYS) || !safeArtifactPath(value.path)
    || !positive(value.minBytes) || typeof value.sha256 !== 'string' || !HASH.test(value.sha256)) {
    throw Error('N045 WebView2 hashed file contract mismatch');
  }
  return { path: value.path, minBytes: value.minBytes, sha256: value.sha256 };
}

export function validateN045WebView2RuntimeManifest(value) {
  if (!record(value) || !exact(value, WEBVIEW2_MANIFEST_KEYS) || value.schemaVersion !== 1
    || value.artifactKind !== 'webview2-fixed-version-runtime' || value.distributionMode !== 'offline'
    || !fixedVersion(value.version) || !WEBVIEW2_ARCHITECTURES.has(value.architecture)) {
    throw Error('N045 WebView2 fixed runtime manifest mismatch');
  }
  const artifact = validateHashedFile(value.artifact);
  const license = validateHashedFile(value.license);
  const notice = validateHashedFile(value.notice);
  const paths = [artifact.path, license.path, notice.path];
  if (new Set(paths).size !== paths.length) throw Error('N045 WebView2 linked path duplicate');
  const expectedName = `Microsoft.WebView2.FixedVersionRuntime.${value.version}.${value.architecture}`;
  const artifactName = basename(artifact.path);
  if (artifactName !== `${expectedName}.cab` && artifactName !== `${expectedName}.zip`) {
    throw Error('N045 WebView2 artifact identity mismatch');
  }
  return {
    schemaVersion: 1,
    artifactKind: value.artifactKind,
    distributionMode: value.distributionMode,
    version: value.version,
    architecture: value.architecture,
    artifact,
    license,
    notice,
  };
}

export function validateN045OfflinePolicy(value) {
  if (!record(value) || !exact(value, ROOT_KEYS) || value.schemaVersion !== 1 || !text(value.policyId, 80)) throw Error('N045 offline policy contract mismatch');
  const list = (name, minimum, maximum) => {
    const entries = value[name];
    if (!Array.isArray(entries) || entries.length < minimum || entries.length > maximum) throw Error(`N045 ${name} contract mismatch`);
    return entries;
  };
  const runtimeFiles = list('runtimeFiles', 3, 32).map(validateFile);
  const noticeFiles = list('noticeFiles', 2, 16).map(validateFile);
  const fonts = list('fonts', 3, 64).map(validateFile);
  const rawWebView2Policy = value.webView2FixedRuntimeManifest;
  if (!record(rawWebView2Policy) || !exact(rawWebView2Policy, WEBVIEW2_POLICY_KEYS)
    || !safeArtifactPath(rawWebView2Policy.path) || !rawWebView2Policy.path.endsWith('.json')
    || !positive(rawWebView2Policy.minBytes) || !fixedVersion(rawWebView2Policy.version)
    || !WEBVIEW2_ARCHITECTURES.has(rawWebView2Policy.architecture)) {
    throw Error('N045 WebView2 manifest path mismatch');
  }
  const webView2FixedRuntimeManifest = {
    path: rawWebView2Policy.path,
    minBytes: rawWebView2Policy.minBytes,
    version: rawWebView2Policy.version,
    architecture: rawWebView2Policy.architecture,
  };
  const wasmAssets = list('wasmAssets', 2, 2).map(entry => {
    if (!record(entry) || !exact(entry, WASM_KEYS) || !WASM_KINDS.has(entry.kind) || !positive(entry.minBytes)
      || (entry.evidenceSha256Key !== null && !text(entry.evidenceSha256Key, 80))) throw Error('N045 wasm contract mismatch');
    return { kind: entry.kind, minBytes: entry.minBytes, evidenceSha256Key: entry.evidenceSha256Key };
  });
  if (new Set(wasmAssets.map(item => item.kind)).size !== 2) throw Error('N045 wasm kind coverage mismatch');
  const scanExtensions = list('scanExtensions', 2, 12);
  if (new Set(scanExtensions).size !== scanExtensions.length || scanExtensions.some(item => !/^\.[a-z0-9]+$/u.test(item))) throw Error('N045 scan extension contract mismatch');
  const paths = [...runtimeFiles, ...noticeFiles, ...fonts, webView2FixedRuntimeManifest].map(item => item.path);
  if (new Set(paths).size !== paths.length) throw Error('N045 required path duplicate');
  return { schemaVersion: 1, policyId: value.policyId, runtimeFiles, wasmAssets, fonts, noticeFiles, webView2FixedRuntimeManifest, scanExtensions: [...scanExtensions] };
}

async function filesBelow(root) {
  const result = [];
  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const absolute = resolve(directory, entry.name);
      const metadata = await lstat(absolute);
      if (metadata.isSymbolicLink()) throw Error(`symbolic link rejected: ${relative(root, absolute)}`);
      if (metadata.isDirectory()) await visit(absolute);
      else if (metadata.isFile()) result.push({ absolute, path: relative(root, absolute).split(sep).join('/'), bytes: metadata.size });
    }
  }
  await visit(root);
  return result.sort((left, right) => left.path.localeCompare(right.path));
}

async function scanNetworkLiterals(files, extensions) {
  const externalNetworkLiterals = [];
  const inertNamespaceLiterals = [];
  const inertHelpLiterals = [];
  for (const file of files) {
    if (!extensions.includes(extname(file.path).toLowerCase())) continue;
    const source = await readFile(file.absolute, 'utf8');
    for (const match of source.matchAll(NETWORK_LITERAL)) {
      const found = { path: file.path, value: match[0].slice(0, 500) };
      if (INERT_NAMESPACE_IDENTIFIERS.has(found.value)) inertNamespaceLiterals.push(found);
      else if (INERT_HELP_LITERALS.has(found.value)||isDependencyReference(found.path,found.value)) inertHelpLiterals.push(found);
      else externalNetworkLiterals.push(found);
    }
  }
  return { externalNetworkLiterals, inertNamespaceLiterals, inertHelpLiterals };
}

export async function inventoryN045NetworkLiterals(directory, rawPolicy) {
  const fields = validateN045OfflinePolicy(rawPolicy);
  return scanNetworkLiterals(await filesBelow(resolve(directory)), fields.scanExtensions);
}

export async function auditN045OfflineBundle(directory, rawPolicy) {
  const root = resolve(directory);
  const policy = validateN045OfflinePolicy(rawPolicy);
  const files = await filesBelow(root);
  const byPath = new Map(files.map(item => [item.path, item]));
  const buildEvidence = JSON.parse(await readFile(resolve(root, 'build-evidence.json'), 'utf8'));
  const checkFiles = async entries => Promise.all(entries.map(async expected => {
    const found = byPath.get(expected.path);
    if (!found || found.bytes < expected.minBytes) throw Error(`required local asset missing or truncated: ${expected.path}`);
    const bytes = await readFile(found.absolute);
    return { path: found.path, bytes: found.bytes, sha256: sha256(bytes) };
  }));
  const runtimeFiles = await checkFiles(policy.runtimeFiles);
  const fonts = await checkFiles(policy.fonts);
  const notices = await checkFiles(policy.noticeFiles);
  const webView2ManifestFile = (await checkFiles([policy.webView2FixedRuntimeManifest]))[0];
  let rawWebView2Manifest;
  try {
    rawWebView2Manifest = JSON.parse(await readFile(resolve(root, webView2ManifestFile.path), 'utf8'));
  } catch {
    throw Error('N045 WebView2 manifest unreadable');
  }
  const webView2Manifest = validateN045WebView2RuntimeManifest(rawWebView2Manifest);
  if (webView2Manifest.version !== policy.webView2FixedRuntimeManifest.version
    || webView2Manifest.architecture !== policy.webView2FixedRuntimeManifest.architecture) {
    throw Error('N045 WebView2 pinned version or architecture mismatch');
  }
  const noticePaths = new Set(policy.noticeFiles.map(entry => entry.path));
  if (!noticePaths.has(webView2Manifest.license.path) || !noticePaths.has(webView2Manifest.notice.path)) {
    throw Error('N045 WebView2 license or notice linkage mismatch');
  }
  const linkedWebView2Files = {};
  for (const [role, expected] of Object.entries({ artifact: webView2Manifest.artifact, license: webView2Manifest.license, notice: webView2Manifest.notice })) {
    const found = byPath.get(expected.path);
    if (!found || found.bytes < expected.minBytes) throw Error(`N045 WebView2 ${role} missing or truncated`);
    const digest = sha256(await readFile(found.absolute));
    if (digest !== expected.sha256) throw Error(`N045 WebView2 ${role} hash mismatch`);
    linkedWebView2Files[role] = { path: found.path, bytes: found.bytes, sha256: digest };
  }
  const webView2FixedRuntime = {
    version: webView2Manifest.version,
    architecture: webView2Manifest.architecture,
    distributionMode: webView2Manifest.distributionMode,
    manifest: webView2ManifestFile,
    ...linkedWebView2Files,
  };
  const wasm = [];
  for (const expected of policy.wasmAssets) {
    const matches = files.filter(item => WASM_PATTERNS[expected.kind].test(item.path));
    if (matches.length !== 1 || matches[0].bytes < expected.minBytes) throw Error(`required WASM mismatch: ${expected.kind}`);
    const digest = sha256(await readFile(matches[0].absolute));
    if (!HASH.test(digest)) throw Error(`invalid WASM hash: ${expected.kind}`);
    if (expected.evidenceSha256Key !== null) {
      const recorded = buildEvidence[expected.evidenceSha256Key];
      if (!HASH.test(recorded) || recorded !== digest) throw Error(`WASM evidence hash mismatch: ${expected.kind}`);
    }
    wasm.push({ kind: expected.kind, path: matches[0].path, bytes: matches[0].bytes, sha256: digest, evidenceMatched: expected.evidenceSha256Key !== null });
  }
  const { externalNetworkLiterals, inertNamespaceLiterals, inertHelpLiterals } = await scanNetworkLiterals(files, policy.scanExtensions);
  if (externalNetworkLiterals.length) throw Error(`external network literal rejected (${externalNetworkLiterals.length}): ${externalNetworkLiterals[0].path} ${externalNetworkLiterals[0].value}`);
  return { schemaVersion: 1, policyId: policy.policyId, status: 'PASS_OFFLINE_BUNDLE', filesScanned: files.length, runtimeFiles, wasm, fonts, notices, webView2FixedRuntime, externalNetworkLiterals, inertNamespaceLiterals, inertHelpLiterals };
}

export function classifyN045OfflineFailure(error) {
  const message = String(error instanceof Error ? error.message : error).slice(0, 2048);
  const code = message.startsWith('external network literal rejected') ? 'EXTERNAL_NETWORK_LITERAL'
    : message.startsWith('WASM evidence hash mismatch') ? 'WASM_HASH_MISMATCH'
      : message.startsWith('N045 WebView2') ? 'WEBVIEW2_FIXED_RUNTIME_REJECTED'
      : message.startsWith('required ') ? 'REQUIRED_LOCAL_ASSET_MISSING'
        : message.startsWith('symbolic link rejected') ? 'SYMLINK_REJECTED' : 'OFFLINE_AUDIT_FAILED';
  return { code, message };
}
