// Read a file saved by the real native GUI; this does not simulate that GUI.
import assert from 'node:assert/strict';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {isAbsolute, resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {inflateRawSync} from 'node:zlib';
import {hwpLogicalStreams} from './lib/hwp-summary-evidence.mjs';
import {capturePreservationEvidence, verifyPreservedExport} from '../src/adapters/rhwp/preservation.ts';

for (const key of ['JUEONY_ENGINE_PACKAGE', 'JUEONY_NATIVE_SAVED_FILE', 'JUEONY_TEST_OUTPUT']) {
  assert.ok(isAbsolute(process.env[key] ?? ''), `${key} requires an absolute path`);
}
const pkg = resolve(process.env.JUEONY_ENGINE_PACKAGE);
const file = resolve(process.env.JUEONY_NATIVE_SAVED_FILE);
const out = resolve(process.env.JUEONY_TEST_OUTPUT);
const expected = process.env.JUEONY_EXPECTED_TEXT;
assert.ok(expected && expected.length < 4000, 'Expected GUI text is required');
await mkdir(out, {recursive: true});
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const json = value => typeof value === 'string' ? JSON.parse(value) : value;
const engine = json(await readFile(pkg + '/jueony-engine-build.json', 'utf8'));
assert.equal(sha(await readFile(pkg + '/rhwp_bg.wasm')), engine.wasmSha256);
assert.equal(sha(await readFile(pkg + '/rhwp.js')), engine.jsSha256);
const bytes = await readFile(file);
const streams = hwpLogicalStreams(bytes);
const header = streams.get('FileHeader');
assert.ok(header && header.length >= 40, 'Native HWP header');
const compressed = Boolean(header.readUInt32LE(36) & 1);
const rawParagraphs = [];
for (const [path, payload] of streams) {
  if (!/^BodyText\/Section\d+$/.test(path)) continue;
  const raw = compressed ? inflateRawSync(payload) : payload;
  for (let at = 0; at < raw.length;) {
    assert.ok(at + 4 <= raw.length, 'Record header is complete');
    const info = raw.readUInt32LE(at); at += 4;
    let size = info >>> 20;
    if (size === 4095) {
      assert.ok(at + 4 <= raw.length, 'Extended record header is complete');
      size = raw.readUInt32LE(at); at += 4;
    }
    assert.ok(at + size <= raw.length, 'Record payload is complete');
    if ((info & 1023) === 67) {
      assert.equal(size % 2, 0, 'UTF-16 paragraph is complete');
      rawParagraphs.push({path, level: (info >>> 10) & 1023, text: raw.subarray(at, at + size).toString('utf16le')});
    }
    at += size;
  }
}
assert.equal(rawParagraphs.filter(p => p.text.includes(expected)).length, 1, 'Independent CFB paragraph contains the recovered text exactly once');
const wasm = await import(pathToFileURL(pkg + '/rhwp.js'));
await wasm.default({module_or_path: await readFile(pkg + '/rhwp_bg.wasm')});
const doc = new wasm.HwpDocument(bytes);
const resaves = [];
try {
  const body = [];
  for (let section = 0; section < doc.getSectionCount(); section++) {
    for (let paragraph = 0; paragraph < doc.getParagraphCount(section); paragraph++) {
      body.push(doc.getTextRange(section, paragraph, 0, doc.getParagraphLength(section, paragraph)));
    }
  }
  assert.equal(body.filter(text => text === expected).length, 1, 'Engine reads the complete restored text');
  const before = capturePreservationEvidence(doc);
  for (const format of ['hwp', 'hwpx']) {
    const artifact = doc[format === 'hwp' ? 'exportHwpWithReport' : 'exportHwpxWithReport']();
    let reopened;
    try {
      const output = artifact.takeBytes();
      const report = verifyPreservedExport(doc, output, format, json(artifact.contentLoss()), data => new wasm.HwpDocument(data));
      reopened = new wasm.HwpDocument(output);
      assert.deepEqual(capturePreservationEvidence(reopened).values, before.values);
      resaves.push({format, sha256: sha(output), preservation: report});
    } finally { reopened?.free(); artifact.free(); }
  }
  assert.deepEqual(capturePreservationEvidence(doc), before);
  assert.equal(sha(await readFile(file)), sha(bytes), 'GUI output remains unchanged');
  await writeFile(out + '/readback.json', JSON.stringify({
    file, sha256: sha(bytes), bytes: bytes.length, expected, body, rawParagraphs,
    resaves, engine, verifierSha256: sha(await readFile(new URL(import.meta.url))),
    scope: 'Independent raw HWP and engine readback after actual native GUI save. GUI actions and engine versions are recorded separately; this verifier does not prove native window interaction or Hancom layout equality.'
  }, null, 2));
  console.log('PASS independent CFB text, both-format strict reopen, live and disk immutability');
} finally { doc.free(); }
