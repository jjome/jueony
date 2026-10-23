import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const app = resolve(dirname(fileURLToPath(import.meta.url)), '..'), repo = resolve(app, '../..');
const dist = resolve(process.env.JUEONY_TEST_DIST), pkg = resolve(process.env.JUEONY_ENGINE_PACKAGE);
const out = resolve(process.env.JUEONY_TEST_OUTPUT ?? join(app, 'evidence/recent-fonts'));
const port = Number(process.env.JUEONY_TEST_PORT ?? 4503), origin = `http://127.0.0.1:${port}`, key = 'jueony-recent-fonts-v1';
await mkdir(out, { recursive: true });
const profile = await mkdtemp(join(tmpdir(), 'jueony-recent-fonts-'));
const { default: init, HwpDocument } = await import(pathToFileURL(join(pkg, 'rhwp.js')).href);
await init({ module_or_path: await readFile(join(pkg, 'rhwp_bg.wasm')) });
if (await fetch(origin).then(() => true, () => false)) throw new Error(`Test port ${port} is occupied`);
const server = spawn(process.execPath, ['apps/launcher/server.mjs'], { cwd: repo, windowsHide: true, stdio: 'ignore', env: { ...process.env, JUEONY_PORT: String(port), JUEONY_DIST: dist, JUEONY_CONNECTION_STORE: 'memory' } });
let browser, page, stage = 'startup';
const results = [], pageErrors = [], externalRequests = [];
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const pass = name => { results.push(name); console.log('PASS', name); };
const parse = value => typeof value === 'string' ? JSON.parse(value) : value;
async function launch() {
  browser = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true, userDataDir: profile, protocolTimeout: 45000, defaultViewport: { width: 1700, height: 1100 }, args: ['--no-first-run', '--disable-background-networking', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
  page = await browser.newPage(); page.setDefaultTimeout(15000);
  page.on('pageerror', error => pageErrors.push(String(error))); page.on('dialog', dialog => dialog.accept());
  await page.setRequestInterception(true);
  page.on('request', request => { if (/^https?:/.test(request.url()) && !request.url().startsWith(origin + '/')) { externalRequests.push(request.url()); void request.abort(); } else void request.continue(); });
  await page.goto(origin + '/?storage=download');
  await page.waitForFunction(() => document.getElementById('app-status')?.textContent.includes('준비 완료'), { timeout: 90000 });
}
async function active() {
  const frame = await (await page.$('.editor-frame:not([hidden])')).contentFrame();
  await frame.waitForFunction(() => window.jueonyEditor?.formattingState && !window.jueonyEditor.busy());
  await frame.evaluate(() => {
    if (window.__recentFontServices) return;
    const automation = window.rhwpStudio.automation;
    automation.registerCommand({ id: 'ext:recent-font-inspect', label: '검수', canExecute: () => true, execute: services => { window.__recentFontServices = services; } });
    automation.execute('ext:recent-font-inspect'); automation.unregisterCommand('ext:recent-font-inspect');
  });
  return frame;
}
async function open(ext) {
  const doc = HwpDocument.createEmpty(); doc.createBlankDocument(); doc.insertText(0, 0, 0, '가나다라마바사ABCDEFGHI');
  const bytes = [...doc[ext === 'hwp' ? 'exportHwp' : 'exportHwpx']()]; doc.free();
  const frame = await active();
  await frame.evaluate(async (bytes, ext) => {
    const root = await navigator.storage.getDirectory(), handle = await root.getFileHandle(`recent-fonts.${ext}`, { create: true }), writer = await handle.createWritable();
    await writer.write(new Uint8Array(bytes)); await writer.close();
    await window.jueonyEditor.open(new Uint8Array(bytes), `recent-fonts.${ext}`, handle, false);
  }, bytes, ext);
  await select(frame); return frame;
}
async function select(frame) {
  await frame.waitForFunction(() => !window.jueonyEditor.busy());
  await frame.evaluate(() => {
    const services = window.__recentFontServices, input = services.getInputHandler();
    input.cursor.selectRange({ sectionIndex: 0, paragraphIndex: 0, charOffset: 0 }, { sectionIndex: 0, paragraphIndex: 0, charOffset: 7 });
    input.updateCaret(); input.focus(); services.eventBus.emit('command-state-changed');
  });
}
const history = () => page.evaluate(key => JSON.parse(localStorage.getItem(key) ?? 'null'), key);
const props = frame => frame.evaluate(() => window.__recentFontServices.wasm.getCharPropertiesAt(0, 0, 1));
async function command(frame, id) { const result = await frame.evaluate(id => window.jueonyEditor.executeCommand(id), id); assert.equal(result.ok, true, JSON.stringify(result)); }
async function menu(frame, category) {
  await frame.locator('#font-name').click(); await frame.waitForSelector('.font-picker-menu');
  if (category) await frame.locator(`.font-picker-category[data-category="${category}"]`).click();
  return frame.$$eval('.font-picker-option', elements => elements.map(el => el.textContent));
}
async function closeMenu(frame) { await frame.focus('#font-name'); await page.keyboard.press('Escape'); await frame.waitForSelector('.font-picker-menu', { hidden: true }); }
async function font(frame, name, category = 'all') {
  await select(frame); await menu(frame, category);
  await frame.evaluate(name => { const button = [...document.querySelectorAll('.font-picker-option')].find(element => element.textContent === name); if (!button) throw new Error(`Font missing: ${name}`); button.click(); }, name);
  await frame.waitForSelector('.font-picker-menu', { hidden: true });
}
async function settings(frame, show, count) {
  const result = await frame.evaluate(() => window.rhwpStudio.automation.execute('tool:options', undefined, { allowDialog: true }));
  assert.equal(result.ok, true); await frame.waitForSelector('#opt-show-recent');
  await frame.$eval('#opt-show-recent', (el, value) => { el.checked = value; }, show);
  await frame.$eval('.opt-count-input', (el, value) => { el.value = String(value); }, count);
  await frame.locator('.modal-overlay .dialog-btn-primary').click();
  await frame.waitForSelector('#opt-show-recent', { hidden: true });
}
try {
  for (let i = 0; i < 100; i++) { if (server.exitCode !== null) throw new Error('Test server exited'); if (await fetch(origin + '/api/health').then(r => r.ok, () => false)) break; await delay(100); }
  await launch();
  let frame = await open('hwpx');
  assert.equal(await history(), null); assert.deepEqual(await menu(frame, 'recent'), []); await closeMenu(frame);
  pass('recent fonts starts empty without writing history during startup or menu inspection');

  for (const ext of ['hwpx', 'hwp']) {
    stage = `${ext} font edit/save/reopen`;
    frame = await open(ext); const before = await props(frame);
    await font(frame, '함초롬돋움'); assert.equal((await props(frame)).fontFamily, '함초롬돋움'); assert.equal((await history()).names[0], '함초롬돋움');
    await command(frame, 'edit:undo'); assert.equal((await props(frame)).fontFamily, before.fontFamily);
    assert.equal((await history()).names[0], '함초롬돋움'); // history records use, not document state
    await command(frame, 'edit:redo'); assert.equal((await props(frame)).fontFamily, '함초롬돋움');
    const saved = await frame.evaluate(async () => { const api = window.jueonyEditor, result = await api.save(), file = await api.fileHandle().getFile(); return { result, bytes: [...new Uint8Array(await file.arrayBuffer())], dirty: api.state().dirty }; });
    assert.equal(saved.result, 'saved'); assert.equal(saved.dirty, false);
    await writeFile(join(out, `recent-fonts.${ext}`), new Uint8Array(saved.bytes));
    const reopened = new HwpDocument(new Uint8Array(saved.bytes)); try { assert.equal(parse(reopened.getCharPropertiesAt(0, 0, 1)).fontFamily, '함초롬돋움'); } finally { reopened.free(); }
    pass(`${ext}: actual font menu edit, undo/redo, safe save, and engine reopen retain font; undo retains usage history`);
  }

  stage = 'bounded MRU and recent menu apply';
  for (const name of ['바탕', '돋움', '궁서', '나눔고딕', '맑은 고딕']) await font(frame, name);
  assert.deepEqual((await history()).names, ['맑은 고딕', '나눔고딕', '궁서', '돋움', '바탕']);
  assert.deepEqual(await menu(frame, 'recent'), ['맑은 고딕', '나눔고딕', '궁서']); await closeMenu(frame);
  await font(frame, '궁서', 'recent'); assert.equal((await props(frame)).fontFamily, '궁서');
  assert.deepEqual((await history()).names, ['궁서', '맑은 고딕', '나눔고딕', '돋움', '바탕']);
  pass('recent category applies the real font, promotes reuse without duplicates, and bounds storage to five');

  stage = 'actual options count and visibility';
  const savedHistory = await history(); await settings(frame, true, 2);
  assert.deepEqual(await menu(frame, 'recent'), ['궁서', '맑은 고딕']); await closeMenu(frame);
  await settings(frame, false, 5); await menu(frame);
  assert.equal(await frame.$('.font-picker-category[data-category="recent"]'), null); await closeMenu(frame);
  assert.deepEqual(await history(), savedHistory); await settings(frame, true, 5);
  assert.deepEqual(await menu(frame, 'recent'), savedHistory.names);
  // Full-page capture resizes this canvas app and intentionally closes popups.
  await page.screenshot({ path: join(out, 'recent-font-menu.png') });
  await frame.waitForSelector('.font-picker-menu', { visible: true });
  await closeMenu(frame);
  pass('real environment dialog count/disable/enable controls recent menu without discarding history');

  stage = 'negative commands and history write failure';
  const beforeBlocked = await history(), beforeRevision = await frame.evaluate(() => window.jueonyEditor.revision());
  await frame.evaluate(() => {
    document.dispatchEvent(new CompositionEvent('compositionstart', { data: 'ㄱ', bubbles: true }));
    const element = document.getElementById('font-name'); element.value = '함초롬바탕'; element.dispatchEvent(new Event('change', { bubbles: true }));
    document.dispatchEvent(new CompositionEvent('compositionend', { data: '', bubbles: true }));
  });
  assert.deepEqual(await history(), beforeBlocked); assert.equal(await frame.evaluate(() => window.jueonyEditor.revision()), beforeRevision);
  await frame.evaluate(key => { window.__recentSetItem = Storage.prototype.setItem; Storage.prototype.setItem = function(name, value) { if (name === key) throw new DOMException('test quota', 'QuotaExceededError'); return window.__recentSetItem.call(this, name, value); }; }, key);
  await font(frame, '함초롬바탕'); assert.equal((await props(frame)).fontFamily, '함초롬바탕'); assert.deepEqual(await history(), beforeBlocked);
  await frame.evaluate(() => { Storage.prototype.setItem = window.__recentSetItem; delete window.__recentSetItem; });
  await font(frame, '함초롬돋움'); assert.equal((await history()).names[0], '함초롬돋움');
  pass('blocked IME command cannot add history; history quota failure leaves a successful document edit intact and retry works');

  stage = 'other open document and restart';
  await menu(frame, 'recent');
  const expected = ['바탕', ...(await history()).names.filter(name => name !== '바탕')].slice(0, 5);
  // The shell is a separate browsing context: exercise native StorageEvent propagation to an already-open menu.
  await page.evaluate((key, names) => localStorage.setItem(key, JSON.stringify({ version: 1, names })), key, expected);
  await frame.waitForFunction(expected => JSON.stringify([...document.querySelectorAll('.font-picker-option')].map(el => el.textContent)) === JSON.stringify(expected), {}, expected);
  await closeMenu(frame);
  const tabCount = await page.$$eval('.editor-frame', elements => elements.length);
  await page.click('#new-document'); await page.waitForFunction(count => document.querySelectorAll('.editor-frame').length === count + 1, {}, tabCount);
  frame = await active(); assert.deepEqual(await menu(frame, 'recent'), expected); await closeMenu(frame);
  await browser.close(); browser = undefined; await launch(); frame = await active();
  assert.deepEqual(await menu(frame, 'recent'), expected); await closeMenu(frame);
  pass('an open menu receives another context update; new documents and a fully restarted isolated browser restore the same recent fonts');

  stage = 'corrupt record protection';
  const future = '{"version":99,"names":["keep"],"sentinel":"preserve"}';
  await page.evaluate((key, value) => localStorage.setItem(key, value), key, future);
  frame = await open('hwpx'); await font(frame, '함초롬돋움'); assert.equal((await props(frame)).fontFamily, '함초롬돋움');
  assert.equal(await page.evaluate(key => localStorage.getItem(key), key), future);
  assert.deepEqual(await menu(frame, 'recent'), []); await closeMenu(frame);
  pass('a future history record is preserved while a successful font edit is accurately retained');

  await page.screenshot({ path: join(out, 'recent-fonts.png'), fullPage: true });
  assert.deepEqual(pageErrors, []); assert.deepEqual(externalRequests, []);
  await writeFile(join(out, 'result.json'), JSON.stringify({ pass: true, results, pageErrors, externalRequests, build: JSON.parse(await readFile(join(dist, 'build-evidence.json'), 'utf8')), limits: ['Only successful ordinary font selections through the formatting toolbar are recorded; named seven-language font sets are not recorded as a font', 'History is device-local and is not included in environment backup', 'Direct Hancom comparison deferred'] }, null, 2));
} catch (error) {
  console.error(error); process.exitCode = 1;
  await page?.screenshot({ path: join(out, 'failure.png'), fullPage: true }).catch(() => {});
  await writeFile(join(out, 'failure.json'), JSON.stringify({ stage, error: String(error.stack ?? error), results, pageErrors, externalRequests }, null, 2));
} finally { await browser?.close(); server.kill(); }
