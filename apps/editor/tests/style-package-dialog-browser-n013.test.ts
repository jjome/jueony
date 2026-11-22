import test from 'node:test';
import assert from 'node:assert/strict';
import {access, mkdtemp, readdir, readFile, rm, writeFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {extname, resolve, sep} from 'node:path';
import puppeteer from 'puppeteer-core';
import {build as viteBuild} from 'vite';

const app = resolve(import.meta.dirname, '..');
const studio = resolve(app, '.build/studio');
const browserPath = process.env.JUEONY_TEST_BROWSER ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const fixtureName = `__style-package-dialog-browser-n013-${process.pid}`;
const fixtureHtml = resolve(studio, `${fixtureName}.html`);
const fixtureSource = resolve(studio, `${fixtureName}.ts`);
const removeWithRetry = async (path: string) => {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {await rm(path, {recursive: true, force: true}); return;}
    catch (error: any) {
      if (!['EBUSY', 'ENOTEMPTY', 'EPERM'].includes(error?.code) || attempt === 4) throw error;
      await new Promise(resolveDelay => setTimeout(resolveDelay, 100 * (attempt + 1)));
    }
  }
};

const fixture = String.raw`
import {StylePackageDialog} from './src/jueony/adapters/browser/style-package-dialog.ts';
import init,{HwpDocument} from '../../node_modules/@rhwp/core/rhwp.js';
import wasmUrl from '../../node_modules/@rhwp/core/rhwp_bg.wasm?url';

await init({module_or_path:wasmUrl});

const character=()=>({fontFamilies:Array(7).fill('\uD568\uCD08\uB86C\uBC14\uD0D5'),fontSize:1000,bold:false,italic:false,underline:false,strikethrough:false,subscript:false,superscript:false,emboss:false,engrave:false,kerning:false,underlineColor:'#000000',strikeColor:'#000000',textColor:'#000000',shadeColor:'#ffffff',shadowColor:'#000000',underlineType:'None',shadowType:0,outlineType:0,emphasisDot:0,underlineShape:0,strikeShape:0,shadowOffsetX:0,shadowOffsetY:0,ratios:Array(7).fill(100),spacings:Array(7).fill(0),relativeSizes:Array(7).fill(100),charOffsets:Array(7).fill(0)});
const paragraph=()=>({alignment:'justify',lineSpacingType:'Percent',lineSpacing:160,marginLeft:0,marginRight:0,indent:0,spacingBefore:0,spacingAfter:0,widowOrphan:false,keepWithNext:false,keepLines:false,pageBreakBefore:false,fontLineHeight:false,singleLine:false,autoSpaceKrEn:false,autoSpaceKrNum:false,verticalAlign:0,englishBreakUnit:0,koreanBreakUnit:1});
const payload=JSON.stringify({format:'jueony-styles',version:1,styles:[{name:'\uAE30\uAD00 \uC81C\uBAA9',englishName:'AgencyTitle',type:0,next:0,char:character(),para:paragraph()}]});
const state={document:null,applied:0,currentCalls:0,appliedPayload:''};
const wasm={
  borrowDocumentHandle:()=>state.document,
  getStyleList:()=>JSON.parse(state.document.getStyleList()),
};

function root(){return document.querySelector('[data-jueony-style-package="true"]');}
function snapshot(){
  const body=root();
  const warning=body?.querySelector(':scope > label');
  const checkbox=warning?.querySelector('input[type="checkbox"]');
  return{
    overlay:Boolean(document.querySelector('.modal-overlay')),
    warningVisible:Boolean(warning&&!warning.hidden),
    warningText:warning?.textContent??'',
    checked:Boolean(checkbox?.checked),
    status:body?.querySelector('[role="status"]')?.textContent??'',
    applied:state.applied,
    currentCalls:state.currentCalls,
    appliedPayload:state.appliedPayload,
  };
}
function open(mode='blank'){
  document.querySelector('.modal-overlay')?.remove();
  state.document?.free();
  state.document=HwpDocument.createEmpty();state.document.createBlankDocument();
  if(mode!=='blank')state.document.insertText(0,0,0,'\uAE30\uC874 \uBCF8\uBB38');
  state.applied=0;state.currentCalls=0;state.appliedPayload='';
  const dialog=new StylePackageDialog(wasm,()=>{state.currentCalls+=1;},text=>{state.applied+=1;state.appliedPayload=text;});
  dialog.show();
  const text=root()?.querySelector('textarea');
  if(!text)throw new Error('style package textarea missing');
  text.value=payload;
  text.dispatchEvent(new Event('input',{bubbles:true}));
  return snapshot();
}
function acknowledge(){const check=root()?.querySelector(':scope > label input[type="checkbox"]');if(check)check.click();return snapshot();}
function confirm(){document.querySelector('.dialog-btn-primary')?.click();return snapshot();}
function setDocumentText(value){if(value)state.document.insertText(0,0,0,value);}
globalThis.__n013={open,acknowledge,confirm,snapshot,setDocumentText,payload};
`;

test('N013 style package dialog enforces the unavailable stored-time warning through real DOM events', {timeout: 120_000}, async () => {
  await access(browserPath);
  await access(resolve(studio, 'src/jueony/adapters/browser/style-package-dialog.ts'));
  const output = await mkdtemp(resolve(app, '.build/jueony-n013-dialog-bundle-'));
  const profile = await mkdtemp(resolve(app, '.build/jueony-n013-dialog-edge-'));
  const externalRequests: string[] = [];
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  const missingResources: string[] = [];
  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | undefined;
  let server: ReturnType<typeof createServer> | undefined;
  try {
    await writeFile(fixtureHtml, '<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>N013 dialog</title></head><body><script type="module" src="./' + fixtureName + '.ts"></script></body></html>');
    await writeFile(fixtureSource, fixture);
    await viteBuild({
      root: studio,
      configFile: false,
      logLevel: 'silent',
      build: {outDir: output, emptyOutDir: true, rollupOptions: {input: {n013: fixtureHtml}}},
    });
    const emitted = await readdir(output);
    const builtHtml = emitted.find(value => value === `${fixtureName}.html`) ?? emitted.find(value => value === 'n013.html');
    assert.ok(builtHtml, `Vite did not emit the N013 fixture HTML: ${emitted.join(', ')}`);
    server = createServer(async (request, response) => {
      try {
        const relative = decodeURIComponent(new URL(request.url ?? '/', 'http://127.0.0.1').pathname).replace(/^\/+/, '') || 'n013.html';
        const file = resolve(output, relative);
        if (!file.startsWith(output + sep)) {response.writeHead(403).end(); return;}
        const body = await readFile(file);
        const type = extname(file) === '.html' ? 'text/html; charset=utf-8' : extname(file) === '.js' ? 'text/javascript; charset=utf-8' : 'application/octet-stream';
        response.writeHead(200, {'content-type': type, 'cache-control': 'no-store'}).end(body);
      } catch {missingResources.push(request.url ?? '/'); response.writeHead(404).end();}
    });
    await new Promise<void>((accept, reject) => {server!.once('error', reject); server!.listen(0, '127.0.0.1', accept);});
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    const origin = `http://127.0.0.1:${address.port}`;
    browser = await puppeteer.launch({
      executablePath: browserPath,
      headless: true,
      userDataDir: profile,
      protocolTimeout: 120_000,
      args: ['--no-first-run','--disable-background-networking','--disable-component-update','--disable-default-apps','--disable-features=OptimizationHints,MediaRouter','--disable-sync','--metrics-recording-only'],
    });
    const page = await browser.newPage();
    page.on('pageerror', error => pageErrors.push(String(error)));
    page.on('console', message => {if (message.type() === 'error') consoleErrors.push(message.text());});
    await page.setRequestInterception(true);
    page.on('request', request => {
      const url = request.url();
      if (url.startsWith(`${origin}/`) || /^(data:|blob:)/u.test(url)) void request.continue();
      else {externalRequests.push(url); void request.abort();}
    });
    await page.goto(`${origin}/${encodeURIComponent(builtHtml)}`, {waitUntil: 'domcontentloaded'});
    await page.waitForFunction(() => Boolean((globalThis as any).__n013), {timeout: 10_000}).catch(async error => {
      throw new Error(JSON.stringify({error: String(error), pageErrors, consoleErrors, externalRequests, missingResources, text: (await page.evaluate(() => document.body.innerText)).slice(0, 2000)}));
    });

    let result = await page.evaluate(() => (globalThis as any).__n013.open('blank'));
    assert.equal(result.overlay, true);
    assert.equal(result.warningVisible, true);
    assert.match(result.warningText, /\uD604\uC7AC \uC5D4\uC9C4.*\uD655\uC778\uD560 \uC218 \uC5C6/);
    assert.match(result.status, /\uD655\uC778\uB780\uC744 \uC120\uD0DD\uD574\uC57C \uC801\uC6A9/);

    result = await page.evaluate(() => (globalThis as any).__n013.confirm());
    assert.equal(result.overlay, true, 'unchecked warning must keep the modal open');
    assert.equal(result.applied, 0);
    assert.match(result.status, /\uD655\uC778\uB780\uC744 \uC120\uD0DD/);

    result = await page.evaluate(() => {const api=(globalThis as any).__n013; api.acknowledge(); return api.confirm();});
    assert.equal(result.overlay, false);
    assert.equal(result.applied, 1);
    assert.equal(result.appliedPayload, await page.evaluate(() => (globalThis as any).__n013.payload));

    result = await page.evaluate(() => {const api=(globalThis as any).__n013; api.open('blank'); api.acknowledge(); api.setDocumentText('\uBC14\uB010 \uBCF8\uBB38'); return api.confirm();});
    assert.equal(result.overlay, true, 'changed evidence must keep the modal open');
    assert.equal(result.applied, 0);
    assert.match(result.status, /\uC800\uC7A5 \uB0A0\uC9DC \uC0C1\uD0DC\uAC00 \uBC14\uB00C/);

    result = await page.evaluate(() => (globalThis as any).__n013.open('nonblank'));
    assert.equal(result.warningVisible, false);
    result = await page.evaluate(() => (globalThis as any).__n013.confirm());
    assert.equal(result.overlay, false);
    assert.equal(result.applied, 1);

    assert.deepEqual(pageErrors, []);
    assert.deepEqual(consoleErrors, []);
    assert.deepEqual(externalRequests, []);
    assert.deepEqual(missingResources, []);
  } finally {
    await browser?.close().catch(() => {});
    if (server) await new Promise<void>(accept => server!.close(() => accept()));
    await Promise.all([
      rm(fixtureHtml, {force: true}),
      rm(fixtureSource, {force: true}),
      removeWithRetry(output),
      removeWithRetry(profile),
    ]);
  }
});
