import puppeteer from 'puppeteer-core';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from './serve.mjs';
const app = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const server = await serve(0);
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const page = await browser.newPage();
const errors = [], failures = [], external = [];
try {
  await page.setViewport({ width: 1440, height: 960, deviceScaleFactor: 1 });
  page.on('pageerror', error => errors.push(String(error)));
  page.on('response', response => { if (response.status() >= 400) failures.push([response.status(), response.url()]); });
  await page.setRequestInterception(true);
  page.on('request', request => {
    const url = request.url();
    if (/^https?:/.test(url) && !url.startsWith(`http://127.0.0.1:${server.address().port}/`)) {
      external.push(url); void request.abort();
    } else void request.continue();
  });
  await page.goto(`http://127.0.0.1:${server.address().port}`, { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => window.jueonyEditor);
  await page.evaluate(() => window.jueonyEditor.ready);
  await page.keyboard.down('Alt'); await page.keyboard.press('KeyN'); await page.keyboard.up('Alt');
  await page.waitForFunction(() => window.jueonyEditor.state().pageCount > 0);
  await mkdir(resolve(app, 'evidence'), { recursive: true });
  await page.screenshot({ path: resolve(app, 'evidence/editor-first.png') });
  const state = await page.evaluate(() => ({ state: window.jueonyEditor.state(), inputs: [...document.querySelectorAll('textarea,canvas')].map(e => ({tag:e.tagName,id:e.id,class:e.className,rect:JSON.stringify(e.getBoundingClientRect())})), text: document.body.innerText.slice(-2500) }));
  const report = { state, errors, failures, external };
  await writeFile(resolve(app, 'evidence/probe.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally { await browser.close(); server.close(); }
