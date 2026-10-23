import puppeteer from 'puppeteer-core';
import { spawn } from 'node:child_process';
import { readFile, writeFile, mkdir, mkdtemp } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

const app = resolve(dirname(fileURLToPath(import.meta.url)), '..'), repo = resolve(app, '../..');
if (!process.env.JUEONY_TEST_DIST || !process.env.JUEONY_ENGINE_PACKAGE) throw new Error('Set JUEONY_TEST_DIST and JUEONY_ENGINE_PACKAGE');
const port = Number(process.env.JUEONY_TEST_PORT ?? 4502), origin = `http://127.0.0.1:${port}`;
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid isolated test port');
const dist = resolve(app, process.env.JUEONY_TEST_DIST), pkg = resolve(repo, process.env.JUEONY_ENGINE_PACKAGE);
const out = resolve(repo, process.env.JUEONY_TEST_OUTPUT ?? 'build/basic-word-boundaries'); await mkdir(out, { recursive: true });
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

  for (const extension of ['hwp', 'hwpx']) {
    for (const [name, initial, offset, shortcut, expected] of [
      ['forward-astral', '😀 tail', 0, 'Control+Delete', 'tail'],
      ['backward-astral', '😀alpha', 6, 'Control+Backspace', '😀'],
      ['forward-long', 'a'.repeat(80) + ' tail', 0, 'Control+Delete', 'tail'],
      ['backward-long', 'head ' + '가'.repeat(80), 85, 'Control+Backspace', 'head '],
    ]) await scenario(`${extension}: ${name} word deletion, one undo/redo and production save/reopen`, async () => {
      const frame = await open([initial], extension); await position(frame, 0, offset); await press(shortcut);
      assert.deepEqual(await text(frame), [expected]); await press('Control+z'); assert.deepEqual(await text(frame), [initial]);
      await press('Control+Shift+z'); assert.deepEqual(await text(frame), [expected]);
      await saved(frame, `${name}.${extension}`, doc => assert.equal(doc.getTextRange(0, 0, 0, doc.getParagraphLength(0, 0)), expected));
    });
    await scenario(`${extension}: previous-word key deletes a reversed scalar selection instead of a neighbouring word`, async () => {
      const frame = await open(['앞선택😀뒤 next'], extension); await position(frame, 0, 1, 4); await press('Control+Backspace');
      assert.deepEqual(await text(frame), ['앞뒤 next']); await press('Control+z'); assert.deepEqual(await text(frame), ['앞선택😀뒤 next']);
    });
    await scenario(`${extension}: word deletion at a paragraph boundary joins only adjacent paragraphs and undoes`, async () => {
      const frame = await open(['앞😀', '뒤🧪'], extension); await position(frame, 0, 2); await press('Control+Delete');
      assert.deepEqual(await text(frame), ['앞😀뒤🧪']); await press('Control+z'); assert.deepEqual(await text(frame), ['앞😀', '뒤🧪']);
      await position(frame, 1, 0); await press('Control+Backspace'); assert.deepEqual(await text(frame), ['앞😀뒤🧪']);
      await press('Control+z'); assert.deepEqual(await text(frame), ['앞😀', '뒤🧪']); await press('Control+Shift+z');
      await saved(frame, `word-paragraph-join.${extension}`, doc => assert.equal(doc.getTextRange(0, 0, 0, doc.getParagraphLength(0, 0)), '앞😀뒤🧪'));
    });
    await scenario(`${extension}: terminal word deletion is a no-op and Shift+Home/End keeps the scalar anchor`, async () => {
      const frame = await open(['앞😀뒤'], extension); const initial = await immutable(frame); await press('Control+Backspace'); assert.deepEqual(await immutable(frame), initial);
      await position(frame, 0, 3); await press('Control+Delete'); assert.deepEqual(await immutable(frame), initial);
      await position(frame, 0, 2); await press('Shift+Home'); assert.equal((await selection(frame)).selection.anchor.charOffset, 2); assert.equal((await selection(frame)).cursor.charOffset, 0);
      await press('Shift+End'); assert.equal((await selection(frame)).selection.anchor.charOffset, 2); assert.equal((await selection(frame)).cursor.charOffset, 3); assert.deepEqual(await immutable(frame), initial);
    });
  }
  await scenario('F3 word/sentence selections and line/arrows preserve scalar anchors without changing the model', async () => {
    const frame = await open(['😀word tail. Next']); await position(frame, 0, 2); const initial = await immutable(frame); await press('F3');
    let state = await selection(frame); assert.equal(state.selection.anchor.charOffset, 1); assert.equal(state.cursor.charOffset, 5);
    const anchor = state.selection.anchor; await press('End'); state = await selection(frame); assert.deepEqual(state.selection.anchor, anchor); assert.equal(state.cursor.charOffset, 16);
    await press('Home'); assert.deepEqual((await selection(frame)).selection.anchor, anchor); assert.equal((await selection(frame)).cursor.charOffset, 0);
    await press('ArrowRight'); assert.equal((await selection(frame)).cursor.charOffset, 1); await press('ArrowRight'); assert.deepEqual((await selection(frame)).selection.anchor, anchor);
    await press('Escape'); await position(frame, 0, 2); await press('F3'); await press('F3');
    state = await selection(frame); assert.equal(state.selection.anchor.charOffset, 0); assert.equal(state.cursor.charOffset, 11); assert.deepEqual(await immutable(frame), initial);
  });
  for (const extension of ['hwp', 'hwpx']) await scenario(`${extension}: cell word deletion preserves neighbours and Ctrl+Backspace keeps the table-row meaning`, async () => {
    const doc = body(['보호 본문']); const made = JSON.parse(doc.createTable(0, 0, 0, 2, 2));
    for (const [index, value] of ['😀 ' + '가'.repeat(80) + ' tail', '옆 셀', '아래 셀', '오른쪽 아래'].entries()) doc.insertTextInCell(0, made.paraIdx, made.controlIdx, index, 0, 0, value);
    const bytes = [...doc[extension === 'hwp' ? 'exportHwp' : 'exportHwpx']()]; doc.free(); const frame = await openBytes(bytes, extension);
    await frame.evaluate(made => {
      window.__wordTable = made; const ih = window.__shortcutServices.getInputHandler();
      ih.cursor.moveTo({ sectionIndex: 0, paragraphIndex: 0, charOffset: 0, parentParaIndex: made.paraIdx, controlIndex: made.controlIdx, cellIndex: 0, cellParaIndex: 0,
        cellPath: [{ controlIndex: made.controlIdx, cellIndex: 0, cellParaIndex: 0 }] });
      ih.updateCaret(); ih.focus(); window.__shortcutServices.eventBus.emit('command-state-changed');
    }, made);
    const cells = () => frame.evaluate(() => { const d = window.__shortcutServices.wasm, t = window.__wordTable; return Array.from({ length: 4 }, (_, cell) => d.getTextInCell(0, t.paraIdx, t.controlIdx, cell, 0, 0, d.getCellParagraphLength(0, t.paraIdx, t.controlIdx, cell, 0))); });
    const before = await cells(); await press('Control+Delete'); assert.deepEqual(await cells(), [before[0].slice(3), ...before.slice(1)]);
    await press('Control+Delete'); assert.deepEqual(await cells(), ['tail', ...before.slice(1)]);
    await press('Control+z'); await press('Control+z'); assert.deepEqual(await cells(), before); await press('Control+Shift+z'); await press('Control+Shift+z');
    await saved(frame, `cell-word.${extension}`, reopened => { assert.equal(reopened.getTextInCell(0, made.paraIdx, made.controlIdx, 0, 0, 0, 4), 'tail'); assert.equal(reopened.getTextInCell(0, made.paraIdx, made.controlIdx, 1, 0, 0, 3), '옆 셀'); });
    const context = await frame.evaluate(() => window.rhwpStudio.automation.getContext()); assert.equal(context.inTable, true);
    await press('Control+Backspace');
    const after = await frame.evaluate(() => { const d = window.__shortcutServices.wasm, t = window.__wordTable; return d.getTextInCell(0, t.paraIdx, t.controlIdx, 0, 0, 0, d.getCellParagraphLength(0, t.paraIdx, t.controlIdx, 0, 0)); });
    assert.equal(after, '아래 셀'); await press('Control+z'); assert.deepEqual(await cells(), ['tail', ...before.slice(1)]);
  });
  await scenario('header word movement uses the same scalar and long-word boundary without editing body or header', async () => {
    const doc = body(['보호 본문']); doc.createHeaderFooter(0, true, 0); doc.insertTextInHeaderFooter(0, true, 0, 0, 0, '😀 ' + 'a'.repeat(80) + ' tail');
    const bytes = [...doc.exportHwpx()]; doc.free(); const frame = await openBytes(bytes);
    await frame.evaluate(() => { const ih = window.__shortcutServices.getInputHandler(); ih.cursor.enterHeaderFooterMode(true, 0, 0); ih.cursor.setHfCursorPosition(0, 0); ih.updateCaret(); ih.focus(); });
    const before = await immutable(frame), offset = () => frame.evaluate(() => window.__shortcutServices.getInputHandler().cursor.hfCharOffset);
    await press('Control+ArrowRight'); assert.equal(await offset(), 2); await press('Control+ArrowRight'); assert.equal(await offset(), 83);
    await press('Control+ArrowLeft'); assert.equal(await offset(), 2); assert.deepEqual(await immutable(frame), before);
  });
  await page.screenshot({ path: resolve(out, 'basic-word-boundaries.png') });
  assert.deepEqual(pageErrors, []); assert.deepEqual(externalRequests, []);
  await writeFile(resolve(out, 'result.json'), JSON.stringify({ results, failures, pageErrors, externalRequests, diagnostics, savedFiles, dist, enginePackage: pkg, port, limitations: 'Isolated actual Edge and Rust/WASM, real keyboard dispatch and production safe save/reopen. Existing character-class word grouping is preserved, not a claim of complete Unicode grapheme segmentation. Direct Hancom comparison, physical Windows IME and complete nested-cell/special-story matrices remain pending.' }, null, 2));
  if (failures.length) process.exitCode = 1;
} catch (error) { console.error(error); process.exitCode = 1; await writeFile(resolve(out, 'fatal.json'), JSON.stringify({ error: String(error), stack: error.stack, results, failures, pageErrors }, null, 2)); }
finally { await browser?.close(); server.kill(); }
