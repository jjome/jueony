import puppeteer from 'puppeteer-core';
import { spawn } from 'node:child_process';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { deflateSync } from 'node:zlib';
import assert from 'node:assert/strict';
const app = resolve(dirname(fileURLToPath(import.meta.url)), '..'), repo = resolve(app, '../..');
if (!process.env.JUEONY_TEST_DIST || !process.env.JUEONY_ENGINE_PACKAGE) throw new Error('Set final test dist and engine package');
const pkg = resolve(repo, process.env.JUEONY_ENGINE_PACKAGE), dist = resolve(app, process.env.JUEONY_TEST_DIST), out = resolve(repo, process.env.JUEONY_TEST_OUTPUT ?? 'docs/evidence/selected-object-properties-2026-10-13/final-verified');
const port = 4217, origin = `http://127.0.0.1:${port}`, delay = ms => new Promise(r => setTimeout(r, ms)); await mkdir(out, { recursive: true });
const { default: init, HwpDocument } = await import(pathToFileURL(resolve(pkg, 'rhwp.js')).href); await init({ module_or_path: await readFile(resolve(pkg, 'rhwp_bg.wasm')) });
if (await fetch(origin + '/api/health').then(() => true, () => false)) throw new Error('Port 4217 already occupied');
const server = spawn(process.execPath, ['apps/launcher/server.mjs'], { cwd: repo, windowsHide: true, stdio: 'ignore', env: { ...process.env, JUEONY_PORT: String(port), JUEONY_DIST: dist, JUEONY_CONNECTION_STORE: 'memory' } });
const results = [], failures = [], pageErrors = [], consoleErrors = [], externalRequests = []; let page, browser;
const parse = value => typeof value === 'string' ? JSON.parse(value) : value;
function png() {
  const crc = data => { let n = 0xffffffff; for (const byte of data) { n ^= byte; for (let i = 0; i < 8; i++) n = (n >>> 1) ^ (n & 1 ? 0xedb88320 : 0); } return (n ^ 0xffffffff) >>> 0; };
  const chunk = (name, bytes) => { const body = Buffer.concat([Buffer.from(name), bytes]), size = Buffer.alloc(4), sum = Buffer.alloc(4); size.writeUInt32BE(bytes.length); sum.writeUInt32BE(crc(body)); return Buffer.concat([size, body, sum]); };
  const head = Buffer.alloc(13); head.writeUInt32BE(1, 0); head.writeUInt32BE(1, 4); head[8] = 8; head[9] = 2;
  return new Uint8Array(Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR', head), chunk('IDAT', deflateSync(Buffer.from([0,255,0,0]))), chunk('IEND', Buffer.alloc(0))]));
}
const active = async () => (await page.$('.editor-frame:not([hidden])')).contentFrame();
async function services() {
  const frame = await active(); await frame.evaluate(() => {
    if (window.__objectServices) return; const automation = window.rhwpStudio.automation;
    automation.registerCommand({ id: 'ext:object-test-inspect', label: '검수', canExecute: () => true, execute: s => { window.__objectServices = s; } }); const result = automation.execute('ext:object-test-inspect'); automation.unregisterCommand('ext:object-test-inspect'); if (!result.ok) throw new Error('Test extension unavailable');
  }); return frame;
}
async function fixture(type, ext) {
  const d = HwpDocument.createEmpty(); d.createBlankDocument(); d.insertText(0, 0, 0, '본문 유지'); d.splitParagraph(0, 0, 5); let result;
  if (type === 'table') { result = parse(d.createTable(0, 1, 0, 2, 2)); d.insertTextInCell(0, result.paraIdx, result.controlIdx, 0, 0, 0, '셀 유지'); }
  else if (type === 'image') result = parse(d.insertPicture(0, 1, 0, '[]', png(), 4000, 4000, 1, 1, 'png', '검수 그림', undefined, undefined));
  else if (type === 'equation') result = parse(d.insertEquation(0, 1, 0, 'x+y', 1000, 0));
  else {
    const shape = shapeType => parse(d.createShapeControl(JSON.stringify({ sectionIdx: 0, paraIdx: 1, charOffset: 0, shapeType, width: 4000, height: 3000, treatAsChar: false })));
    result = shape(type === 'textbox' ? 'textbox' : type === 'line' ? 'line' : 'rectangle');
    if (type === 'group') { shape('ellipse'); const objects = parse(d.getObjects()).filter(o => o.kind === 'shape'); result = parse(d.groupShapes(JSON.stringify({ sectionIdx: 0, targets: objects.map(o => ({ paraIdx: o.para, controlIdx: o.controlIndex })) }))); }
  }
  if (!result?.ok) throw new Error('Synthetic ' + type + ' creation failed'); const bytes = [...d[ext === 'hwp' ? 'exportHwp' : 'exportHwpx']()]; d.free();
  const target = { sec: 0, ppi: result.paraIdx, ci: result.controlIdx, type: type === 'textbox' ? 'shape' : type }, frame = await services();
  await frame.evaluate(async (bytes, ext, ref) => {
    const root = await navigator.storage.getDirectory(), handle = await root.getFileHandle(`selected-${ref.type}.${ext}`, { create: true }), writer = await handle.createWritable(); await writer.write(new Uint8Array(bytes)); await writer.close(); await window.jueonyEditor.open(new Uint8Array(bytes), `selected-${ref.type}.${ext}`, handle, false);
    const s = window.__objectServices, ih = s.getInputHandler(); ih.cursor.exitCellSelectionMode(); ih.cursor.exitTableObjectSelection(); ih.cursor.exitPictureObjectSelection(); ih.cursor.moveTo({ sectionIndex: 0, paragraphIndex: ref.ppi, charOffset: 0 });
    if (ref.type === 'table') ih.cursor.enterTableObjectSelectionDirect(ref.sec, ref.ppi, ref.ci); else ih.cursor.enterPictureObjectSelectionDirect(ref.sec, ref.ppi, ref.ci, ref.type); ih.updateCaret(); ih.focus(); s.eventBus.emit('command-state-changed');
  }, bytes, ext, target); return { frame, target };
}
async function properties(ref) { return (await active()).evaluate(ref => {
  const w = window.__objectServices.wasm, raw = w.borrowDocumentHandle(); let result;
  if (ref.type === 'table') result = raw.getTableProperties(ref.sec, ref.ppi, ref.ci);
  else if (ref.type === 'equation') result = raw.getEquationProperties(ref.sec, ref.ppi, ref.ci, -1, -1);
  else if (ref.type === 'image') result = raw.getPictureProperties(ref.sec, ref.ppi, ref.ci); else result = raw.getShapeProperties(ref.sec, ref.ppi, ref.ci);
  return typeof result === 'string' ? JSON.parse(result) : result;
}, ref); }
async function chord() { await page.keyboard.down('Control'); await page.keyboard.press('n'); await page.keyboard.up('Control'); await page.keyboard.press('k'); }
async function execute(id) { const result = await (await active()).evaluate(id => window.jueonyEditor.executeCommand(id), id); assert.equal(result.ok, true, JSON.stringify(result)); }
const snapshot = async () => (await active()).evaluate(() => window.jueonyEditor.snapshot());
async function scenario(name, run) {
  try { await run(); results.push(name); console.log('PASS', name); }
  catch (error) { failures.push({ name, error: String(error), stack: error.stack }); console.error('FAIL', name, error); await page.screenshot({ path: resolve(out, 'failure-' + failures.length + '.png') }).catch(() => {}); await (await active()).evaluate(() => document.querySelectorAll('.modal-overlay .dialog-close').forEach(b => b.click())).catch(() => {}); }
}
try {
  for (let i = 0; i < 100; i++) { if (await fetch(origin + '/api/health').then(r => r.ok, () => false)) break; await delay(100); }
  browser = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true, args: ['--no-first-run', '--disable-background-networking'], defaultViewport: { width: 1600, height: 1000 } }); page = await browser.newPage(); page.setDefaultTimeout(15000); page.on('pageerror', e => pageErrors.push(String(e))); page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); }); page.on('dialog', d => d.accept());
  await page.setRequestInterception(true); page.on('request', r => { if (!r.url().startsWith(origin) && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) { externalRequests.push(r.url()); void r.abort(); } else void r.continue(); }); await page.goto(origin); await page.waitForFunction(() => document.getElementById('app-status')?.textContent.includes('준비 완료'), { timeout: 90000 });
  for (const ext of ['hwp', 'hwpx']) for (const type of ['table', 'image', 'shape', 'line', 'textbox', 'group', 'equation']) await scenario(`${ext}: selected ${type} Ctrl+N,K opens native dialog, cancel preserves content and P applies/undo/redo/save`, async () => {
    const { frame, target } = await fixture(type, ext), original = await properties(target), before = await snapshot(), selector = type === 'table' ? '.tcp-dialog' : type === 'equation' ? '.eq-props-dialog' : '.pp-dialog';
    await chord(); await frame.waitForSelector(selector); await frame.click(selector + ' .dialog-close'); await frame.waitForSelector(selector, { hidden: true }); assert.equal((await snapshot()).revision, before.revision);
    await frame.evaluate(() => window.__objectServices.getInputHandler().focus()); await page.keyboard.press('p'); await frame.waitForSelector(selector);
    if (type === 'table') { await frame.click('.tcp-dialog .dialog-tab[data-tab=table]'); await frame.$eval('.tcp-dialog .dialog-tab-panel[data-tab=table] input[type=checkbox]', e => { if (!e.checked) e.click(); }); }
    else { const field = type === 'equation' ? '.eq-props-dialog input[type=number]' : '.pp-dialog .dialog-tab-panel input[type=number]'; await frame.$eval(field, e => { e.value = String(Number(e.value) + 2); e.dispatchEvent(new Event('input', { bubbles: true })); }); }
    await frame.click(selector + ' .dialog-btn-primary'); await frame.waitForSelector(selector, { hidden: true }); const changed = await properties(target);
    if (type === 'table') assert.equal(changed.repeatHeader, true); else if (type === 'equation') assert.notEqual(changed.fontSize, original.fontSize); else assert.notEqual(changed.width, original.width);
    await execute('edit:undo'); assert.deepEqual(await properties(target), original); await execute('edit:redo'); assert.deepEqual(await properties(target), changed);
    const saved = await frame.evaluate(async () => { const result = await window.jueonyEditor.save(); const f = await window.jueonyEditor.fileHandle().getFile(); return { result, bytes: [...new Uint8Array(await f.arrayBuffer())] }; }); assert.equal(saved.result, 'saved'); await writeFile(resolve(out, `${type}-changed.${ext}`), new Uint8Array(saved.bytes));
    const d = new HwpDocument(new Uint8Array(saved.bytes)); try { const again = parse(type === 'table' ? d.getTableProperties(target.sec, target.ppi, target.ci) : type === 'equation' ? d.getEquationProperties(target.sec, target.ppi, target.ci, -1, -1) : type === 'image' ? d.getPictureProperties(target.sec, target.ppi, target.ci) : d.getShapeProperties(target.sec, target.ppi, target.ci)); assert.equal(again[type === 'table' ? 'repeatHeader' : type === 'equation' ? 'fontSize' : 'width'], changed[type === 'table' ? 'repeatHeader' : type === 'equation' ? 'fontSize' : 'width']); assert.equal(d.getTextFileUnicode().includes('본문 유지'), true); }
    finally { d.free(); }
  });
  for (const type of ['table', 'image']) await scenario(`stale ${type} dialog refuses confirm after another document mutation`, async () => {
    const { frame, target } = await fixture(type, 'hwpx'), selector = type === 'table' ? '.tcp-dialog' : '.pp-dialog', original = await properties(target); await chord(); await frame.waitForSelector(selector);
    await frame.evaluate(() => { const ih = window.__objectServices.getInputHandler(); ih.executeOperation({ kind: 'snapshot', operationType: 'test-object-concurrent', operation: wasm => { wasm.insertText(0, 0, 0, '후속 편집'); return { sectionIndex: 0, paragraphIndex: 0, charOffset: 0 }; } }); });
    const changed = await snapshot(); await frame.click(selector + ' .dialog-btn-primary'); assert.match(await frame.$eval('[data-jueony-object-properties-error]', e => e.textContent), /문서나 선택 개체가 바뀌/); assert.equal((await snapshot()).revision, changed.revision); assert.deepEqual(await properties(target), original); await frame.click(selector + ' .dialog-close');
  });
  if (pageErrors.length) failures.push({ name: 'page errors', pageErrors }); if (consoleErrors.length) failures.push({ name: 'console errors', consoleErrors }); if (externalRequests.length) failures.push({ name: 'offline boundary', externalRequests }); await page.screenshot({ path: resolve(out, 'selected-objects.png') });
  await writeFile(resolve(out, 'result.json'), JSON.stringify({ results, failures, pageErrors, consoleErrors, externalRequests, build: await page.evaluate(() => fetch('/build-evidence.json').then(r => r.json())), reference: 'https://help.hancom.com/hoffice130/ko-KR/Hwp/edit/modification.htm', limitation: 'Selected-object dispatch only. Hancom cursor-backward search across arbitrary controls is not implemented; unsupported dialog tabs retain their existing engine/UI limitations. No native Hancom comparison.' }, null, 2)); if (failures.length) process.exitCode = 1;
} catch (error) { console.error(error); process.exitCode = 1; await writeFile(resolve(out, 'fatal.json'), JSON.stringify({ error: String(error), stack: error.stack, results, failures, pageErrors, consoleErrors }, null, 2)); }
finally { await browser?.close(); server.kill(); }
