import puppeteer from 'puppeteer-core';
import { spawn } from 'node:child_process';
import { readFile, writeFile, mkdir, mkdtemp } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import { readFindHits, findHitPosition } from '../src/editor-actions/basic-find.ts';

const app = resolve(dirname(fileURLToPath(import.meta.url)), '..'), repo = resolve(app, '../..');
if (!process.env.JUEONY_TEST_DIST || !process.env.JUEONY_ENGINE_PACKAGE) throw new Error('Set JUEONY_TEST_DIST and JUEONY_ENGINE_PACKAGE');
const port = Number(process.env.JUEONY_TEST_PORT ?? 4502), origin = `http://127.0.0.1:${port}`;
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid isolated test port');
const dist = resolve(app, process.env.JUEONY_TEST_DIST), pkg = resolve(repo, process.env.JUEONY_ENGINE_PACKAGE);
const out = resolve(repo, process.env.JUEONY_TEST_OUTPUT ?? 'build/table-formula-format'); await mkdir(out, { recursive: true });
const { default: init, HwpDocument } = await import(pathToFileURL(resolve(pkg, 'rhwp.js')).href);
await init({ module_or_path: await readFile(resolve(pkg, 'rhwp_bg.wasm')) });
if (await fetch(origin + '/api/health').then(() => true, () => false)) throw new Error(`Test port ${port} is occupied`);
const server = spawn(process.execPath, ['apps/launcher/server.mjs'], { cwd: repo, windowsHide: true, stdio: 'ignore', env: { ...process.env, JUEONY_PORT: String(port), JUEONY_DIST: dist, JUEONY_CONNECTION_STORE: 'memory' } });
const results = [], failures = [], pageErrors = [], externalRequests = [], diagnostics = [], savedFiles = [];
let browser, page;
const delay = ms => new Promise(done => setTimeout(done, ms));
const active = async () => (await page.$('.editor-frame:not([hidden])')).contentFrame();
async function services() {
  const frame = await active();
  await frame.evaluate(() => {
    if (window.__shortcutServices) return;
    const automation = window.rhwpStudio.automation;
    automation.registerCommand({ id: 'ext:shortcut-test-services', label: '검수', canExecute: () => true, execute: value => { window.__shortcutServices = value; } });
    const result = automation.execute('ext:shortcut-test-services'); automation.unregisterCommand('ext:shortcut-test-services');
    if (!result.ok) throw new Error('Test-only service access failed');
  }); return frame;
}
function body(lines) {
  const doc = HwpDocument.createEmpty(); doc.createBlankDocument();
  for (const [index, line] of lines.entries()) { if (index) doc.splitParagraph(0, index - 1, doc.getParagraphLength(0, index - 1)); doc.insertText(0, index, 0, line); }
  return doc;
}
async function open(lines, extension = 'hwpx') {
  const doc = body(lines), bytes = [...doc[extension === 'hwp' ? 'exportHwp' : 'exportHwpx']()]; doc.free();
  return openBytes(bytes, extension);
}
async function openBytes(bytes, extension = 'hwpx') {
  const frame = await services();
  await frame.evaluate(async (bytes, extension) => {
    const root = await navigator.storage.getDirectory(), file = await root.getFileHandle('shortcut-basic.' + extension, { create: true });
    const writer = await file.createWritable(); await writer.write(new Uint8Array(bytes)); await writer.close();
    await window.jueonyEditor.open(new Uint8Array(bytes), 'shortcut-basic.' + extension, file, false);
    const ih = window.__shortcutServices.getInputHandler(); ih.cursor.exitBlockSelectionMode(); ih.cursor.moveTo({ sectionIndex: 0, paragraphIndex: 0, charOffset: 0 }); ih.updateCaret(); ih.focus();
  }, bytes, extension);
  return frame;
}
async function position(frame, paragraph, offset, anchor = null) {
  await frame.evaluate((paragraph, offset, anchor) => {
    const ih = window.__shortcutServices.getInputHandler(); ih.cursor.exitBlockSelectionMode(); ih.cursor.clearSelection();
    const end = { sectionIndex: 0, paragraphIndex: paragraph, charOffset: offset };
    if (anchor !== null) ih.cursor.selectRange({ ...end, charOffset: anchor }, end); else ih.cursor.moveTo(end);
    ih.updateCaret(); ih.focus(); window.__shortcutServices.eventBus.emit('command-state-changed');
  }, paragraph, offset, anchor);
}
async function press(keys) {
  const parts = keys.split('+');
  for (const modifier of parts.slice(0, -1)) await page.keyboard.down(modifier);
  await page.keyboard.press(parts.at(-1));
  for (const modifier of parts.slice(0, -1).reverse()) await page.keyboard.up(modifier);
}
async function repeat(keys) {
  const parts = keys.split('+');
  for (const modifier of parts.slice(0, -1)) await page.keyboard.down(modifier);
  await page.keyboard.down(parts.at(-1)); await page.keyboard.down(parts.at(-1)); await page.keyboard.up(parts.at(-1));
  for (const modifier of parts.slice(0, -1).reverse()) await page.keyboard.up(modifier);
}
const text = frame => frame.evaluate(() => window.jueonyEditor.snapshot().nodes.map(node => node.text));
const selection = frame => frame.evaluate(() => {
  const ih = window.__shortcutServices.getInputHandler();
  return { selection: ih.cursor.getSelection(), cursor: ih.cursor.getPosition(), phase: ih.cursor.blockSelectionPhase() };
});
// The ordinary save facade stamps the *current cursor* before export. Reading
// the native model directly proves navigation itself changed no model bytes,
// instead of making this inspection mutate the model's saved-cursor fields.
const immutable = frame => frame.evaluate(() => ({ revision: window.jueonyEditor.revision(), dirty: window.jueonyEditor.state().dirty,
  history: { undo: window.__shortcutServices.getInputHandler().history.undoStack.length, redo: window.__shortcutServices.getInputHandler().history.redoStack.length },
  bytes: [...window.__shortcutServices.wasm.borrowDocumentHandle().exportHwpx()] }));
async function saved(frame, name, verify) {
  const result = await frame.evaluate(async () => {
    const api = window.jueonyEditor, status = await api.save(), file = await api.fileHandle().getFile();
    return { status, dirty: api.state().dirty, bytes: [...new Uint8Array(await file.arrayBuffer())] };
  });
  if (result.status !== 'saved') {
    const diagnostic = await frame.evaluate(() => {
      const wasm = window.__shortcutServices.wasm, artifact = wasm.borrowDocumentHandle().exportHwpxWithReport();
      try { return { state: window.jueonyEditor.state(), font: window.jueonyEditor.formattingState(), bytes: [...artifact.takeBytes()], loss: JSON.parse(artifact.contentLoss()), properties: wasm.getCharPropertiesAt(0, 0, 0) }; }
      finally { artifact.free(); }
    });
    await writeFile(resolve(out, `blocked-${name}.hwpx`), new Uint8Array(diagnostic.bytes));
    const { bytes, ...properties } = diagnostic; diagnostics.push({ name, ...properties });
  }
  assert.equal(result.status, 'saved'); assert.equal(result.dirty, false);
  const bytes = new Uint8Array(result.bytes); await writeFile(resolve(out, name), bytes);
  const reopened = new HwpDocument(bytes); try { verify(reopened); } finally { reopened.free(); }
  savedFiles.push(name);
}
async function scenario(name, run) {
  try { await run(); results.push(name); console.log('PASS', name); }
  catch (error) { failures.push({ name, error: String(error), stack: error.stack }); console.error('FAIL', name, error); await page.screenshot({ path: resolve(out, `failure-${failures.length}.png`) }).catch(() => {}); await (await active()).evaluate(() => document.querySelectorAll('.modal-overlay .dialog-close').forEach(button => button.click())).catch(() => {}); }
}
try {
  for (let index = 0; index < 100; index++) { if (await fetch(origin + '/api/health').then(response => response.ok, () => false)) break; await delay(100); }
  const profile = await mkdtemp(resolve(out, 'edge-profile-'));
  browser = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', userDataDir: profile, headless: true, args: ['--no-first-run', '--disable-background-networking'], defaultViewport: { width: 1600, height: 1000 } });
  page = await browser.newPage(); page.setDefaultTimeout(15000); page.on('pageerror', error => pageErrors.push(String(error))); page.on('dialog', dialog => { diagnostics.push({ dialog: dialog.message() }); return dialog.dismiss(); });
  page.on('console', message => { if (message.type() === 'error') diagnostics.push({ console: message.text() }); });
  await page.setRequestInterception(true); page.on('request', request => { const url = request.url(); if (/^https?:/.test(url) && new URL(url).origin !== origin) { externalRequests.push(url); void request.abort(); } else void request.continue(); });
  await page.goto(origin); await page.waitForFunction(() => document.getElementById('app-status')?.textContent.includes('준비 완료'), { timeout: 90000 });



  async function openFormula(extension = 'hwpx') {
    const doc = body(['보호 본문']);
    const table = JSON.parse(doc.createTable(0, 0, 0, 1, 3));
    doc.insertTextInCell(0, table.paraIdx, table.controlIdx, 0, 0, 0, '1234.5');
    doc.insertTextInCell(0, table.paraIdx, table.controlIdx, 1, 0, 0, '0.06');
    doc.insertTextInCell(0, table.paraIdx, table.controlIdx, 2, 0, 0, '원문😀');
    const bytes = [...doc[extension === 'hwp' ? 'exportHwp' : 'exportHwpx']()]; doc.free();
    const frame = await openBytes(bytes, extension);
    await frame.evaluate(table => {
      window.__formulaTable = table;
      const ih = window.__shortcutServices.getInputHandler();
      ih.cursor.moveTo({ sectionIndex:0, paragraphIndex:0, charOffset:0, parentParaIndex:table.paraIdx, controlIndex:table.controlIdx, cellIndex:2, cellParaIndex:0, cellPath:[{controlIndex:table.controlIdx,cellIndex:2,cellParaIndex:0}] });
      ih.updateCaret(); ih.focus();
    }, table);
    return frame;
  }
  async function dialog(frame, format, comma, formula='=SUM(A1:B1)') {
    const result = await frame.evaluate(() => window.jueonyEditor.executeCommand('table:formula'));
    assert.equal(result.ok, true, JSON.stringify(result));
    await frame.waitForSelector('.formula-input');
    await frame.$eval('.formula-input', (element, value) => { element.value = value; }, formula);
    await frame.$$eval('.formula-select', (elements, value) => { elements[2].value = value; }, format);
    await frame.$eval('.formula-dialog-body input[type=checkbox]', (element, value) => { element.checked = value; }, comma);
  }
  const cellValue = frame => frame.evaluate(() => { const s=window.__shortcutServices,t=window.__formulaTable;return s.wasm.getTextInCell(0,t.paraIdx,t.controlIdx,2,0,0,s.wasm.getCellParagraphLength(0,t.paraIdx,t.controlIdx,2,0)); });
  for (const extension of ['hwp', 'hwpx']) for (const [format,comma,formula,expected] of [
    ['integer',false,'=SUM(A1:B1)','1235'], ['decimal1',false,'=SUM(A1:B1)','1234.6'],
    ['decimal2',false,'=A1','1234.50'], ['decimal2',true,'=A1','1,234.50'],
  ]) await scenario(`${extension}: ${format}, comma=${comma} displayed precision, one undo/redo, safe save/reopen`, async () => {
    const frame=await openFormula(extension), before=await immutable(frame);
    await dialog(frame,format,comma,formula);await frame.click('.modal-overlay .dialog-btn-primary');
    assert.equal(await frame.$('.formula-input'),null,await frame.$eval('.formula-error',e=>e.textContent).catch(()=>''));
    assert.equal(await cellValue(frame),expected);
    await frame.evaluate(()=>window.jueonyEditor.executeCommand('edit:undo'));assert.equal(await cellValue(frame),'원문😀');
    assert.deepEqual((await immutable(frame)).bytes,before.bytes);
    await frame.evaluate(()=>window.jueonyEditor.executeCommand('edit:redo'));assert.equal(await cellValue(frame),expected);
    const table=await frame.evaluate(()=>window.__formulaTable);
    await saved(frame,`formula-${format}-${comma}.${extension}`,d=>{
      assert.equal(d.getTextInCell(0,table.paraIdx,table.controlIdx,2,0,0,d.getCellParagraphLength(0,table.paraIdx,table.controlIdx,2,0)),expected);
      assert.equal(d.getTextInCell(0,table.paraIdx,table.controlIdx,0,0,0,6),'1234.5');
    });
  });
  for(const mode of ['insert-failure','operation-refused']) await scenario(`${mode}: original bytes, revision and history survive; dialog remains open`,async()=>{
    const frame=await openFormula(),before=await immutable(frame);await dialog(frame,'decimal2',false);
    await frame.evaluate(mode=>{const s=window.__shortcutServices,ih=s.getInputHandler();if(mode==='insert-failure'){window.__oldFormulaMethod=s.wasm.insertTextInCell;s.wasm.insertTextInCell=()=>{throw new Error('Injected formula insert failure');};}else{window.__oldFormulaMethod=ih.executeOperation;ih.executeOperation=()=>{};}},mode);
    try{await frame.click('.modal-overlay .dialog-btn-primary');assert.ok(await frame.$('.formula-input'));assert.match(await frame.$eval('.formula-error',e=>e.textContent),mode==='insert-failure'?/Injected formula insert failure/:/적용할 수 없습니다/);assert.deepEqual(await immutable(frame),before);}
    finally{await frame.evaluate(mode=>{const s=window.__shortcutServices;if(mode==='insert-failure')s.wasm.insertTextInCell=window.__oldFormulaMethod;else s.getInputHandler().executeOperation=window.__oldFormulaMethod;},mode);await frame.click('.modal-overlay .dialog-close');}
  });
  await page.screenshot({ path: resolve(out, 'table-formula-format.png') });
  assert.deepEqual(pageErrors, []); assert.deepEqual(externalRequests, []);
  await writeFile(resolve(out, 'result.json'), JSON.stringify({ results, failures, pageErrors, externalRequests, diagnostics, savedFiles, dist, enginePackage: pkg, port, limitations: 'Actual Edge formula dialog and Rust/WASM; displayed numeric precision, snapshot undo/redo and strict HWP/HWPX save/reopen. Failure injection checks rollback and refused operations. Static result text only: formula dependency graphs, automatic recalculation, Agent formula editing and direct Hancom parity remain unsupported/unverified.' }, null, 2));
  if (failures.length) process.exitCode = 1;
} catch (error) { console.error(error); process.exitCode = 1; await writeFile(resolve(out, 'fatal.json'), JSON.stringify({ error: String(error), stack: error.stack, results, failures, pageErrors }, null, 2)); }
finally { await browser?.close(); server.kill(); }
