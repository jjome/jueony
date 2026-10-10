import puppeteer from 'puppeteer-core';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import init, { HwpDocument } from '@rhwp/core';
import { serve } from './serve.mjs';
await init({ module_or_path: await readFile('node_modules/@rhwp/core/rhwp_bg.wasm') });
const server = await serve(4197);
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true, args: ['--no-first-run'] });
const page = await browser.newPage(), checks = [], errors = [];
page.on('pageerror', e => errors.push(String(e)));
const press = async (keys) => { const parts = keys.split('+'); for (const k of parts.slice(0, -1)) await page.keyboard.down(k); await page.keyboard.press(parts.at(-1)); for (const k of parts.slice(0, -1).reverse()) await page.keyboard.up(k); };
const focus = () => page.$eval('[aria-label="문서 편집 입력"]', e => e.focus());
const inspect = async (fn) => { const bytes = await page.evaluate(() => [...window.jueonyEditor.recovery().bytes]); const doc = new HwpDocument(new Uint8Array(bytes)); try { return fn(doc); } finally { doc.free(); } };
const props = () => inspect(doc => JSON.parse(doc.getCharPropertiesAt(0, 0, 0)));
try {
  await page.goto('http://127.0.0.1:4197/editor.html?storage=download&skipRecovery=1');
  await page.waitForFunction(() => window.jueonyEditor?.shortcuts, { timeout: 60000 });
  await page.waitForFunction(() => !window.jueonyEditor.busy());
  const fixture = [...await readFile('fixtures/three-paragraphs.hwpx')];
  await page.evaluate(async b => window.jueonyEditor.open(new Uint8Array(b), '단축키.hwpx'), fixture);
  await focus(); await press('Control+A'); await press('Alt+Shift+B');
  assert.equal((await props()).bold, true); checks.push('Alt+Shift+B applies bold to real selected document');
  await press('Alt+Shift+C'); assert.equal((await props()).bold, false); checks.push('Alt+Shift+C clears character styling instead of centering');
  await press('Control+M'); await press('R'); assert.equal((await props()).textColor.toLowerCase(), '#ff0000'); checks.push('Ctrl+M,R changes actual character color');
  await press('Control+Z'); assert.notEqual((await props()).textColor.toLowerCase(), '#ff0000'); checks.push('shortcut edit participates in engine undo');
  await press('Control+Shift+C');
  assert.equal(await inspect(doc => JSON.parse(doc.getParaPropertiesAt(0, 0)).alignment), 'center'); checks.push('Ctrl+Shift+C centers the actual paragraph');
  await press('Alt+L'); await page.waitForSelector('.modal-overlay');
  const before = await page.evaluate(() => window.jueonyEditor.revision());
  await page.evaluate(() => { const el = document.querySelector('.modal-overlay input'); el?.focus(); el?.dispatchEvent(new KeyboardEvent('keydown', { key: 'y', code: 'KeyY', ctrlKey: true, bubbles: true, cancelable: true })); });
  assert.equal(await page.evaluate(() => window.jueonyEditor.revision()), before); checks.push('dialog input does not delete document text');
  await press('Escape'); await page.waitForFunction(() => !document.querySelector('.modal-overlay'));
  await focus();
  // Verify the renderer boundary separately: Chromium can reserve Ctrl+N before DOM delivery.
  await page.evaluate(() => { const el = document.querySelector('[aria-label="문서 편집 입력"]'); for (const [key, code, ctrlKey] of [['n', 'KeyN', true], ['t', 'KeyT', false]]) el.dispatchEvent(new KeyboardEvent('keydown', { key, code, ctrlKey, bubbles: true, cancelable: true })); });
  await page.waitForSelector('.modal-overlay'); checks.push('Ctrl+N,T renderer event mapping opens table creation (not native key delivery)');
  await press('Escape'); await page.waitForFunction(() => !document.querySelector('.modal-overlay'));
  await focus(); const original = await page.evaluate(() => window.jueonyEditor.snapshot().nodes.map(n => n.text));
  await press('Control+Home'); await press('Control+Y');
  assert.notDeepEqual(await page.evaluate(() => window.jueonyEditor.snapshot().nodes.map(n => n.text)), original);
  await press('Control+Z'); assert.deepEqual(await page.evaluate(() => window.jueonyEditor.snapshot().nodes.map(n => n.text)), original); checks.push('Ctrl+Y deletes real line and undo restores text');
  await mkdir('evidence/shortcuts', { recursive: true });
  await page.screenshot({ path: 'evidence/shortcuts/editor.png', fullPage: true });
  assert.deepEqual(errors, []);
  await writeFile('evidence/shortcuts/results.json', JSON.stringify({ checks, errors, limitation: 'Headless Edge input is not a physical Windows IME or native accelerator validation.' }, null, 2));
  console.log(JSON.stringify({ passed: checks.length, checks }));
} catch (error) {
  console.error(JSON.stringify({ completed: checks, errors, error: String(error) })); throw error;
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
