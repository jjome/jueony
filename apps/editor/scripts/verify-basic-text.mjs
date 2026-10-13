import puppeteer from 'puppeteer-core';
import { spawn } from 'node:child_process';
import { readFile, writeFile, mkdir, mkdtemp } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

const app = resolve(dirname(fileURLToPath(import.meta.url)), '..'), repo = resolve(app, '../..');
if (!process.env.JUEONY_TEST_DIST || !process.env.JUEONY_ENGINE_PACKAGE) throw new Error('Set JUEONY_TEST_DIST and JUEONY_ENGINE_PACKAGE');
const port = 4218, origin = `http://127.0.0.1:${port}`, dist = resolve(app, process.env.JUEONY_TEST_DIST), pkg = resolve(repo, process.env.JUEONY_ENGINE_PACKAGE);
const out = resolve(repo, process.env.JUEONY_TEST_OUTPUT ?? 'docs/evidence/remaining-editor-2026-10-13'); await mkdir(out, { recursive: true });
const { default: init, HwpDocument } = await import(pathToFileURL(resolve(pkg, 'rhwp.js')).href); await init({ module_or_path: await readFile(resolve(pkg, 'rhwp_bg.wasm')) });
const { exportStylePackage } = await import('../src/adapters/rhwp/style-package-native.ts');
if (await fetch(origin + '/api/health').then(() => true, () => false)) throw new Error(`Test port ${port} already occupied`);
const server = spawn(process.execPath, ['apps/launcher/server.mjs'], { cwd: repo, windowsHide: true, stdio: 'ignore', env: { ...process.env, JUEONY_PORT: String(port), JUEONY_DIST: dist, JUEONY_CONNECTION_STORE: 'memory' } });
let page, browser;
const results = [], failures = [], pageErrors = [], externalRequests = [], delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const active = async () => (await page.$('.editor-frame:not([hidden])')).contentFrame();
async function services() {
  const frame = await active(); await frame.evaluate(() => {
    if (window.__textServices) return;
    const automation = window.rhwpStudio.automation; automation.registerCommand({ id: 'ext:text-test-inspect', label: '검수', canExecute: () => true, execute: services => { window.__textServices = services; } });
    const result = automation.execute('ext:text-test-inspect'); automation.unregisterCommand('ext:text-test-inspect'); if (!result.ok) throw new Error('Test service extension unavailable');
  }); return frame;
}
async function open(doc, ext) {
  const bytes = [...doc[ext === 'hwp' ? 'exportHwp' : 'exportHwpx']()]; doc.free();
  const frame = await services(); await frame.evaluate(async (bytes, ext) => {
    const root = await navigator.storage.getDirectory(), handle = await root.getFileHandle('basic-text.' + ext, { create: true }), writer = await handle.createWritable(); await writer.write(new Uint8Array(bytes)); await writer.close();
    await window.jueonyEditor.open(new Uint8Array(bytes), 'basic-text.' + ext, handle, false); const ih = window.__textServices.getInputHandler(); ih.cursor.moveTo({ sectionIndex: 0, paragraphIndex: 0, charOffset: 0 }); ih.focus();
  }, bytes, ext); return frame;
}
const fresh = () => { const doc = HwpDocument.createEmpty(); doc.createBlankDocument(); return doc; };
async function select(frame, paragraph, start, end) {
  await frame.evaluate((paragraph, start, end) => { const s = window.__textServices, ih = s.getInputHandler(); ih.cursor.exitCellSelectionMode(); ih.cursor.exitTableObjectSelection(); ih.cursor.selectRange({ sectionIndex: 0, paragraphIndex: paragraph, charOffset: start }, { sectionIndex: 0, paragraphIndex: paragraph, charOffset: end }); ih.updateCaret(); ih.focus(); s.eventBus.emit('command-state-changed'); }, paragraph, start, end);
}
const snapshot = frame => frame.evaluate(() => window.jueonyEditor.snapshot());
async function command(frame, id) { const result = await frame.evaluate(id => window.jueonyEditor.executeCommand(id), id); assert.equal(result.ok, true, JSON.stringify(result)); }
async function confirm(frame, selector) { await frame.click('.modal-overlay .dialog-btn-primary'); await frame.waitForSelector(selector, { hidden: true }); }
async function save(frame, name) {
  const saved = await frame.evaluate(async () => { const api = window.jueonyEditor, result = await api.save(), file = await api.fileHandle().getFile(); return { result, dirty: api.state().dirty, bytes: [...new Uint8Array(await file.arrayBuffer())] }; });
  assert.equal(saved.result, 'saved'); assert.equal(saved.dirty, false); await writeFile(resolve(out, name), new Uint8Array(saved.bytes)); return new HwpDocument(new Uint8Array(saved.bytes));
}
async function scenario(name, run) { try { await run(); results.push(name); console.log('PASS', name); } catch (error) { failures.push({ name, error: String(error), stack: error.stack }); console.error('FAIL', name, error); await page.screenshot({ path: resolve(out, 'failure-' + failures.length + '.png') }).catch(() => {}); await (await active()).evaluate(() => document.querySelectorAll('.modal-overlay .dialog-close').forEach(button => button.click())).catch(() => {}); } }
try {
  for (let i = 0; i < 100; i++) { if (await fetch(origin + '/api/health').then(r => r.ok, () => false)) break; await delay(100); }
  const profile = await mkdtemp(resolve(repo, 'build/basic-text-browser-'));
  browser = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', userDataDir: profile, headless: true, args: ['--no-first-run', '--disable-background-networking'], defaultViewport: { width: 1600, height: 1000 } });
  page = await browser.newPage(); page.setDefaultTimeout(15000); page.on('pageerror', error => pageErrors.push(String(error))); page.on('dialog', dialog => dialog.accept());
  await page.setRequestInterception(true); page.on('request', request => { if (![origin, 'data:', 'blob:'].some(prefix => request.url().startsWith(prefix))) { externalRequests.push(request.url()); void request.abort(); } else void request.continue(); });
  await page.goto(origin); await page.waitForFunction(() => document.getElementById('app-status')?.textContent.includes('준비 완료'), { timeout: 90000 });
  for (const ext of ['hwp', 'hwpx']) {
    await scenario(`${ext}: mixed-format case expansion through real dialog, undo/redo and save`, async () => {
      const doc = fresh(); doc.insertText(0, 0, 0, '앞aß😀b뒤'); doc.applyCharFormat(0, 0, 2, 3, JSON.stringify({ bold: true })); doc.applyCharFormat(0, 0, 5, 6, JSON.stringify({ italic: true })); const frame = await open(doc, ext); await select(frame, 0, 1, 5);
      await command(frame, 'edit:transform-text'); assert.equal(await frame.$eval('[data-jueony-text-transform] textarea', e => e.value), 'ASS😀B'); await confirm(frame, '[data-jueony-text-transform]');
      assert.equal((await snapshot(frame)).nodes[0].text, '앞ASS😀B뒤'); await command(frame, 'edit:undo'); assert.equal((await snapshot(frame)).nodes[0].text, '앞aß😀b뒤'); await command(frame, 'edit:redo'); assert.equal((await snapshot(frame)).nodes[0].text, '앞ASS😀B뒤');
      const native = await save(frame, 'case-expansion.' + ext); try { assert.equal(native.getTextRange(0, 0, 0, 7), '앞ASS😀B뒤'); assert.equal(JSON.parse(native.getCharPropertiesAt(0, 0, 3)).bold, true); assert.equal(JSON.parse(native.getCharPropertiesAt(0, 0, 6)).italic, true); } finally { native.free(); }
    });
    await scenario(`${ext}: plaintext multiline paste replaces selected text and preserves suffix formatting`, async () => {
      const doc = fresh(); doc.insertText(0, 0, 0, '앞바꿀뒤'); doc.applyCharFormat(0, 0, 3, 4, JSON.stringify({ italic: true })); const frame = await open(doc, ext); await select(frame, 0, 1, 3);
      await command(frame, 'edit:paste-special'); await frame.$eval('[data-jueony-plain-text] textarea', e => { e.value = '첫😀\n\n끝'; }); await confirm(frame, '[data-jueony-plain-text]'); assert.deepEqual((await snapshot(frame)).nodes.map(node => node.text), ['앞첫😀', '', '끝뒤']);
      await command(frame, 'edit:undo'); assert.deepEqual((await snapshot(frame)).nodes.map(node => node.text), ['앞바꿀뒤']); await command(frame, 'edit:redo'); const native = await save(frame, 'plain-text.' + ext); try { assert.equal(native.getTextRange(0, 2, 0, 2), '끝뒤'); assert.equal(JSON.parse(native.getCharPropertiesAt(0, 2, 1)).italic, true); } finally { native.free(); }
    });
    await scenario(`${ext}: Unicode space/hyphen commands and trusted shortcut, undo and save`, async () => {
      const frame = await open(fresh(), ext);
      await command(frame, 'insert:fixed-space'); await frame.evaluate(() => window.__textServices.getInputHandler().focus()); await page.keyboard.down('Control'); await page.keyboard.down('Alt'); await page.keyboard.press('Space'); await page.keyboard.up('Alt'); await page.keyboard.up('Control'); await command(frame, 'insert:soft-hyphen');
      assert.equal((await snapshot(frame)).nodes[0].text, '\u2007\u00a0\u00ad'); await command(frame, 'edit:undo'); assert.equal((await snapshot(frame)).nodes[0].text, '\u2007\u00a0'); await command(frame, 'edit:redo'); const native = await save(frame, 'special-characters.' + ext); try { assert.equal(native.getTextRange(0, 0, 0, 3), '\u2007\u00a0\u00ad'); } finally { native.free(); }
    });
    for (const seeds of [['2024-02-28', '2024-02-29', '2024-03-01', '2024-03-02'], ['😀 제001호', '😀 제003호', '😀 제005호', '😀 제007호']]) await scenario(`${ext}: ${seeds[0]} autofill preview, undo and native save`, async () => {
      const doc = fresh(), t = JSON.parse(doc.createTable(0, 0, 0, 1, 4)); [...seeds.slice(0, 2), '기존', '기존'].forEach((value, cell) => doc.insertTextInCell(0, t.paraIdx, t.controlIdx, cell, 0, 0, value)); const frame = await open(doc, ext);
      await frame.evaluate(t => { const s = window.__textServices, ih = s.getInputHandler(); ih.cursor.moveTo({ sectionIndex: 0, paragraphIndex: 0, parentParaIndex: t.paraIdx, controlIndex: t.controlIdx, cellIndex: 0, cellParaIndex: 0, charOffset: 0, cellPath: [{ controlIndex: t.controlIdx, cellIndex: 0, cellParaIndex: 0 }] }); ih.cursor.enterCellSelectionMode(); ih.cursor.advanceCellSelectionPhase(); ih.cursor.setCellSelectionFocus(0, 3); ih.updateCellSelection(); ih.focus(); s.eventBus.emit('command-state-changed'); }, t);
      await command(frame, 'table:auto-fill-integers'); assert.ok(await frame.$eval('[data-jueony-table-auto-fill]', e => e.textContent.includes('2개 변경'))); await confirm(frame, '[data-jueony-table-auto-fill]'); assert.deepEqual((await snapshot(frame)).structure.tables[0].cells.map(cell => cell.text), seeds);
      await command(frame, 'edit:undo'); assert.deepEqual((await snapshot(frame)).structure.tables[0].cells.map(cell => cell.text), [...seeds.slice(0, 2), '기존', '기존']); await command(frame, 'edit:redo'); const native = await save(frame, (seeds[0].includes('😀') ? 'numbered-fill.' : 'date-fill.') + ext); try { assert.equal(native.getTextInCell(0, t.paraIdx, t.controlIdx, 3, 0, 0, native.getCellParagraphLength(0, t.paraIdx, t.controlIdx, 3, 0)), seeds[3]); } finally { native.free(); }
    });
  }
  await scenario('cancel, identical transformation and stale dialog leave no new mutation', async () => {
    const doc = fresh(); doc.insertText(0, 0, 0, 'ABC'); const frame = await open(doc, 'hwpx'); await select(frame, 0, 0, 3); const before = await snapshot(frame);
    await command(frame, 'edit:transform-text'); await page.keyboard.press('Escape'); assert.equal((await snapshot(frame)).revision, before.revision); await command(frame, 'edit:transform-text'); await confirm(frame, '[data-jueony-text-transform]'); assert.equal((await snapshot(frame)).revision, before.revision);
    await command(frame, 'edit:paste-special'); await frame.$eval('[data-jueony-plain-text] textarea', e => { e.value = '오래된 입력'; }); await frame.evaluate(() => { const ih = window.__textServices.getInputHandler(); ih.executeOperation({ kind: 'snapshot', operationType: 'concurrent-test', operation: wasm => { wasm.insertText(0, 0, 0, '새'); return { sectionIndex: 0, paragraphIndex: 0, charOffset: 0 }; } }); }); const changed = await snapshot(frame);
    await frame.click('.modal-overlay .dialog-btn-primary'); assert.match(await frame.$eval('[data-jueony-plain-text] [role=alert]', e => e.textContent), /문서나 선택이 바뀌/); assert.equal((await snapshot(frame)).revision, changed.revision); await page.keyboard.press('Escape');
  });
  await scenario('failure after live replacement rolls back bytes and history without partial edit', async () => {
    const doc = fresh(); doc.insertText(0, 0, 0, 'abc'); const frame = await open(doc, 'hwpx'); await select(frame, 0, 0, 3); const before = await frame.evaluate(() => ({ bytes: [...window.__textServices.wasm.exportHwpx()], undo: window.__textServices.getInputHandler().history.peekUndoTop()?.type ?? null }));
    await command(frame, 'edit:transform-text'); await frame.evaluate(() => { window.__textServices.wasm.borrowDocumentHandle().setCharShapeRuns = () => { throw new Error('합성 서식 실패'); }; }); await frame.click('.modal-overlay .dialog-btn-primary'); assert.match(await frame.$eval('[data-jueony-text-transform] [role=alert]', e => e.textContent), /합성 서식 실패/);
    assert.deepEqual(await frame.evaluate(() => ({ bytes: [...window.__textServices.wasm.exportHwpx()], undo: window.__textServices.getInputHandler().history.peekUndoTop()?.type ?? null })), before); await page.keyboard.press('Escape');
  });
  for (const ext of ['hwp', 'hwpx']) await scenario(`${ext}: style file import through dialog keeps existing document, next-style links, undo and native save`, async () => {
    const source = fresh(), first = source.createStyle(JSON.stringify({ name: '업무 제목', englishName: 'WorkTitle', type: 0, nextStyleId: 0 })), next = source.createStyle(JSON.stringify({ name: '업무 본문', englishName: 'WorkBody', type: 0, nextStyleId: first })); source.updateStyle(first, JSON.stringify({ nextStyleId: next })); source.updateStyleShapes(first, JSON.stringify({ fontSize: 1600, bold: true }), JSON.stringify({ marginLeft: 600 })); const value = exportStylePackage(source, [first]); source.free();
    const target = fresh(); target.insertText(0, 0, 0, '기존 문서'); const frame = await open(target, ext), before = await frame.evaluate(() => window.__textServices.wasm.getStyleList());
    await command(frame, 'format:style-package'); await frame.$eval('[data-jueony-style-package] textarea', (element, text) => { element.value = text; element.dispatchEvent(new Event('input')); }, JSON.stringify(value)); assert.match(await frame.$eval('[data-jueony-style-package] [role=status]', element => element.textContent), /가져오기 준비: 2개/); await confirm(frame, '[data-jueony-style-package]');
    const imported = await frame.evaluate(() => window.__textServices.wasm.getStyleList()); assert.equal(imported.length, before.length + 2); assert.equal((await snapshot(frame)).nodes[0].text, '기존 문서');
    await command(frame, 'edit:undo'); assert.deepEqual(await frame.evaluate(() => window.__textServices.wasm.getStyleList()), before); await command(frame, 'edit:redo'); const native = await save(frame, 'style-import.' + ext); try { const styles = JSON.parse(native.getStyleList()); assert.equal(styles[before.length].nextStyleId, before.length + 1); assert.equal(styles[before.length + 1].nextStyleId, before.length); assert.equal(JSON.parse(native.getStyleDetail(before.length)).charProps.fontSize, 1600); } finally { native.free(); }
    await command(frame, 'format:style-package'); await frame.$eval('[data-jueony-style-package] textarea', (element, text) => { element.value = text; element.dispatchEvent(new Event('input')); }, JSON.stringify(value)); assert.match(await frame.$eval('[data-jueony-style-package] [role=status]', e => e.textContent), /가져옴/); await page.keyboard.press('Escape');
  });
  await scenario('environment file export/import restores settings after reload without document mutation', async () => {
    const frame = await open(fresh(), 'hwpx'), before = await snapshot(frame); await command(frame, 'tool:settings-backup');
    const exported = await frame.evaluate(async () => {
      const original = HTMLAnchorElement.prototype.click, createUrl = URL.createObjectURL;
      try { let captured; URL.createObjectURL = function(blob) { captured = blob; return createUrl.call(URL, blob); }; HTMLAnchorElement.prototype.click = function() {}; document.querySelector('[data-jueony-settings-backup] button').click(); if (!captured) throw new Error('No environment export'); return JSON.parse(await captured.text()); } finally { HTMLAnchorElement.prototype.click = original; URL.createObjectURL = createUrl; }
    }); assert.equal(exported.format, 'jueony-editor-preferences'); assert.equal(JSON.stringify(exported).includes('apiKey'), false);
    exported.settings.view.showControlCodes = true; exported.settings.autosave.idleDelaySeconds = 25; exported.documentDefaults.enabled = true; exported.documentDefaults.font.sizePt = 12;
    await frame.$eval('[data-jueony-settings-backup] textarea', (element, text) => { element.value = text; element.dispatchEvent(new Event('input')); }, JSON.stringify(exported)); assert.match(await frame.$eval('[data-jueony-settings-backup] [role=status]', e => e.textContent), /가져오기 준비/); await confirm(frame, '[data-jueony-settings-backup]');
    assert.equal((await snapshot(frame)).revision, before.revision); assert.equal(await frame.evaluate(() => JSON.parse(localStorage.getItem('rhwp-settings')).autosave.idleDelaySeconds), 25); assert.equal(await frame.evaluate(() => JSON.parse(localStorage.getItem('jueony-document-defaults')).font.sizePt), 12);
    await page.reload(); await page.waitForFunction(() => document.getElementById('app-status')?.textContent.includes('준비 완료'), { timeout: 90000 }); const restored = await services(); assert.equal(await restored.evaluate(() => JSON.parse(localStorage.getItem('rhwp-settings')).view.showControlCodes), true);
    await command(restored, 'tool:settings-backup'); await restored.$eval('[data-jueony-settings-backup] textarea', (element, text) => { element.value = text; }, JSON.stringify(exported)); await restored.evaluate(() => { const v = JSON.parse(localStorage.getItem('rhwp-settings')); v.view.showControlCodes = false; localStorage.setItem('rhwp-settings', JSON.stringify(v)); });
    await restored.click('.modal-overlay .dialog-btn-primary'); assert.match(await restored.$eval('[data-jueony-settings-backup] [role=status]', e => e.textContent), /다른 창에서 환경 설정이 바뀌/); await page.keyboard.press('Escape');
  });
  await scenario('Shift+F10 keyboard menu preserves body selection, skips disabled items, invokes dialog and restores focus', async () => {
    const doc = fresh(); doc.insertText(0, 0, 0, '선택 유지'); const frame = await open(doc, 'hwpx'); await select(frame, 0, 0, 2); const before = await frame.evaluate(() => ({ selection: window.__textServices.getInputHandler().cursor.getSelection(), revision: window.jueonyEditor.revision() }));
    await page.keyboard.down('Shift'); await page.keyboard.press('F10'); await page.keyboard.up('Shift'); await frame.waitForSelector('.context-menu[role=menu]'); assert.equal(await frame.evaluate(() => document.activeElement.getAttribute('role')), 'menuitem');
    await page.keyboard.press('End'); assert.equal(await frame.evaluate(() => document.activeElement.dataset.cmd), await frame.$eval('.context-menu', e => [...e.querySelectorAll('[role=menuitem]:not(.disabled)')].at(-1).dataset.cmd)); await page.keyboard.press('Home');
    const index = await frame.$eval('.context-menu', e => [...e.querySelectorAll('[role=menuitem]:not(.disabled)')].findIndex(e => e.dataset.cmd === 'format:char-shape')); assert.ok(index >= 0); for (let i = 0; i < index; i++) await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter'); await frame.waitForSelector('.modal-overlay'); assert.equal(await frame.$('.context-menu'), null); await page.keyboard.press('Escape'); await frame.waitForSelector('.modal-overlay', { hidden: true });
    assert.deepEqual(await frame.evaluate(() => ({ selection: window.__textServices.getInputHandler().cursor.getSelection(), revision: window.jueonyEditor.revision() })), before);
    await page.keyboard.down('Shift'); await page.keyboard.press('F10'); await page.keyboard.up('Shift'); await frame.waitForSelector('.context-menu'); await page.keyboard.press('Escape'); await frame.waitForSelector('.context-menu', { hidden: true }); assert.equal(await frame.evaluate(() => document.activeElement === window.__textServices.getInputHandler().textarea), true);
  });
  await scenario('keyboard menu uses selected table context without moving cursor or changing document', async () => {
    const doc = fresh(), t = JSON.parse(doc.createTable(0, 0, 0, 2, 2)), frame = await open(doc, 'hwpx'); await frame.evaluate(t => { const s = window.__textServices, ih = s.getInputHandler(); ih.cursor.enterTableObjectSelectionDirect(0, t.paraIdx, t.controlIdx); ih.updateCaret(); ih.focus(); s.eventBus.emit('table-object-selection-changed', true); s.eventBus.emit('command-state-changed'); }, t); const before = await frame.evaluate(() => ({ ref: window.__textServices.getInputHandler().getSelectedTableRef(), revision: window.jueonyEditor.revision() }));
    await page.keyboard.down('Shift'); await page.keyboard.press('F10'); await page.keyboard.up('Shift'); await frame.waitForSelector('.context-menu'); assert.ok(await frame.$('.context-menu [data-cmd="table:delete"]')); await page.keyboard.press('Escape'); assert.deepEqual(await frame.evaluate(() => ({ ref: window.__textServices.getInputHandler().getSelectedTableRef(), revision: window.jueonyEditor.revision() })), before);
  });
  for (const ext of ['hwp', 'hwpx']) for (const id of ['official-letter', 'work-plan', 'meeting-result', 'work-report']) await scenario(`${ext}: ${id} work template previews, applies to empty document, undoes and saves`, async () => {
    const frame = await open(fresh(), ext); await command(frame, 'file:work-template'); await frame.select('[data-jueony-work-template] select', id); const preview = await frame.$eval('[data-jueony-work-template] textarea', element => element.value); assert.ok(preview.includes('[')); await confirm(frame, '[data-jueony-work-template]'); const after = await snapshot(frame); assert.ok(after.nodes.length > 1); const title = after.nodes[0].text;
    if (id === 'work-plan' || id === 'meeting-result') assert.equal(after.structure.tables.length, 1); await command(frame, 'edit:undo'); assert.deepEqual((await snapshot(frame)).nodes.map(node => node.text), ['']); await command(frame, 'edit:redo'); assert.equal((await snapshot(frame)).nodes[0].text, title);
    const native = await save(frame, 'template-' + id + '.' + ext); try { assert.equal(native.getTextRange(0, 0, 0, native.getParagraphLength(0, 0)), title); assert.equal(JSON.parse(native.getCharPropertiesAt(0, 0, 0)).bold, true); } finally { native.free(); }
    const refused = await frame.evaluate(() => window.jueonyEditor.executeCommand('file:work-template')); assert.equal(refused.ok, false); assert.equal((await snapshot(frame)).nodes[0].text, title);
  });
  for (const ext of ['hwp', 'hwpx']) await scenario(`${ext}: common snippet save does not edit document; insert/undo/save and library restore work`, async () => {
    const frame = await open(fresh(), ext), name = '협조 요청 ' + ext, text = '검토 결과를 회신해 주시기 바랍니다.\n감사합니다.';
    await command(frame, 'insert:snippets'); await frame.type('[aria-label="상용구 이름"]', name); await frame.$eval('[aria-label="상용구 내용"]', (element, text) => { element.value = text; }, text); await frame.click('[data-jueony-snippets] button'); assert.equal((await snapshot(frame)).nodes[0].text, ''); await confirm(frame, '[data-jueony-snippets]'); assert.deepEqual((await snapshot(frame)).nodes.map(node => node.text), text.split('\n')); await command(frame, 'edit:undo'); assert.equal((await snapshot(frame)).nodes[0].text, ''); await command(frame, 'edit:redo'); const native = await save(frame, 'snippet.' + ext); try { assert.ok(JSON.parse(native.getTextFileUnicode()).includes(text.split('\n')[0])); } finally { native.free(); }
    await page.reload(); await page.waitForFunction(() => document.getElementById('app-status')?.textContent.includes('준비 완료'), { timeout: 90000 }); const restored = await services(); await command(restored, 'insert:snippets'); await restored.select('[aria-label="저장한 상용구"]', name); assert.equal(await restored.$eval('[aria-label="상용구 내용"]', element => element.value), text); await page.keyboard.press('Escape');
  });
  await scenario('concurrently changed snippet library refuses overwrite and leaves document intact', async () => {
    const frame = await open(fresh(), 'hwpx'); await command(frame, 'insert:snippets'); await frame.type('[aria-label="상용구 이름"]', '새 문구'); await frame.$eval('[aria-label="상용구 내용"]', e => { e.value = '오래된 입력'; });
    await frame.evaluate(() => { const value = JSON.parse(localStorage.getItem('jueony-common-snippets')); value.snippets.push({ name: '다른 창', text: '유지 내용' }); localStorage.setItem('jueony-common-snippets', JSON.stringify(value)); }); await frame.click('[data-jueony-snippets] button'); assert.match(await frame.$eval('[data-jueony-snippets] [role=status]', e => e.textContent), /다른 창에서 상용구 목록이 바뀌/); assert.equal((await snapshot(frame)).nodes[0].text, ''); await page.keyboard.press('Escape');
  });
  await page.screenshot({ path: resolve(out, 'basic-text.png') });
  if (pageErrors.length) failures.push({ name: 'page errors', errors: pageErrors }); if (externalRequests.length) failures.push({ name: 'offline asset requests', externalRequests });
  await writeFile(resolve(out, 'basic-text-browser.json'), JSON.stringify({ results, failures, pageErrors, externalRequests, build: await page.evaluate(() => fetch('/build-evidence.json').then(r => r.json())), note: 'Isolated Edge, real production commands/dialogs/history/save. Native engine reopen. No Hancom GUI comparison or paid LLM call.' }, null, 2)); if (failures.length) process.exitCode = 1;
} catch (error) { console.error(error); process.exitCode = 1; await writeFile(resolve(out, 'fatal.json'), JSON.stringify({ error: String(error), stack: error.stack, results, failures, pageErrors }, null, 2)); }
finally { await browser?.close(); server.kill(); }
