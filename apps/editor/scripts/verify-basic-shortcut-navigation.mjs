import puppeteer from 'puppeteer-core';
import { spawn } from 'node:child_process';
import { readFile, writeFile, mkdir, mkdtemp } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import {readOwnedZip, writeOwnedZip} from './lib/owned-zip.mjs';

const app = resolve(dirname(fileURLToPath(import.meta.url)), '..'), repo = resolve(app, '../..');
if (!process.env.JUEONY_TEST_DIST || !process.env.JUEONY_ENGINE_PACKAGE) throw new Error('Set JUEONY_TEST_DIST and JUEONY_ENGINE_PACKAGE');
const port = Number(process.env.JUEONY_TEST_PORT ?? 4502), origin = `http://127.0.0.1:${port}`;
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid isolated test port');
const dist = resolve(app, process.env.JUEONY_TEST_DIST), pkg = resolve(repo, process.env.JUEONY_ENGINE_PACKAGE);
const out = resolve(repo, process.env.JUEONY_TEST_OUTPUT ?? 'build/basic-shortcut-navigation'); await mkdir(out, { recursive: true });
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
const immutable = frame => frame.evaluate(() => ({ revision: window.jueonyEditor.revision(), dirty: window.jueonyEditor.state().dirty, bytes: [...window.__shortcutServices.wasm.borrowDocumentHandle().exportHwpx()] }));
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
    await scenario(`${extension}: Ctrl+T deletes a reversed scalar selection, undo/redo and actual save/reopen`, async () => {
      const frame = await open(['앞선택😀뒤 next'], extension); await position(frame, 0, 1, 4);
      await press('Control+t'); assert.deepEqual(await text(frame), ['앞뒤 next']);
      await press('Control+z'); assert.deepEqual(await text(frame), ['앞선택😀뒤 next']);
      await press('Control+Shift+z'); assert.deepEqual(await text(frame), ['앞뒤 next']);
      await saved(frame, `selected-word.${extension}`, doc => assert.equal(doc.getTextRange(0, 0, 0, doc.getParagraphLength(0, 0)), '앞뒤 next'));
    });
    await scenario(`${extension}: held Ctrl+T repeats word deletion, undo preserves each actual edit`, async () => {
      const frame = await open(['one two three'], extension); await repeat('Control+t'); assert.deepEqual(await text(frame), ['three']);
      await press('Control+z'); assert.deepEqual(await text(frame), ['two three']); await press('Control+z'); assert.deepEqual(await text(frame), ['one two three']);
      await press('Control+Shift+z'); await press('Control+Shift+z'); assert.deepEqual(await text(frame), ['three']);
      await saved(frame, `repeated-word.${extension}`, doc => assert.equal(doc.getTextRange(0, 0, 0, doc.getParagraphLength(0, 0)), 'three'));
    });
    await scenario(`${extension}: held font-size increments apply twice without repeating a toggle and persist`, async () => {
      const frame = await open(['서식😀'], extension); await position(frame, 0, 3, 0);
      const before = await frame.evaluate(() => window.__shortcutServices.wasm.getCharPropertiesAt(0, 0, 0).fontSize);
      await repeat('Control+]'); assert.equal(await frame.evaluate(() => window.__shortcutServices.wasm.getCharPropertiesAt(0, 0, 0).fontSize), before + 200);
      await repeat('Control+b'); assert.equal(await frame.evaluate(() => window.__shortcutServices.wasm.getCharPropertiesAt(0, 0, 0).bold), true);
      await saved(frame, `repeated-format.${extension}`, doc => { const properties = JSON.parse(doc.getCharPropertiesAt(0, 0, 0)); assert.equal(properties.fontSize, before + 200); assert.equal(properties.bold, true); });
    });
    await scenario(`${extension}: Ctrl+Alt+V opens text-only paste; selection, undo and save stay connected`, async () => {
      const frame = await open(['앞바꿀뒤'], extension); await position(frame, 0, 3, 1); await press('Control+Alt+v');
      await frame.waitForSelector('[data-jueony-plain-text]');
      await frame.$eval('[data-jueony-plain-text] textarea', element => { element.value = '새😀\n다음'; });
      await frame.click('.modal-overlay .dialog-btn-primary'); await frame.waitForSelector('[data-jueony-plain-text]', { hidden: true });
      assert.deepEqual(await text(frame), ['앞새😀', '다음뒤']); await press('Control+z'); assert.deepEqual(await text(frame), ['앞바꿀뒤']);
      await press('Control+Shift+z'); assert.deepEqual(await text(frame), ['앞새😀', '다음뒤']);
      await saved(frame, `paste-shortcut.${extension}`, doc => { assert.equal(doc.getTextRange(0, 0, 0, doc.getParagraphLength(0, 0)), '앞새😀'); assert.equal(doc.getTextRange(0, 1, 0, doc.getParagraphLength(0, 1)), '다음뒤'); });
    });
    await scenario(`${extension}: Shift document and paragraph boundaries preserve and reverse an existing selection without modifying bytes`, async () => {
      const frame = await open(['첫 문단', '가운데 😀 문단', '끝 문단'], extension); await position(frame, 1, 3);
      const before = await immutable(frame); await press('Control+Shift+PageDown');
      let state = await selection(frame); assert.deepEqual(state.selection.anchor, { sectionIndex: 0, paragraphIndex: 1, charOffset: 3 }); assert.equal(state.cursor.paragraphIndex, 2); assert.equal(state.cursor.charOffset, 4);
      await press('Control+Shift+PageUp'); state = await selection(frame); assert.equal(state.selection.anchor.paragraphIndex, 1); assert.equal(state.selection.anchor.charOffset, 3); assert.equal(state.cursor.paragraphIndex, 0); assert.equal(state.cursor.charOffset, 0);
      await press('Alt+Shift+End'); state = await selection(frame); assert.equal(state.selection.anchor.paragraphIndex, 1); assert.equal(state.cursor.charOffset, 4);
      await press('Alt+Home'); state = await selection(frame); assert.equal(state.selection, null); assert.equal(state.cursor.charOffset, 0);
      assert.deepEqual(await immutable(frame), before);
    });
    await scenario(`${extension}: F3 block selection survives unmodified document boundary navigation`, async () => {
      const frame = await open(['처음', '선택 기준', '끝'], extension); await position(frame, 1, 2); const before = await immutable(frame);
      await press('F3'); await press('Control+PageDown'); let state = await selection(frame);
      assert.notEqual(state.phase, null); assert.equal(state.selection.anchor.paragraphIndex, 1); assert.equal(state.selection.anchor.charOffset, 2); assert.equal(state.cursor.paragraphIndex, 2);
      await press('Control+PageUp'); state = await selection(frame); assert.equal(state.selection.anchor.paragraphIndex, 1); assert.equal(state.cursor.paragraphIndex, 0);
      assert.deepEqual(await immutable(frame), before);
    });
    await scenario(`${extension}: Ctrl+Alt+A cycles superscript/subscript/normal, preserves other effects and saves`, async () => {
      const frame = await open(['첨자😀 보존'], extension); await position(frame, 0, 3, 0); await press('Control+b');
      const selected = await selection(frame);
      const script = () => frame.evaluate(() => { const p = window.__shortcutServices.wasm.getCharPropertiesAt(0, 0, 0); return { superscript: p.superscript, subscript: p.subscript, bold: p.bold }; });
      await repeat('Control+Alt+a'); assert.deepEqual(await script(), { superscript: true, subscript: false, bold: true }); assert.deepEqual(await selection(frame), selected);
      await press('Control+Alt+a'); assert.deepEqual(await script(), { superscript: false, subscript: true, bold: true }); assert.deepEqual(await selection(frame), selected);
      await press('Control+Alt+a'); assert.deepEqual(await script(), { superscript: false, subscript: false, bold: true }); assert.deepEqual(await selection(frame), selected);
      await press('Control+z'); assert.deepEqual(await script(), { superscript: false, subscript: true, bold: true });
      await press('Control+Shift+z'); assert.deepEqual(await script(), { superscript: false, subscript: false, bold: true });
      // Existing engine history restores its own caret, not the old selection.
      // Re-select explicitly; selection retention above belongs to each shortcut.
      await position(frame, 0, 3, 0); await press('Control+Alt+a'); assert.deepEqual(await selection(frame), selected);
      await saved(frame, `cycle-script.${extension}`, doc => { const p = JSON.parse(doc.getCharPropertiesAt(0, 0, 0)); assert.equal(p.superscript, true); assert.equal(p.subscript, false); assert.equal(p.bold, true); assert.equal(JSON.parse(doc.getCharPropertiesAt(0, 0, 4)).superscript, false); });
    });
    await scenario(`${extension}: Alt+Shift+F/G follow current local font order with repeat, undo and save`, async () => {
      const frame = await open(['글꼴😀 보존'], extension); await position(frame, 0, 3, 0);
      const initial = await frame.evaluate(() => window.jueonyEditor.formattingState());
      const fonts = [...new Set(initial.fonts)], index = fonts.indexOf(initial.fontFamily); assert.ok(index >= 0 && fonts.length > 2);
      const chars = () => frame.evaluate(() => window.__shortcutServices.wasm.getCharPropertiesAt(0, 0, 0));
      await press('Alt+Shift+f'); assert.equal((await chars()).fontFamily, fonts[(index + 1) % fonts.length]);
      await press('Alt+Shift+g'); assert.equal((await chars()).fontFamily, initial.fontFamily);
      await repeat('Alt+Shift+f'); const expected = fonts[(index + 2) % fonts.length]; assert.equal((await chars()).fontFamily, expected);
      await press('Control+z'); assert.equal((await chars()).fontFamily, fonts[(index + 1) % fonts.length]); await press('Control+Shift+z');
      await saved(frame, `cycle-font.${extension}`, doc => { assert.equal(JSON.parse(doc.getCharPropertiesAt(0, 0, 0)).fontFamily, expected); assert.equal(JSON.parse(doc.getCharPropertiesAt(0, 0, 4)).fontFamily, initial.fontFamily); });
    });
  }
  await scenario('font-cycle shortcut honors the selected language slot without rewriting other font families', async () => {
    const frame = await open(['English 한글']); await position(frame, 0, 7, 0); await frame.select('#font-lang', '1');
    await frame.evaluate(() => window.__shortcutServices.getInputHandler().focus());
    const before = await frame.evaluate(() => window.__shortcutServices.wasm.getCharPropertiesAt(0, 0, 0).fontFamilies);
    const initial = await frame.evaluate(() => window.jueonyEditor.formattingState()), fonts = [...new Set(initial.fonts)], index = fonts.indexOf(initial.fontFamily); assert.ok(index >= 0);
    await press('Alt+Shift+f'); const after = await frame.evaluate(() => window.__shortcutServices.wasm.getCharPropertiesAt(0, 0, 0).fontFamilies);
    assert.equal(after[1], fonts[(index + 1) % fonts.length]); for (let slot = 0; slot < 7; slot++) if (slot !== 1) assert.equal(after[slot], before[slot]);
    await frame.select('#font-lang', 'all');
  });
  await scenario('all-language font change resolves each distinct language catalog instead of reusing the Korean numeric ID', async () => {
    const doc = body(['한글 English 😀']), entries = readOwnedZip(doc.exportHwpx()); doc.free();
    let changed = 0;
    for (const entry of entries) if (entry[0] === 'Contents/header.xml') {
      entry[1] = Buffer.from(entry[1].toString().replace(/<hh:fontface lang="LATIN"[^>]*>[\s\S]*?<\/hh:fontface>/, part => {
        changed++; return part.replace(/face="함초롬돋움"/g, 'face="__TEMP__"').replace(/face="함초롬바탕"/g, 'face="함초롬돋움"').replace(/face="__TEMP__"/g, 'face="함초롬바탕"');
      }));
    }
    assert.equal(changed, 1);
    const frame = await openBytes([...writeOwnedZip(entries)]); await position(frame, 0, 6, 0);
    const before = await frame.evaluate(() => window.__shortcutServices.wasm.getCharPropertiesAt(0, 0, 0).fontFamilies);
    assert.notEqual(before[0], before[1]); await press('Alt+Shift+f');
    const after = await frame.evaluate(() => window.__shortcutServices.wasm.getCharPropertiesAt(0, 0, 0).fontFamilies);
    assert.deepEqual(after, Array(7).fill('함초롬돋움'));
    await press('Control+z'); assert.deepEqual(await frame.evaluate(() => window.__shortcutServices.wasm.getCharPropertiesAt(0, 0, 0).fontFamilies), before);
    await press('Control+Shift+z');
    await saved(frame, 'different-font-catalogs.hwpx', doc => assert.deepEqual(JSON.parse(doc.getCharPropertiesAt(0, 0, 0)).fontFamilies, Array(7).fill('함초롬돋움')));
  });
  await scenario('caret script cycling changes pending typing properties and applies to subsequently typed text only', async () => {
    const frame = await open(['기존']); await position(frame, 0, 2); const before = await immutable(frame);
    await press('Control+Alt+a'); assert.deepEqual(await immutable(frame), before); await page.keyboard.type('X'); assert.deepEqual(await text(frame), ['기존X']);
    assert.equal(await frame.evaluate(() => window.__shortcutServices.wasm.getCharPropertiesAt(0, 0, 2).superscript), true);
    assert.equal(await frame.evaluate(() => window.__shortcutServices.wasm.getCharPropertiesAt(0, 0, 0).superscript), false);
    await saved(frame, 'pending-script.hwpx', doc => assert.equal(JSON.parse(doc.getCharPropertiesAt(0, 0, 2)).superscript, true));
  });
  await scenario('unknown imported font types remain blocked with a precise error and unchanged original file', async () => {
    const doc = body(['원본 글꼴 유형 보호']), entries = readOwnedZip(doc.exportHwpx()); doc.free();
    for (const entry of entries) if (entry[0] === 'Contents/header.xml') entry[1] = Buffer.from(entry[1].toString().replace(/<hh:font\b[^>]*>/g, tag => tag.replace(/\btype="[^"]*"/, 'type="OTHER"')));
    const bytes = [...writeOwnedZip(entries)], frame = await openBytes(bytes); await position(frame, 0, 2, 0); await press('Control+b');
    const start = diagnostics.length;
    const result = await frame.evaluate(async () => {
      const api = window.jueonyEditor, status = await api.save(), file = await api.fileHandle().getFile();
      return {status, dirty: api.state().dirty, bytes: [...new Uint8Array(await file.arrayBuffer())]};
    });
    assert.equal(result.status, 'failed'); assert.equal(result.dirty, true); assert.deepEqual(result.bytes, bytes);
    const notices = JSON.stringify(diagnostics.slice(start)); assert.match(notices, /원본 글꼴 유형|글꼴 속성/); assert.doesNotMatch(notices, /손실 보고서 항목이 올바르지/);
  });
  await scenario('Ctrl+Shift+Home/End select the visible screen edge instead of jumping to document start/end', async () => {
    const frame = await open(Array.from({ length: 100 }, (_, index) => `본문 ${String(index).padStart(3, '0')} 화면 선택 😀`)); await position(frame, 50, 4); await delay(100);
    const before = await immutable(frame), scrollBefore = await frame.evaluate(() => window.__shortcutServices.getInputHandler().container.scrollTop);
    await press('Control+Shift+Home'); const first = await selection(frame);
    assert.equal(first.selection.anchor.paragraphIndex, 50); assert.ok(first.cursor.paragraphIndex > 0 && first.cursor.paragraphIndex < 50, JSON.stringify(first));
    assert.equal(await frame.evaluate(() => window.__shortcutServices.getInputHandler().container.scrollTop), scrollBefore);
    await press('Control+Shift+End'); const last = await selection(frame); assert.equal(last.selection.anchor.paragraphIndex, 50); assert.ok(last.cursor.paragraphIndex > first.cursor.paragraphIndex && last.cursor.paragraphIndex < 99, JSON.stringify(last));
    assert.equal(await frame.evaluate(() => window.__shortcutServices.getInputHandler().container.scrollTop), scrollBefore); assert.deepEqual(await immutable(frame), before);
  });
  await scenario('synthetic AltGraph and IME safeguards leave actual document, selection and dialogs unchanged', async () => {
    const frame = await open(['조합 보호']); await position(frame, 0, 2, 0); const before = await immutable(frame), selected = await selection(frame);
    const result = await frame.evaluate(() => {
      const ih = window.__shortcutServices.getInputHandler(), event = new KeyboardEvent('keydown', { key: 'v', code: 'KeyV', ctrlKey: true, altKey: true, bubbles: true, cancelable: true });
      Object.defineProperty(event, 'getModifierState', { value: name => name === 'AltGraph' }); ih.textarea.dispatchEvent(event);
      ih.textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 't', code: 'KeyT', ctrlKey: true, isComposing: true, bubbles: true, cancelable: true }));
      return { altGraphDefaultPrevented: event.defaultPrevented, dialog: Boolean(document.querySelector('.modal-overlay')) };
    });
    assert.equal(result.altGraphDefaultPrevented, false); assert.equal(result.dialog, false); assert.deepEqual(await immutable(frame), before); assert.deepEqual(await selection(frame), selected);
  });
  await page.screenshot({ path: resolve(out, 'basic-shortcuts.png') });
  assert.deepEqual(pageErrors, []); assert.deepEqual(externalRequests, []);
  await writeFile(resolve(out, 'result.json'), JSON.stringify({ results, failures, pageErrors, externalRequests, diagnostics, savedFiles, dist, enginePackage: pkg, port, limitations: 'Isolated actual Edge and Rust/WASM engine, real keyboard dispatch and disk save/reopen. Synthetic AltGraph/IME guard checks are not physical Windows IME validation. Hancom direct comparison remains pending; Shift boundary selection is an app contract extension, not a separately confirmed Hancom gesture.' }, null, 2));
  if (failures.length) process.exitCode = 1;
} catch (error) { console.error(error); process.exitCode = 1; await writeFile(resolve(out, 'fatal.json'), JSON.stringify({ error: String(error), stack: error.stack, results, failures, pageErrors }, null, 2)); }
finally { await browser?.close(); server.kill(); }
