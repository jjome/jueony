import assert from 'node:assert/strict';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {readOwnedZip, writeOwnedZip} from './lib/owned-zip.mjs';
import {verifyPreservedExport} from '../src/adapters/rhwp/preservation.ts';

const app = resolve(dirname(fileURLToPath(import.meta.url)), '..'), root = resolve(app, '../..');
if (!process.env.JUEONY_ENGINE_PACKAGE) throw Error('Set JUEONY_ENGINE_PACKAGE to a proven engine build');
const pkg = resolve(root, process.env.JUEONY_ENGINE_PACKAGE);
const out = resolve(root, process.env.JUEONY_TEST_OUTPUT ?? 'build/user-font-declaration'); await mkdir(out, {recursive: true});
const {default: init, HwpDocument} = await import(pathToFileURL(resolve(pkg, 'rhwp.js')).href);
await init({module_or_path: await readFile(resolve(pkg, 'rhwp_bg.wasm'))});
const results = [], failures = [], savedFiles = [];
function fixture(format) {
  const doc = HwpDocument.createEmpty(); doc.createBlankDocument(); doc.insertText(0, 0, 0, '글꼴 English 😀');
  try { return new HwpDocument(doc[format === 'hwp' ? 'exportHwp' : 'exportHwpx']()); } finally { doc.free(); }
}
function artifact(doc, format) {
  const value = doc[format === 'hwp' ? 'exportHwpWithReport' : 'exportHwpxWithReport']();
  try { return {bytes: value.takeBytes(), report: JSON.parse(value.contentLoss())}; } finally { value.free(); }
}
function header(bytes) { return new Map(readOwnedZip(bytes)).get('Contents/header.xml').toString(); }
function fontTypes(bytes, name) {
  return [...header(bytes).matchAll(/<hh:font\b([^>]*)>/g)]
    .filter(match => match[1].includes(`face="${name}"`))
    .map(match => /\btype="([^"]*)"/.exec(match[1])?.[1]);
}
async function scenario(name, run) {
  try { await run(); results.push(name); console.log('PASS', name); }
  catch (error) { failures.push({name, error: String(error), stack: error.stack}); console.error('FAIL', name, error); }
}
for (const source of ['hwp', 'hwpx']) for (const mode of ['all', 'english']) await scenario(
  `${source}: newly requested ${mode} font keeps TTF identity and passes actual HWP/HWPX preservation`, async () => {
    const doc = fixture(source), name = '맑은 고딕';
    try {
      const before = JSON.parse(doc.getCharPropertiesAt(0, 0, 0)).fontFamilies;
      const props = mode === 'all' ? {fontId: doc.findOrCreateFontId(name)} :
        {fontIds: before.map((family, lang) => doc.findOrCreateFontIdForLang(lang, lang === 1 ? name : family))};
      const id = mode === 'all' ? props.fontId : props.fontIds[1]; assert.ok(Number.isSafeInteger(id) && id >= 0);
      assert.notEqual(JSON.parse(doc.applyCharFormat(0, 0, 0, 5, JSON.stringify(props))).ok, false);
      for (const format of ['hwp', 'hwpx']) {
        const value = artifact(doc, format); assert.equal(value.report.count, 0, JSON.stringify(value.report));
        assert.equal(verifyPreservedExport(doc, value.bytes, format, value.report, bytes => new HwpDocument(bytes)).status, 'checked');
        await writeFile(resolve(out, `${source}-${mode}.${format}`), value.bytes);
        const reopened = new HwpDocument(value.bytes);
        try {
          const families = JSON.parse(reopened.getCharPropertiesAt(0, 0, 0)).fontFamilies;
          for (let lang = 0; lang < 7; lang++) assert.equal(families[lang], mode === 'all' || lang === 1 ? name : before[lang]);
          assert.deepEqual(JSON.parse(reopened.getCharPropertiesAt(0, 0, 6)).fontFamilies, before);
          const roundtrip = artifact(reopened, 'hwpx'); assert.equal(roundtrip.report.count, 0, JSON.stringify(roundtrip.report));
          const declared = fontTypes(roundtrip.bytes, name); assert.ok(declared.length > 0); assert.ok(declared.every(type => type === 'TTF'), declared.join(','));
        } finally { reopened.free(); }
        savedFiles.push(`${source}-${mode}.${format}`);
      }
    } finally { doc.free(); }
  });
for (const type of ['HFT', 'REP', 'OTHER', 'missing']) await scenario(
  `existing imported ${type} font lookup preserves bytes and its original loss gate`, async () => {
    const seed = fixture('hwpx'); let bytes;
    try { bytes = seed.exportHwpx(); } finally { seed.free(); }
    const entries = readOwnedZip(bytes); let replaced = 0;
    for (const entry of entries) if (entry[0] === 'Contents/header.xml') {
      entry[1] = Buffer.from(entry[1].toString().replace(/<hh:font\b[^>]*>/g, tag => {
        replaced++; return type === 'missing' ? tag.replace(/\s+type="[^"]*"/, '') : tag.replace(/\btype="[^"]*"/, `type="${type}"`);
      }));
    }
    assert.ok(replaced >= 7); const doc = new HwpDocument(writeOwnedZip(entries));
    try {
      const before = artifact(doc, 'hwpx'), eventLog = doc.getEventLog();
      const names = JSON.parse(doc.getCharPropertiesAt(0, 0, 0)).fontFamilies;
      const first = doc.findOrCreateFontId(names[0]); assert.ok(Number.isInteger(first) && first >= 0);
      assert.equal(doc.findOrCreateFontId(names[0]), first);
      for (let lang = 0; lang < 7; lang++) { const id = doc.findOrCreateFontIdForLang(lang, names[lang]); assert.ok(Number.isInteger(id) && id >= 0); assert.equal(doc.findOrCreateFontIdForLang(lang, names[lang]), id); }
      const after = artifact(doc, 'hwpx'); assert.deepEqual(after.report, before.report); assert.deepEqual(after.bytes, before.bytes); assert.equal(doc.getEventLog(), eventLog);
      if (type === 'OTHER' || type === 'missing') {
        assert.ok(after.report.losses.some(loss => loss.subject === 'fontProperties'));
        assert.throws(() => verifyPreservedExport(doc, after.bytes, 'hwpx', after.report, data => new HwpDocument(data)), /보존/);
      } else {
        assert.equal(after.report.count, 0); assert.ok(fontTypes(after.bytes, names[0]).every(value => value === type));
        if (type === 'REP') assert.ok(artifact(doc, 'hwp').report.losses.some(loss => loss.subject === 'fontProperties'));
      }
    } finally { doc.free(); }
  });
await writeFile(resolve(out, 'result.json'), JSON.stringify({results, failures, savedFiles, enginePackage: pkg,
  scope: 'New editing fonts are explicitly declared TrueType; imported resources are never retyped. Synthetic fixtures, actual Rust/WASM export, full production preservation and independent ZIP type assertions. Native Hancom rendering and font licensing/installability are not evaluated.'}, null, 2));
if (failures.length) process.exitCode = 1;
