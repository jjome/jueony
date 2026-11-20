import assert from 'node:assert/strict';
import {readFile, mkdtemp, rm} from 'node:fs/promises';
import {createServer as createHttpServer} from 'node:http';
import {tmpdir} from 'node:os';
import {extname, join, resolve, sep} from 'node:path';
import puppeteer from 'puppeteer-core';
import {build as viteBuild} from 'vite';

const app = resolve(import.meta.dirname, '..');
const executablePath = process.env.JUEONY_TEST_BROWSER ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const userDataDir = await mkdtemp(join(tmpdir(), 'jueony-n023-edge-'));
const bundleDir = await mkdtemp(join(tmpdir(), 'jueony-n023-bundle-'));
const externalRequests = [];
const missingLocalResources = [];
const pageErrors = [];
const consoleErrors = [];
const results = [];
let browser;
let server;

try {
  await viteBuild({
    root: app,
    configFile: false,
    logLevel: 'silent',
    build: {
      outDir: bundleDir,
      emptyOutDir: true,
      rollupOptions: {input: {n023: resolve(app, 'scripts/fixtures/viewport-placement-browser-n023.html')}},
    },
  });
  server = createHttpServer(async (request, response) => {
    try {
      const relative = decodeURIComponent(new URL(request.url ?? '/', 'http://127.0.0.1').pathname).replace(/^\/+/, '');
      const file = resolve(bundleDir, relative);
      if (!relative || !file.startsWith(bundleDir + sep)) {
        response.writeHead(relative ? 403 : 404).end();
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
  assert.ok(address && typeof address !== 'string');
  const origin = `http://127.0.0.1:${address.port}`;

  browser = await puppeteer.launch({
    executablePath,
    headless: true,
    userDataDir,
    protocolTimeout: 120_000,
    args: [
      '--no-first-run', '--disable-background-networking', '--disable-component-update',
      '--disable-default-apps', '--disable-features=OptimizationHints,MediaRouter',
      '--disable-sync', '--metrics-recording-only',
    ],
  });

  for (const scenario of [
    {name: 'DPR 125% wide viewport', width: 1280, height: 800, dpr: 1.25, left: 900, top: 80},
    {name: 'DPR 150% constrained viewport', width: 520, height: 520, dpr: 1.5, left: 450, top: 420},
    {name: 'DPR 200% narrow viewport', width: 360, height: 480, dpr: 2, left: 300, top: 380},
  ]) {
    const page = await createFixturePage(origin, scenario);
    try {
      const measurement = await page.evaluate(async ({left, top}) => window.__n023ViewportFixture.openAt(left, top), scenario);
      validateMeasurement(measurement, scenario.dpr);
      if (scenario.width <= 520) {
        assert.equal(measurement.placement.side, 'above');
        assert.ok(measurement.placement.left < scenario.left, 'narrow viewport must clamp popup left');
      }
      results.push({name: scenario.name, detail: summarize(measurement)});
    } finally {
      await page.close();
    }
  }

  const page = await createFixturePage(origin, {width: 1000, height: 700, dpr: 1.5});
  try {
    const beforeResize = await page.evaluate(() => window.__n023ViewportFixture.openAt(360, 320));
    validateMeasurement(beforeResize, 1.5);
    await page.setViewport({width: 480, height: 420, deviceScaleFactor: 1.5});
    await twoFrames(page);
    const afterResize = await page.evaluate(() => window.__n023ViewportFixture.measure());
    validateMeasurement(afterResize, 1.5);
    assert.equal(afterResize.open, true, 'resize must keep the menu open');
    assert.notEqual(afterResize.actual.left, beforeResize.actual.left, 'resize listener must recalculate popup left');
    results.push({name: 'open menu repositions after actual viewport resize', detail: {before: summarize(beforeResize), after: summarize(afterResize)}});

    const beforeScrollEvent = await page.evaluate(() => window.__n023ViewportFixture.openAt(120, 120));
    const afterScrollEvent = await page.evaluate(() => window.__n023ViewportFixture.moveAnchorAndDispatchViewportScroll(180, 250));
    validateMeasurement(afterScrollEvent, 1.5);
    assert.equal(afterScrollEvent.open, true, 'visual viewport scroll event must keep the menu open');
    assert.notEqual(afterScrollEvent.actual.top, beforeScrollEvent.actual.top, 'visual viewport scroll listener must recalculate popup top');
    results.push({name: 'open menu repositions on visualViewport scroll event', detail: {before: summarize(beforeScrollEvent), after: summarize(afterScrollEvent)}});
  } finally {
    await page.close();
  }

  const zoomPage = await createFixturePage(origin, {width: 960, height: 720, dpr: 1});
  try {
    const session = await zoomPage.createCDPSession();
    await session.send('Emulation.setPageScaleFactor', {pageScaleFactor: 1.5});
    await twoFrames(zoomPage);
    const zoomed = await zoomPage.evaluate(() => window.__n023ViewportFixture.openAt(520, 380));
    validateMeasurement(zoomed, 1);
    assert.ok(zoomed.viewportScale >= 1.49 && zoomed.viewportScale <= 1.51, `unexpected visual viewport scale: ${zoomed.viewportScale}`);
    assert.ok(zoomed.viewport.width < 960, 'page scale must reduce visual viewport CSS width');
    results.push({name: '150% page-scale visual viewport', detail: summarize(zoomed)});
    await session.detach();
  } finally {
    await zoomPage.close();
  }

  assert.deepEqual(pageErrors, []);
  assert.deepEqual(consoleErrors, []);
  assert.deepEqual(externalRequests, []);
  assert.deepEqual(missingLocalResources, []);
  console.log(JSON.stringify({
    pass: true,
    browser: await browser.version(),
    results,
    pageErrors,
    consoleErrors,
    externalRequests,
    missingLocalResources,
    limits: [
      'Headless Edge uses deviceScaleFactor and CDP page-scale emulation; this is not Windows OS DPI or browser chrome zoom certification.',
      'visualViewport scroll listener is exercised with a browser DOM scroll event after moving the synthetic anchor.',
      'Anchors that are already outside the visual viewport are not claimed as supported by this verifier.',
      'Multi-monitor placement, native Windows coordinates, and Hancom 2024 comparison remain unverified.',
    ],
  }, null, 2));
} catch (error) {
  console.error(JSON.stringify({
    pass: false,
    error: String(error instanceof Error ? error.stack ?? error.message : error),
    results,
    pageErrors,
    consoleErrors,
    externalRequests,
    missingLocalResources,
  }, null, 2));
  process.exitCode = 1;
} finally {
  await browser?.close().catch(() => {});
  if (server) await new Promise(resolveClose => server.close(resolveClose));
  await rm(userDataDir, {recursive: true, force: true}).catch(() => {});
  await rm(bundleDir, {recursive: true, force: true}).catch(() => {});
}

async function createFixturePage(origin, viewport) {
  const page = await browser.newPage();
  await page.setViewport({width: viewport.width, height: viewport.height, deviceScaleFactor: viewport.dpr});
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
  await page.goto(`${origin}/scripts/fixtures/viewport-placement-browser-n023.html`, {waitUntil: 'domcontentloaded'});
  await page.waitForFunction(() => window.__n023ViewportFixture?.ready === true);
  return page;
}

function validateMeasurement(value, expectedDpr) {
  assert.equal(value.open, true);
  assert.ok(Math.abs(value.dpr - expectedDpr) < 0.01, `DPR ${value.dpr} != ${expectedDpr}`);
  for (const key of ['left', 'top', 'maxWidth', 'maxHeight']) {
    assert.ok(Math.abs(value.actual[key] - value.placement[key]) < 0.51, `${key} DOM/pure placement drift`);
  }
  assert.equal(value.actual.side, value.placement.side);
  const right = value.viewport.left + value.viewport.width;
  const bottom = value.viewport.top + value.viewport.height;
  assert.ok(value.actual.left >= value.viewport.left + 7.5);
  assert.ok(value.actual.top >= value.viewport.top + 7.5);
  assert.ok(value.actual.left + value.actual.width <= right - 7.5 + 0.51);
  assert.ok(value.actual.top + value.actual.height <= bottom - 7.5 + 0.51);
}

function summarize(value) {
  return {
    dpr: value.dpr,
    viewportScale: value.viewportScale,
    viewport: value.viewport,
    side: value.actual.side,
    left: value.actual.left,
    top: value.actual.top,
    width: value.actual.width,
    height: value.actual.height,
  };
}

async function twoFrames(page) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}
