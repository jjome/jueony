import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const app = resolve(dirname(fileURLToPath(import.meta.url)), '..'), repo = resolve(app, '../..');
const out = resolve(process.env.JUEONY_TEST_OUTPUT ?? join(app, 'evidence/basic-view-preferences'));
const dist = resolve(process.env.JUEONY_TEST_DIST ?? join(app, 'evidence/dist-basic-editor-20261024'));
const port = Number(process.env.JUEONY_TEST_PORT ?? 4503), origin = `http://127.0.0.1:${port}`;
const key = 'jueony-editor-chrome-v1', legacy = 'jueony-style-panel';
await mkdir(out, { recursive: true });
const profile = await mkdtemp(join(tmpdir(), 'jueony-basic-view-'));
if (await fetch(origin).then(() => true, () => false)) throw new Error(`Test port ${port} is occupied`);
const server = spawn(process.execPath, ['apps/launcher/server.mjs'], { cwd: repo, windowsHide: true, stdio: 'ignore', env: { ...process.env, JUEONY_PORT: String(port), JUEONY_DIST: dist, JUEONY_CONNECTION_STORE: 'memory' } });
let browser, page, ribbonPage, stage = 'startup';
const results = [], pageErrors = [], externalRequests = [];
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const pass = (name, detail) => { results.push({ name, ...(detail ? { detail } : {}) }); console.log('PASS', name); };
async function launch() {
  browser = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true, userDataDir: profile, protocolTimeout: 45000, defaultViewport: { width: 1600, height: 1100 }, args: ['--no-first-run', '--disable-background-networking', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'] });
  page = await browser.newPage();
  page.on('pageerror', error => pageErrors.push(String(error)));
  page.on('dialog', dialog => dialog.accept());
  await page.setRequestInterception(true);
  page.on('request', request => { if (/^https?:/.test(request.url()) && !request.url().startsWith(origin + '/')) { externalRequests.push(request.url()); void request.abort(); } else void request.continue(); });
}
async function ready() {
  await page.waitForFunction(() => document.getElementById('app-status')?.textContent.includes('준비 완료'), { timeout: 90000 });
  const frame = await active();
  await frame.waitForFunction(() => window.jueonyEditor?.snapshot && document.querySelector('.j-tab[aria-selected="true"]'), { timeout: 60000 });
  return frame;
}
async function active() { return (await page.$('.editor-frame:not([hidden])')).contentFrame(); }
const ui = async frame => {
  await frame.waitForFunction(() => !window.jueonyEditor.busy(), { timeout: 15000 });
  return frame.evaluate(() => ({ hidden: document.getElementById('jueony-style-panel').hidden, tab: document.querySelector('.j-tab[aria-selected="true"]')?.textContent, state: window.jueonyEditor.state(), structure: window.jueonyEditor.snapshot().structure }));
};
const raw = () => page.evaluate(key => localStorage.getItem(key), key);
async function clickTab(frame, id) {
  // The unified shell deliberately hides its legacy menu/ribbon. Exercise the
  // standalone editor's real ribbon, then observe the shell editor receiving it.
  if (!ribbonPage || ribbonPage.isClosed()) {
    ribbonPage = await browser.newPage();
    ribbonPage.on('pageerror', error => pageErrors.push(String(error)));
    ribbonPage.on('dialog', dialog => dialog.accept());
    await ribbonPage.goto(origin + '/editor.html?storage=download&skipRecovery=1');
    await ribbonPage.waitForFunction(() => window.jueonyEditor?.snapshot && document.querySelector('.j-tab[aria-selected="true"]'), { timeout: 60000 });
  }
  await ribbonPage.bringToFront();
  await ribbonPage.click(`[data-menu="${id}"] .j-tab`);
  await delay(50);
  await page.bringToFront();
}
async function toggleStylePanel() {
  await page.bringToFront();
  await page.evaluate(() => [...document.querySelectorAll('#unified-menus > details > summary')].find(el => el.textContent === '보기').click());
  await page.click('#unified-menus [data-editor-command="ext:jueony-style-panel"]');
}
async function openBackup(frame) {
  const result = await frame.evaluate(() => window.rhwpStudio.automation.execute('tool:settings-backup', undefined, { allowDialog: true }));
  assert.equal(result.ok, true); await frame.waitForSelector('[data-jueony-settings-backup]');
}
try {
  for (let i = 0; i < 100; i++) { if (server.exitCode !== null) throw new Error('Test server exited'); if (await fetch(origin + '/api/health').then(r => r.ok, () => false)) break; await delay(100); }
  await launch();
  await page.goto(origin + '/favicon.ico');
  await page.evaluate(legacy => localStorage.setItem(legacy, 'false'), legacy);
  await page.goto(origin + '/?storage=download'); let first = await ready();
  const original = await ui(first);
  assert.equal(original.hidden, true); assert.equal(original.tab, '편집'); assert.equal(await raw(), null);
  pass('legacy hidden style panel restores without a startup preference write');

  stage = 'local preference changes';
  await clickTab(first, 'format'); await toggleStylePanel();
  assert.equal((await ui(first)).hidden, false); assert.equal((await ui(first)).tab, '서식');
  assert.deepEqual(JSON.parse(await raw()), { version: 1, stylePanelOpen: true, ribbonTab: 'format' });
  assert.deepEqual((await ui(first)).structure, original.structure); assert.deepEqual((await ui(first)).state, original.state);
  pass('ribbon and style controls persist without changing document content, revision, or dirty state');

  stage = 'cross-document synchronization';
  const storedBeforeNew = await raw(); await page.click('#new-document');
  await page.waitForFunction(() => document.querySelectorAll('.editor-frame').length === 2);
  const second = await ready();
  assert.equal((await ui(second)).tab, '서식'); assert.equal((await ui(second)).hidden, false); assert.equal(await raw(), storedBeforeNew);
  await second.locator('[aria-label="스타일 작업 창 닫기"]').click();
  await second.waitForFunction(() => document.getElementById('jueony-style-panel').hidden);
  await clickTab(second, 'view');
  await first.waitForFunction(() => document.getElementById('jueony-style-panel').hidden && document.querySelector('.j-tab[aria-selected="true"]')?.textContent === '보기');
  assert.deepEqual((await ui(first)).structure, original.structure); assert.deepEqual((await ui(first)).state, original.state);
  pass('existing hidden editor and newly opened document share live view preferences without startup overwrite');

  stage = 'reload and actual browser restart';
  await page.reload(); first = await ready();
  assert.equal((await ui(first)).hidden, true); assert.equal((await ui(first)).tab, '보기');
  await browser.close(); browser = undefined; ribbonPage = undefined; await launch(); await page.goto(origin + '/?storage=download'); first = await ready();
  assert.equal((await ui(first)).hidden, true); assert.equal((await ui(first)).tab, '보기');
  pass('view preferences survive a page reload and a closed/relaunched isolated browser profile');

  stage = 'quota failure';
  const beforeQuota = await ui(first), beforeQuotaRaw = await raw();
  await first.evaluate(key => { window.__viewTestSetItem = Storage.prototype.setItem; Storage.prototype.setItem = function(k, value) { if (k === key) throw new DOMException('synthetic full', 'QuotaExceededError'); return window.__viewTestSetItem.call(this, k, value); }; }, key);
  await first.evaluate(() => document.querySelector('[data-menu="format"] .j-tab').click()); await toggleStylePanel();
  assert.equal((await ui(first)).tab, beforeQuota.tab); assert.equal((await ui(first)).hidden, beforeQuota.hidden); assert.equal(await raw(), beforeQuotaRaw);
  await first.evaluate(() => { Storage.prototype.setItem = window.__viewTestSetItem; delete window.__viewTestSetItem; });
  await clickTab(first, 'format'); assert.equal((await ui(first)).tab, '서식');
  pass('a failed preference write keeps the shown choice and stored value; retry succeeds');

  stage = 'backup export and import';
  const downloads = join(out, 'downloads'); await mkdir(downloads, { recursive: true });
  const cdp = await page.createCDPSession(); await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloads });
  await openBackup(first);
  await first.evaluate(() => [...document.querySelectorAll('[data-jueony-settings-backup] button')].find(button => button.textContent === '현재 환경 파일로 내보내기').click());
  let backupText;
  for (let i = 0; i < 100; i++) { const files = await readdir(downloads); const name = files.find(name => name.endsWith('.json')); if (name) { backupText = await readFile(join(downloads, name), 'utf8'); break; } await delay(100); }
  assert.ok(backupText, 'actual downloaded environment JSON');
  const backup = JSON.parse(backupText); assert.deepEqual(backup.editorChrome, { version: 1, stylePanelOpen: false, ribbonTab: 'format' });
  backup.editorChrome = { version: 1, stylePanelOpen: true, ribbonTab: 'page' };
  await first.$eval('textarea[aria-label="가져올 환경 JSON"]', (el, text) => { el.value = text; el.dispatchEvent(new Event('input', { bubbles: true })); }, JSON.stringify(backup));
  await first.click('.modal-overlay .dialog-btn-primary');
  await first.waitForFunction(() => !document.querySelector('[data-jueony-settings-backup]'));
  assert.equal((await ui(first)).hidden, false); assert.equal((await ui(first)).tab, '쪽');
  for (const frame of page.frames().filter(frame => frame.url().includes('editor.html'))) await frame.waitForFunction(() => !document.getElementById('jueony-style-panel').hidden && document.querySelector('.j-tab[aria-selected="true"]')?.textContent === '쪽');
  pass('actual environment JSON download/import includes ribbon and panel and updates every opened editor');

  stage = 'overlapping live view restores';
  const prior = await first.evaluate(() => window.jueonyEditor.state());
  const restoreResult = await first.evaluate(async () => {
    const api = window.jueonyEditor, initial = api.captureDocumentView();
    const one = api.restoreDocumentView({ ...initial, zoom: 1.25, fitMode: 'none', scrollY: 10 });
    const two = api.restoreDocumentView({ ...initial, zoom: 1.5, fitMode: 'none', scrollY: 220 });
    return { statuses: await Promise.all([one, two]), captured: api.captureDocumentView(), actualZoom: document.getElementById('sb-zoom-display').textContent.trim(), actualScroll: document.getElementById('scroll-container').scrollTop };
  });
  assert.deepEqual(restoreResult.statuses, ['ignored', 'applied']); assert.equal(restoreResult.captured.zoom, 1.5); assert.equal(restoreResult.captured.scrollY, restoreResult.actualScroll); assert.equal(restoreResult.actualZoom, '150%');
  assert.deepEqual(await first.evaluate(() => window.jueonyEditor.state()), prior);
  pass('latest overlapping viewport restoration finishes without an extra resize and leaves document state intact', restoreResult);

  stage = 'unsupported preference version';
  const futureRaw = '{"version":99,"stylePanelOpen":false,"ribbonTab":"unknown","sentinel":"keep"}';
  await page.evaluate((key, value) => localStorage.setItem(key, value), key, futureRaw);
  await page.reload(); first = await ready();
  assert.equal((await ui(first)).hidden, false); assert.equal((await ui(first)).tab, '편집');
  await clickTab(first, 'format'); await first.locator('[aria-label="스타일 작업 창 닫기"]').click();
  assert.equal(await raw(), futureRaw); assert.equal((await ui(first)).hidden, false); assert.equal((await ui(first)).tab, '편집');
  pass('future preference records survive startup and attempted edits without silent overwrite');
  await page.screenshot({ path: join(out, 'view-preferences.png'), fullPage: true });
  assert.deepEqual(pageErrors, []); assert.deepEqual(externalRequests, []);
  await writeFile(join(out, 'result.json'), JSON.stringify({ pass: true, results, pageErrors, externalRequests, build: await page.evaluate(() => fetch('/build-evidence.json').then(r => r.json())), limits: ['Isolated headless Edge, actual locally bundled editor and engine; no user profile or document access', 'Hancom 2024 direct comparison deferred'] }, null, 2));
} catch (error) {
  console.error(error); process.exitCode = 1;
  await page?.screenshot({ path: join(out, 'failure.png'), fullPage: true }).catch(() => {});
  await writeFile(join(out, 'failure.json'), JSON.stringify({ stage, error: String(error.stack ?? error), results, pageErrors, externalRequests }, null, 2));
} finally { await browser?.close(); server.kill(); }
