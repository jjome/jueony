import puppeteer from 'puppeteer-core';
import { spawn } from 'node:child_process';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

const app = resolve(dirname(fileURLToPath(import.meta.url)), '..'), repo = resolve(app, '../..');
if (!process.env.JUEONY_TEST_DIST) throw new Error('Set JUEONY_TEST_DIST to a built editor with the conversion helper installed');
const port = 4213, origin = `http://127.0.0.1:${port}`, dist = resolve(app, process.env.JUEONY_TEST_DIST);
const out = resolve(repo, process.env.JUEONY_TEST_OUTPUT ?? 'docs/evidence/table-conversion-2026-10-13/browser'); await mkdir(out, { recursive: true });
const pkg = process.env.JUEONY_ENGINE_PACKAGE ? resolve(repo, process.env.JUEONY_ENGINE_PACKAGE) : resolve(app, 'node_modules/@rhwp/core');
const { default: init, HwpDocument } = await import(pathToFileURL(resolve(pkg, 'rhwp.js')).href); await init({ module_or_path: await readFile(resolve(pkg, 'rhwp_bg.wasm')) });
if (await fetch(origin + '/api/health').then(() => true, () => false)) throw new Error(`Test port ${port} already occupied`);
const server = spawn(process.execPath, ['apps/launcher/server.mjs'], { cwd: repo, windowsHide: true, stdio: 'ignore', env: { ...process.env, JUEONY_PORT: String(port), JUEONY_DIST: dist, JUEONY_CONNECTION_STORE: 'memory' } });
const results = [], failures = [], pageErrors = [], consoleErrors = [], externalRequests = [], delay = ms => new Promise(r => setTimeout(r, ms));
let page, browser;
const active = async () => (await page.$('.editor-frame:not([hidden])')).contentFrame();
async function services() {
  const frame = await active(); await frame.evaluate(() => {
    if (window.__tableServices) return;
    const automation = window.rhwpStudio.automation;
    automation.registerCommand({ id: 'ext:conversion-test-inspect', label: '검수', canExecute: () => true, execute: s => { window.__tableServices = s; } });
    const result = automation.execute('ext:conversion-test-inspect'); automation.unregisterCommand('ext:conversion-test-inspect');
    if (!result.ok || !window.__tableServices) throw new Error('Test command extension unavailable');
  }); return frame;
}
const snapshot = async () => (await active()).evaluate(() => window.jueonyEditor.snapshot());
async function execute(id) { const result = await (await active()).evaluate(id => window.jueonyEditor.executeCommand(id), id); assert.equal(result.ok, true, JSON.stringify(result)); }
async function open(ext) {
  const doc = HwpDocument.createEmpty(); doc.createBlankDocument();
  const text = ['앞 문단', '이름\t나이', '김😀\t30', '뒤 문단'];
  for (let p = 0; p < text.length; p++) { if (p) doc.splitParagraph(0, p - 1, doc.getParagraphLength(0, p - 1)); doc.insertText(0, p, 0, text[p]); }
  doc.applyCharFormat(0, 1, 0, doc.getParagraphLength(0, 1), JSON.stringify({ bold: true }));
  const bytes = [...doc[ext === 'hwp' ? 'exportHwp' : 'exportHwpx']()]; doc.free();
  const frame = await services(); await frame.evaluate(async (bytes, ext) => {
    const root = await navigator.storage.getDirectory(), handle = await root.getFileHandle(`conversion.${ext}`, { create: true }), writer = await handle.createWritable(); await writer.write(new Uint8Array(bytes)); await writer.close();
    await window.jueonyEditor.open(new Uint8Array(bytes), `conversion.${ext}`, handle, false);
    const s = window.__tableServices, ih = s.getInputHandler(); ih.cursor.exitCellSelectionMode(); ih.cursor.exitTableObjectSelection();
    ih.cursor.selectRange({ sectionIndex: 0, paragraphIndex: 1, charOffset: 0 }, { sectionIndex: 0, paragraphIndex: 3, charOffset: 0 }); ih.updateCaret(); ih.focus(); s.eventBus.emit('command-state-changed');
  }, bytes, ext); return { frame, text };
}
async function confirm(frame) { await frame.click('[data-jueony-table-conversion] + .dialog-footer .dialog-btn-primary').catch(async () => { await frame.click('.modal-overlay .dialog-btn-primary'); }); await frame.waitForSelector('[data-jueony-table-conversion]', { hidden: true }); }
async function save(name) {
  const frame = await active(), saved = await frame.evaluate(async () => {
    const api = window.jueonyEditor, result = await api.save(), file = await api.fileHandle().getFile(); return { result, dirty: api.state().dirty, bytes: [...new Uint8Array(await file.arrayBuffer())] };
  }); assert.equal(saved.result, 'saved'); assert.equal(saved.dirty, false); await writeFile(resolve(out, name), new Uint8Array(saved.bytes)); return saved.bytes;
}
async function scenario(name, run) {
  try { await run(); results.push(name); console.log('PASS', name); }
  catch (error) { failures.push({ name, error: String(error), stack: error.stack }); console.error('FAIL', name, error); await page.screenshot({ path: resolve(out, `failure-${failures.length}.png`) }).catch(() => {}); const frame = await active(); await frame.evaluate(() => document.querySelectorAll('.modal-overlay .dialog-close').forEach(button => button.click())).catch(() => {}); }
}
try {
  for (let i = 0; i < 100; i++) { if (await fetch(origin + '/api/health').then(r => r.ok, () => false)) break; await delay(100); }
  browser = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true, args: ['--no-first-run', '--disable-background-networking'], defaultViewport: { width: 1600, height: 1000 } });
  page = await browser.newPage(); page.setDefaultTimeout(15000); page.on('pageerror', e => pageErrors.push(String(e))); page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); }); page.on('dialog', d => d.accept());
  await page.setRequestInterception(true); page.on('request', r => { if (!r.url().startsWith(origin) && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) { externalRequests.push(r.url()); void r.abort(); } else void r.continue(); });
  await page.goto(origin); await page.waitForFunction(() => document.getElementById('app-status')?.textContent.includes('준비 완료'), { timeout: 90000 });
  for (const ext of ['hwp', 'hwpx']) await scenario(`${ext}: actual selection → conversion dialog → table; undo/redo, native save/reopen and inverse conversion`, async () => {
    const { frame, text } = await open(ext), before = await snapshot();
    const menu = await frame.evaluate(() => { window.jueonyEditor.prepareMenus(); return window.jueonyEditor.menus(); });
    assert.ok(JSON.stringify(menu).includes('table:text-to-table'), 'unified/native menu must expose the registered conversion command');
    await execute('table:text-to-table'); await frame.waitForSelector('[data-jueony-table-conversion="text-to-table"]');
    assert.match(await frame.$eval('[data-jueony-table-conversion] [role=status]', e => e.textContent), /2행 × 2열/); await confirm(frame);
    let changed = await snapshot(); assert.equal(changed.structure.tables.length, 1); assert.deepEqual(changed.structure.tables[0].cells.map(c => c.text), ['이름', '나이', '김😀', '30']); assert.notEqual(changed.revision, before.revision);
    assert.equal(await frame.evaluate(() => window.__tableServices.getInputHandler().history.peekUndoTop().type), 'snapshot:jueonyTableConversion');
    await execute('edit:undo'); assert.deepEqual((await snapshot()).nodes.map(n => n.text), text); assert.equal((await snapshot()).structure.tables.length, 0);
    await execute('edit:redo'); changed = await snapshot(); assert.equal(changed.structure.tables.length, 1);
    const saved = await save(`browser-text-to-table.${ext}`), native = new HwpDocument(new Uint8Array(saved));
    try { assert.equal(JSON.parse(native.getTableDimensions(0, 1, changed.structure.tables[0].control)).cellCount, 4); assert.equal(native.getTextFileUnicode().includes('김😀'), true); }
    finally { native.free(); }
    await frame.evaluate(() => { const s = window.__tableServices, t = window.jueonyEditor.snapshot().structure.tables[0], ih = s.getInputHandler(); ih.cursor.enterTableObjectSelectionDirect(t.section, t.paragraph, t.control); ih.updateCaret(); ih.focus(); s.eventBus.emit('table-object-selection-changed', true); s.eventBus.emit('command-state-changed'); });
    await execute('table:table-to-text'); await frame.waitForSelector('[data-jueony-table-conversion="table-to-text"]'); await confirm(frame);
    assert.deepEqual((await snapshot()).nodes.map(n => n.text), text); assert.equal((await snapshot()).structure.tables.length, 0);
    await execute('edit:undo'); assert.equal((await snapshot()).structure.tables.length, 1); await execute('edit:redo'); assert.deepEqual((await snapshot()).nodes.map(n => n.text), text);
    const returned = await save(`browser-table-to-text.${ext}`), reopened = new HwpDocument(new Uint8Array(returned));
    try { assert.deepEqual(Array.from({ length: reopened.getParagraphCount(0) }, (_, p) => reopened.getTextRange(0, p, 0, reopened.getParagraphLength(0, p))), text); assert.equal(JSON.parse(reopened.getCharPropertiesAt(0, 1, 0)).bold, true); }
    finally { reopened.free(); }
  });
  await scenario('cancel and concurrently changed document refuse conversion without applying old selected text', async () => {
    const { frame } = await open('hwpx'), before = await snapshot(); await execute('table:text-to-table'); await page.keyboard.press('Escape'); await frame.waitForSelector('[data-jueony-table-conversion]', { hidden: true }); assert.equal((await snapshot()).revision, before.revision);
    await execute('table:text-to-table'); await frame.evaluate(() => { const ih = window.__tableServices.getInputHandler(); ih.executeOperation({ kind: 'snapshot', operationType: 'conversion-test-concurrent', operation: wasm => { wasm.insertText(0, 0, 0, '새 편집'); return { sectionIndex: 0, paragraphIndex: 0, charOffset: 0 }; } }); });
    const changed = await snapshot(); await frame.click('.modal-overlay .dialog-btn-primary'); assert.match(await frame.$eval('[data-jueony-table-conversion] [role=status]', e => e.textContent), /문서나 선택이 바뀌/); assert.equal((await snapshot()).revision, changed.revision); assert.equal((await snapshot()).structure.tables.length, 0); await page.keyboard.press('Escape');
  });
  await scenario('native failure after source deletion restores content and leaves no partial table or undo receipt', async () => {
    const { frame, text } = await open('hwpx');
    const before = await frame.evaluate(() => ({ bytes: [...window.__tableServices.wasm.exportHwpx()], history: window.__tableServices.getInputHandler().history.peekUndoTop()?.type ?? null }));
    await execute('table:text-to-table');
    await frame.evaluate(() => {
      const raw = window.__tableServices.wasm.borrowDocumentHandle();
      // Inject only into the live test instance. Scratch instances stay intact,
      // so failure occurs after live deletion/createTable in the snapshot path.
      raw.setCellParaShapeId = () => { throw new Error('합성 셀 서식 실패'); };
    });
    await frame.click('.modal-overlay .dialog-btn-primary');
    assert.match(await frame.$eval('[data-jueony-table-conversion] [role=status]', e => e.textContent), /합성 셀 서식 실패/);
    const restored = await snapshot(); assert.deepEqual(restored.nodes.map(n => n.text), text); assert.equal(restored.structure.tables.length, 0);
    const after = await frame.evaluate(() => ({ bytes: [...window.__tableServices.wasm.exportHwpx()], history: window.__tableServices.getInputHandler().history.peekUndoTop()?.type ?? null }));
    assert.deepEqual(after, before); await page.keyboard.press('Escape');
  });
  for (const ext of ['hwp', 'hwpx']) await scenario(`${ext}: integer autofill previews overwrite, preserves formats/other cells, one undo and repeat no-op`, async () => {
    const d = HwpDocument.createEmpty(); d.createBlankDocument(); const t = JSON.parse(d.createTable(0, 0, 0, 2, 4)), values = ['다른', '행', '그대로', '유지', '001', '003', '기존', '덮기'];
    values.forEach((value, cell) => d.insertTextInCell(0, t.paraIdx, t.controlIdx, cell, 0, 0, value)); d.applyCharFormatInCell(0, t.paraIdx, t.controlIdx, 6, 0, 0, 2, JSON.stringify({ bold: true }));
    const bytes = [...d[ext === 'hwp' ? 'exportHwp' : 'exportHwpx']()]; d.free(); const frame = await services();
    await frame.evaluate(async (bytes, ext, table) => {
      const root = await navigator.storage.getDirectory(), handle = await root.getFileHandle('auto-fill.' + ext, { create: true }), writer = await handle.createWritable(); await writer.write(new Uint8Array(bytes)); await writer.close(); await window.jueonyEditor.open(new Uint8Array(bytes), 'auto-fill.' + ext, handle, false);
      const s = window.__tableServices, ih = s.getInputHandler(); ih.cursor.moveTo({ sectionIndex: 0, parentParaIndex: table.paraIdx, paragraphIndex: 0, charOffset: 0, controlIndex: table.controlIdx, cellIndex: 4, cellParaIndex: 0, cellPath: [{ controlIndex: table.controlIdx, cellIndex: 4, cellParaIndex: 0 }] }); ih.cursor.enterCellSelectionMode(); ih.cursor.advanceCellSelectionPhase(); ih.cursor.setCellSelectionFocus(1, 3); ih.updateCellSelection(); ih.focus(); s.eventBus.emit('command-state-changed');
    }, bytes, ext, t);
    const before = await snapshot(), block = await frame.evaluate(() => window.__tableServices.getInputHandler().cursor.captureCellSelection());
    await frame.evaluate(() => window.__tableServices.getInputHandler().focus()); await page.keyboard.press('a'); await frame.waitForSelector('[data-jueony-table-auto-fill]'); assert.match(await frame.$eval('[data-jueony-table-auto-fill]', e => e.textContent), /2개 변경/);
    await page.keyboard.press('Escape'); await frame.waitForSelector('[data-jueony-table-auto-fill]', { hidden: true }); assert.equal((await snapshot()).revision, before.revision);
    await execute('table:auto-fill-integers'); await frame.click('.modal-overlay .dialog-btn-primary'); await frame.waitForSelector('[data-jueony-table-auto-fill]', { hidden: true });
    const after = await snapshot(), expected = [...values.slice(0, 6), '005', '007']; assert.deepEqual(after.structure.tables[0].cells.map(c => c.text), expected); assert.equal(after.structure.tables[0].cells[6].characters.bold, true); assert.deepEqual(after.structure.tables[0].cells.map(c => c.properties), before.structure.tables[0].cells.map(c => c.properties));
    assert.equal(await frame.evaluate(() => window.__tableServices.getInputHandler().history.peekUndoTop().type), 'snapshot:jueonyTableAutoFill');
    await execute('edit:undo'); assert.deepEqual((await snapshot()).structure.tables[0].cells.map(c => c.text), values); await execute('edit:redo'); assert.deepEqual((await snapshot()).structure.tables[0].cells.map(c => c.text), expected);
    await frame.evaluate(block => { const ih = window.__tableServices.getInputHandler(); ih.cursor.restoreCellSelection(block); ih.updateCellSelection(); ih.focus(); window.__tableServices.eventBus.emit('command-state-changed'); }, block);
    const noOp = await snapshot(); await execute('table:auto-fill-integers'); await frame.click('.modal-overlay .dialog-btn-primary'); await frame.waitForSelector('[data-jueony-table-auto-fill]', { hidden: true }); assert.equal((await snapshot()).revision, noOp.revision);
    const saved = await save('browser-auto-fill.' + ext), reopened = new HwpDocument(new Uint8Array(saved));
    try { assert.equal(reopened.getTextInCell(0, t.paraIdx, t.controlIdx, 6, 0, 0, 3), '005'); assert.equal(JSON.parse(reopened.getCellCharPropertiesAt(0, t.paraIdx, t.controlIdx, 6, 0, 0)).bold, true); }
    finally { reopened.free(); }
  });
  if (pageErrors.length) failures.push({ name: 'page errors', errors: pageErrors }); if (consoleErrors.length) failures.push({ name: 'console errors', errors: consoleErrors }); if (externalRequests.length) failures.push({ name: 'offline asset boundary', externalRequests });
  await page.screenshot({ path: resolve(out, 'conversion.png') });
  await writeFile(resolve(out, 'result.json'), JSON.stringify({ results, failures, pageErrors, consoleErrors, externalRequests, build: await page.evaluate(() => fetch('/build-evidence.json').then(r => r.json())), note: 'Isolated headless Edge profile. Synthetic test extension positions actual cursor/selection; production dialogs/commands/history/save used. No paid model or native Hancom comparison.' }, null, 2)); if (failures.length) process.exitCode = 1;
} catch (error) { console.error(error); process.exitCode = 1; await writeFile(resolve(out, 'fatal.json'), JSON.stringify({ error: String(error), stack: error.stack, results, failures, pageErrors, consoleErrors }, null, 2)); }
finally { await browser?.close(); server.kill(); }
