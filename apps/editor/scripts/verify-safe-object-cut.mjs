import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, mkdtemp } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
import puppeteer from 'puppeteer-core';
import { loadReviewEngine, hash } from './lib/hancom-review.mjs';
const repo = resolve(import.meta.dirname, '../../..'), port = Number(process.env.JUEONY_TEST_PORT ?? 4507), origin = `http://127.0.0.1:${port}`;
const out = resolve(process.env.JUEONY_TEST_OUTPUT ?? resolve(repo, 'build/safe-object-cut-evidence'));
assert.ok(process.env.JUEONY_TEST_DIST && process.env.JUEONY_ENGINE_PACKAGE); await mkdir(out, { recursive: true });
const engine = await loadReviewEngine(process.env.JUEONY_ENGINE_PACKAGE), { HwpDocument } = engine;
const png = new Uint8Array(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==', 'base64'));
const parse = x => typeof x === 'string' ? JSON.parse(x) : x;
const fresh = () => { const d = HwpDocument.createEmpty(); d.createBlankDocument(); return d; };
function fixture(kind) {
  const d = fresh(); let target;
  if (kind === 'table') { target = parse(d.createTable(0, 0, 0, 1, 2)); d.insertTextInCell(0, target.paraIdx, target.controlIdx, 0, 0, 0, 'CUTSOURCE'); }
  else if (kind === 'image') target = parse(d.insertPicture(0, 0, 0, '[]', png, 3000, 3000, 1, 1, 'png', 'CUTSOURCE'));
  else target = parse(d.createShapeControl(JSON.stringify({ sectionIdx: 0, paraIdx: 0, charOffset: 0, width: 4000, height: 3000, treatAsChar: true, shapeType: 'rectangle' })));
  assert.equal(target.ok, true); return { d, target, kind };
}
const results = [], failures = [], pageErrors = [], external = [], alerts = [];
let browser, page, server;
const frame = async () => (await page.$('.editor-frame:not([hidden])')).contentFrame();
async function services() {
  const f = await frame(); await f.evaluate(() => { if (window.__cutServices) return; const a = window.rhwpStudio.automation; a.registerCommand({ id: 'ext:cut-test', label: '잘라내기 검수', canExecute: () => true, execute: s => { window.__cutServices = s; } }); const r = a.execute('ext:cut-test'); a.unregisterCommand('ext:cut-test'); if (!r.ok) throw new Error('No service access'); }); return f;
}
async function open(kind = 'table', ext = 'hwpx') {
  const { d, target } = fixture(kind), bytes = [...d[ext === 'hwp' ? 'exportHwp' : 'exportHwpx']()]; d.free(); const f = await services();
  await f.evaluate(async (bytes, ext, target, kind) => {
    const root = await navigator.storage.getDirectory(), handle = await root.getFileHandle('safe-cut.' + ext, { create: true }), writer = await handle.createWritable(); await writer.write(new Uint8Array(bytes)); await writer.close();
    await window.jueonyEditor.open(new Uint8Array(bytes), 'safe-cut.' + ext, handle, false);
    const ih = window.__cutServices.getInputHandler(); ih.cursor.clearSelection(); ih.cursor.moveTo({ sectionIndex: 0, paragraphIndex: target.paraIdx, charOffset: 0 });
    if (kind === 'table') ih.cursor.enterTableObjectSelectionDirect(0, target.paraIdx, target.controlIdx);
    else ih.cursor.enterPictureObjectSelectionDirect(0, target.paraIdx, target.controlIdx, kind === 'image' ? 'image' : 'shape');
    ih.focus();
    if (!window.__originalClipboardWrite) window.__originalClipboardWrite = navigator.clipboard.write.bind(navigator.clipboard);
    window.__cutWrites = []; window.__cutMode = 'success'; window.__cutWaitResolve = null;
    Object.defineProperty(navigator.clipboard, 'write', { configurable: true, value: async items => {
      const record = { types: items[0].types, html: await (await items[0].getType('text/html')).text() }; window.__cutWrites.push(record);
      if (window.__cutMode === 'deny') throw new DOMException('Synthetic clipboard denial', 'NotAllowedError');
      if (window.__cutMode === 'wait') await new Promise(resolve => { window.__cutWaitResolve = resolve; });
    } });
  }, bytes, ext, target, kind); return f;
}
const capture = f => f.evaluate(() => { const s = window.__cutServices, c = s.getInputHandler().cursor; return { bytes: [...s.wasm.exportHwp()], revision: window.jueonyEditor.revision(), undo: s.getInputHandler().history.peekUndoTop()?.type ?? null, picture: c.getSelectedPictureRefs(), table: c.getSelectedTableRef() }; });
const controls = f => f.evaluate(() => window.__cutServices.wasm.getControls().length);
const cut = f => f.evaluate(() => window.__cutServices.getInputHandler().performObjectCutSafely());
const command = async (f, id) => { const r = await f.evaluate(id => window.jueonyEditor.executeCommand(id), id); assert.equal(r.ok, true, JSON.stringify(r)); };
async function pending(f) {
  await f.evaluate(() => { window.__cutMode = 'wait'; window.__cutPendingOutcome = undefined; window.__cutPromise = window.__cutServices.getInputHandler().performObjectCutSafely().then(result => { window.__cutPendingOutcome = result; return result; }); });
  await f.waitForFunction(() => !!window.__cutWaitResolve || typeof window.__cutPendingOutcome === 'boolean');
  assert.equal(await f.evaluate(() => typeof window.__cutWaitResolve), 'function', 'cut refused before reaching clipboard acknowledgement');
}
const settle = f => f.evaluate(async () => { window.__cutWaitResolve(); return window.__cutPromise; });
async function save(f, name) {
  const bytes = await f.evaluate(async () => { const api = window.jueonyEditor; if (await api.save() !== 'saved') throw new Error('Safe save failed'); if (api.state().dirty) throw new Error('Still dirty'); return [...new Uint8Array(await (await api.fileHandle().getFile()).arrayBuffer())]; });
  await writeFile(resolve(out, name), new Uint8Array(bytes)); return new HwpDocument(new Uint8Array(await readFile(resolve(out, name))));
}
async function scenario(name, action) { const start = performance.now(); try { await action(); results.push({ name, status: 'PASS', milliseconds: Math.round(performance.now() - start) }); console.log('PASS', name); } catch (error) { failures.push({ name, error: String(error), stack: error.stack }); console.log('FAIL', name, String(error)); await page.screenshot({ path: resolve(out, `failure-${failures.length}.png`) }).catch(() => {}); } }
try {
  if (await fetch(origin + '/api/health').then(() => true, () => false)) throw new Error('Test port occupied');
  server = spawn(process.execPath, ['apps/launcher/server.mjs'], { cwd: repo, windowsHide: true, stdio: 'ignore', env: { ...process.env, JUEONY_PORT: String(port), JUEONY_DIST: resolve(process.env.JUEONY_TEST_DIST), JUEONY_CONNECTION_STORE: 'memory' } });
  for (let i = 0; i < 100; i++) { if (await fetch(origin + '/api/health').then(r => r.ok, () => false)) break; await new Promise(r => setTimeout(r, 100)); }
  browser = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', userDataDir: await mkdtemp(resolve(repo, 'build/safe-object-cut-browser-')), headless: true, args: ['--no-first-run', '--disable-background-networking'], defaultViewport: { width: 1600, height: 1000 } });
  page = await browser.newPage(); page.setDefaultTimeout(15000); page.on('pageerror', error => pageErrors.push(String(error))); page.on('dialog', d => { alerts.push(d.message()); void d.accept(); });
  await page.setRequestInterception(true); page.on('request', request => { if (![origin, 'blob:', 'data:'].some(prefix => request.url().startsWith(prefix))) { external.push(request.url()); void request.abort(); } else void request.continue(); });
  await page.goto(origin); await page.waitForFunction(() => document.getElementById('app-status')?.textContent.includes('준비 완료'), { timeout: 90000 });
  for (const kind of ['table', 'image', 'shape']) {
    await scenario(`${kind}: clipboard denial preserves original bytes, selection, history and revision`, async () => { const f = await open(kind), before = await capture(f); await f.evaluate(() => { window.__cutMode = 'deny'; }); assert.equal(await cut(f), false); assert.deepEqual(await capture(f), before); assert.equal(await f.evaluate(() => window.__cutWrites.length), 1); });
    for (const ext of ['hwp', 'hwpx']) await scenario(`${kind}/${ext}: acknowledged cut has one undo/redo and safe disk reopen`, async () => {
      const f = await open(kind, ext), before = await capture(f), count = await controls(f); assert.equal(await cut(f), true); assert.ok(await controls(f) < count);
      const writes = await f.evaluate(() => window.__cutWrites); assert.equal(writes.length, 1); assert.ok(writes[0].types.includes('text/html')); if (kind === 'image') assert.ok(writes[0].types.includes('image/png')); if (kind === 'table') assert.match(writes[0].html, /CUTSOURCE/);
      await command(f, 'edit:undo'); assert.deepEqual((await capture(f)).bytes, before.bytes); await command(f, 'edit:redo'); assert.ok(await controls(f) < count);
      const reopened = await save(f, `${kind}-cut.${ext}`); try { assert.ok(parse(reopened.getControls()).length < count); } finally { reopened.free(); }
    });
  }
  await scenario('pending rich clipboard does not remove table before acknowledgement', async () => { const f = await open(), before = await capture(f); await pending(f); assert.deepEqual(await capture(f), before); assert.equal(await settle(f), true); assert.notDeepEqual((await capture(f)).bytes, before.bytes); });
  await scenario('selection change while copying cancels deletion after acknowledgement', async () => { const f = await open(); await pending(f); await f.evaluate(() => window.__cutServices.getInputHandler().cursor.exitTableObjectSelection()); const before = await capture(f); assert.equal(await settle(f), false); assert.deepEqual(await capture(f), before); });
  await scenario('document edit while copying cancels deletion and preserves the new edit', async () => { const f = await open(); await pending(f); await f.evaluate(() => { const ih = window.__cutServices.getInputHandler(); ih.executeOperation({ kind: 'snapshot', operationType: 'cut-test-change', operation: wasm => { wasm.insertText(0, 0, 0, 'new text'); return { sectionIndex: 0, paragraphIndex: 0, charOffset: 8 }; } }); }); const before = await capture(f); assert.equal(await settle(f), false); assert.deepEqual(await capture(f), before); });
  await scenario('swapped document cannot receive the pending old-document cut', async () => { const f = await open(); await pending(f); const d = fresh(); d.insertText(0, 0, 0, 'SECOND'); const bytes = [...d.exportHwpx()]; d.free(); await f.evaluate(async bytes => { await window.jueonyEditor.open(new Uint8Array(bytes), 'second.hwpx', null, false); }, bytes); const before = await capture(f); assert.equal(await settle(f), false); assert.deepEqual(await capture(f), before); });
  await scenario('rapid repeated cut produces only one clipboard write and one history entry', async () => { const f = await open(); await pending(f); assert.equal(await cut(f), false); assert.equal(await f.evaluate(() => window.__cutWrites.length), 1); assert.equal(await settle(f), true); await command(f, 'edit:undo'); assert.match(await f.evaluate(() => window.__cutServices.wasm.exportControlHtml(0, 0, 2)), /CUTSOURCE/); });
  await scenario('native cut event also waits and preserves the object on clipboard failure', async () => { const f = await open('image'), before = await capture(f); await f.evaluate(() => { window.__cutMode = 'deny'; window.__cutServices.getInputHandler().onCut(new ClipboardEvent('cut', { cancelable: true })); }); await f.waitForFunction(() => window.__cutWrites.length === 1); await new Promise(r => setTimeout(r, 50)); assert.deepEqual(await capture(f), before); });
  await scenario('engine rejection after deletion rolls snapshot back without losing source', async () => { const f = await open(), before = await capture(f); const outcome = await f.evaluate(async () => { const wasm = window.__cutServices.wasm, original = wasm.deleteTableControl; wasm.deleteTableControl = (...args) => { original.apply(wasm, args); return { ok: false }; }; try { return await window.__cutServices.getInputHandler().performObjectCutSafely(); } finally { wasm.deleteTableControl = original; } }); assert.equal(outcome, false); assert.deepEqual(await capture(f), before); });
  await scenario('another copy before acknowledgement invalidates the internal clipboard token', async () => { const f = await open(); await pending(f); await f.evaluate(() => { window.__cutMode = 'success'; window.__cutServices.getInputHandler().performCopy(); }); await f.waitForFunction(() => window.__cutWrites.length === 2); const before = await capture(f); assert.equal(await settle(f), false); assert.deepEqual(await capture(f), before); });
  assert.deepEqual(pageErrors, []); assert.deepEqual(external, []);
} finally {
  await browser?.close(); server?.kill();
  await writeFile(resolve(out, 'result.json'), JSON.stringify({ engine: engine.metadata, verifierSha256: hash(await readFile(import.meta.filename)), results, failures, pageErrors, externalRequests: external, alerts, scope: 'Synthetic HWP/HWPX; actual compiled Rust engine, generated Studio clipboard encoding/selection/snapshot/history/safe save and disk reopen. Only OS clipboard acknowledgement is deterministic stubbed success/denial/pending; user system clipboard untouched. Native Hancom comparison deferred.' }, null, 2));
}
assert.deepEqual(failures, []); console.log('PASS', results.length, 'object cut browser/engine scenarios');
