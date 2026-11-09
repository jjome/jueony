import test from 'node:test';
import assert from 'node:assert/strict';
import {access, mkdtemp, readdir, readFile, rm, writeFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {tmpdir} from 'node:os';
import {extname, join, resolve, sep} from 'node:path';
import puppeteer from 'puppeteer-core';
import {build as viteBuild} from 'vite';

const app = resolve(import.meta.dirname, '..');
const studio = resolve(app, '.build/studio');
const edge = process.env.JUEONY_TEST_BROWSER ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const fixtureName = `__stored-character-style-browser-n012-${process.pid}`;
const fixtureHtml = resolve(studio, `${fixtureName}.html`);
const fixtureSource = resolve(studio, `${fixtureName}.ts`);

const fixture = String.raw`
import init,{HwpDocument} from '../../node_modules/@rhwp/core/rhwp.js';
import wasmUrl from '../../node_modules/@rhwp/core/rhwp_bg.wasm?url';
import {Toolbar} from './src/ui/toolbar.ts';
import {InputHandler} from './src/engine/input-handler.ts';

await init({module_or_path:wasmUrl});
const parse=value=>typeof value==='string'?JSON.parse(value):value;
const equal=(a,b)=>a.length===b.length&&a.every((value,index)=>value===b[index]);
const state={document:null,format:'hwpx',styleId:-1,selection:null,position:null,dispatches:[],lastDispatch:null,transactions:0,writes:0,history:null,pendingBefore:null,race:false};
const bridge={
  borrowDocumentHandle:()=>state.document,
  getStyleList:()=>parse(state.document.getStyleList()),
  getStyleDetail:id=>parse(state.document.getStyleDetail(id)),
  getSectionCount:()=>state.document.getSectionCount(),
  getParagraphCount:section=>state.document.getParagraphCount(section),
  getParagraphLength:(section,paragraph)=>state.document.getParagraphLength(section,paragraph),
  setCharShapeRuns:(section,paragraph,start,end,runs)=>{state.writes+=1;return state.document.setCharShapeRuns(section,paragraph,start,end,JSON.stringify(runs));},
};
const cursor={isInHeaderFooter:()=>false,isInFootnote:()=>false,isInTextBox:()=>false,isInCellSelectionMode:()=>false,isInTableObjectSelection:()=>false,isInPictureObjectSelection:()=>false};
const handler=Object.create(InputHandler.prototype);
handler.wasm=bridge;handler.cursor=cursor;
handler.getSelection=()=>state.selection;
handler.getPosition=()=>state.position;
handler.executeOperation=descriptor=>{
  state.transactions+=1;
  const before=state.pendingBefore;
  if(!before)throw new Error('pre-operation snapshot missing');
  state.pendingBefore=null;
  if(state.race){state.race=false;state.document.updateStyle(state.styleId,JSON.stringify({name:'경합 변경',englishName:'RaceChanged',type:1,nextStyleId:0}));}
  const result=descriptor.operation(bridge);
  const after=bytes();
  state.history={before,after};
  return result;
};
const services={getInputHandler:()=>handler,wasm:bridge};
const dispatcher={dispatch:(id,params)=>{
  state.dispatches.push({id,params});
  try{
    if(id!=='format:apply-style')throw new Error('unexpected command '+id);
    state.pendingBefore=bytes();
    handler.applyStyle(params?.styleId);
    state.lastDispatch={ok:true};
  }catch(error){state.lastDispatch={ok:false,error:String(error?.message??error)};}
}};
const select=document.createElement('select');select.id='style-name';select.setAttribute('aria-label','스타일');document.body.append(select);
const toolbar=Object.create(Toolbar.prototype);toolbar.styleName=select;toolbar.wasm=bridge;toolbar.dispatcher=dispatcher;toolbar.styleDropdownInitialized=false;toolbar.setupStyleDropdown();

function bytes(){return state.document[state.format==='hwp'?'exportHwp':'exportHwpx']();}
function replaceDocument(value){state.document?.free();state.document=new HwpDocument(value);}
function createCharacterStyle(document){
  const properties={bold:true,italic:true,fontSize:1733,textColor:'#225588',shadeColor:'#ddecfa',ratios:[93,93,93,93,93,93,93],spacings:[7,7,7,7,7,7,7]};
  const inserted=parse(document.insertParagraph(0,document.getParagraphCount(0)-1));
  if(inserted.ok!==true)throw new Error('temporary paragraph failed');
  if(parse(document.insertText(0,inserted.paraIdx,0,'가')).ok!==true)throw new Error('temporary text failed');
  if(parse(document.applyCharFormat(0,inserted.paraIdx,0,1,JSON.stringify(properties))).ok!==true)throw new Error('temporary format failed');
  const charShapeId=parse(document.getCharPropertiesAt(0,inserted.paraIdx,0)).charShapeId;
  const styleId=document.createStyle(JSON.stringify({name:'검증 글자 스타일',englishName:'VerifiedCharacter',type:1,nextStyleId:0,baseCharShapeId:charShapeId}));
  if(!document.updateStyleShapes(styleId,JSON.stringify(properties),'{}'))throw new Error('character style shape update failed');
  if(parse(document.deleteParagraph(0,inserted.paraIdx)).ok!==true)throw new Error('temporary paragraph cleanup failed');
  return{styleId,charShapeId};
}
function setup(format){
  state.document?.free();state.document=HwpDocument.createEmpty();state.document.createBlankDocument();state.document.insertText(0,0,0,'가나다라마바사아');
  state.format=format;const created=createCharacterStyle(state.document);state.styleId=created.styleId;
  state.selection={start:{sectionIndex:0,paragraphIndex:0,charOffset:0},end:{sectionIndex:0,paragraphIndex:0,charOffset:4}};
  state.position={sectionIndex:0,paragraphIndex:0,charOffset:4};state.dispatches=[];state.lastDispatch=null;state.transactions=0;state.writes=0;state.history=null;state.pendingBefore=null;state.race=false;
  toolbar.initStyleDropdown();
  return{styleId:state.styleId,option:[...select.options].find(option=>Number(option.value)===state.styleId)?.textContent??''};
}
function inspect(){
  const selected=parse(state.document.getCharPropertiesAt(0,0,1));
  const outside=parse(state.document.getCharPropertiesAt(0,0,6));
  return{selected:{bold:selected.bold,textColor:selected.textColor,charShapeId:selected.charShapeId},outside:{bold:outside.bold,textColor:outside.textColor,charShapeId:outside.charShapeId},dispatches:structuredClone(state.dispatches),lastDispatch:state.lastDispatch,transactions:state.transactions,writes:state.writes};
}
function undo(){if(!state.history)throw new Error('history missing');const expected=state.history.before;replaceDocument(expected);return equal(bytes(),expected);}
function redo(){if(!state.history)throw new Error('history missing');const expected=state.history.after;replaceDocument(expected);return equal(bytes(),expected);}
function reopen(){const saved=bytes(),document=new HwpDocument(saved);try{const selected=parse(document.getCharPropertiesAt(0,0,1)),outside=parse(document.getCharPropertiesAt(0,0,6));return{text:document.getTextRange(0,0,0,document.getParagraphLength(0,0)),selected:{bold:selected.bold,textColor:selected.textColor,charShapeId:selected.charShapeId},outside:{bold:outside.bold,textColor:outside.textColor,charShapeId:outside.charShapeId},style:parse(document.getStyleList()).find(value=>value.id===state.styleId)};}finally{document.free();}}
function makeAmbiguous(){const detail=parse(state.document.getStyleList()).find(value=>value.id===state.styleId);state.document.createStyle(JSON.stringify({name:'중복 모양 스타일',englishName:'DuplicateShape',type:1,nextStyleId:0,baseCharShapeId:detail.charShapeId}));}
function enableRace(){state.race=true;}
globalThis.__n012={setup,inspect,undo,redo,reopen,makeAmbiguous,enableRace};
`;

const removeWithRetry = async (path: string) => {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {await rm(path, {recursive: true, force: true}); return;}
    catch (error: any) {
      if (!['EBUSY', 'EPERM'].includes(error?.code) || attempt === 4) throw error;
      await new Promise(resolveDelay => setTimeout(resolveDelay, 100 * (attempt + 1)));
    }
  }
};

test('N012 native style dropdown applies a stored character style through the real command boundary', {timeout: 120_000}, async () => {
  await access(edge);
  await access(resolve(studio, 'src/engine/input-handler.ts'));
  const output = await mkdtemp(join(tmpdir(), 'jueony-n012-dialog-bundle-'));
  const profile = await mkdtemp(join(tmpdir(), 'jueony-n012-dialog-edge-'));
  const pageErrors: string[] = [], consoleErrors: string[] = [], externalRequests: string[] = [], missingResources: string[] = [];
  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | undefined;
  let server: ReturnType<typeof createServer> | undefined;
  try {
    await writeFile(fixtureHtml, '<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>N012 style UI</title></head><body><script type="module" src="./' + fixtureName + '.ts"></script></body></html>');
    await writeFile(fixtureSource, fixture);
    await viteBuild({root: studio, configFile: false, logLevel: 'silent', resolve: {alias: {'@': resolve(studio, 'src')}}, build: {outDir: output, emptyOutDir: true, rollupOptions: {input: {n012: fixtureHtml}}}});
    const emitted = await readdir(output), builtHtml = emitted.find(value => value === `${fixtureName}.html`) ?? emitted.find(value => value === 'n012.html');
    assert.ok(builtHtml, `Vite did not emit the N012 fixture HTML: ${emitted.join(', ')}`);
    server = createServer(async (request, response) => {
      try {
        const relative = decodeURIComponent(new URL(request.url ?? '/', 'http://127.0.0.1').pathname).replace(/^\/+/, '') || builtHtml;
        const file = resolve(output, relative);
        if (!file.startsWith(output + sep)) {response.writeHead(403).end(); return;}
        const body = await readFile(file), type = extname(file) === '.html' ? 'text/html; charset=utf-8' : extname(file) === '.js' ? 'text/javascript; charset=utf-8' : extname(file) === '.wasm' ? 'application/wasm' : 'application/octet-stream';
        response.writeHead(200, {'content-type': type, 'cache-control': 'no-store'}).end(body);
      } catch {missingResources.push(request.url ?? '/'); response.writeHead(404).end();}
    });
    await new Promise<void>((accept, reject) => {server!.once('error', reject); server!.listen(0, '127.0.0.1', accept);});
    const address = server.address();assert.ok(address && typeof address !== 'string');const origin = `http://127.0.0.1:${address.port}`;
    browser = await puppeteer.launch({executablePath: edge, headless: true, userDataDir: profile, protocolTimeout: 120_000, args: ['--no-first-run','--disable-background-networking','--disable-component-update','--disable-default-apps','--disable-features=OptimizationHints,MediaRouter','--disable-sync','--metrics-recording-only']});
    const page = await browser.newPage();page.on('pageerror', error => pageErrors.push(String(error)));page.on('console', message => {if(message.type()==='error')consoleErrors.push(message.text());});
    await page.setRequestInterception(true);page.on('request', request => {const url=request.url();if(url.startsWith(`${origin}/`)||/^(data:|blob:)/u.test(url))void request.continue();else{externalRequests.push(url);void request.abort();}});
    await page.goto(`${origin}/${encodeURIComponent(builtHtml)}`, {waitUntil: 'domcontentloaded'});await page.waitForFunction(() => Boolean((globalThis as any).__n012), {timeout: 30_000});

    for (const format of ['hwp','hwpx']) {
      const setup = await page.evaluate(format => (globalThis as any).__n012.setup(format), format);
      assert.equal(setup.option, '검증 글자 스타일');
      await page.select('#style-name', String(setup.styleId));
      let result = await page.evaluate(() => (globalThis as any).__n012.inspect());
      assert.deepEqual(result.dispatches, [{id:'format:apply-style',params:{styleId:setup.styleId}}], format);
      assert.deepEqual(result.lastDispatch, {ok:true}, format);assert.equal(result.transactions, 1, format);assert.equal(result.writes, 1, format);
      assert.equal(result.selected.bold, true, format);assert.equal(result.selected.textColor, '#225588', format);assert.equal(result.outside.bold, false, format);
      assert.equal(await page.evaluate(() => (globalThis as any).__n012.undo()), true, format+' undo exact bytes');
      result = await page.evaluate(() => (globalThis as any).__n012.inspect());assert.equal(result.selected.bold, false, format);
      assert.equal(await page.evaluate(() => (globalThis as any).__n012.redo()), true, format+' redo exact bytes');
      const reopened = await page.evaluate(() => (globalThis as any).__n012.reopen());assert.equal(reopened.text, '가나다라마바사아', format);assert.equal(reopened.selected.bold, true, format);assert.equal(reopened.selected.textColor, '#225588', format);assert.equal(reopened.outside.bold, false, format);assert.equal(reopened.style.type, 1, format);
    }

    let setup = await page.evaluate(() => {const api=(globalThis as any).__n012,value=api.setup('hwpx');api.makeAmbiguous();return value;});
    await page.select('#style-name', String(setup.styleId));
    let blocked = await page.evaluate(() => (globalThis as any).__n012.inspect());assert.equal(blocked.lastDispatch.ok, false);assert.equal(blocked.transactions, 0);assert.equal(blocked.writes, 0);assert.equal(blocked.selected.bold, false);

    setup = await page.evaluate(() => {const api=(globalThis as any).__n012,value=api.setup('hwpx');api.enableRace();return value;});
    await page.select('#style-name', String(setup.styleId));
    blocked = await page.evaluate(() => (globalThis as any).__n012.inspect());assert.equal(blocked.lastDispatch.ok, false);assert.equal(blocked.transactions, 1);assert.equal(blocked.writes, 0);assert.equal(blocked.selected.bold, false);

    assert.deepEqual(pageErrors, []);assert.deepEqual(consoleErrors, []);assert.deepEqual(externalRequests, []);assert.deepEqual(missingResources, []);
  } finally {
    await browser?.close().catch(() => {});if(server)await new Promise<void>(accept => server!.close(() => accept()));
    await Promise.all([rm(fixtureHtml,{force:true}),rm(fixtureSource,{force:true}),removeWithRetry(output),removeWithRetry(profile)]);
  }
});
