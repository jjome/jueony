// Inspect and corrupt our own generated cache descriptor independently of Rust.
import assert from 'node:assert/strict';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {resolve, dirname, isAbsolute, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadReviewEngine, hash, snapshot, compareSnapshots} from './lib/hancom-review.mjs';
import {readOwnedZip, writeOwnedZip} from './lib/owned-zip.mjs';
import {verifyPreservedExport} from '../src/adapters/rhwp/preservation.ts';

for (const key of ['JUEONY_ENGINE_PACKAGE', 'JUEONY_TEST_OUTPUT']) assert.ok(isAbsolute(process.env[key] ?? ''), key);
const app = resolve(dirname(fileURLToPath(import.meta.url)), '..'), repo = resolve(app, '../..');
const out = resolve(process.env.JUEONY_TEST_OUTPUT); await mkdir(out, {recursive: true});
const engine = await loadReviewEngine(process.env.JUEONY_ENGINE_PACKAGE);
const descriptorPath = 'META-INF/rhwp-computed-native-rows-v1.json';
const fixture = join(repo, 'docs/evidence/file-completion-2026-10-18/engine76/columns-native/fixtures/build/file-closure69-public/column2-candidate74/valid-negative-disk/baseline-single_column.hwp');
const source = await readFile(fixture); assert.equal(hash(source), '9778d66926e3138ce4bb51fadfd16173ee3d439aeec0a02a8f0af34b7fac0f3b');
const doc = new engine.HwpDocument(source), prefix = '앞 문단 줄바꿈을 유발하는 본문입니다. '.repeat(25);
doc.insertText(0, 0, doc.getParagraphLength(0, 0), prefix);
const live = snapshot(doc), text = doc.getTextFileUnicode(), artifact = doc.exportHwpxWithReport();
let bytes, loss;
try {bytes = artifact.takeBytes(); loss = JSON.parse(artifact.contentLoss());} finally {artifact.free();}
const original = readOwnedZip(bytes), parts = new Map(original);
const results = [], failures = [], observations = [];
async function scenario(name, run) {
  try {await run(); results.push({name, status: 'PASS'}); console.log('PASS', name);}
  catch (error) {results.push({name, status: 'FAIL'}); failures.push({name, error: String(error), stack: error.stack}); console.log('FAIL', name, String(error));}
}
function exportedParts(d) {
  const a = d.exportHwpxWithReport();
  try {const b = a.takeBytes(); return new Map(readOwnedZip(b));} finally {a.free();}
}
function packageWith(update) {
  const entries = original.map(([name, value]) => [name, Buffer.from(value)]);
  update(entries); return writeOwnedZip(entries);
}
function editDescriptor(entries, update) {
  const pair = entries.find(([name]) => name === descriptorPath); assert.ok(pair, 'descriptor required');
  const value = JSON.parse(pair[1]); update(value); pair[1] = Buffer.from(JSON.stringify(value));
}
function untrusted(value, {expectedText = text, mayReject = false} = {}) {
  let d;
  try {d = new engine.HwpDocument(value);}
  catch (error) {
    if (mayReject) {
      assert.ok(!(error instanceof WebAssembly.RuntimeError), 'a WASM trap is not a safe parse refusal');
      assert.doesNotMatch(String(error), /unreachable|memory access out of bounds|out of memory/i);
      observations.push({rejectedAtLoad: true, error: String(error)}); return;
    }
    throw error;
  }
  try {
    assert.equal(d.getTextFileUnicode(), expectedText, 'cache rejection must not replace standard XML text');
    assert.equal(exportedParts(d).has(descriptorPath), false, 'invalid cache must not regain completed ownership on export');
  } finally {d.free();}
}

await scenario('computed HWPX actually saves and standard XML owns text and rows', () => {
  assert.equal(loss.count, 0); assert.equal(verifyPreservedExport(doc, bytes, 'hwpx', loss, b => new engine.HwpDocument(b)).status, 'checked');
  assert.ok(parts.has(descriptorPath));
  const value = JSON.parse(parts.get(descriptorPath)); assert.equal(value.version, 1);
  assert.deepEqual(value.header, [...Buffer.from(hash(parts.get('Contents/header.xml')), 'hex')]);
  const sections = [...parts.keys()].filter(name => /^Contents\/section\d+\.xml$/.test(name)).sort();
  assert.deepEqual(value.sections, sections.map(name => [...Buffer.from(hash(parts.get(name)), 'hex')]));
  const xml = parts.get('Contents/section0.xml').toString('utf8');
  assert.ok(xml.includes(prefix), 'actual text must be in standard XML');
  assert.ok((xml.match(/<hp:lineseg\b/g) ?? []).length >= 13, 'fresh multiline partition must be in standard XML');
  const reopened = new engine.HwpDocument(bytes);
  try {
    assert.equal(compareSnapshots(live, snapshot(reopened)).status, 'SAME_WITHIN_PUBLISHED_CONTRACT');
    assert.ok(exportedParts(reopened).has(descriptorPath), 'valid loaded lease must remain usable');
  } finally {reopened.free();}
});
await scenario('removing descriptor keeps standard body text and cannot mint a lease', () => untrusted(packageWith(entries => {
  const index = entries.findIndex(([n]) => n === descriptorPath); assert.ok(index >= 0, 'valid source descriptor required');
  entries.splice(index, 1);
})));
for (const [name, update] of [
  ['unknown descriptor version', p => p.version = 255],
  ['unknown descriptor field', p => p.unrecognizedPermission = true],
  ['different pipeline', p => p.pipeline += '-stale'],
  ['different resource fingerprint', p => p.resource[0] ^= 1],
  ['stale header hash', p => p.header[0] ^= 1],
  ['stale section hash', p => p.sections[0][0] ^= 1],
  ['duplicate paragraph identity', p => p.entries.push(structuredClone(p.entries[0]))],
  ['missing row basis', p => p.entries[0].bases.pop()],
  ['impossible page', p => p.entries[0].bases[0].page = 0xffffffff],
  ['row coordinate overflow', p => {assert.ok(p.entries[0].bases.length > 1); p.entries[0].bases[1].offset = 0x7fffffff;}],
  ['unknown space metric', p => p.entries[0].spaces = [[0, 255]]],
  ['partially valid prefix then invalid entry', p => p.entries.push({...structuredClone(p.entries[0]), paragraph: 999999})],
]) await scenario(name + ' restores no completed owner', () => untrusted(packageWith(entries => editDescriptor(entries, update))));
await scenario('truncated descriptor restores no completed owner', () => untrusted(packageWith(entries => {
  entries.find(([n]) => n === descriptorPath)[1] = Buffer.from('{"version":1');
})));
await scenario('oversize descriptor restores no completed owner', () => untrusted(packageWith(entries => {
  entries.find(([n]) => n === descriptorPath)[1] = Buffer.alloc(2 * 1024 * 1024 + 1, 32);
}), {mayReject: true}));
await scenario('duplicate ZIP descriptor is never an authority', () => untrusted(packageWith(entries => {
  const pair = entries.find(([n]) => n === descriptorPath); assert.ok(pair, 'valid source descriptor required'); entries.push(pair);
}), {mayReject: true}));
for (const path of ['Contents/header.xml', 'Contents/section0.xml']) await scenario(
  `duplicate bound ${path} cannot retain completed authority`, () => untrusted(packageWith(entries => {
    const pair = entries.find(([name]) => name === path); assert.ok(pair);
    // The ordinary last-wins reader still sees the original bytes. Another ZIP
    // consumer could select this earlier entry; neither may grant cache trust.
    const xml = pair[1].toString('utf8'), end = xml.indexOf('?>'); assert.ok(end >= 0);
    const other = Buffer.from(xml.slice(0, end + 2) + '<!-- ambiguous source -->' + xml.slice(end + 2));
    entries.unshift([path, other]);
  }), {mayReject: true}));
await scenario('actual changed standard XML text defeats stale descriptor', () => untrusted(packageWith(entries => {
  const pair = entries.find(([n]) => n === 'Contents/section0.xml');
  const xml = pair[1].toString('utf8'); assert.ok(xml.includes(prefix));
  pair[1] = Buffer.from(xml.replace(prefix, prefix.replace('앞 문단', '뒤 문단')));
}), {expectedText: text.replace(prefix, prefix.replace('앞 문단', '뒤 문단'))}));

// A lossy UTF-8 decode maps both a genuine replacement character and byte FF
// to U+FFFD. Private cache authority must bind the original ZIP entry bytes.
for (const target of ['Contents/section0.xml', 'Contents/header.xml']) await scenario(
  `invalid UTF-8 in ${target} cannot retain a valid raw-byte binding`, () => {
    const probe = new engine.HwpDocument(source);
    try {
      probe.insertText(0, 0, probe.getParagraphLength(0, 0), prefix + '\uFFFD');
      const a = probe.exportHwpxWithReport(); let good, goodLoss;
      try {good = a.takeBytes(); goodLoss = JSON.parse(a.contentLoss()); assert.equal(goodLoss.count, 0);} finally {a.free();}
      assert.equal(verifyPreservedExport(probe, good, 'hwpx', goodLoss, b => new engine.HwpDocument(b)).status, 'checked');
      const entries = readOwnedZip(good), pair = entries.find(([n]) => n === target);
      assert.ok(pair); const replacement = Buffer.from('\uFFFD');
      if (target.endsWith('header.xml')) {
        const end = pair[1].indexOf(Buffer.from('?>')); assert.ok(end >= 0);
        pair[1] = Buffer.concat([pair[1].subarray(0, end + 2), Buffer.from('<!-- \uFFFD -->'), pair[1].subarray(end + 2)]);
        // A semantically neutral comment, with the exact valid raw hash.
        editDescriptor(entries, value => value.header = [...Buffer.from(hash(pair[1]), 'hex')]);
      }
      const valid = new engine.HwpDocument(writeOwnedZip(entries));
      try {assert.ok(exportedParts(valid).has(descriptorPath), 'valid UTF-8 positive control must retain ownership');}
      finally {valid.free();}
      const offset = pair[1].indexOf(replacement); assert.ok(offset >= 0);
      pair[1] = Buffer.concat([pair[1].subarray(0, offset), Buffer.from([255]), pair[1].subarray(offset + replacement.length)]);
      untrusted(writeOwnedZip(entries), {expectedText: probe.getTextFileUnicode()});
    } finally {probe.free();}
  });

doc.free();
const paths = ['scripts/lib/hancom-review.mjs', 'scripts/lib/owned-zip.mjs', 'src/adapters/rhwp/preservation.ts', 'src/adapters/rhwp/document-save-layout.ts', 'src/adapters/rhwp/overlap-save-layout.ts'];
const sourceHashes = await Promise.all(paths.map(async path => ({path, sha256: hash(await readFile(join(app, path)))})));
await writeFile(out + '/result.json', JSON.stringify({engine: engine.metadata, results, failures, observations, sourceHashes,
  verifierSha256: hash(await readFile(fileURLToPath(import.meta.url))), sourceUnchanged: hash(await readFile(fixture)) === hash(source),
  scope: 'Independent ZIP text/row/hash inspection and adversarial invalid descriptor packages generated from an owned native prefix edit. Actual parser/exporter exercised; no user files or Hancom UI.'}, null, 2));
if (failures.length) process.exitCode = 1;
