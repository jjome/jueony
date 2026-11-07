import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, mkdtemp } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
import puppeteer from 'puppeteer-core';
import { loadReviewEngine, hash } from './lib/hancom-review.mjs';
const repo = resolve(import.meta.dirname, '../../..'), port = Number(process.env.JUEONY_TEST_PORT ?? 4504), origin = `http://127.0.0.1:${port}`, out = resolve(process.env.JUEONY_TEST_OUTPUT ?? resolve(repo, 'build/table-date-fill'));
await mkdir(out, { recursive: true }); const engine = await loadReviewEngine(process.env.JUEONY_ENGINE_PACKAGE), { HwpDocument } = engine;
const results = [], failures = [], pageErrors = [], external = []; let browser, page, server;
async function services() { const f = await (await page.$('.editor-frame:not([hidden])')).contentFrame(); await f.evaluate(() => { if (window.__dateServices) return; const a = window.rhwpStudio.automation; a.registerCommand({ id: 'ext:date-fill-review', label: '날짜 검수', canExecute: () => true, execute: s => window.__dateServices = s }); a.execute('ext:date-fill-review'); a.unregisterCommand('ext:date-fill-review'); }); return f; }
async function open(ext = 'hwpx', seeds = ['2026-01-31', '2026-02-28'], formula = false,storedField=false,matrix=false) {
  const d = HwpDocument.createEmpty(); d.createBlankDocument();
  const row = formula ? 1 : 0, first = row * 4, t = JSON.parse(d.createTable(0, 0, 0, matrix?3:row + 1, 4));
  const contents = matrix?['1','3','13','7','4','6','21','12','5','6','8','9']:formula ? ['2', '4', '6', '8', ...seeds, '기존', '원문'] : [...seeds, '기존', '원문'];
  contents.forEach((v, c) => d.insertTextInCell(0, t.paraIdx, t.controlIdx, c, 0, 0, v));
  if(storedField)d.insertTableFormulaField(0,t.paraIdx,t.controlIdx,first,seeds[0],'=A1*2','%.2f');
  d.applyCharFormatInCell(0, t.paraIdx, t.controlIdx, first + 2, 0, 0, 2, '{"bold":true}');
  const bytes = [...d[ext === 'hwp' ? 'exportHwp' : 'exportHwpx']()]; d.free();
  const f = await services();
  await f.evaluate(async (bytes, ext, t, row, first,matrix) => {
    const root = await navigator.storage.getDirectory(), handle = await root.getFileHandle('auto-fill.' + ext, { create: true }), w = await handle.createWritable();
    await w.write(new Uint8Array(bytes)); await w.close();
    await window.jueonyEditor.open(new Uint8Array(bytes), 'auto-fill.' + ext, handle, false);
    const s = window.__dateServices, ih = s.getInputHandler();
    ih.cursor.moveTo({ sectionIndex: 0, paragraphIndex: 0, charOffset: 0, parentParaIndex: t.paraIdx, controlIndex: t.controlIdx, cellIndex: first, cellParaIndex: 0, cellPath: [{ controlIndex: t.controlIdx, cellIndex: first, cellParaIndex: 0 }] });
    ih.cursor.enterCellSelectionMode(); ih.cursor.advanceCellSelectionPhase(); ih.cursor.setCellSelectionFocus(matrix?2:row, 3); ih.updateCellSelection(); ih.focus(); s.eventBus.emit('command-state-changed');
  }, bytes, ext, t, row, first,matrix);
  return f;
}
const capture = f => f.evaluate(() => { const s = window.__dateServices, ih = s.getInputHandler(); return { bytes: [...s.wasm.exportHwp()], revision: window.jueonyEditor.revision(), history: ih.history.peekUndoTop()?.type ?? null, block: ih.cursor.captureCellSelection() }; });
const command = async (f, id) => { const r = await f.evaluate(id => window.jueonyEditor.executeCommand(id), id); assert.equal(r.ok, true, JSON.stringify(r)); };
const values = f => f.evaluate(() => window.jueonyEditor.snapshot().structure.tables[0].cells.map(c => c.text));
async function dialog(f, unit = 'months') { await command(f, 'table:auto-fill-integers'); await f.waitForSelector('[data-jueony-table-auto-fill]'); await f.select('[aria-label="날짜 채우기 간격"]', unit); }
async function scenario(name, action) { try { await action(); results.push({ name, status: 'PASS' }); console.log('PASS', name); } catch (error) { failures.push({ name, error: String(error), stack: error.stack }); console.log('FAIL', name, String(error)); await page.screenshot({ path: resolve(out, `failure-${failures.length}.png`) }).catch(() => {}); const f = await services(); await f.evaluate(() => document.querySelectorAll('.modal-overlay .dialog-close').forEach(b => b.click())).catch(() => {}); } }
try {
  if (await fetch(origin + '/api/health').then(() => true, () => false)) throw new Error('Port occupied');
  server = spawn(process.execPath, ['apps/launcher/server.mjs'], { cwd: repo, windowsHide: true, stdio: 'ignore', env: { ...process.env, JUEONY_PORT: String(port), JUEONY_DIST: process.env.JUEONY_TEST_DIST, JUEONY_CONNECTION_STORE: 'memory' } });
  for (let i = 0; i < 100; i++) { if (await fetch(origin + '/api/health').then(r => r.ok, () => false)) break; await new Promise(r => setTimeout(r, 100)); }
  browser = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', userDataDir: await mkdtemp(resolve(repo, 'build/date-fill-browser-')), headless: true, args: ['--no-first-run', '--disable-background-networking'], defaultViewport: { width: 1600, height: 1000 } });
  page = await browser.newPage(); page.setDefaultTimeout(10000); page.on('pageerror', e => pageErrors.push(String(e))); page.on('dialog', d => void d.accept()); await page.setRequestInterception(true); page.on('request', r => { if (![origin, 'data:', 'blob:'].some(p => r.url().startsWith(p))) { external.push(r.url()); void r.abort(); } else void r.continue(); }); await page.goto(origin); await page.waitForFunction(() => document.getElementById('app-status')?.textContent.includes('준비 완료'), { timeout: 90000 });
  for (const ext of ['hwp', 'hwpx']) for (const [unit, expected] of [['days', ['2024-02-28', '2024-02-29', '2024-03-01', '2024-03-02']], ['months', ['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30']], ['years', ['2024-02-29', '2025-02-28', '2026-02-28', '2027-02-28']]]) await scenario(`${ext}/${unit}: preview, fill, one undo/redo and formatted safe save/reopen`, async () => { const f = await open(ext, expected.slice(0, 2)), before = await capture(f); await dialog(f, unit); assert.ok((await f.$eval('[data-jueony-table-auto-fill]', e => e.textContent)).includes(expected[2])); await f.click('.modal-overlay .dialog-btn-primary'); await f.waitForSelector('[data-jueony-table-auto-fill]', { hidden: true }); assert.deepEqual(await values(f), expected); const after = await capture(f); await command(f, 'edit:undo'); assert.deepEqual((await capture(f)).bytes, before.bytes); await command(f, 'edit:redo'); assert.deepEqual((await capture(f)).bytes, after.bytes); const bytes = await f.evaluate(async () => { if (await window.jueonyEditor.save() !== 'saved') throw new Error('save refused'); return [...new Uint8Array(await (await window.jueonyEditor.fileHandle().getFile()).arrayBuffer())]; }); const name = resolve(out, `${unit}.${ext}`); await writeFile(name, new Uint8Array(bytes)); const reopened = new HwpDocument(new Uint8Array(await readFile(name))); try { const table = JSON.parse(reopened.getControls()).find(c => c.type === 'table'); const at = await f.evaluate(() => window.jueonyEditor.snapshot().structure.tables[0]); for (let c = 0; c < 4; c++) assert.equal(reopened.getTextInCell(at.section, at.paragraph, at.control, c, 0, 0, 10), expected[c]); assert.equal(JSON.parse(reopened.getCellCharPropertiesAt(at.section, at.paragraph, at.control, 2, 0, 0)).bold, true); } finally { reopened.free(); } });
  for (const ext of ['hwp', 'hwpx']) for (const output of ['formula', 'value']) {
    await scenario(`${ext}/${output}: formula reference fill, one undo/redo, guarded save and reopen`, async () => {
      const seed = '=A1+$A$1';
      const expected = ['2', '4', '6', '8', seed, ...(output === 'value' ? ['6', '8', '10'] : ['=B1+$A$1', '=C1+$A$1', '=D1+$A$1'])];
      const f = await open(ext, [seed, '둘째'], true), before = await capture(f);
      await command(f, 'table:auto-fill-integers');
      const selector = '[aria-label="수식 채우기 방식"]';
      await f.waitForSelector(selector); await f.select(selector, output);
      const preview = await f.$eval('[aria-label="자동 채우기 변경 미리보기"]', table => [...table.rows].map(row => row.cells[3].textContent));
      assert.deepEqual(preview, expected.slice(5));
      await f.click('.modal-overlay .dialog-btn-primary'); await f.waitForSelector(selector, {hidden: true});
      assert.deepEqual(await values(f), expected);
      const after = await capture(f);
      await command(f, 'edit:undo'); assert.deepEqual((await capture(f)).bytes, before.bytes);
      await command(f, 'edit:redo'); assert.deepEqual((await capture(f)).bytes, after.bytes);
      const bytes = await f.evaluate(async () => {
        if (await window.jueonyEditor.save() !== 'saved') throw new Error('safe save refused');
        return [...new Uint8Array(await (await window.jueonyEditor.fileHandle().getFile()).arrayBuffer())];
      });
      const path = resolve(out, `reference-${output}.${ext}`); await writeFile(path, new Uint8Array(bytes));
      const reopened = new HwpDocument(new Uint8Array(await readFile(path)));
      try {
        const at = await f.evaluate(() => window.jueonyEditor.snapshot().structure.tables[0]);
        assert.deepEqual(expected.map((_, i) => reopened.getTextInCell(0, at.paragraph, at.control, i, 0, 0, reopened.getCellParagraphLength(0, at.paragraph, at.control, i, 0))), expected);
        assert.equal(JSON.parse(reopened.getCellCharPropertiesAt(0, at.paragraph, at.control, 6, 0, 0)).bold, true);
      } finally { reopened.free(); }
    });
  }
  if(process.env.JUEONY_REVIEW_STORED_FILL==='1')for(const ext of ['hwp','hwpx'])for(const output of ['formula','value']){
    await scenario(ext+'/'+output+' stored formula modal preview, real fields, undo/redo and guarded reopen',async()=>{
      const frame=await open(ext,['원본','대상'],true,true),before=await capture(frame);
      await command(frame,'table:auto-fill-integers');
      const selector='[aria-label="수식 채우기 방식"]';await frame.waitForSelector(selector);await frame.select(selector,output);
      const preview=await frame.$eval('[aria-label="자동 채우기 변경 미리보기"]',t=>[...t.rows].map(r=>r.cells[3].textContent));
      const expressions=['=B1*2','=C1*2','=D1*2'],expected=['8.00','12.00','16.00'];
      assert.deepEqual(preview,output==='value'?expected:expressions.map((expr,i)=>expr+' → '+expected[i]));
      await frame.click('.modal-overlay .dialog-btn-primary');await frame.waitForSelector(selector,{hidden:true});
      assert.deepEqual((await values(frame)).slice(5),expected);
      const after=await capture(frame);await command(frame,'edit:undo');assert.deepEqual((await capture(frame)).bytes,before.bytes);
      await command(frame,'edit:redo');assert.deepEqual((await capture(frame)).bytes,after.bytes);
      const bytes=await frame.evaluate(async()=>{const a=window.jueonyEditor;if(await a.save()!=='saved')throw Error('save');return [...new Uint8Array(await(await a.fileHandle().getFile()).arrayBuffer())];});
      const reopened=new HwpDocument(new Uint8Array(bytes));try{
        assert.deepEqual(JSON.parse(reopened.getFieldList()).map(f=>f.command),['=A1*2??%.2f;;4.00',...(output==='value'?[]:expressions.map((expr,i)=>expr+'??%.2f;;'+expected[i]))]);
      }finally{reopened.free();}
    });
  }
  if(process.env.JUEONY_REVIEW_RECTANGLE==='1')for(const ext of ['hwp','hwpx']){
    await scenario(ext+'/rectangle chooses rows or columns, previews and saves one undoable operation',async()=>{
      const f=await open(ext,[],false,false,true),before=await capture(f),selector='[aria-label="직사각형 채우기 방향"]';
      await command(f,'table:auto-fill-integers');await f.waitForSelector(selector);
      const preview=()=>f.$eval('[aria-label="자동 채우기 변경 미리보기"]',t=>[...t.rows].map(r=>r.cells[3].textContent));
      assert.equal(await f.$eval(selector,e=>e.value),'rows');assert.deepEqual(await preview(),['5','8','10','7','8']);
      await f.select(selector,'columns');assert.deepEqual(await preview(),['7','9','29','17']);
      await f.click('.modal-overlay .dialog-btn-primary');await f.waitForSelector(selector,{hidden:true});
      assert.deepEqual((await values(f)).slice(8),['7','9','29','17']);const after=await capture(f);
      await command(f,'edit:undo');assert.deepEqual((await capture(f)).bytes,before.bytes);
      await command(f,'edit:redo');assert.deepEqual((await capture(f)).bytes,after.bytes);
      const bytes=await f.evaluate(async()=>{const a=window.jueonyEditor;if(await a.save()!=='saved')throw Error('save');return [...new Uint8Array(await(await a.fileHandle().getFile()).arrayBuffer())];});
      const reopened=new HwpDocument(new Uint8Array(bytes));try{
        const t=await f.evaluate(()=>window.jueonyEditor.snapshot().structure.tables[0]);
        assert.deepEqual([8,9,10,11].map(i=>reopened.getTextInCell(0,t.paragraph,t.control,i,0,0,2)),['7','9','29','17']);
      }finally{reopened.free();}
    });
  }
  await scenario('cyclic numeric preview remains open and cancellation preserves all source bytes', async () => {
    const f = await open('hwpx', ['=A2', '둘째'], true), before = await capture(f);
    await command(f, 'table:auto-fill-integers');
    const selector = '[aria-label="수식 채우기 방식"]';
    await f.select(selector, 'value'); await f.click('.modal-overlay .dialog-btn-primary');
    assert.match(await f.$eval('[data-jueony-table-auto-fill] [role=alert]', e => e.textContent), /순환/);
    await page.keyboard.press('Escape'); await f.waitForSelector(selector, {hidden: true});
    assert.deepEqual(await capture(f), before);
  });
  await scenario('silent router refusal keeps dialog open and source/selection/history unchanged', async () => { const f = await open(), before = await capture(f); await dialog(f); await f.evaluate(() => { const ih = window.__dateServices.getInputHandler(); window.__oldDateOperation = ih.executeOperation; ih.executeOperation = () => {}; }); try { await f.click('.modal-overlay .dialog-btn-primary'); assert.match(await f.$eval('[data-jueony-table-auto-fill] [role=alert]', e => e.textContent), /적용하지 못했습니다/); assert.deepEqual(await capture(f), before); } finally { await f.evaluate(() => { window.__dateServices.getInputHandler().executeOperation = window.__oldDateOperation; }); await page.keyboard.press('Escape'); } });
  await scenario('live second-target mutation failure rolls all earlier date changes back', async () => { const f = await open(), before = await capture(f); await dialog(f); await f.evaluate(() => { const raw = window.__dateServices.wasm.borrowDocumentHandle(), old = raw.insertTextInCell; window.__oldDateInsert = old; raw.insertTextInCell = function (...args) { const result = old.apply(raw, args); if (args[3] === 3) throw new Error('Synthetic late date fill failure'); return result; }; }); try { await f.click('.modal-overlay .dialog-btn-primary'); assert.match(await f.$eval('[data-jueony-table-auto-fill] [role=alert]', e => e.textContent), /Synthetic late date fill failure/); assert.deepEqual(await capture(f), before); } finally { await f.evaluate(() => { window.__dateServices.wasm.borrowDocumentHandle().insertTextInCell = window.__oldDateInsert; }); await page.keyboard.press('Escape'); } });
  assert.deepEqual(pageErrors, []); assert.deepEqual(external, []);
} finally { await browser?.close(); server?.kill(); await writeFile(resolve(out, 'result.json'), JSON.stringify({ engine: engine.metadata, verifierSha256: hash(await readFile(import.meta.filename)), results, failures, pageErrors, external, scope: 'Date/number series and A1 formula-text/static-value fill through the real Studio dialog, one-step undo/redo, guarded save and reopen. Native calculation fields, automatic recalculation and native Hancom comparison are outside this verification.' }, null, 2)); }
assert.deepEqual(failures, []); console.log('PASS', results.length, 'table fill scenarios');
