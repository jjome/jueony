import assert from 'node:assert/strict';
import {readFile, mkdtemp, rm} from 'node:fs/promises';
import {createServer as createHttpServer} from 'node:http';
import {tmpdir} from 'node:os';
import {extname, join, resolve, sep} from 'node:path';
import puppeteer from 'puppeteer-core';
import {build as viteBuild} from 'vite';

const app = resolve(import.meta.dirname, '..');
const executablePath = process.env.JUEONY_TEST_BROWSER ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const userDataDir = await mkdtemp(join(tmpdir(), 'jueony-n044-edge-'));
const bundleDir = await mkdtemp(join(tmpdir(), 'jueony-n044-bundle-'));
const externalRequests = [];
const missingLocalResources = [];
const pageErrors = [];
const consoleErrors = [];
let browser;
let page;
let server;

try {
  await viteBuild({
    root: app,
    configFile: false,
    logLevel: 'silent',
    build: {
      outDir: bundleDir,
      emptyOutDir: true,
      rollupOptions: {
        input: {n044: resolve(app, 'scripts/fixtures/recovery-checkpoint-browser-n044.html')},
      },
    },
  });
  server = createHttpServer(async (request, response) => {
    try {
      const relative = decodeURIComponent(new URL(request.url ?? '/', 'http://127.0.0.1').pathname).replace(/^\/+/, '') || 'n044.html';
      const file = resolve(bundleDir, relative);
      if (!file.startsWith(bundleDir + sep)) {
        response.writeHead(403).end();
        return;
      }
      const body = await readFile(file);
      const contentType = extname(file) === '.html' ? 'text/html; charset=utf-8'
        : extname(file) === '.js' ? 'text/javascript; charset=utf-8'
          : 'application/octet-stream';
      response.writeHead(200, {'content-type': contentType, 'cache-control': 'no-store'}).end(body);
    } catch {
      missingLocalResources.push(request.url ?? '/');
      response.writeHead(404).end();
    }
  });
  await new Promise((resolveListen, rejectListen) => {
    server.once('error', rejectListen);
    server.listen(0, '127.0.0.1', resolveListen);
  });
  const address = server.address();
  assert.ok(address && typeof address !== 'string', 'HTTP server did not expose a loopback port');
  const origin = `http://127.0.0.1:${address.port}`;

  browser = await puppeteer.launch({
    executablePath,
    headless: true,
    userDataDir,
    protocolTimeout: 120_000,
    args: [
      '--no-first-run',
      '--disable-background-networking',
      '--disable-component-update',
      '--disable-default-apps',
      '--disable-features=OptimizationHints,MediaRouter',
      '--disable-sync',
      '--metrics-recording-only',
    ],
  });
  page = await browser.newPage();
  page.on('pageerror', error => pageErrors.push(String(error)));
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  await page.setRequestInterception(true);
  page.on('request', request => {
    const url = request.url();
    if (url.startsWith(`${origin}/`) || /^(data:|blob:)/u.test(url)) void request.continue();
    else {
      externalRequests.push(url);
      void request.abort();
    }
  });

  await page.goto(`${origin}/scripts/fixtures/recovery-checkpoint-browser-n044.html`, {waitUntil: 'domcontentloaded'});
  await page.waitForFunction(() => window.__n044BrowserVerification?.status !== undefined, {timeout: 30_000});
  const report = await page.evaluate(() => window.__n044BrowserVerification);
  assert.ok(report, 'browser fixture did not publish a report');
  assert.equal(report.status, 'passed', report.error ?? 'browser fixture failed');
  assert.equal(report.results.length, 3, 'all N044 browser scenarios must pass');
  assert.deepEqual(pageErrors, []);
  assert.deepEqual(consoleErrors, []);
  assert.deepEqual(externalRequests, []);
  assert.deepEqual(missingLocalResources, []);
  console.log(JSON.stringify({
    pass: true,
    browser: report.browser,
    results: report.results,
    pageErrors,
    consoleErrors,
    externalRequests,
    missingLocalResources,
    limits: [
      'Independent headless Edge fixture; the Jueony app shell and Hancom 2024 were not opened.',
      'Actual app boot injection, Tauri/Windows abnormal termination, and user-document recovery remain unverified.',
    ],
  }, null, 2));
} catch (error) {
  const pageState = await page?.evaluate(() => ({
    href: location.href,
    statusText: document.getElementById('status')?.textContent ?? null,
    scripts: [...document.scripts].map(script => script.src),
    report: window.__n044BrowserVerification ?? null,
  })).catch(() => null);
  console.error(JSON.stringify({
    pass: false,
    error: String(error instanceof Error ? error.stack ?? error.message : error),
    pageErrors,
    consoleErrors,
    externalRequests,
    missingLocalResources,
    pageState,
  }, null, 2));
  process.exitCode = 1;
} finally {
  await browser?.close().catch(() => {});
  if (server) await new Promise(resolveClose => server.close(resolveClose));
  await rm(userDataDir, {recursive: true, force: true}).catch(() => {});
  await rm(bundleDir, {recursive: true, force: true}).catch(() => {});
}
