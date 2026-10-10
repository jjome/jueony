import puppeteer from 'puppeteer-core';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import init, { HwpDocument } from '@rhwp/core';
import { serve } from './serve.mjs';
await init({ module_or_path: await readFile('node_modules/@rhwp/core/rhwp_bg.wasm') });
const server = await serve(4196), checks = [], errors = [], external = [];
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true, args: ['--no-first-run', '--disable-background-networking'], defaultViewport: { width: 1440, height: 1000 } });
const page = await browser.newPage();
page.on('pageerror', e => errors.push(String(e)));
page.on('request', r => { if (/^https?:/.test(r.url()) && new URL(r.url()).hostname !== '127.0.0.1') external.push(r.url()); });
const rows = [['단계', '기간', '담당'], ['준비', '1월', '총무'], ['실행', '2월', '사업'], ['점검', '3월', '감사']];
const operations = [
 { kind: 'create_table', after: 's0p1', resultId: 'schedule', rows },
 { kind: 'format_table_cells', target: '@schedule', startRow: 0, rowCount: 1, startColumn: 0, columnCount: 3, properties: { bold: true, background: '#eeeeee' } },
 { kind: 'format_characters', target: 's0p0', properties: { bold: true, fontSizePt: 16 } },
 { kind: 'set_page_setup', section: 0, properties: { widthMm: 210, heightMm: 297, landscape: true, marginLeftMm: 20, marginRightMm: 20, marginTopMm: 20, marginBottomMm: 20 } },
];
const snapshot = () => page.evaluate(() => window.jueonyEditor.snapshot());
try {
 await page.goto('http://127.0.0.1:4196/editor.html?storage=download&skipRecovery=1');
 await page.waitForFunction(() => window.jueonyEditor?.snapshot && !window.jueonyEditor.busy(), { timeout: 60000 });
 const doc = HwpDocument.createEmpty(); doc.createBlankDocument();
 for (const [i, value] of ['업무 계획', '추진 일정', '후속 조치'].entries()) { if (i) doc.splitParagraph(0, i - 1, doc.getParagraphLength(0, i - 1)); doc.insertText(0, i, 0, value); }
 const fixture = [...doc.exportHwpx()]; doc.free();
 await page.evaluate(bytes => window.jueonyEditor.open(new Uint8Array(bytes), 'AI-표-쪽설정.hwpx'), fixture);
 const before = await snapshot();
 const receipt = await page.evaluate(async operations => { const api = window.jueonyEditor; return api.apply(crypto.randomUUID(), api.snapshot(), { message: '일정표와 서식', sourceIds: [], operations }); }, operations);
 const after = await snapshot(); assert.equal(after.structure.tables.length, 1); assert.equal(after.structure.tables[0].cells[0].characters.bold, true); assert.equal(after.nodes[0].editable, true); checks.push('Live editor applies one request containing table, cell style, title and page setup');
 await mkdir('evidence/document-control', { recursive: true });
 const bytes = new Uint8Array(await page.evaluate(() => [...window.jueonyEditor.recovery().bytes]));
 await writeFile('evidence/document-control/AI-표-쪽설정.hwpx', bytes);
 const saved = new HwpDocument(bytes); try {
  assert.equal(saved.getTextInCell(0, 2, 0, 11, 0, 0, 10), '감사');
  await writeFile('evidence/document-control/AI-표-쪽설정.hwp', saved.exportHwp());
 } finally { saved.free(); }
 checks.push('Exported HWPX reopens and HWP counterpart is available for Hancom review');
 await page.screenshot({ path: 'evidence/document-control/applied.png', fullPage: true });
 const error = await page.evaluate(async () => { const api = window.jueonyEditor, s = api.snapshot(); try { await api.apply(crypto.randomUUID(), s, { message: '', sourceIds: [], operations: [{ kind: 'format_characters', target: 's0p0', properties: { bold: false } }, { kind: 'set_page_setup', section: 0, properties: { marginLeftMm: 900 } }] }); } catch (e) { return e.message; } });
 assert.ok(error); assert.equal((await snapshot()).revision, after.revision); checks.push('Invalid last command prevents all earlier changes');
 await page.evaluate(receipt => window.jueonyEditor.undoRequest(receipt), receipt);
 const restored = await snapshot(); assert.deepEqual(restored.structure, before.structure); assert.deepEqual(restored.nodes.map(n => n.text), before.nodes.map(n => n.text)); checks.push('One request undo restores table structure, text, all formatting and paper settings');
 const rollback = await page.evaluate(async () => {
   const api = window.jueonyEditor, s = api.snapshot();
   // Fault injection: a forged native coordinate fails AFTER the first format.
   s.nodes[2].paragraph = 999999;
   try { await api.apply(crypto.randomUUID(), s, { message: '', sourceIds: [], operations: [{ kind: 'format_characters', target: 's0p0', properties: { bold: true } }, { kind: 'replace_body_text', target: 's0p2', start: 0, count: 5, text: '실패 주입' }] }); }
   catch (e) { return e.name; }
 });
 assert.equal(rollback, 'RolledBackError'); assert.deepEqual((await snapshot()).structure, before.structure); checks.push('Native failure after first mutation restores the complete snapshot');
 const conflict = await page.evaluate(async ({ before, operations }) => { try { await window.jueonyEditor.apply(crypto.randomUUID(), before, { message: '', sourceIds: [], operations }); } catch (e) { return e.name; } }, { before, operations });
 assert.equal(conflict, 'ConflictError'); checks.push('Stale document revision is rejected');
 assert.deepEqual(errors, []); assert.deepEqual(external, []); checks.push('No page errors or external requests during document editing');
 await writeFile('evidence/document-control/results.json', JSON.stringify({ checks, errors, external, note: 'Engine reopen verified; Hancom Office visual review is pending.' }, null, 2));
 console.log(JSON.stringify({ passed: checks.length, checks }));
} finally { await browser.close(); await new Promise(r => server.close(r)); }
