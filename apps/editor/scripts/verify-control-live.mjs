// Explicitly opt in with --live. Uses the existing encrypted HCX-005 connection.
// Synthetic document only; one paid model request; no retries or key logging.
import puppeteer from 'puppeteer-core';
import { spawn } from 'node:child_process';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import init, { HwpDocument } from '@rhwp/core';
if (!process.argv.includes('--live')) throw new Error('This test requires --live and a saved HCX-005 connection.');
const currentServer = process.argv.includes('--current-server');
const root = fileURLToPath(new URL('../../../', import.meta.url)), origin = currentServer ? 'http://127.0.0.1:4173' : 'http://127.0.0.1:4201';
const evidence = join(root, 'apps/editor/evidence', currentServer ? 'agent-current-live' : 'document-control-live');
await mkdir(evidence, { recursive: true });
if (!currentServer) assert.equal(await fetch(origin + '/api/health').then(() => true, () => false), false, 'isolated port must be free');
else assert.equal((await (await fetch(origin + '/api/health')).json()).documentControlVersion, 1, 'current server must support document control');
const report = { syntheticOnly: true, origin, separateBrowserProfile: true, calls: 0, checks: [], hancomReview: 'pending' }; let browser;
const diagnosticServer = `const original=globalThis.fetch;globalThis.fetch=async(...args)=>{const r=await original(...args);if(!r.ok){const b=await r.clone().json().catch(()=>({}));const auth=args[1]?.headers?.Authorization?.replace(/^Bearer /,'')??'';let message=String(b.status?.message??'');if(auth)message=message.replaceAll(auth,'[REDACTED]');process.send({http:r.status,code:b.status?.code,message:message.replace(/nv-[A-Za-z0-9_-]+/g,'[REDACTED]').slice(0,800)});}return r;};await import('./apps/launcher/server.mjs');`;
const server = currentServer ? undefined : spawn(process.execPath, ['--input-type=module', '-e', diagnosticServer], { cwd: root, windowsHide: true, env: { ...process.env, JUEONY_PORT: '4201', JUEONY_DIST: join(root, 'apps/editor/dist') }, stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
server?.on('message', info => { report.providerError = info; });
try {
 for (let i = 0; i < 100; i++) { if (server && server.exitCode !== null) throw new Error('Test server failed'); if (await fetch(origin + '/api/health').then(r => r.ok, () => false)) break; await new Promise(r => setTimeout(r, 100)); }
 await init({ module_or_path: await readFile(join(root, 'apps/editor/node_modules/@rhwp/core/rhwp_bg.wasm')) });
 browser = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true, args: ['--no-first-run'], defaultViewport: { width: 1600, height: 1000 } });
 const page = await browser.newPage(); page.setDefaultTimeout(60000);
 await page.goto(origin + '/?storage=download');
 await page.waitForFunction(() => document.getElementById('app-status').textContent.includes('준비 완료'));
 const selected = await page.evaluate(async () => {
  const token = (await (await fetch('/api/session', { headers: { 'X-Jueony-Bootstrap': '1' } })).json()).token;
  const data = await (await fetch('/api/connections', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Jueony-Token': token }, body: '{}' })).json();
  const c = data.connections.find(c => c.hasKey && c.config.adapterId === 'hyperclova' && c.config.modelId === 'HCX-005');
  if (!c) throw new Error('No saved HCX-005 connection');
  const group = c.config.label + ' | ' + c.config.adapterId + ' | ' + c.config.endpoint;
  const provider = document.getElementById('provider-select'); provider.value = group; provider.dispatchEvent(new Event('change'));
  const model = document.getElementById('model-select'); model.value = c.config.id; model.dispatchEvent(new Event('change'));
  return c.config.modelId;
 }); report.model = selected;
 const doc = HwpDocument.createEmpty(); doc.createBlankDocument();
 for (const [i, value] of ['업무 계획', '추진 일정', '후속 조치'].entries()) { if (i) doc.splitParagraph(0, i - 1, doc.getParagraphLength(0, i - 1)); doc.insertText(0, i, 0, value); }
 const fixture = [...doc.exportHwpx()]; doc.free();
 const frame = await (await page.$('.editor-frame:not([hidden])')).contentFrame();
 await frame.evaluate(bytes => window.jueonyEditor.open(new Uint8Array(bytes), '가상-업무계획.hwpx'), fixture);
 const before = await frame.evaluate(() => window.jueonyEditor.snapshot());
 const request = '현재 문서를 수정해줘. 제목 업무 계획을 16pt 굵게로 바꾸고, 추진 일정 문단 바로 뒤에 4행 3열 표를 만들어줘. 표 내용은 행 순서대로 [단계,기간,담당], [준비,1월,총무], [실행,2월,사업], [점검,3월,감사]야. 첫 행은 굵게 하고 배경색 #eeeeee를 적용해줘. 현재 구역은 A4 가로, 좌우상하여백 각 20mm로 바꿔줘. 본문 문단의 텍스트는 그대로 유지하고 저장은 하지 마.';
 let response;
 page.on('response', async r => { if (r.url() === origin + '/api/generate') { report.calls++; response = r; } });
 await page.type('#request-input', request); await page.screenshot({ path: join(evidence, 'request-entered.png'), fullPage: true }); await page.click('#send-request');
 await page.waitForFunction(() => document.getElementById('send-request').disabled);
 await page.waitForFunction(() => !document.getElementById('send-request').disabled, { timeout: 110000 });
 assert.equal(report.calls, 1); report.response = await response.json();
 assert.equal(response.status(), 200); report.appStatus = await page.$eval('#app-status', e => e.textContent);
 assert.equal(report.appStatus, 'AI 요청이 완료되었습니다.');
 const after = await frame.evaluate(() => window.jueonyEditor.snapshot());
 assert.equal(after.structure.tables.length, 1); const table = after.structure.tables[0];
 assert.equal(table.rows, 4); assert.equal(table.columns, 3); assert.deepEqual(table.cells.map(c => c.text), ['단계', '기간', '담당', '준비', '1월', '총무', '실행', '2월', '사업', '점검', '3월', '감사']);
 for (const cell of table.cells.slice(0, 3)) { assert.equal(cell.characters.bold, true); assert.equal(cell.properties.fillColor, '#eeeeee'); }
 for (const cell of table.cells.slice(3)) { assert.equal(cell.characters.bold, false, 'Only the requested header row may be bold'); assert.equal(cell.properties.fillType, 'none', 'Only the requested header row may have a fill'); }
 assert.equal(after.structure.paragraphs[0].characters.fontSize, 1600); assert.equal(after.structure.paragraphs[0].characters.bold, true);
 assert.equal(after.structure.sections[0].page.landscape, true);
 for (const side of ['Left', 'Right', 'Top', 'Bottom']) assert.equal(after.structure.sections[0].page['margin' + side], Math.round(20 * 7200 / 25.4));
 report.checks.push('Real HCX-005 chat applied table, cell format, title and paper settings to live editor');
 await page.screenshot({ path: join(evidence, 'agent-applied.png'), fullPage: true });
 const bytes = new Uint8Array(await frame.evaluate(() => [...window.jueonyEditor.recovery().bytes]));
 const saved = new HwpDocument(bytes); try { await writeFile(join(evidence, '실제-AI-일정표.hwp'), saved.exportHwp()); await writeFile(join(evidence, '실제-AI-일정표.hwpx'), saved.exportHwpx()); } finally { saved.free(); }
 const compare = await page.$$('.message-actions button'); await compare.at(-2).click();
 assert.match(await page.$eval('#structure-diff-text', e => e.textContent), /4행 × 3열/);
 await page.screenshot({ path: join(evidence, 'diff.png'), fullPage: true }); await page.keyboard.press('Escape');
 await compare.at(-1).click(); await page.waitForFunction(() => document.getElementById('app-status').textContent.includes('되돌렸습니다'));
 assert.deepEqual((await frame.evaluate(() => window.jueonyEditor.snapshot())).structure, before.structure);
 report.checks.push('Structure comparison and one-request undo restore original document'); report.status = 'PASS';
} catch (e) { report.status = 'FAIL'; report.error = String(e.message).replace(/nv-[A-Za-z0-9_-]+/g, '[REDACTED]'); process.exitCode = 1; }
finally { await browser?.close(); server?.kill(); await writeFile(join(evidence, 'results.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify({ status: report.status, calls: report.calls, checks: report.checks, error: report.error })); }
