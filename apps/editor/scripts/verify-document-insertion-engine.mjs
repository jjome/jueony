import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { deflateSync } from 'node:zlib';
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
if (!process.env.JUEONY_ENGINE_PACKAGE) throw new Error('Set JUEONY_ENGINE_PACKAGE to the newly built engine');
const pkg = resolve(repo, process.env.JUEONY_ENGINE_PACKAGE), out = resolve(repo, process.env.JUEONY_TEST_OUTPUT ?? 'docs/evidence/document-insert-2026-10-12/engine');
const { default: init, HwpDocument } = await import(pathToFileURL(resolve(pkg, 'rhwp.js')).href);
await init({ module_or_path: await readFile(resolve(pkg, 'rhwp_bg.wasm')) });
await mkdir(out, { recursive: true });
const parse = value => typeof value === 'string' ? JSON.parse(value) : value;
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const fresh = () => { const d = HwpDocument.createEmpty(); d.createBlankDocument(); return d; };
const exportBytes = (d, ext) => d[ext === 'hwp' ? 'exportHwp' : 'exportHwpx']();
const texts = d => Array.from({ length: d.getParagraphCount(0) }, (_, p) => d.getTextRange(0, p, 0, d.getParagraphLength(0, p)));
const pictures = d => parse(d.getObjects()).filter(o => o.kind === 'picture');
const imageHashes = d => {
  const keys = new Set(); for (let page = 0; page < d.pageCount(); page++) for (const key of parse(d.getPageSourceImageKeys(page)).keys) keys.add(key);
  return [...keys].map(key => hash(d.getSourceImageBytes(key))).sort();
};
function tinyPng(color) {
  const crc = data => { let n = 0xffffffff; for (const byte of data) { n ^= byte; for (let i = 0; i < 8; i++) n = (n >>> 1) ^ (n & 1 ? 0xedb88320 : 0); } return (n ^ 0xffffffff) >>> 0; };
  const chunk = (name, data) => { const body = Buffer.concat([Buffer.from(name), data]), size = Buffer.alloc(4), checksum = Buffer.alloc(4); size.writeUInt32BE(data.length); checksum.writeUInt32BE(crc(body)); return Buffer.concat([size, body, checksum]); };
  const header = Buffer.alloc(13); header.writeUInt32BE(1, 0); header.writeUInt32BE(1, 4); header[8] = 8; header[9] = 2;
  return new Uint8Array(Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR', header), chunk('IDAT', deflateSync(Buffer.from([0,...color]))), chunk('IEND', Buffer.alloc(0))]));
}
const png = tinyPng([255,0,0]), existingPng = tinyPng([0,0,255]);
const picture = (d, p, description, bytes = png) => parse(d.insertPicture(0, p, 0, '[]', bytes, 3000, 3000, 1, 1, 'png', description, undefined, undefined));
const results = [], failures = [];
async function test(name, run) {
  try { await run(); results.push(name); console.log('PASS', name); }
  catch (error) { failures.push({ name, error: String(error), stack: error.stack }); console.error('FAIL', name, error); }
}
for (const sourceFormat of ['hwp', 'hwpx']) for (const destinationFormat of ['hwp', 'hwpx']) {
  await test(`${sourceFormat} into ${destinationFormat}: Unicode/body/table/image assets and destination page persist`, async () => {
    let source = fresh(), destination = fresh(), reopened;
    try {
      source.insertText(0, 0, 0, '가😀나'); source.applyCharFormat(0, 0, 1, 2, JSON.stringify({ bold: true, textColor: '#ff0000' }));
      source.splitParagraph(0, 0, 3); source.insertText(0, 1, 0, '가져온 본문');
      const table = parse(source.createTable(0, 1, 7, 2, 2));
      source.insertTextInCell(0, table.paraIdx, table.controlIdx, 0, 0, 0, '표😀셀');
      source.applyCharFormatInCell(0, table.paraIdx, table.controlIdx, 0, 0, 0, 3, JSON.stringify({ italic: true }));
      source.splitParagraph(0, source.getParagraphCount(0) - 1, source.getParagraphLength(0, source.getParagraphCount(0) - 1));
      picture(source, source.getParagraphCount(0) - 1, '삽입 그림');
      source.setPageDef(0, JSON.stringify({ paperWidth: 30000, paperHeight: 40000 }));
      destination.insertText(0, 0, 0, '앞😀뒤'); destination.applyCharFormat(0, 0, 0, 3, JSON.stringify({ italic: true }));
      destination.splitParagraph(0, 0, 3); picture(destination, 1, '기존 그림', existingPng);
      const page = parse(destination.getPageDef(0)), bytes = exportBytes(source, sourceFormat), beforeHash = hash(bytes);
      await writeFile(resolve(out, `source-${sourceFormat}-to-${destinationFormat}.${sourceFormat}`), bytes);
      const result = parse(destination.insertDocumentBytes(0, 0, 2, bytes)); assert.equal(result.ok, true);
      assert.equal(hash(bytes), beforeHash); assert.deepEqual(parse(destination.getPageDef(0)), page);
      assert.equal(texts(destination)[0], '앞😀가😀나'); assert.ok(texts(destination).join('\n').includes('가져온 본문'));
      assert.equal(parse(destination.getCharPropertiesAt(0, 0, 3)).bold, true);
      const controls = parse(destination.getControls()), tables = controls.filter(c => c.ctrlId === 'tbl'); assert.equal(tables.length, 1);
      const cursorModel = parse(destination.getCursorModel()), cell = cursorModel.lists.find(l => l.isCell && l.cellIndex === 0);
      assert.equal(destination.getTextFileUnicode().includes('표😀셀'), true);
      assert.equal(parse(destination.getCellCharPropertiesAtByPath(0, cell.hostPara, JSON.stringify([{ controlIndex: cell.controlIndex, cellIndex: 0, cellParaIndex: 0 }]), 0)).italic, true);
      assert.equal(pictures(destination).length, 2); assert.deepEqual(imageHashes(destination), [hash(png), hash(existingPng)].sort());
      const saved = exportBytes(destination, destinationFormat); reopened = new HwpDocument(saved);
      assert.deepEqual(texts(reopened), texts(destination)); assert.deepEqual(parse(reopened.getPageDef(0)), page);
      assert.equal(pictures(reopened).length, 2); assert.deepEqual(imageHashes(reopened), imageHashes(destination)); assert.equal(reopened.getTextFileUnicode().includes('표😀셀'), true);
      await writeFile(resolve(out, `inserted-${sourceFormat}-to-${destinationFormat}.${destinationFormat}`), saved);
    } finally { reopened?.free(); source.free(); destination.free(); }
  });
}
await test('empty destination retains its page settings', () => {
  const source = fresh(), destination = fresh();
  try {
    source.insertText(0, 0, 0, '외부 본문'); source.setPageDef(0, JSON.stringify({ paperWidth: 30000, paperHeight: 40000 }));
    const before = parse(destination.getPageDef(0)); destination.insertDocumentBytes(0, 0, 0, source.exportHwpx());
    assert.deepEqual(parse(destination.getPageDef(0)), before); assert.equal(texts(destination)[0], '외부 본문');
  } finally { source.free(); destination.free(); }
});
for (const format of ['hwp', 'hwpx']) await test(`${format}: colliding style IDs and source font/paragraph values remap into a blank destination`, () => {
  const source = fresh(), destination = fresh(); let reopened;
  try {
    source.insertText(0, 0, 0, '참고 스타일 본문');
    const fontIds = Array.from({ length: 7 }, (_, lang) => source.findOrCreateFontIdForLang(lang, '함초롬돋움'));
    source.applyCharFormat(0, 0, 0, source.getParagraphLength(0, 0), JSON.stringify({ fontIds, fontSize: 1400, bold: true }));
    const id = source.createStyle(JSON.stringify({ name: '참고 스타일', baseCharShapeId: parse(source.getCharPropertiesAt(0, 0, 0)).charShapeId }));
    source.applyStyle(0, 0, id); destination.createStyle(JSON.stringify({ name: '기존 스타일' }));
    destination.insertDocumentBytes(0, 0, 0, exportBytes(source, format));
    assert.equal(parse(destination.getStyleAt(0, 0)).name, '참고 스타일');
    assert.equal(parse(destination.getCharPropertiesAt(0, 0, 0)).bold, true);
    assert.equal(parse(destination.getCharPropertiesAt(0, 0, 0)).fontSize, 1400);
    assert.equal(parse(destination.getCharPropertiesAt(0, 0, 0)).fontFamily, '함초롬돋움');
    reopened = new HwpDocument(exportBytes(destination, format)); assert.equal(parse(reopened.getStyleAt(0, 0)).name, '참고 스타일');
    assert.equal(parse(reopened.getCharPropertiesAt(0, 0, 0)).fontFamily, '함초롬돋움');
  } finally { reopened?.free(); source.free(); destination.free(); }
});
for (const kind of ['multiple sections', 'header', 'invalid bytes', 'invalid position', 'too many characters']) {
  await test(`${kind} refuses before mutating the destination`, () => {
    const source = fresh(), destination = fresh();
    try {
      source.insertText(0, 0, 0, kind === 'too many characters' ? '가'.repeat(100001) : '참고');
      if (kind === 'multiple sections') source.insertSectionBreak(0, 0, 1);
      if (kind === 'header') source.createHeaderFooter(0, true, 0);
      destination.insertText(0, 0, 0, '원본😀'); const before = hash(destination.exportHwp());
      const data = kind === 'invalid bytes' ? new Uint8Array([0, 1, 2]) : source.exportHwpx();
      assert.throws(() => destination.insertDocumentBytes(0, 0, kind === 'invalid position' ? 99 : 2, data));
      assert.equal(hash(destination.exportHwp()), before); assert.equal(texts(destination)[0], '원본😀');
    } finally { source.free(); destination.free(); }
  });
}
await writeFile(resolve(out, 'result.json'), JSON.stringify({ results, failures, engine: JSON.parse(await readFile(resolve(pkg, 'jueony-engine-build.json'), 'utf8')), note: 'Native WASM regression using synthetic local documents. Not a Hancom rendering equality test.' }, null, 2));
if (failures.length) process.exitCode = 1;
