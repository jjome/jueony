import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, mkdtemp } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
import puppeteer from 'puppeteer-core';
import { loadReviewEngine, hash } from './lib/hancom-review.mjs';
import { verifyPreservedExport } from '../src/adapters/rhwp/preservation.ts';
import { readFindHits, replaceFindHit } from '../src/editor-actions/basic-find.ts';
const repo = resolve(import.meta.dirname, '../../..'), app = resolve(repo, 'apps/editor');
const port = Number(process.env.JUEONY_TEST_PORT ?? 4507), origin = `http://127.0.0.1:${port}`;
const out = resolve(process.env.JUEONY_TEST_OUTPUT ?? resolve(repo, 'build/basic-find-evidence'));
assert.ok(process.env.JUEONY_TEST_DIST && process.env.JUEONY_ENGINE_PACKAGE); await mkdir(out, { recursive: true });
const engine = await loadReviewEngine(process.env.JUEONY_ENGINE_PACKAGE), { HwpDocument } = engine;
const fresh = () => { const d = HwpDocument.createEmpty(); d.createBlankDocument(); return d; };
const parse = x => typeof x === 'string' ? JSON.parse(x) : x;
function fixture(kind) {
  const d = fresh();
  if (kind === 'body') d.insertText(0, 0, 0, '같은😀같은😀');
  if (kind === 'overlap') d.insertText(0, 0, 0, 'banana');
  if (kind === 'cells') { const t = parse(d.createTable(0, 0, 0, 1, 2)); for (let c = 0; c < 2; c++) d.insertTextInCell(0, t.paraIdx, t.controlIdx, c, 0, 0, '같은😀'); }
  if (kind === 'nested') d.pasteHtml(0, 0, 0, '<table><tr><td>outer<table><tr><td>같은😀 A</td><td>같은😀 B</td></tr></table></td></tr></table>');
  return d;
}
const results = [], failures = [], pageErrors = [], external = [];
let browser, page, server;
const frame = async () => (await page.$('.editor-frame:not([hidden])')).contentFrame();
async function services() { const f = await frame(); await f.evaluate(() => { if (window.__findServices) return; const a = window.rhwpStudio.automation; a.registerCommand({ id: 'ext:basic-find-test', label: '찾기 검수', canExecute: () => true, execute: s => { window.__findServices = s; } }); const r = a.execute('ext:basic-find-test'); a.unregisterCommand('ext:basic-find-test'); if (!r.ok) throw new Error('No service access'); }); return f; }
async function open(d, ext = 'hwpx') {
  const bytes = [...d[ext === 'hwp' ? 'exportHwp' : 'exportHwpx']()]; d.free(); const f = await services();
  await f.evaluate(async (bytes, ext) => { document.querySelector('.find-dialog .dialog-close')?.click(); const root = await navigator.storage.getDirectory(), h = await root.getFileHandle('basic-find.' + ext, { create: true }), w = await h.createWritable(); await w.write(new Uint8Array(bytes)); await w.close(); await window.jueonyEditor.open(new Uint8Array(bytes), 'basic-find.' + ext, h, false); const ih = window.__findServices.getInputHandler(); ih.cursor.clearSelection(); ih.cursor.moveTo({ sectionIndex: 0, paragraphIndex: 0, charOffset: 0 }); ih.focus(); }, bytes, ext); return f;
}
async function command(f, id) { const r = await f.evaluate(id => window.jueonyEditor.executeCommand(id), id); assert.equal(r.ok, true, JSON.stringify(r)); }
async function dialog(f, query, replacement = '') { await command(f, 'edit:find-replace'); await f.$eval('.find-dialog', (e, q, r) => { const inputs = e.querySelectorAll('input[type=text]'); inputs[0].value = q; inputs[0].dispatchEvent(new Event('input')); inputs[1].value = r; inputs[1].dispatchEvent(new Event('input')); }, query, replacement); }
async function click(f, text) { await f.evaluate(text => { const b = [...document.querySelectorAll('.find-dialog button')].find(b => b.textContent === text); if (!b) throw new Error('Missing find button ' + text); b.click(); }, text); }
const selection = f => f.evaluate(() => window.__findServices.getInputHandler().cursor.getSelectionOrdered());
const text = f => f.evaluate(() => window.__findServices.wasm.getTextRange(0, 0, 0, window.__findServices.wasm.getParagraphLength(0, 0)));
const hits = (f, q) => f.evaluate(q => window.__findServices.wasm.searchAllText(q, true, true), q);
async function save(f, name) {
  const data = await f.evaluate(async () => { const api = window.jueonyEditor, r = await api.save(); if (r !== 'saved') throw new Error('save: ' + r); const file = await api.fileHandle().getFile(); return { bytes: [...new Uint8Array(await file.arrayBuffer())], dirty: api.state().dirty }; });
  assert.equal(data.dirty, false); await writeFile(resolve(out, name), new Uint8Array(data.bytes)); return new HwpDocument(new Uint8Array(await readFile(resolve(out, name))));
}
async function scenario(name, action) { const start = performance.now(); try { await action(); results.push({ name, status: 'PASS', milliseconds: Math.round(performance.now() - start) }); console.log('PASS', name); } catch (e) { failures.push({ name, error: String(e), stack: e.stack }); console.log('FAIL', name, String(e)); await page.screenshot({ path: resolve(out, 'failure-' + failures.length + '.png') }).catch(() => {}); } }
try {
  if (await fetch(origin + '/api/health').then(() => true, () => false)) throw new Error('Test port occupied');
  server = spawn(process.execPath, ['apps/launcher/server.mjs'], { cwd: repo, windowsHide: true, stdio: 'ignore', env: { ...process.env, JUEONY_PORT: String(port), JUEONY_DIST: resolve(process.env.JUEONY_TEST_DIST), JUEONY_CONNECTION_STORE: 'memory' } });
  for (let i = 0; i < 100; i++) { if (await fetch(origin + '/api/health').then(r => r.ok, () => false)) break; await new Promise(r => setTimeout(r, 100)); }
  browser = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', userDataDir: await mkdtemp(resolve(repo, 'build/basic-find-browser-')), headless: true, args: ['--no-first-run', '--disable-background-networking'], defaultViewport: { width: 1600, height: 1000 } });
  page = await browser.newPage(); page.setDefaultTimeout(15000); page.on('pageerror', e => pageErrors.push(String(e))); page.on('dialog', d => d.accept());
  await page.setRequestInterception(true); page.on('request', r => { if (![origin, 'blob:', 'data:'].some(prefix => r.url().startsWith(prefix))) { external.push(r.url()); void r.abort(); } else void r.continue(); });
  await page.goto(origin); await page.waitForFunction(() => document.getElementById('app-status')?.textContent.includes('준비 완료'), { timeout: 90000 });
  for (const ext of ['hwp', 'hwpx']) for (const kind of ['body', 'cells', 'nested']) {
    await scenario(`${ext}/${kind}: every hit, reverse/wrap, one replacement, undo/redo and disk reopen`, async () => {
      const f = await open(fixture(kind), ext); await dialog(f, '같은', '새😀'); await click(f, '다음'); const first = await selection(f); assert.equal(first.start.charOffset, 0);
      await click(f, '다음'); const second = await selection(f); assert.notDeepEqual(second.start, first.start);
      await click(f, '이전'); assert.deepEqual(await selection(f), first);
      await click(f, '이전'); assert.deepEqual(await selection(f), second);
      await click(f, '바꾸기'); assert.equal((await hits(f, '새😀')).length, 1); assert.equal((await hits(f, '같은')).length, 1);
      await command(f, 'edit:undo'); assert.equal((await hits(f, '새😀')).length, 0); assert.equal((await hits(f, '같은')).length, 2);
      await command(f, 'edit:redo'); assert.equal((await hits(f, '새😀')).length, 1);
      const reopened = await save(f, `${kind}-replace.${ext}`); try { assert.equal(readFindHits(reopened, '새😀', true).length, 1); assert.equal(readFindHits(reopened, '같은', true).length, 1); } finally { reopened.free(); }
    });
    await scenario(`${ext}/${kind}: replace-all is one undo and saved counts are exact`, async () => {
      const f = await open(fixture(kind), ext); await dialog(f, '같은', '같은새😀'); await click(f, '모두 바꾸기'); assert.equal((await hits(f, '같은새😀')).length, 2);
      await command(f, 'edit:undo'); assert.equal((await hits(f, '같은새😀')).length, 0); assert.equal((await hits(f, '같은')).length, 2);
      await command(f, 'edit:redo'); assert.equal((await hits(f, '같은새😀')).length, 2); const reopened = await save(f, `${kind}-all.${ext}`); try { assert.equal(readFindHits(reopened, '같은새😀', true).length, 2); } finally { reopened.free(); }
    });
  }
  await scenario('native table stuck-result reproduction is fixed through closed-dialog find-again', async () => {
    const f = await open(fixture('cells')); await dialog(f, '같은'); await click(f, '다음'); const first = await selection(f); await f.click('.find-dialog .dialog-close'); await command(f, 'edit:find-again'); const second = await selection(f); assert.notDeepEqual(second.start, first.start); await command(f, 'edit:find-again'); assert.deepEqual(await selection(f), first);
  });
  await scenario('open modeless find dialog no longer intercepts Enter in the editor', async () => {
    const f = await open(fixture('body')); await dialog(f, '같은'); await f.evaluate(() => { const ih = window.__findServices.getInputHandler(); ih.cursor.clearSelection(); ih.cursor.moveTo({ sectionIndex: 0, paragraphIndex: 0, charOffset: 0 }); ih.focus(); }); await page.keyboard.press('Enter'); assert.equal(await f.evaluate(() => window.__findServices.wasm.getParagraphCount(0)), 2); assert.ok(await f.$('.find-dialog'));
  });
  await scenario('document swap closes modeless find and discards stale replacement target', async () => {
    const f = await open(fixture('body')); await dialog(f, '같은', '다른문서'); await click(f, '다음'); const d = fixture('overlap'), bytes = [...d.exportHwpx()]; d.free(); await f.evaluate(async bytes => { await window.jueonyEditor.open(new Uint8Array(bytes), 'next.hwpx', null, false); }, bytes); assert.equal(await f.$('.find-dialog'), null); assert.equal(await text(f), 'banana');
  });
  await scenario('protected earlier cell rolls back later-cell replacement and history exactly', async () => {
    const d = fixture('cells'), t = readFindHits(d, '같은', true)[0].cellContext; assert.ok(t); d.setCellProperties(0, t.parentPara, t.ctrlIdx, 0, JSON.stringify({ cellProtect: true })); const f = await open(d); await dialog(f, '같은', '보호실패');
    const capture = () => f.evaluate(() => ({ bytes: [...window.__findServices.wasm.exportHwp()], top: window.__findServices.getInputHandler().history.peekUndoTop()?.type ?? null, revision: window.jueonyEditor.revision() })); const before = await capture(); await click(f, '모두 바꾸기'); assert.match(await f.$eval('.find-dialog-status', e => e.textContent), /보호/); assert.deepEqual(await capture(), before); assert.equal((await hits(f, '같은')).length, 2);
  });
  await scenario('identical replace-all preserves revision and redo history', async () => {
    const f = await open(fixture('body')); await dialog(f, '같은', '바꿈'); await click(f, '모두 바꾸기'); await command(f, 'edit:undo'); const before = await f.evaluate(() => ({ revision: window.jueonyEditor.revision(), canRedo: window.__findServices.getContext().canRedo })); assert.equal(before.canRedo, true); await f.$eval('.find-dialog input[type=text]:nth-of-type(1)', e => { e.value = '같은'; }); await f.evaluate(() => { document.querySelectorAll('.find-dialog input[type=text]')[1].value = '같은'; }); await click(f, '모두 바꾸기'); assert.deepEqual(await f.evaluate(() => ({ revision: window.jueonyEditor.revision(), canRedo: window.__findServices.getContext().canRedo })), before); await command(f, 'edit:redo'); assert.equal((await hits(f, '바꿈')).length, 2);
  });
  await scenario('overlapping source matches are replaced once without deleting extra text', async () => {
    const f = await open(fixture('overlap')); await dialog(f, 'ana', 'X'); await click(f, '모두 바꾸기'); assert.equal(await text(f), 'bXna'); await command(f, 'edit:undo'); assert.equal(await text(f), 'banana');
  });
  await scenario('navigation pane displays and selects actual nested cell text', async () => {
    const f = await open(fixture('nested')); await command(f, 'ext:jueony-navigation-pane'); await f.type('#jueony-navigation-pane input[type=search]', '같은'); await f.click('#jueony-navigation-pane button[type=submit]'); await f.waitForFunction(() => document.querySelectorAll('.j-search-hit').length === 2); await f.click('.j-search-hit[data-hit-index="1"]'); const s = await selection(f); assert.equal(s.start.cellPath.length, 2); assert.match(await f.$eval('.j-search-hit[data-hit-index="1"] span', e => e.textContent), /같은😀 B/); await f.click('[aria-label="탐색 작업 창 닫기"]');
  });
  await scenario('replacement composition defers mutation until committed text is available', async () => {
    const f = await open(fixture('body')); await dialog(f, '같은', '조합'); await f.evaluate(() => document.querySelectorAll('.find-dialog input[type=text]')[1].dispatchEvent(new CompositionEvent('compositionstart'))); await click(f, '모두 바꾸기'); assert.equal((await hits(f, '같은')).length, 2); await f.evaluate(() => document.querySelectorAll('.find-dialog input[type=text]')[1].dispatchEvent(new CompositionEvent('compositionend'))); await click(f, '모두 바꾸기'); assert.equal((await hits(f, '조합')).length, 2);
  });
  await scenario('a document mutation invalidates a stale single-replacement target', async () => {
    const f = await open(fixture('body')); await dialog(f, '같은', '오래된수정'); await click(f, '다음');
    await f.evaluate(() => { const ih = window.__findServices.getInputHandler(); ih.executeOperation({ kind: 'snapshot', operationType: 'concurrent-find-test', operation: wasm => { wasm.insertText(0, 0, 0, '새접두사 '); return { sectionIndex: 0, paragraphIndex: 0, charOffset: 0 }; } }); });
    const before = await text(f); await click(f, '바꾸기'); assert.equal(await text(f), before); assert.equal((await hits(f, '오래된수정')).length, 0);
  });
  await scenario('find replacement rejects control characters and form mode without edits', async () => {
    const f = await open(fixture('body')); await dialog(f, '같은', '바꿈'); await f.evaluate(() => { document.querySelectorAll('.find-dialog input[type=text]')[1].value = '\u0001'; });
    const before = await text(f); await click(f, '모두 바꾸기'); assert.match(await f.$eval('.find-dialog-status', e => e.textContent), /제어 문자/); assert.equal(await text(f), before);
    await f.evaluate(() => { document.querySelectorAll('.find-dialog input[type=text]')[1].value = '바꿈'; window.__findServices.setEditMode('form'); });
    try { await click(f, '모두 바꾸기'); assert.match(await f.$eval('.find-dialog-status', e => e.textContent), /편집 상태/); assert.equal(await text(f), before); } finally { await f.evaluate(() => window.__findServices.setEditMode('normal')); }
  });
  await scenario('replacement preserves mixed suffix formatting after save and reopen', async () => {
    const d = fresh(); d.insertText(0, 0, 0, '같은뒤😀'); d.applyCharFormat(0, 0, 2, 4, JSON.stringify({ bold: true, italic: true })); const f = await open(d);
    await dialog(f, '같은', '긴새😀'); await click(f, '모두 바꾸기'); assert.equal(await text(f), '긴새😀뒤😀');
    const reopened = await save(f, 'mixed-format.hwpx'); try { const properties = parse(reopened.getCharPropertiesAt(0, 0, 3)); assert.equal(properties.bold, true); assert.equal(properties.italic, true); } finally { reopened.free(); }
  });
  // Direct serializer guard proves the final compiled engine still preserves both formats.
  await scenario('loaded nested replacement production preservation guard for both formats', async () => {
    const seed = fixture('nested'), d = new HwpDocument(seed.exportHwp()); seed.free();
    try { const h = readFindHits(d, '같은', true); replaceFindHit(d, h[1], '같은', true, '새😀'); for (const f of ['hwp', 'hwpx']) { const a = d[f === 'hwp' ? 'exportHwpWithReport' : 'exportHwpxWithReport'](); try { const bytes = a.takeBytes(); assert.equal(verifyPreservedExport(d, bytes, f, a.contentLoss(), bytes => new HwpDocument(bytes)).status, 'checked'); } finally { a.free(); } } } finally { d.free(); }
  });
  assert.deepEqual(pageErrors, []); assert.deepEqual(external, []);
} finally {
  await browser?.close(); server?.kill();
  await writeFile(resolve(out, 'result.json'), JSON.stringify({ engine: engine.metadata, verifierSha256: hash(await readFile(import.meta.filename)), results, failures, pageErrors, externalRequests: external, scope: 'Synthetic local HWP/HWPX documents; real compiled Rust182, actual generated Studio command/dialog/history/navigation, disk reopen. Native Hancom direct comparison deferred.' }, null, 2));
}
assert.deepEqual(failures, []); console.log('PASS', results.length, 'basic find browser/engine scenarios');
