// A real UI-to-provider-to-editor check. Requires explicit API usage opt-in.
import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
if (!process.argv.includes('--live')) throw new Error('Use --live to run two real HCX-005 requests against the current app.');
const root = fileURLToPath(new URL('../../../', import.meta.url));
const origin = 'http://127.0.0.1:4173', evidence = join(root, 'apps/editor/evidence/agent-interaction');
await mkdir(evidence, { recursive: true });
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true, args: ['--no-first-run'], defaultViewport: { width: 1600, height: 1000 } });
const page = await browser.newPage(), calls = [], requests = [], errors = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('request', r => { if (r.url() === origin + '/api/generate') requests.push(r); });
page.on('response', r => { if (r.url() === origin + '/api/generate') calls.push(r); });
page.on('dialog', d => d.accept());
const report = { origin, syntheticOnly: true, separateProfile: true, checks: [], runs: [], errors };
const snap = () => page.evaluate(() => document.querySelector('.editor-frame:not([hidden])').contentWindow.jueonyEditor.snapshot());
async function send(text, enter) {
  await page.$eval('#request-input', e => e.value = ''); await page.type('#request-input', text);
  const count = calls.length;
  if (enter) await page.keyboard.press('Enter'); else await page.click('#send-request');
  await page.waitForSelector('#agent-progress');
  await page.screenshot({ path: join(evidence, 'request-pending.png'), fullPage: true });
  await page.waitForFunction(() => !document.getElementById('send-request').disabled, { timeout: 110000 });
  assert.equal(calls.length, count + 1);
  const response = calls.at(-1), result = await response.json(), status = await page.$eval('#app-status', e => e.textContent);
  report.runs.push({ text, input: enter ? 'Enter' : 'button', httpStatus: response.status(), result, status });
  assert.equal(response.status(), 200, JSON.stringify(result)); assert.equal(status, 'AI 요청이 완료되었습니다.');
  assert.equal(await page.$('#agent-progress'), null); return snap();
}
try {
  await page.goto(origin + '/?storage=download');
  await page.waitForFunction(() => document.getElementById('app-status').textContent.includes('준비 완료'), { timeout: 60000 });
  report.selectedModel = await page.$eval('#model-select', e => e.selectedOptions[0]?.textContent);
  assert.equal(report.selectedModel, 'HCX-005', 'Select the saved HCX-005 connection in this test profile');
  await page.type('#request-input', '줄바꿈 확인'); await page.keyboard.down('Shift'); await page.keyboard.press('Enter'); await page.keyboard.up('Shift');
  assert.equal(await page.$eval('#request-input', e => e.value), '줄바꿈 확인\n'); assert.equal(requests.length, 0);
  report.checks.push('Shift+Enter inserts a newline without sending');
  await page.$eval('#request-input', e => e.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true })));
  await page.keyboard.press('Enter'); assert.equal(requests.length, 0);
  await page.$eval('#request-input', e => {
    e.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }));
    e.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 229, bubbles: true, cancelable: true }));
    e.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true, cancelable: true }));
  });
  assert.equal(requests.length, 0); report.checks.push('Composition state, keyCode 229 and composing Enter do not send (synthetic IME events)');
  const created = await send('새 문서에 회의 안내문을 작성해줘. 제목은 회의 안내, 일시는 2026년 10월 20일 오후 2시, 장소는 대회의실이야. 제목, 일시, 장소를 각각 별도 문단으로 작성해줘. 다른 내용은 추가하지 마.', true);
  assert.equal(created.nodes[0].text, '회의 안내'); assert.match(created.nodes.map(n => n.text).join('\n'), /2026년 10월 20일/); assert.match(created.nodes.map(n => n.text).join('\n'), /대회의실/);
  report.checks.push('Enter sends one real HCX-005 request and creates a new document');
  await page.screenshot({ path: join(evidence, 'created-after.png'), fullPage: true });
  const edited = await send('현재 문서의 제목 회의 안내를 업무 회의 안내로 바꾸고, 그 제목만 16pt 굵게 해줘. 일시와 장소는 그대로 유지해줘.', false);
  assert.equal(edited.nodes[0].text, '업무 회의 안내'); assert.equal(edited.structure.paragraphs[0].characters.fontSize, 1600); assert.equal(edited.structure.paragraphs[0].characters.bold, true);
  assert.deepEqual(edited.nodes.slice(1).map(n => n.text), created.nodes.slice(1).map(n => n.text));
  report.checks.push('Button sends a follow-up edit and preserves the date and place');
  await page.screenshot({ path: join(evidence, 'edited-after.png'), fullPage: true });
  const actions = await page.$$('.message-actions button'); await actions.at(-1).click();
  await page.waitForFunction(() => document.getElementById('app-status').textContent.includes('되돌렸습니다'));
  assert.deepEqual((await snap()).structure, created.structure);
  report.checks.push('Request undo restores the first generated document');
  assert.deepEqual(errors, []); report.checks.push('Progress appears while working and clears on completion; no browser errors'); report.status = 'PASS';
} catch (e) {
  report.status = 'FAIL'; report.error = String(e.message).replace(/nv-[A-Za-z0-9_-]+/g, '[REDACTED]'); process.exitCode = 1;
  await page.screenshot({ path: join(evidence, 'failure-after.png'), fullPage: true });
} finally {
  report.calls = calls.length;
  await writeFile(join(evidence, 'after.json'), JSON.stringify(report, null, 2));
  await browser.close(); console.log(JSON.stringify({ status: report.status, calls: report.calls, checks: report.checks, error: report.error }));
}
