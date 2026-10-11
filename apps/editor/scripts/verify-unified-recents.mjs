import puppeteer from 'puppeteer-core';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile, realpath, mkdtemp } from 'node:fs/promises';
import { resolve, extname, sep, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import init, { HwpDocument } from '@rhwp/core';

const app = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = await realpath(process.env.JUEONY_PARITY_DIST ?? resolve(app, 'evidence/dist-continuation'));
const output = resolve(app, 'evidence/unified-recents');
const port = Number(process.env.JUEONY_PARITY_PORT ?? 4211);
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
  const fixture = text => { const doc=HwpDocument.createEmpty(); doc.createBlankDocument(); doc.insertText(0,0,0,text); try{return [...doc.exportHwpx()];}finally{doc.free();} };
  const markerA='최근 문서 원문 A 7142',markerB='최근 문서 원문 B 9385',markerB2='최근 문서 최신 B 3026';
  const name='같은이름.hwpx';
  await page.goto(`http://127.0.0.1:${port}/`);
  await page.waitForFunction(()=>document.querySelector('.editor-frame:not([hidden])')?.contentWindow?.jueonyEditor?.snapshot&&document.getElementById('app-status')?.textContent.includes('준비 완료'),{timeout:60000});
  await page.evaluate(async ({a,b,name})=>{
    const root=await navigator.storage.getDirectory(),handles={};
    for(const [key,bytes] of [['a',a],['b',b]]){const directory=await root.getDirectoryHandle('recent-test-'+key,{create:true});const handle=await directory.getFileHandle(name,{create:true});const out=await handle.createWritable();await out.write(new Uint8Array(bytes));await out.close();handles[key]=handle;}
    window.__recentTestHandles=handles;
    window.showOpenFilePicker=async()=>[window.__recentTestHandles[window.__recentTestPick??'a']];
  },{a:fixture(markerA),b:fixture(markerB),name});
  const currentText=()=>page.evaluate(()=>document.querySelector('.editor-frame:not([hidden])').contentWindow.jueonyEditor.snapshot().nodes.map(n=>n.text).join('\n'));
  const waitText=text=>page.waitForFunction(text=>{try{return document.querySelector('.editor-frame:not([hidden])').contentWindow.jueonyEditor.snapshot().nodes.some(n=>n.text.includes(text));}catch{return false;}},{timeout:30000},text);
  const rows=()=>page.evaluate(()=>new Promise((resolve,reject)=>{const request=indexedDB.open('rhwpStudioRecent',1);request.onerror=()=>reject(request.error);request.onsuccess=()=>{const db=request.result;const tx=db.transaction('recent','readonly');const get=tx.objectStore('recent').getAll();get.onsuccess=()=>{db.close();resolve(get.result.map(r=>({id:r.id,fileName:r.fileName,hasHandle:Boolean(r.handle)})));};get.onerror=()=>{db.close();reject(get.error);};};}));
  await page.click('#open-document');await waitText(markerA);
  await page.evaluate(()=>window.__recentTestPick='b');await page.click('#open-document');await waitText(markerB);
  let records;for(let i=0;i<100;i++){records=(await rows()).filter(r=>r.fileName===name);if(records.length===2&&records.every(r=>r.hasHandle))break;await new Promise(r=>setTimeout(r,50));}
  assert.equal(records.length,2);assert.ok(records.every(r=>r.hasHandle));assert.notEqual(records[0].id,records[1].id);
  checks.push('Host file-open creates two distinct recent-store IDs with serialized OPFS handles for same-name files');
  const blank=async()=>{const count=await page.$$('.editor-frame');await page.click('#new-document');await page.waitForFunction(n=>document.querySelectorAll('.editor-frame').length>n,{},count.length);await page.waitForFunction(()=>{try{const f=document.querySelector('.editor-frame:not([hidden])');return f.contentDocument.documentElement.dataset.unifiedChrome==='true'&&f.contentWindow.jueonyEditor.snapshot().nodes.every(n=>!n.text);}catch{return false;}},{timeout:60000});};
  const openRecent=async key=>{
    const id=await page.evaluate(async key=>{
      const entries=await new Promise((resolve,reject)=>{const r=indexedDB.open('rhwpStudioRecent',1);r.onerror=()=>reject(r.error);r.onsuccess=()=>{const db=r.result;const q=db.transaction('recent','readonly').objectStore('recent').getAll();q.onsuccess=()=>{db.close();resolve(q.result);};q.onerror=()=>{db.close();reject(q.error);};};});
      for(const row of entries)if(row.handle&&await row.handle.isSameEntry(window.__recentTestHandles[key]))return row.id;
      throw new Error('Recent ID not found for '+key);
    },key);
    await page.click('#unified-menus > details:first-child > summary');
    await page.waitForFunction(()=>document.querySelector('#unified-menus > details:first-child')?.open&&document.querySelectorAll('#unified-menus [data-editor-command="file:open-recent"]').length>=2);
    const index=await page.evaluate(id=>{
      const api=document.querySelector('.editor-frame:not([hidden])').contentWindow.jueonyEditor;
      const entries=[];const visit=nodes=>{for(const n of nodes){if(n.commandId==='file:open-recent')entries.push(n);if(n.submenu)visit(n.submenu);}};for(const menu of api.menus())visit(menu.items);
      const i=entries.findIndex(n=>n.params?.id===id);if(i<0)throw new Error('Menu lost the record ID');
      const buttons=[...document.querySelectorAll('#unified-menus [data-editor-command="file:open-recent"]')];
      for(let p=buttons[i].parentElement;p&&p.id!=='unified-menus';p=p.parentElement)if(p.tagName==='DETAILS')p.open=true;
      return i;
    },id);
    const buttons=await page.$$('#unified-menus [data-editor-command="file:open-recent"]');await buttons[index].click();
  };
  await blank();await openRecent('a');await waitText(markerA);assert.equal(await currentText(),markerA);
  assert.equal(await page.evaluate(async()=>document.querySelector('.editor-frame:not([hidden])').contentWindow.jueonyEditor.fileHandle().isSameEntry(window.__recentTestHandles.a)),true);
  checks.push('Opening the unified File menu refreshes records and recent item A reopens its exact original text and handle');
  await page.evaluate(async bytes=>{const stream=await window.__recentTestHandles.b.createWritable();await stream.write(new Uint8Array(bytes));await stream.close();},fixture(markerB2));
  await blank();await openRecent('b');await waitText(markerB2);assert.equal(await currentText(),markerB2);
  assert.equal(await page.evaluate(async()=>document.querySelector('.editor-frame:not([hidden])').contentWindow.jueonyEditor.fileHandle().isSameEntry(window.__recentTestHandles.b)),true);
  checks.push('The other same-name recent item resolves its own ID and reads the changed live file, not a cached snapshot or item A');
  const missing=await page.evaluate(()=>document.querySelector('.editor-frame:not([hidden])').contentWindow.jueonyEditor.executeCommand('file:open-recent'));
  assert.equal(missing.ok,false);assert.match(missing.message,/식별자/);assert.equal(await currentText(),markerB2);
  checks.push('Missing recent ID returns an explicit failure without changing the current document');
  await page.screenshot({path:resolve(output,'same-name-reopened.png'),fullPage:true});
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);assert.equal(hash(await readFile(resolve(dist,'editor.html'))),initialBuildHash);
  const result={passed:checks.length,checks,errors,external,port,editorHtmlSha256:initialBuildHash,limitation:'Uses synthetic OPFS handles in a fresh headless Edge profile; native OS file-picker permissions are not exercised.'};
  await writeFile(resolve(output,'results.json'),JSON.stringify(result,null,2));
  const evidence=resolve(app,'../../docs/evidence/continuation-2026-10-11/behavior');await mkdir(evidence,{recursive:true});await writeFile(resolve(evidence,'unified-recents-results.json'),JSON.stringify(result,null,2));
  console.log(JSON.stringify({passed:checks.length,checks}));
} catch(error){if(page)await page.screenshot({path:resolve(output,'failure.png'),fullPage:true}).catch(()=>{});await writeFile(resolve(output,'failure.json'),JSON.stringify({completed:checks,error:String(error),errors,external},null,2));throw error;}
finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
