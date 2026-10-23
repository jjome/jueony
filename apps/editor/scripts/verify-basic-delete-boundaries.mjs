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
const out = resolve(repo, process.env.JUEONY_TEST_OUTPUT ?? 'build/basic-delete-boundaries'); await mkdir(out, { recursive: true });
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


  async function openTable(offset, cellIndex, extension = 'hwpx', split = false) {
    const doc = body(['보호 앞뒤']); const made = JSON.parse(doc.createTable(0, 0, 0, 2, 2));
    for (const [index, value] of ['첫😀', '옆🧪', '아래🍀', '마지막🐱'].entries()) doc.insertTextInCell(0, made.paraIdx, made.controlIdx, index, 0, 0, value);
    if (split) doc.splitParagraphInCell(0, made.paraIdx, made.controlIdx, 0, 0, 1);
    const bytes = [...doc[extension === 'hwp' ? 'exportHwp' : 'exportHwpx']()]; doc.free(); const frame = await openBytes(bytes, extension);
    await frame.evaluate((made, offset, cellIndex) => {
      const ih = window.__shortcutServices.getInputHandler(); window.__boundaryTable = made;
      ih.cursor.moveTo({ sectionIndex: 0, paragraphIndex: 0, charOffset: offset, parentParaIndex: made.paraIdx, controlIndex: made.controlIdx, cellIndex, cellParaIndex: 0,
        cellPath: [{ controlIndex: made.controlIdx, cellIndex, cellParaIndex: 0 }] });
      ih.updateCaret(); ih.focus(); window.__shortcutServices.eventBus.emit('command-state-changed');
    }, made, offset, cellIndex); return frame;
  }
  for (const extension of ['hwp', 'hwpx']) for (const [cell,offset,key] of [[0,2,'Delete'],[0,0,'Backspace'],[3,4,'Delete'],[0,2,'Control+Delete'],[3,4,'Control+Delete']]) {
    await scenario(`${extension}: cell ${cell} offset ${offset} ${key} does not edit an adjacent cell/body`, async () => {
      const frame=await openTable(offset,cell,extension), before=await immutable(frame), caret=await selection(frame); await press(key);
      assert.deepEqual(await immutable(frame),before); assert.deepEqual(await selection(frame),caret);
    });
  }
  for (const extension of ['hwp', 'hwpx']) await scenario(`${extension}: nested table end Ctrl+Delete preserves outer cells and sibling nested table`, async () => {
    const doc = body([]);
    doc.pasteHtml(0, 0, 0, '<table><tr><td><p>바깥 앞</p><table><tr><td>안쪽😀</td></tr></table><p>바깥 사이</p><table><tr><td>다른표🧪</td></tr></table><p>바깥 뒤</p></td><td>이웃🍀</td></tr></table>');
    const hit = readFindHits(doc, '안쪽😀', true)[0], other = readFindHits(doc, '다른표🧪', true)[0];
    assert.ok(hit?.cellPath?.length > 1); assert.ok(other?.cellPath?.length > 1);
    assert.equal(hit.cellPath[0].cellIndex, other.cellPath[0].cellIndex);
    assert.notEqual(hit.cellPath[0].cellParaIndex, other.cellPath[0].cellParaIndex);
    const at = { ...findHitPosition(hit), charOffset: hit.charOffset + hit.length };
    const bytes = [...doc[extension === 'hwp' ? 'exportHwp' : 'exportHwpx']()]; doc.free();
    const frame = await openBytes(bytes, extension);
    await frame.evaluate(at => { const ih = window.__shortcutServices.getInputHandler(); ih.cursor.moveTo(at); ih.updateCaret(); ih.focus(); }, at);
    const before = await immutable(frame), caret = await selection(frame); await press('Control+Delete');
    assert.deepEqual(await immutable(frame), before); assert.deepEqual(await selection(frame), caret);
  });
  for (const extension of ['hwp', 'hwpx']) await scenario(`${extension}: Ctrl+Delete still joins paragraphs inside one cell and preserves its neighbours`, async () => {
    const frame=await openTable(1,0,extension,true), state=()=>frame.evaluate(()=>{const d=window.__shortcutServices.wasm,t=window.__boundaryTable;return {count:d.getCellParagraphCount(0,t.paraIdx,t.controlIdx,0),text:d.getTextInCell(0,t.paraIdx,t.controlIdx,0,0,0,d.getCellParagraphLength(0,t.paraIdx,t.controlIdx,0,0)),other:d.getTextInCell(0,t.paraIdx,t.controlIdx,1,0,0,2)};});
    assert.deepEqual(await state(),{count:2,text:'첫',other:'옆🧪'}); await press('Control+Delete'); assert.deepEqual(await state(),{count:1,text:'첫😀',other:'옆🧪'});
    await press('Control+z');assert.deepEqual(await state(),{count:2,text:'첫',other:'옆🧪'});await press('Control+Shift+z');assert.deepEqual(await state(),{count:1,text:'첫😀',other:'옆🧪'});
    const made=await frame.evaluate(()=>window.__boundaryTable);
    await saved(frame,`cell-paragraph-${extension}.${extension}`,d=>{assert.equal(d.getCellParagraphCount(0,made.paraIdx,made.controlIdx,0),1);assert.equal(d.getTextInCell(0,made.paraIdx,made.controlIdx,0,0,0,2),'첫😀');assert.equal(d.getTextInCell(0,made.paraIdx,made.controlIdx,1,0,0,2),'옆🧪');});
  });
  for (const extension of ['hwp', 'hwpx']) for (const key of ['Delete','Backspace']) await scenario(`${extension}: plain ${key} merges a simple section boundary and one undo restores both sections`, async () => {
    const doc=body(['앞😀뒤🧪']); doc.insertSectionBreak(0,0,2); const bytes=[...doc[extension==='hwp'?'exportHwp':'exportHwpx']()];doc.free();const frame=await openBytes(bytes,extension);
    await frame.evaluate(key=>{const ih=window.__shortcutServices.getInputHandler();ih.cursor.moveTo({sectionIndex:key==='Delete'?0:1,paragraphIndex:0,charOffset:key==='Delete'?2:0});ih.updateCaret();ih.focus();},key);
    const before=await text(frame);await press(key);assert.deepEqual(await text(frame),['앞😀뒤🧪']);await press('Control+z');assert.deepEqual(await text(frame),before);
    await press('Control+Shift+z');assert.deepEqual(await text(frame),['앞😀뒤🧪']);
    await saved(frame,`section-${key}.${extension}`,d=>{assert.equal(d.getSectionCount(),1);assert.equal(d.getTextRange(0,0,0,d.getParagraphLength(0,0)),'앞😀뒤🧪');});
  });
  await page.screenshot({ path: resolve(out, 'basic-delete-boundaries.png') });
  assert.deepEqual(pageErrors, []); assert.deepEqual(externalRequests, []);
  await writeFile(resolve(out, 'result.json'), JSON.stringify({ results, failures, pageErrors, externalRequests, diagnostics, savedFiles, dist, enginePackage: pkg, port, limitations: 'Isolated actual Edge and Rust/WASM, real keyboard dispatch and production safe save/reopen. Existing character-class word grouping is preserved, not a claim of complete Unicode grapheme segmentation. Direct Hancom comparison, physical Windows IME and complete nested-cell/special-story matrices remain pending.' }, null, 2));
  if (failures.length) process.exitCode = 1;
} catch (error) { console.error(error); process.exitCode = 1; await writeFile(resolve(out, 'fatal.json'), JSON.stringify({ error: String(error), stack: error.stack, results, failures, pageErrors }, null, 2)); }
finally { await browser?.close(); server.kill(); }
