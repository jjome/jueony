import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readTextTablePlan, readTableTextPlan, executeTableConversion, preflightTableConversion } from '../src/adapters/rhwp/table-conversion-native.ts';
import { readAutoFillPlan, executeAutoFill, preflightAutoFill } from '../src/adapters/rhwp/table-auto-fill-native.ts';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
if (!process.env.JUEONY_ENGINE_PACKAGE) throw new Error('Set JUEONY_ENGINE_PACKAGE to the verified engine package');
const pkg = resolve(repo, process.env.JUEONY_ENGINE_PACKAGE), out = resolve(repo, process.env.JUEONY_TEST_OUTPUT ?? 'docs/evidence/table-conversion-2026-10-13/engine');
const { default: init, HwpDocument } = await import(pathToFileURL(resolve(pkg, 'rhwp.js')).href);
await init({ module_or_path: await readFile(resolve(pkg, 'rhwp_bg.wasm')) }); await mkdir(out, { recursive: true });
const parse = v => typeof v === 'string' ? JSON.parse(v) : v, hash = v => createHash('sha256').update(v).digest('hex');
const results = [], failures = [], fresh = () => { const d = HwpDocument.createEmpty(); d.createBlankDocument(); return d; };
const body = d => Array.from({ length: d.getParagraphCount(0) }, (_, p) => d.getTextRange(0, p, 0, d.getParagraphLength(0, p)));
async function test(name, run) { try { await run(); results.push(name); console.log('PASS', name); } catch (error) { failures.push({ name, error: String(error), stack: error.stack }); console.error('FAIL', name, error); } }
for (const ext of ['hwp', 'hwpx']) {
  await test(`${ext}: literal Unicode/empty-cell conversion, scratch preflight and two saved roundtrips`, async () => {
    const d = fresh(); let reopened, converted;
    try {
      const values = ['앞 문단 유지', '이름\t나이\t메모', '김😀\t30\t', '박정환\t\t 공백 유지 ', '뒤 문단 유지'];
      for (let p = 0; p < values.length; p++) { if (p) d.splitParagraph(0, p - 1, d.getParagraphLength(0, p - 1)); d.insertText(0, p, 0, values[p]); }
      d.applyCharFormat(0, 1, 0, d.getParagraphLength(0, 1), JSON.stringify({ bold: true, textColor: '#ff0000' }));
      d.applyParaFormat(0, 2, JSON.stringify({ alignment: 'center', spacingBefore: 283 }));
      const plan = readTextTablePlan(d, { anchor: { sectionIndex: 0, paragraphIndex: 1, charOffset: 0 }, focus: { sectionIndex: 0, paragraphIndex: 4, charOffset: 0 } }, 'tab');
      const bridge = { fileName: 'converted.' + ext, borrowDocumentHandle: () => d, getWasmModuleExports: () => ({ HwpDocument }) };
      const before = hash(d.exportHwpx()); preflightTableConversion(bridge, plan); assert.equal(hash(d.exportHwpx()), before, 'scratch probe must not dirty the live document');
      executeTableConversion(d, plan);
      const control = parse(d.getControls()).find(c => c.ctrlId === 'tbl');
      const target = { sec: 0, ppi: control.para, ci: control.controlIndex };
      assert.deepEqual(body(d), [values[0], '', values[4]]);
      assert.equal(parse(d.getCellCharPropertiesAt(0, target.ppi, target.ci, 0, 0, 0)).bold, true);
      assert.equal(parse(d.getCellCharPropertiesAt(0, target.ppi, target.ci, 1, 0, 0)).textColor, '#ff0000');
      assert.equal(parse(d.getCellParaPropertiesAt(0, target.ppi, target.ci, 3, 0)).alignment, 'center');
      const bytes = d[ext === 'hwp' ? 'exportHwp' : 'exportHwpx'](); await writeFile(resolve(out, `text-converted-to-table.${ext}`), bytes);
      reopened = new HwpDocument(bytes); assert.deepEqual(readTableTextPlan(reopened, target, 'tab').rows, plan.rows);
      const inverse = readTableTextPlan(d, target, 'tab'), tableBefore = hash(d.exportHwpx()); preflightTableConversion(bridge, inverse); assert.equal(hash(d.exportHwpx()), tableBefore);
      executeTableConversion(d, inverse); assert.deepEqual(body(d), values);
      assert.equal(parse(d.getCharPropertiesAt(0, 1, 0)).bold, true); assert.equal(parse(d.getParaPropertiesAt(0, 2)).alignment, 'center');
      const returned = d[ext === 'hwp' ? 'exportHwp' : 'exportHwpx'](); await writeFile(resolve(out, `table-converted-to-text.${ext}`), returned);
      converted = new HwpDocument(returned); assert.deepEqual(body(converted), values);
      assert.equal(parse(converted.getControls()).some(c => c.ctrlId === 'tbl'), false);
    } finally { converted?.free(); reopened?.free(); d.free(); }
  });
}
await test('native unsafe conversion refuses stale content, merged/protected cells and literal host tabs without mutations', () => {
  const d = fresh();
  try {
    d.insertText(0, 0, 0, '가\t나');
    const selection = { anchor: { sectionIndex: 0, paragraphIndex: 0, charOffset: 0 }, focus: { sectionIndex: 0, paragraphIndex: 0, charOffset: 3 } };
    const plan = readTextTablePlan(d, selection, 'tab'); d.insertText(0, 0, 3, '바뀜');
    const before = hash(d.exportHwpx()); assert.throws(() => executeTableConversion(d, plan), /바뀌었습니다/); assert.equal(hash(d.exportHwpx()), before);
    d.deleteText(0, 0, 0, d.getParagraphLength(0, 0)); const made = parse(d.createTable(0, 0, 0, 2, 2)); const ref = { sec: 0, ppi: made.paraIdx, ci: made.controlIdx };
    d.insertText(0, made.paraIdx, 0, '\t'); assert.throws(() => readTableTextPlan(d, ref, 'tab'), /같은 문단/); d.deleteText(0, made.paraIdx, 0, 1);
    d.setCellProperties(0, made.paraIdx, made.controlIdx, 0, JSON.stringify({ cellProtect: true }));
    const protectedBefore = hash(d.exportHwpx()); assert.throws(() => readTableTextPlan(d, ref, 'tab'), /보호/); assert.equal(hash(d.exportHwpx()), protectedBefore);
    d.setCellProperties(0, made.paraIdx, made.controlIdx, 0, JSON.stringify({ cellProtect: false })); d.mergeTableCells(0, made.paraIdx, made.controlIdx, 0, 0, 0, 1);
    const mergedBefore = hash(d.exportHwpx()); assert.throws(() => readTableTextPlan(d, ref, 'tab'), /병합/); assert.equal(hash(d.exportHwpx()), mergedBefore);
  } finally { d.free(); }
});
for (const ext of ['hwp', 'hwpx']) await test(`${ext}: selected integer series preserves target style/geometry and unrelated cells through scratch/save/reopen`, async () => {
  const d = fresh(); let reopened;
  try {
    const made = parse(d.createTable(0, 0, 0, 3, 2)); const values = ['005', '다른1', '010', '다른2', '기존😀', '다른3']; values.forEach((value, cell) => d.insertTextInCell(0, made.paraIdx, made.controlIdx, cell, 0, 0, value));
    d.applyCharFormatInCell(0, made.paraIdx, made.controlIdx, 4, 0, 0, 3, JSON.stringify({ italic: true }));
    const block = { sec: 0, ppi: made.paraIdx, ci: made.controlIdx, anchor: { row: 2, col: 0 }, focus: { row: 0, col: 0 }, excluded: [] }, plan = readAutoFillPlan(d, block);
    const before = hash(d.exportHwpx()), geometry = Array.from({ length: 6 }, (_, cell) => parse(d.getCellProperties(0, made.paraIdx, made.controlIdx, cell)));
    preflightAutoFill({ fileName: 'auto-fill.' + ext, borrowDocumentHandle: () => d, getWasmModuleExports: () => ({ HwpDocument }) }, plan); assert.equal(hash(d.exportHwpx()), before);
    executeAutoFill(d, plan); assert.deepEqual(Array.from({ length: 6 }, (_, cell) => d.getTextInCell(0, made.paraIdx, made.controlIdx, cell, 0, 0, d.getCellParagraphLength(0, made.paraIdx, made.controlIdx, cell, 0))), ['005', '다른1', '010', '다른2', '015', '다른3']);
    assert.deepEqual(Array.from({ length: 6 }, (_, cell) => parse(d.getCellProperties(0, made.paraIdx, made.controlIdx, cell))), geometry);
    const bytes = d[ext === 'hwp' ? 'exportHwp' : 'exportHwpx'](); await writeFile(resolve(out, 'integer-auto-fill.' + ext), bytes); reopened = new HwpDocument(bytes);
    assert.equal(reopened.getTextInCell(0, made.paraIdx, made.controlIdx, 4, 0, 0, 3), '015'); assert.equal(parse(reopened.getCellCharPropertiesAt(0, made.paraIdx, made.controlIdx, 4, 0, 0)).italic, true);
    const noOpBefore = hash(d.exportHwpx()); executeAutoFill(d, readAutoFillPlan(d, block)); assert.equal(hash(d.exportHwpx()), noOpBefore);
    assert.throws(() => executeAutoFill(d, plan), /바뀌었습니다/);
  } finally { reopened?.free(); d.free(); }
});
await writeFile(resolve(out, 'result.json'), JSON.stringify({ results, failures, engine: JSON.parse(await readFile(resolve(pkg, 'jueony-engine-build.json'), 'utf8')), note: 'Native WASM synthetic conversion tests, including scratch export-preservation checks and saved HWP/HWPX reopen. No native Hancom or UI comparison.' }, null, 2));
if (failures.length) process.exitCode = 1;
