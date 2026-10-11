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
const output = resolve(app, 'evidence/shortcuts-parity');
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
  const fixture = HwpDocument.createEmpty(); fixture.createBlankDocument(); fixture.insertText(0, 0, 0, '단축키 검수');
  const bytes = [...fixture.exportHwpx()]; fixture.free();
  await page.evaluate(b => window.jueonyEditor.open(new Uint8Array(b), 'parity-shortcuts.hwpx'), bytes);
  await page.evaluate(async () => {
    const api = window.jueonyEditor;
    await api.apply('shortcut-table', api.snapshot(), { message: '', sourceIds: [], operations: [{ kind: 'create_table', after: 's0p0', resultId: 'parityTable', rows: [['11', '12', '13'], ['21', '22', '23'], ['31', '32', '33']] }] });
    // Reopen the actual serialized editor output to start the selection test with a clean document.
    await api.open(api.recovery().bytes, 'parity-shortcuts.hwpx');
  });
  const positionInMiddle = () => page.evaluate(() => {
    const ih = window.rhwpStudio.automation.options.dispatcher.services.getInputHandler();
    const table = window.jueonyEditor.snapshot().structure.tables[0];
    const cell = table.cells.find(c => c.row === 1 && c.column === 1);
    ih.cursor.exitCellSelectionMode(); ih.cursor.clearSelection();
    ih.cursor.moveTo({ sectionIndex: table.section, paragraphIndex: 0, charOffset: 0, parentParaIndex: table.paragraph, controlIndex: table.control, cellIndex: cell.index, cellParaIndex: 0, cellPath: [{ controlIndex: table.control, cellIndex: cell.index, cellParaIndex: 0 }] });
    ih.updateCaret(); ih.focus();
  });
  const serializedBefore = new Uint8Array(await page.evaluate(() => [...window.jueonyEditor.recovery().bytes]));
  const stateBefore = (await read()).state;
  await positionInMiddle(); await press('F5');
  assert.equal((await read()).highlights.length, 1);
  await press('F7');
  let selection = await read();
  assert.deepEqual(selection.block.anchor, { row: 0, col: 1 });
  assert.deepEqual(selection.block.focus, { row: 2, col: 1 });
  assert.equal(selection.highlights.length, 3);
  assert.equal(new Set(selection.highlights.map(h => h.left)).size, 1);
  assert.equal(await page.$('.modal-overlay'), null);
  checks.push('F5 then F7 selects the full middle column, showing three cells without opening page setup');
  await page.screenshot({ path: resolve(output, 'column-selection.png'), fullPage: true });
  await positionInMiddle(); await press('F5'); await press('F8');
  selection = await read();
  assert.deepEqual(selection.block.anchor, { row: 1, col: 0 });
  assert.deepEqual(selection.block.focus, { row: 1, col: 2 });
  assert.equal(selection.highlights.length, 3);
  assert.equal(new Set(selection.highlights.map(h => h.top)).size, 1);
  checks.push('F5 then F8 selects the full middle row, showing three aligned cells');
  assert.deepEqual(selection.state, stateBefore);
  const serializedAfter = new Uint8Array(await page.evaluate(() => [...window.jueonyEditor.recovery().bytes]));
  assert.equal(hash(serializedBefore), hash(serializedAfter));
  checks.push('Column and row selection preserve dirty state, revision and serialized document bytes');
  await page.screenshot({ path: resolve(output, 'row-selection.png'), fullPage: true });
  for (const [key, id] of [['H', 'table:cell-height-equal'], ['W', 'table:cell-width-equal']]) {
    assert.equal(await page.evaluate(id => window.rhwpStudio.automation.isEnabled(id), id), false);
    const result = await page.evaluate(id => window.rhwpStudio.automation.execute(id), id);
    assert.equal(result.ok, false); assert.equal(result.reason, 'disabled');
    await press(key);
    const hint = await page.$eval('#jueony-key-hint', e => e.textContent);
    assert.ok(hint.includes('칸 전체'));
  }
  checks.push('Equal-height/equal-width reject insufficient or partial cell bands with an actionable hint');
  await page.evaluate(() => {
    const ih = window.rhwpStudio.automation.options.dispatcher.services.getInputHandler();
    ih.cursor.exitCellSelectionMode(); ih.cursor.clearSelection(); ih.cursor.moveTo({ sectionIndex: 0, paragraphIndex: 0, charOffset: 0 }); ih.updateCaret(); ih.focus();
  });
  await press('F7'); await page.waitForSelector('.modal-overlay');
  assert.ok((await page.$eval('.modal-overlay', el => el.textContent)).includes('편집 용지'));
  await press('Escape'); await page.waitForFunction(() => !document.querySelector('.modal-overlay'));
  checks.push('F7 in body text still opens page setup and Escape cancels');
  await focus(); await press('Control+F');
  assert.equal(await page.$('.modal-overlay'), null);
  await page.waitForSelector('#jueony-navigation-pane');
  await page.click('[aria-label="탐색 작업 창 닫기"]'); await focus();
  await press('Control+Q'); await press('F'); await page.waitForSelector('.find-dialog');
  assert.ok((await page.$eval('.find-dialog', el => el.textContent)).includes('찾기'));
  const beforeDialogKey = await page.evaluate(() => window.jueonyEditor.revision());
  await page.$eval('.find-dialog input', el => { el.focus(); el.dispatchEvent(new KeyboardEvent('keydown', { key: 'y', code: 'KeyY', ctrlKey: true, bubbles: true, cancelable: true })); });
  assert.equal(await page.evaluate(() => window.jueonyEditor.revision()), beforeDialogKey);
  await page.click('.find-dialog .dialog-close'); await page.waitForFunction(() => !document.querySelector('.find-dialog'));
  checks.push('Ctrl+F opens the docked navigation pane; Ctrl+Q,F opens Find; dialog input cannot delete document lines');
  await focus();
  const toolbarBefore = await page.evaluate(() => document.documentElement.dataset.toolboxBasic);
  await press('Control+F1');
  assert.notEqual(await page.evaluate(() => document.documentElement.dataset.toolboxBasic), toolbarBefore);
  await press('Control+F1');
  assert.equal(await page.evaluate(() => document.documentElement.dataset.toolboxBasic), toolbarBefore);
  checks.push('Ctrl+F1 reaches the existing toolbar command and toggles back');
  assert.equal(hash(await readFile(resolve(dist, 'editor.html'))), initialBuildHash, 'Build changed during test');
  assert.deepEqual(errors, []); assert.deepEqual(external, []);
  checks.push('No page errors or external network requests');
  await writeFile(resolve(output, 'fixture.hwpx'), serializedBefore);
  const reopened = new HwpDocument(serializedAfter); try { await writeFile(resolve(output, 'fixture.hwp'), reopened.exportHwp()); } finally { reopened.free(); }
  await writeFile(resolve(output, 'results.json'), JSON.stringify({ passed: checks.length, checks, errors, external, editorHtmlSha256: initialBuildHash, port, dist, limitation: 'Headless browser checks with test-only initial cursor positioning; physical Windows IME, native key delivery and Hancom editor comparison remain unverified.' }, null, 2));
  console.log(JSON.stringify({ passed: checks.length, checks }));
} catch (error) {
  if (page) await page.screenshot({ path: resolve(output, 'failure.png'), fullPage: true }).catch(() => {});
  await writeFile(resolve(output, 'failure.json'), JSON.stringify({ completed: checks, error: String(error), errors, external }, null, 2));
  throw error;
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}