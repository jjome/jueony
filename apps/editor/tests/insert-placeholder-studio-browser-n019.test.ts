import test from 'node:test';
import assert from 'node:assert/strict';
import { access, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { extname, join, resolve, sep } from 'node:path';
import puppeteer from 'puppeteer-core';
import { build as viteBuild } from 'vite';
import { patchInsertPlaceholderCommandsN019 } from '../scripts/integration/insert-placeholder-command-patches-n019.mjs';

const app = resolve(import.meta.dirname, '..');
const studio = resolve(app, '.build/studio');
const edge = process.env.JUEONY_TEST_BROWSER ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const fixtureName = `__insert-placeholder-browser-n019-${process.pid}`;
const fixtureHtml = resolve(studio, `${fixtureName}.html`);
const fixtureSource = resolve(studio, `${fixtureName}.ts`);
const commandIds = ['insert:comment', 'insert:para-band'] as const;

const fixture = String.raw`
import {EventBus} from './src/core/event-bus.ts';
import {CommandRegistry} from './src/command/registry.ts';
import {CommandDispatcher} from './src/command/dispatcher.ts';
import {insertCommands} from './src/command/commands/insert.ts';
import {MenuBar} from './src/ui/menu-bar.ts';
import {ContextMenu} from './src/ui/context-menu.ts';
import {installHangulChrome} from './src/jueony/chrome-2024.ts';

const ids=['insert:comment','insert:para-band'];
const context={hasDocument:true,hasSelection:false,hasCopiedFormat:false,inTable:false,inCellSelectionMode:false,hasMultiCellSelection:false,hasTableTransposeClipboard:false,inTableObjectSelection:false,inPictureObjectSelection:false,inField:false,isEditable:true,editMode:'normal',isFormMode:false,canEditFormField:false,canUndo:false,canRedo:false,zoom:1,showControlCodes:false,showParagraphMarks:false,isDirty:false,sourceFormat:'hwpx'};
let writes=0,executeCalls=0,dispatchCalls=0,commandStateEvents=0;
const wasm=new Proxy({fileName:'N019.hwpx',getStyleList:()=>[]},{get(target,key){if(key in target)return target[key];return()=>{writes+=1;throw new Error('unexpected native write: '+String(key));};}});
const eventBus=new EventBus();eventBus.on('command-state-changed',()=>{commandStateEvents+=1;});
const services={eventBus,wasm,documentState:{isDirty:()=>false},getContext:()=>context,getInputHandler:()=>null,getViewportManager:()=>null,gotoPage:()=>false,refreshDocumentStatus:()=>{},setEditMode:()=>{}};
const registry=new CommandRegistry();registry.registerAll(insertCommands);
for(const id of ids){const def=registry.get(id);registry.register({...def,execute:(...args)=>{executeCalls+=1;return def.execute(...args);}});}
const dispatcher=new CommandDispatcher(registry,services,eventBus);const dispatch=dispatcher.dispatch.bind(dispatcher);dispatcher.dispatch=(...args)=>{dispatchCalls+=1;return dispatch(...args);};

const menu=document.createElement('div');menu.id='menu-bar';
for(const name of ['file','edit','view','insert','format','page','table','tool']){const item=document.createElement('div');item.className='menu-item';item.dataset.menu=name;const title=document.createElement('button');title.className='menu-title';title.textContent=name;item.append(title);if(name==='insert'){for(const id of ids){const row=document.createElement('div');row.className='md-item';row.dataset.cmd=id;row.textContent=id;item.append(row);}}menu.append(item);}document.body.append(menu);
for(const id of ['icon-toolbar','style-bar','editor-area','status-bar']){const element=document.createElement('div');element.id=id;document.body.append(element);}const style=document.createElement('select');style.id='style-name';document.getElementById('style-bar').append(style);document.title='N019';

const menuBar=new MenuBar(menu,eventBus,dispatcher,registry);menu.querySelector('[data-menu="insert"] .menu-title').dispatchEvent(new MouseEvent('mousedown',{bubbles:true}));
const menuState=ids.map(id=>({id,disabled:menu.querySelector('[data-cmd="'+id+'"]').classList.contains('disabled')}));
for(const id of ids)menu.querySelector('[data-cmd="'+id+'"]').dispatchEvent(new MouseEvent('click',{bubbles:true}));
const direct=ids.map(id=>({id,enabled:dispatcher.isEnabled(id),result:dispatcher.dispatchWithResult(id)}));

const contextMenu=new ContextMenu(dispatcher,registry);contextMenu.show(4,4,ids.map(commandId=>({type:'command',commandId})));
const contextState=ids.map(id=>{const row=document.querySelector('.context-menu [data-cmd="'+id+'"]');return{id,disabled:row.classList.contains('disabled'),ariaDisabled:row.getAttribute('aria-disabled')};});
for(const id of ids)document.querySelector('.context-menu [data-cmd="'+id+'"]').dispatchEvent(new MouseEvent('click',{bubbles:true}));contextMenu.hide();

const chromeCommands=new Set(['file:new-doc','file:open','file:save','file:save-as','edit:undo','edit:redo','edit:paste','edit:cut','edit:copy','edit:format-copy','edit:delete','edit:select-all','edit:find','edit:find-replace','edit:goto','insert:image','table:create','insert:shape','insert:textbox','insert:equation','insert:symbols','insert:hyperlink','insert:bookmark','insert:footnote','insert:endnote','page:header-create','page:footer-create','format:style-dialog']);
const automation={listCommands:()=>[...chromeCommands].map(id=>({id,label:id,canExecute:()=>true})),execute:(id)=>({ok:false,reason:'disabled'}),isEnabled:()=>false,getContext:()=>context,registerCommand:()=>{},addMenuItem:()=>{}};
installHangulChrome({wasm,eventBus,documentState:services.documentState,automation});
menu.querySelector('[data-menu="insert"] .j-tab').dispatchEvent(new MouseEvent('click',{bubbles:true}));
const chromeState={ribbon:ids.map(id=>Boolean(document.querySelector('#jueony-ribbon [data-j-command="'+id+'"]'))),quick:ids.map(id=>Boolean(document.querySelector('.j-quick-access [data-j-command="'+id+'"]')))};

globalThis.__n019={menuState,direct,contextState,chromeState,counters:()=>({writes,executeCalls,dispatchCalls,commandStateEvents})};
`;

async function removeWithRetry(path: string): Promise<void> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try { await rm(path, { recursive: true, force: true }); return; }
    catch (error: any) {
      if (!['EBUSY', 'EPERM'].includes(error?.code) || attempt === 4) throw error;
      await new Promise(resolveDelay => setTimeout(resolveDelay, 100 * (attempt + 1)));
    }
  }
}

test('N019 Studio surfaces and dispatcher keep unsupported insert placeholders disabled', { timeout: 60_000 }, async () => {
  await access(edge); await access(resolve(studio, 'src/command/commands/insert.ts'));
  const output = await mkdtemp(join(tmpdir(), 'jueony-n019-bundle-'));
  const profile = await mkdtemp(join(tmpdir(), 'jueony-n019-edge-'));
  const pageErrors: string[] = [], consoleErrors: string[] = [], externalRequests: string[] = [], missingResources: string[] = [];
  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | undefined;
  let server: ReturnType<typeof createServer> | undefined;
  try {
    await writeFile(fixtureHtml, '<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>N019</title></head><body><script type="module" src="./' + fixtureName + '.ts"></script></body></html>');
    await writeFile(fixtureSource, fixture);
    await viteBuild({
      root: studio, configFile: false, logLevel: 'silent', resolve: { alias: { '@': resolve(studio, 'src') } },
      plugins: [{
        name: 'n019-command-seam', enforce: 'pre',
        resolveId(source) { return source.endsWith('/jueony/shortcuts/insert-placeholder-capability-n019.ts') ? resolve(app, 'src/shortcuts/insert-placeholder-capability-n019.ts') : undefined; },
        transform(code, id) { return /[\\/]src[\\/]command[\\/]commands[\\/]insert\.ts$/u.test(id) ? patchInsertPlaceholderCommandsN019(code) : undefined; },
      }],
      build: { outDir: output, emptyOutDir: true, rollupOptions: { input: { n019: fixtureHtml } } },
    });
    const emitted = await readdir(output), builtHtml = emitted.find(value => value === `${fixtureName}.html`) ?? emitted.find(value => value === 'n019.html');
    assert.ok(builtHtml, `Vite did not emit N019 fixture: ${emitted.join(', ')}`);
    server = createServer(async (request, response) => {
      try {
        const relative = decodeURIComponent(new URL(request.url ?? '/', 'http://127.0.0.1').pathname).replace(/^\/+/, '') || builtHtml;
        const file = resolve(output, relative); if (!file.startsWith(output + sep)) { response.writeHead(403).end(); return; }
        const body = await readFile(file), type = extname(file) === '.html' ? 'text/html; charset=utf-8' : extname(file) === '.js' ? 'text/javascript; charset=utf-8' : 'application/octet-stream';
        response.writeHead(200, { 'content-type': type, 'cache-control': 'no-store' }).end(body);
      } catch { missingResources.push(request.url ?? '/'); response.writeHead(404).end(); }
    });
    await new Promise<void>((accept, reject) => { server!.once('error', reject); server!.listen(0, '127.0.0.1', accept); });
    const address = server.address(); assert.ok(address && typeof address !== 'string'); const origin = `http://127.0.0.1:${address.port}`;
    browser = await puppeteer.launch({ executablePath: edge, headless: true, userDataDir: profile, protocolTimeout: 120_000, args: ['--no-first-run','--disable-background-networking','--disable-component-update','--disable-default-apps','--disable-features=OptimizationHints,MediaRouter','--disable-sync','--metrics-recording-only'] });
    const page = await browser.newPage(); page.on('pageerror', error => pageErrors.push(String(error))); page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
    await page.setRequestInterception(true); page.on('request', request => { const url = request.url(); if (url.startsWith(`${origin}/`) || /^(data:|blob:)/u.test(url)) void request.continue(); else { externalRequests.push(url); void request.abort(); } });
    await page.goto(`${origin}/${encodeURIComponent(builtHtml)}`, { waitUntil: 'domcontentloaded' });
    try { await page.waitForFunction(() => Boolean((globalThis as any).__n019), { timeout: 10_000 }); }
    catch (error) { throw new Error(`${String(error)}; page=${pageErrors.join(' | ')}; console=${consoleErrors.join(' | ')}; missing=${missingResources.join(' | ')}`); }
    const result = await page.evaluate(() => ({ ...(globalThis as any).__n019, counters: (globalThis as any).__n019.counters() }));
    assert.deepEqual(result.menuState, [{ id:'insert:comment', disabled:true }, { id:'insert:para-band', disabled:true }]);
    assert.deepEqual(result.direct, commandIds.map(id => ({ id, enabled:false, result:{ ok:false, reason:'disabled' } })));
    assert.deepEqual(result.contextState, commandIds.map(id => ({ id, disabled:true, ariaDisabled:'true' })));
    assert.deepEqual(result.chromeState, { ribbon:[false,false], quick:[false,false] });
    assert.deepEqual(result.counters, { writes:0, executeCalls:0, dispatchCalls:0, commandStateEvents:0 });
    assert.deepEqual(pageErrors, []); assert.deepEqual(consoleErrors, []); assert.deepEqual(externalRequests, []); assert.deepEqual(missingResources, []);
  } finally {
    await browser?.close().catch(() => {}); if (server) await new Promise<void>(accept => server!.close(() => accept()));
    await Promise.all([rm(fixtureHtml, { force:true }), rm(fixtureSource, { force:true }), removeWithRetry(output), removeWithRetry(profile)]);
  }
});
