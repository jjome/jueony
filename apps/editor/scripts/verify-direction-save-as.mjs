import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {resolve, join} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import puppeteer from 'puppeteer-core';
import {loadReviewEngine} from './lib/hancom-review.mjs';
import {readOwnedZip, writeOwnedZip} from './lib/owned-zip.mjs';

// Run against a profile built using this engine. Only synthetic documents and
// the isolated browser's origin-private filesystem are used.
const [distPath, enginePath, browserPath] = process.argv.slice(2);
assert.ok(distPath && enginePath && browserPath, 'Supply dist, engine package and browser executable paths');
const dist = resolve(distPath), engine = await loadReviewEngine(resolve(enginePath));
const build = JSON.parse(await readFile(join(dist, 'build-evidence.json'), 'utf8'));
assert.equal(build.engineWasmSha256, engine.metadata.wasmSha256);
const port = Number(process.env.JUEONY_TEST_PORT ?? 4748);
assert.ok(Number.isInteger(port) && port > 1024 && port < 65536);
const origin = 'http://127.0.0.1:' + port;
assert.equal(await fetch(origin).then(() => true, () => false), false, 'test port already in use');
const server = spawn(process.execPath, ['apps/launcher/server.mjs'], {
  env: {...process.env, JUEONY_DIST: dist, JUEONY_PORT: String(port), JUEONY_CONNECTION_STORE: 'memory'},
  windowsHide: true, stdio: 'ignore',
});
let browser;
try {
  const document = engine.HwpDocument.createEmpty();
  let base;
  try {
    document.createBlankDocument();
    document.insertText(0, 0, 0, '글 방향 보존 확인');
    base = document.exportHwpx();
  } finally { document.free(); }
  for (let i = 0; i < 100; i++) {
    if (await fetch(origin + '/api/health').then(r => r.ok, () => false)) break;
    await delay(100);
  }
  browser = await puppeteer.launch({executablePath: resolve(browserPath), headless: true, args: ['--disable-background-networking']});
  const page = await browser.newPage(), alerts = [];
  page.on('dialog', async dialog => { alerts.push(dialog.message()); await dialog.accept(); });
  await page.goto(origin);
  await page.waitForFunction(() => document.querySelector('#app-status')?.textContent.includes('준비 완료'), {timeout: 60000});
  const frame = await (await page.$('.editor-frame:not([hidden])')).contentFrame();
  const cases = ['RTL', 'AUTO', 'LTR'].flatMap(direction => ['cancel','save'].map(action => ({direction, action})));
  cases.unshift({direction:'RTL', action:'original-handle'}, {direction:'AUTO', action:'unbound-original'}, {direction:'LTR', action:'switch-in-picker'});
  cases.push({direction:'RTL', action:'password'}, {direction:'RTL', action:'switch'}, {direction:'LTR', action:'switch-before-options'});
  for (const {direction, action} of cases) {
    const parts = new Map(readOwnedZip(base));
    const header = parts.get('Contents/header.xml').toString('utf8');
    assert.match(header, /<hh:paraPr id="0" /);
    parts.set('Contents/header.xml', header.replace('<hh:paraPr id="0" ', '<hh:paraPr id="0" textDir="' + direction + '" '));
    const source = writeOwnedZip([...parts]);
    await frame.evaluate(async ({bytes, direction, action}) => {
      const dir = await navigator.storage.getDirectory(), src = await dir.getFileHandle('source-' + direction + '.hwpx', {create:true});
      const write = await src.createWritable(); await write.write(new Uint8Array(bytes)); await write.close();
      await window.jueonyEditor.open(new Uint8Array(bytes), src.name, action==='unbound-original'?null:src, false);
      window.__directionSource = src;
      window.__directionPicks = [];
      window.__directionOriginalWrites = 0;
      Object.defineProperty(window, 'showSaveFilePicker', {configurable:true, value:async options => {
        window.__directionPicks.push(options.suggestedName);
        if (['original-handle','unbound-original','switch-in-picker'].includes(action)) {
          const selected=await dir.getFileHandle(action==='switch-in-picker'?options.suggestedName:src.name,{create:true});
          const open=selected.createWritable.bind(selected);
          selected.createWritable=(...args)=>{window.__directionOriginalWrites++;return open(...args);};
          if (action==='switch-in-picker') await window.jueonyEditor.open(new Uint8Array(bytes),src.name,src,false);
          return selected;
        }
        return dir.getFileHandle(options.suggestedName, {create:true});
      }});
    }, {bytes:[...source], direction, action});
    const name = ['original-handle','unbound-original','switch-in-picker'].includes(action) ? 'source-' + direction : '방향-' + direction + '-' + action;
    const password = 'fixture-only-1234';
    const command = await frame.evaluate(() => window.jueonyEditor.executeCommand('file:save-as-hwp'));
    assert.equal(command.ok, true);
    await frame.waitForSelector('.modal-overlay input[type=text]');
    await frame.$eval('.modal-overlay input[type=text]', (input, name) => { input.value = name; }, name);
    if(action === 'switch-before-options') {
      await frame.evaluate(async () => {
        const old = window.__directionSource, copy = new Uint8Array(await (await old.getFile()).arrayBuffer());
        await window.jueonyEditor.open(copy, old.name, old, false);
      });
      await frame.click('.modal-overlay .dialog-btn-primary');
      await frame.waitForFunction(() => !document.querySelector('.modal-overlay'));
      assert.match(alerts.pop() ?? '', /저장 대기 중 문서/);
      assert.deepEqual(await frame.evaluate(()=>window.__directionPicks),[]);
      console.log('PASS', direction, action);
      continue;
    }
    if (action === 'password') {
      await frame.click('.modal-overlay .dialog-btn:not(.dialog-footer button)');
      await frame.waitForSelector('#hwp-save-password-input');
      await frame.type('#hwp-save-password-input', password);
      await frame.type('#hwp-save-password-confirmation', password);
    }
    await frame.click('.modal-overlay .dialog-btn-primary');
    await frame.waitForFunction(() => document.querySelector('.modal-overlay')?.textContent.includes('문단 글 방향 보존'));
    if (['original-handle','unbound-original','switch-in-picker'].includes(action)) {
      await frame.click('.dialog-footer .dialog-btn-primary');
      await frame.waitForFunction(()=>window.__directionPicks.length===1);
      // A distinct handle object can still alias the original OPFS entry.
      for(let i=0;i<50 && !alerts.length;i++)await delay(30);
      assert.equal(await frame.evaluate(()=>window.__directionOriginalWrites),0,'original HWPX was opened for writing');
      assert.match(alerts.pop() ?? '', action==='switch-in-picker'?/저장 대기 중 문서/:/원본 파일/);
      const result=await frame.evaluate(async()=>({name:window.__directionPicks[0],source:[...new Uint8Array(await (await window.__directionSource.getFile()).arrayBuffer())]}));
      assert.notEqual(result.name, name+'.hwpx');
      assert.deepEqual(result.source,[...source]);
      console.log('PASS', direction, action);
      continue;
    }
    assert.match(await frame.$eval('.modal-overlay', el => el.textContent), new RegExp(name + '\\.hwpx'));
    if (action === 'switch') {
      await frame.evaluate(async () => {
        const src = window.__directionSource, data = new Uint8Array(await (await src.getFile()).arrayBuffer());
        await window.jueonyEditor.open(data, src.name, src, false);
      });
    }
    await frame.click(action === 'cancel' ? '.dialog-footer .dialog-btn:not(.dialog-btn-primary)' : '.dialog-footer .dialog-btn-primary');
    await frame.waitForFunction(() => !document.querySelector('.modal-overlay'));
    const accept = action === 'save' || action === 'password';
    if (accept) await frame.waitForFunction(name => window.jueonyEditor.fileHandle()?.name === name + '.hwpx', {}, name);
    const result = await frame.evaluate(async () => {
      const bytes = async handle => [...new Uint8Array(await (await handle.getFile()).arrayBuffer())];
      return {picks:window.__directionPicks, source:await bytes(window.__directionSource), current:await bytes(window.jueonyEditor.fileHandle())};
    });
    assert.deepEqual(result.picks, accept ? [name + '.hwpx'] : []);
    assert.deepEqual(result.source, [...source]);
    if (accept) {
      const bytes = new Uint8Array(result.current);
      if (action === 'password') assert.throws(() => new engine.HwpDocument(bytes));
      const reopened = action === 'password' ? engine.HwpDocument.openWithPassword(bytes,password) : new engine.HwpDocument(bytes);
      try {
        assert.equal(reopened.getTextRange(0,0,0,reopened.getParagraphLength(0,0)), '글 방향 보존 확인');
        const xml = new Map(readOwnedZip(action === 'password' ? reopened.exportHwpx() : bytes)).get('Contents/header.xml').toString('utf8');
        assert.match(xml, new RegExp('<hh:paraPr id="0"[^>]* textDir="' + direction + '"'));
      }
      finally { reopened.free(); }
    } else assert.deepEqual(result.current, [...source]);
    if (action === 'switch') assert.match(alerts.pop() ?? '', /저장 대기 중 문서/);
    console.log('PASS', direction, action);
  }
  assert.deepEqual(alerts, []);
} finally {
  await browser?.close();
  server.kill();
}
