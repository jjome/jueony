// Read independently saved Hancom fixtures; never automate Hancom via this script.
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import {hwpxSectionTabAttributes} from './integration/hwpx-tab-evidence.mjs';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
if (!process.env.JUEONY_ENGINE_PACKAGE) throw new Error('JUEONY_ENGINE_PACKAGE must name the compared engine pkg');
const pkg = resolve(repo, process.env.JUEONY_ENGINE_PACKAGE);
const native = join(repo, 'docs/evidence/native-section-merge-2026-10-12');
const reference = resolve(repo, process.env.JUEONY_NATIVE_REFERENCE ?? 'docs/evidence/native-section-merge-2026-10-12/documents');
const wasm = await readFile(join(pkg, 'rhwp_bg.wasm'));
const build = JSON.parse(await readFile(join(pkg, 'jueony-engine-build.json'), 'utf8'));
assert.equal(build.wasmSha256, createHash('sha256').update(wasm).digest('hex'), 'actual engine and manifest must agree');
const { default: init, HwpDocument } = await import(pathToFileURL(join(pkg, 'rhwp.js')).href);
await init({ module_or_path: wasm });
const parse = value => typeof value === 'string' ? JSON.parse(value) : value;
async function inspect(root, name) {
  const bytes = await readFile(join(root, name)), doc = new HwpDocument(bytes);
  try {
    return { name, sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length,
      sections: Array.from({ length: doc.getSectionCount() }, (_, s) => ({
        paragraphs: Array.from({ length: doc.getParagraphCount(s) }, (_, p) => doc.getTextRange(s, p, 0, doc.getParagraphLength(s, p))),
        page: parse(doc.getPageDef(s)), definition: parse(doc.getSectionDef(s)), columns: parse(doc.getColumnDef(s)),
      })), info: parse(doc.getDocumentInfo()) };
  } finally { doc.free(); }
}
const observations = [], results = [], failures = [];
async function check(name, action) {
  try { await action(); results.push(name); console.log('PASS', name); }
  catch (error) { failures.push({ name, error: String(error) }); console.error('FAIL', name, error); }
}
await check('native ABCD split/Delete saved as one body paragraph', async () => {
  const doc = await inspect(native, 'native-abcd-delete.hwpx'); observations.push(doc);
  assert.deepEqual(doc.sections.map(s => s.paragraphs), [['ABCD']]);
});
for (const format of ['hwp', 'hwpx']) {
  await check(`native ${format}: merged text, left settings and untouched later section match Jueony`, async () => {
    const doc = await inspect(native, `native-three-settings-delete.${format}`);
    const expected = await inspect(reference, `merge-three-section-settings.${format}`);
    observations.push(doc);
    assert.deepEqual(doc.sections.map(s => s.paragraphs), expected.sections.map(s => s.paragraphs));
    for (let s = 0; s < expected.sections.length; s++) {
      // Only compare the settings this task promises; Hancom may normalize unrelated records.
      assert.deepEqual(doc.sections[s].page, expected.sections[s].page, `section ${s}: page definition`);
      assert.equal(doc.sections[s].definition.defaultTabSpacing, expected.sections[s].definition.defaultTabSpacing, `section ${s}: tabs`);
      assert.equal(doc.sections[s].definition.pageNum, expected.sections[s].definition.pageNum, `section ${s}: page numbering`);
      assert.deepEqual(doc.sections[s].columns, expected.sections[s].columns, `section ${s}: columns`);
    }
  });
}
await check('serialized HWPX tabStopVal agrees with native Hancom, independently of rhwp parser', async () => {
  const actual = hwpxSectionTabAttributes(await readFile(join(reference, 'merge-three-section-settings.hwpx')));
  const expected = hwpxSectionTabAttributes(await readFile(join(native, 'native-three-settings-delete.hwpx')));
  observations.push({serializedTabValues: {actual, expected}});
  assert.deepEqual(actual, expected);
});
await writeFile(join(native, process.env.JUEONY_NATIVE_RESULT ?? 'parsed-comparison.json'), JSON.stringify({ verifiedAt: new Date().toISOString(),
  engineWasmSha256: createHash('sha256').update(wasm).digest('hex'), results, failures, observations,
  scope: 'Selected synthetic body cases. Not independent layout/rendering validation or full Hancom parity.' }, null, 2) + '\n');
if (failures.length) process.exitCode = 1;
