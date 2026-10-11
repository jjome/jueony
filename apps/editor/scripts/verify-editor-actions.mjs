import puppeteer from 'puppeteer-core';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile, realpath, mkdtemp } from 'node:fs/promises';
import { resolve, extname, sep, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import init, { HwpDocument } from '@rhwp/core';

const app = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = await realpath(process.env.JUEONY_PARITY_DIST ?? resolve(app, 'evidence/dist-parity'));
const output = resolve(app, 'evidence/editor-actions');
const port = Number(process.env.JUEONY_PARITY_PORT ?? 4199);
if (!Number.isInteger(port) || port < 1024 || port > 65535 || port === 4173) throw new Error('Use an isolated test port.');
await mkdir(output, { recursive: true });
const profile = await mkdtemp(resolve(output, 'edge-profile-'));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const initialBuildHash = hash(await readFile(resolve(dist, 'editor.html')));
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.png': 'image/png', '.svg': 'image/svg+xml' };
const server = createServer(async (req, res) => {
  try {
    if (req.headers.host !== `127.0.0.1:${port}` || !['GET', 'HEAD'].includes(req.method)) { res.writeHead(403).end(); return; }
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = await realpath(resolve(dist, '.' + (pathname === '/' ? '/index.html' : pathname)));
    if (!file.startsWith(dist + sep)) { res.writeHead(403).end(); return; }
    res.writeHead(200, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    res.end(req.method === 'HEAD' ? undefined : await readFile(file));
  } catch { res.writeHead(404).end('Not found'); }
});
await new Promise((ok, fail) => { server.once('error', fail); server.listen(port, '127.0.0.1', ok); });
const checks = [], errors = [], external = [];
let browser, page;
try {
  await init({ module_or_path: await readFile(resolve(app, 'node_modules/@rhwp/core/rhwp_bg.wasm')) });
  browser = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', userDataDir: profile, headless: true, args: ['--no-first-run', '--disable-background-networking'], defaultViewport: { width: 1440, height: 1000 } });
  page = await browser.newPage();
  page.on('pageerror', e => errors.push(String(e)));
  await page.setRequestInterception(true);
  page.on('request', request => {
    if (/^https?:/.test(request.url()) && new URL(request.url()).origin !== `http://127.0.0.1:${port}`) { external.push(request.url()); request.abort(); }
    else request.continue();
  });
  const press = async keys => {
    const parts = keys.split('+');
    for (const key of parts.slice(0, -1)) await page.keyboard.down(key);
    await page.keyboard.press(parts.at(-1));
    for (const key of parts.slice(0, -1).reverse()) await page.keyboard.up(key);
  };
  const focus = () => page.$eval('[aria-label="문서 편집 입력"]', el => el.focus());
  const read = () => page.evaluate(() => {
    // Test-only inspection through the existing command host; no product debug hook is added.
    const ih = window.rhwpStudio.automation.options.dispatcher.services.getInputHandler();
    return { state: window.jueonyEditor.state(), block: ih.cursor.captureCellSelection(), highlights: [...document.querySelectorAll('.cell-selection-highlight')].map(el => ({ left: el.style.left, top: el.style.top, width: el.style.width, height: el.style.height })) };
  });
  await page.goto(`http://127.0.0.1:${port}/editor.html?storage=download&skipRecovery=1`);
  await page.waitForFunction(() => window.jueonyEditor?.shortcuts && !window.jueonyEditor.busy(), { timeout: 60000 });
  const fixture = HwpDocument.createEmpty(); fixture.createBlankDocument(); fixture.insertText(0, 0, 0, 'alpha 계획안');
  const tableInfo = JSON.parse(fixture.createTable(0, 0, 9, 3, 3));
  fixture.insertTextInCell(0, tableInfo.paraIdx, tableInfo.controlIdx, 4, 0, 0, 'alpha 표 안');
  const updates = Array.from({ length: 9 }, (_, i) => { const p = JSON.parse(fixture.getCellProperties(0, tableInfo.paraIdx, tableInfo.controlIdx, i)); return { cellIdx: i, widthDelta: [9000, 14000, 19000][i % 3] - p.width, heightDelta: [1800, 2400, 3000][Math.floor(i / 3)] - p.height }; });
  fixture.resizeTableCells(0, tableInfo.paraIdx, tableInfo.controlIdx, JSON.stringify(updates));
  const initial = [...fixture.exportHwpx()]; fixture.free();
  await page.evaluate(bytes => window.jueonyEditor.open(new Uint8Array(bytes), 'unequal-cells.hwpx'), initial);
  const geometry = () => page.evaluate(() => { const ih = window.rhwpStudio.automation.options.dispatcher.services.getInputHandler(), t = window.jueonyEditor.snapshot().structure.tables[0]; return t.cells.map(c => ({ index: c.index, ...ih.wasm.getCellProperties(t.section, t.paragraph, t.control, c.index) })); });
  const select = async (anchor = { row: 0, col: 0 }, focus = { row: 2, col: 2 }) => page.evaluate(({ anchor, focus }) => {
    const ih = window.rhwpStudio.automation.options.dispatcher.services.getInputHandler(), t = window.jueonyEditor.snapshot().structure.tables[0];
    ih.cursor.clearSelection(); ih.cursor.moveTo({ sectionIndex: t.section, paragraphIndex: t.paragraph, charOffset: 0, parentParaIndex: t.paragraph, controlIndex: t.control, cellIndex: 0, cellParaIndex: 0 });
    ih.cursor.restoreCellSelection({ sec: t.section, ppi: t.paragraph, ci: t.control, anchor, focus, phase: 2, reason: 'manual', excluded: [] }); ih.updateCellSelection(); ih.focus();
    window.rhwpStudio.automation.options.dispatcher.services.eventBus.emit('command-state-changed');
  }, { anchor, focus });
  const before = await geometry();
  const outerHeightBefore = await page.evaluate(() => { const ih = window.rhwpStudio.automation.options.dispatcher.services.getInputHandler(), t = window.jueonyEditor.snapshot().structure.tables[0]; return ih.wasm.getTableProperties(t.section,t.paragraph,t.control).tableHeight; });
  await select();
  assert.equal(await page.evaluate(() => window.rhwpStudio.automation.isEnabled('table:cell-width-equal')), true);
  await press('W');
  const widthEqual = await geometry(); assert.ok(widthEqual.every(c => c.width === 14000));
  assert.deepEqual(widthEqual.map(c => c.height), before.map(c => c.height));
  assert.equal((await read()).state.dirty, true);
  checks.push('W on a full cell block equalizes all widths without changing heights, and marks the real document dirty');
  assert.equal((await page.evaluate(() => window.rhwpStudio.automation.execute('edit:undo'))).ok, true);
  assert.deepEqual(await geometry(), before); checks.push('Single undo restores the complete original geometry');
  await select(); const beforeFailure = (await read()).state;
  const failed = await page.evaluate(() => {
    const ih = window.rhwpStudio.automation.options.dispatcher.services.getInputHandler(), original = ih.wasm.setCellProperties;
    let calls = 0; ih.wasm.setCellProperties = function(...args) { if (++calls === 2) throw new Error('Injected second-cell failure'); return original.apply(this,args); };
    try { return window.rhwpStudio.automation.execute('table:cell-height-equal'); } finally { ih.wasm.setCellProperties = original; }
  });
  assert.equal(failed.reason, 'threw'); assert.deepEqual(await geometry(), before); assert.deepEqual((await read()).state, beforeFailure);
  checks.push('Injected failure after the first height change rolls back all cell sizes and leaves dirty/revision unchanged');
  await select(); await press('W'); await select();
  await page.click('[data-menu="table"] .j-tab');
  await page.click('[data-j-command="table:cell-height-equal"]');
  const equal = await geometry(); assert.ok(equal.every(c => c.width === 14000 && c.height === equal[0].height));
  assert.equal(equal.filter((c, i) => i % 3 === 0).reduce((n, c) => n + c.height, 0), outerHeightBefore);
  checks.push('Height-equal ribbon command shares the keyboard command and preserves the outer table height');
  assert.equal((await page.evaluate(() => window.rhwpStudio.automation.execute('edit:undo'))).ok, true);
  assert.deepEqual((await geometry()).map(c => c.height), before.map(c => c.height));
  assert.equal((await page.evaluate(() => window.rhwpStudio.automation.execute('edit:redo'))).ok, true);
  assert.deepEqual(await geometry(), equal);
  checks.push('Height equalization is one complete undo/redo step, including table-height surplus');
  const rendered = await page.evaluate(() => { const ih = window.rhwpStudio.automation.options.dispatcher.services.getInputHandler(), t = window.jueonyEditor.snapshot().structure.tables[0]; return ih.wasm.getTableCellBboxes(t.section,t.paragraph,t.control); });
  assert.equal(new Set(rendered.map(c => c.w)).size, 1); assert.equal(new Set(rendered.map(c => c.h)).size, 1);
  checks.push('Engine layout reports equal visible widths and heights for the edited fixture');
  await page.screenshot({ path: resolve(output, 'equal-cells.png'), fullPage: true });
  await select(); const noOpRevision = (await read()).state.revision; await press('W'); await press('H'); assert.equal((await read()).state.revision, noOpRevision);
  checks.push('Repeated equalization of already equal cells is a no-op without new revision');
  await select({ row: 0, col: 0 }, { row: 1, col: 1 });
  for (const id of ['table:cell-width-equal','table:cell-height-equal']) assert.equal((await page.evaluate(id => window.rhwpStudio.automation.execute(id), id)).reason, 'disabled');
  await press('W'); assert.ok((await page.$eval('#jueony-key-hint', el => el.textContent)).includes('칸 전체'));
  assert.deepEqual(await geometry(), equal); checks.push('Partial selections refuse execution without silently modifying other cells');
  const savedHwpx = new Uint8Array(await page.evaluate(() => [...window.jueonyEditor.recovery().bytes]));
  const native = new HwpDocument(savedHwpx); const savedHwp = native.exportHwp(); native.free();
  for (const [extension, bytes] of [['hwpx', savedHwpx], ['hwp', savedHwp]]) {
    await writeFile(resolve(output, 'equal-cells.' + extension), bytes);
    await page.evaluate(async ({ bytes, extension }) => window.jueonyEditor.open(new Uint8Array(bytes), 'equal-cells.' + extension), { bytes: [...bytes], extension });
    assert.deepEqual((await geometry()).map(c => [c.width,c.height]), equal.map(c => [c.width,c.height]));
  }
  checks.push('Both exported HWP and HWPX reopen in the actual editor with all equalized sizes preserved');
  await page.evaluate(() => { const ih = window.rhwpStudio.automation.options.dispatcher.services.getInputHandler(); ih.cursor.exitCellSelectionMode(); ih.cursor.clearSelection(); ih.cursor.moveTo({ sectionIndex:0,paragraphIndex:0,charOffset:0 }); ih.updateCaret(); ih.focus(); });
  const searchBefore = (await read()).state;
  await press('Control+F'); await page.waitForSelector('#jueony-navigation-pane');
  await page.type('[aria-label="탐색할 내용"]', 'alpha'); await press('Enter');
  await page.waitForFunction(() => document.querySelector('.j-search-status')?.textContent.includes('2개 결과'));
  assert.equal(await page.$('.find-dialog'), null); assert.equal(await page.$('.modal-overlay'), null);
  await page.click('[data-hit-index="1"]');
  const selected = await page.evaluate(() => window.rhwpStudio.automation.options.dispatcher.services.getInputHandler().cursor.getPosition()); assert.equal(selected.cellIndex, 4);
  assert.deepEqual((await read()).state, searchBefore); checks.push('Ctrl+F docks a pane and searches body plus cell text; clicking a hit selects the cell without mutating the document');
  await page.screenshot({ path: resolve(output, 'navigation-pane.png'), fullPage: true });
  await page.$eval('[aria-label="탐색할 내용"]', el => { el.value = 'ALPHA'; el.dispatchEvent(new Event('input',{bubbles:true})); });
  await page.waitForFunction(() => document.querySelector('.j-search-status')?.textContent.includes('2개 결과'));
  await page.click('.j-search-option input'); await page.waitForFunction(() => document.querySelector('.j-search-status')?.textContent.includes('0개 결과'));
  await page.click('.j-search-option input'); await page.waitForFunction(() => document.querySelector('.j-search-status')?.textContent.includes('2개 결과'));
  checks.push('Case sensitivity refreshes the actual native search results');
  await page.$eval('[aria-label="탐색할 내용"]', el => { el.focus(); el.dispatchEvent(new KeyboardEvent('keydown', { key:'y',code:'KeyY',ctrlKey:true,bubbles:true,cancelable:true })); });
  assert.deepEqual((await read()).state, searchBefore); checks.push('Navigation search input does not route Ctrl+Y to delete a document line');
  await page.evaluate(() => { const ih = window.rhwpStudio.automation.options.dispatcher.services.getInputHandler(); ih.cursor.clearSelection(); ih.cursor.moveTo({ sectionIndex:0,paragraphIndex:0,charOffset:0 }); ih.updateCaret(); ih.focus(); });
  await page.keyboard.type('alpha ');
  await page.waitForFunction(() => document.querySelector('.j-search-status')?.textContent.includes('3개 결과'));
  checks.push('Unsaved direct editing refreshes search results from the same open document');
  await page.evaluate(bytes => window.jueonyEditor.open(new Uint8Array(bytes), 'other-work.hwpx'), initial);
  await page.waitForFunction(() => document.querySelector('[aria-label="탐색할 내용"]').value === '');
  assert.equal((await page.$$('.j-search-hit')).length, 0); checks.push('Changing the open document clears the previous query and results');
  await page.click('[aria-label="탐색 작업 창 닫기"]'); await focus(); await press('Control+Q'); await press('F'); await page.waitForSelector('.find-dialog'); await page.click('.find-dialog .dialog-close');
  checks.push('Ctrl+Q,F still opens the separate floating Find dialog');
  assert.equal(hash(await readFile(resolve(dist, 'editor.html'))), initialBuildHash, 'Build changed during test');
  assert.deepEqual(errors, []); assert.deepEqual(external, []);
  await writeFile(resolve(output, 'results.json'), JSON.stringify({ passed: checks.length, checks, errors, external, editorHtmlSha256: initialBuildHash, limitation: 'Headless engine/browser checks; no installed Hancom editor, so physical shortcut/IME and Hancom reopen comparison remain BLOCKED_REFERENCE.' }, null, 2));
  console.log(JSON.stringify({ passed: checks.length, checks }));
} catch (error) {
  if (page) await page.screenshot({ path: resolve(output, 'failure.png'), fullPage: true }).catch(() => {});
  await writeFile(resolve(output, 'failure.json'), JSON.stringify({ completed: checks, error:String(error), errors, external }, null, 2)); throw error;
} finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }