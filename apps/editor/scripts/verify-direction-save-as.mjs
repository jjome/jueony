import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {resolve, join} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import puppeteer from 'puppeteer-core';
import {hash, loadReviewEngine} from './lib/hancom-review.mjs';
import {readOwnedZip, writeOwnedZip} from './lib/owned-zip.mjs';

// Run against a profile built using this engine. Only synthetic documents and
// the isolated browser's origin-private filesystem are used.
const [distPath, enginePath, browserPath, outputDir, hancomDir] = process.argv.slice(2);
assert.ok(distPath && enginePath && browserPath, 'Supply dist, engine package and browser executable paths');
const dist = resolve(distPath), engine = await loadReviewEngine(resolve(enginePath));
const build = JSON.parse(await readFile(join(dist, 'build-evidence.json'), 'utf8'));
assert.equal(build.engineWasmSha256, engine.metadata.wasmSha256);
// Native Hancom files have no Jueony sidecar that could mask a binary reader regression.
if (hancomDir) {
  const evidence = JSON.parse(await readFile(new URL('../../../docs/evidence/n046-hancom-2026-11-08/comparison.json', import.meta.url), 'utf8'));
  for (const direction of ['LTR', 'RTL']) {
    const bytes = await readFile(join(hancomDir, direction + '-disk.hwp'));
    assert.equal(hash(bytes), evidence[direction].hwpSha256);
    const native = new engine.HwpDocument(bytes);
    try {
      const parts = new Map(readOwnedZip(native.exportHwpx()));
      const id = evidence[direction].paraShapeId;
      assert.match(parts.get('Contents/section0.xml').toString(), new RegExp('<hp:p [^>]*paraPrIDRef="' + id + '"'));
      assert.match(parts.get('Contents/header.xml').toString(), new RegExp('<hh:paraPr id="' + id + '"[^>]* textDir="' + direction + '"'));
    } finally { native.free(); }
    console.log('PASS', direction, 'read native Hancom HWP');
  }
}
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
  // Supplying an output directory runs just the three disk round trips.
  const cases = ['LTR', 'RTL', 'AUTO'].map(direction => ({direction, action:'save'}));
  if (outputDir) {
    await mkdir(outputDir, {recursive:true});
  } else {
    for (const action of ['cancel','password','switch','switch-before-options','original-handle','unbound-original','switch-in-picker']) {
      cases.push({direction:'AUTO', action});
    }
  }
  for (const {direction, action} of cases) {
    const parts = new Map(readOwnedZip(base));
    const header = parts.get('Contents/header.xml').toString('utf8');
    const shapeTag = /<hh:paraPr id="0"\s[^>]*>/;
    assert.match(header, shapeTag);
    let sourceHeader = header.replace(shapeTag, tag => tag.replace(/ textDir="[^"]*"/, '').slice(0, -1) + ' textDir="' + direction + '">');
    if (outputDir) {
      // These spacing settings share the HWP attr2 word with text direction.
      const spacing = '<hh:autoSpacing eAsianEng="0" eAsianNum="0"';
      assert.ok(sourceHeader.includes(spacing));
      sourceHeader = sourceHeader.replace(spacing, '<hh:autoSpacing eAsianEng="1" eAsianNum="1"');
    }
    parts.set('Contents/header.xml', sourceHeader);
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
    if (direction !== 'AUTO') {
      const expected = name + '.hwp';
      await frame.waitForFunction(fileName => window.jueonyEditor.fileHandle()?.name === fileName, {}, expected);
      const saved = await frame.evaluate(async () => {
        const bytes = async handle => [...new Uint8Array(await (await handle.getFile()).arrayBuffer())];
        return {picks:window.__directionPicks, original:await bytes(window.__directionSource), current:await bytes(window.jueonyEditor.fileHandle())};
      });
      assert.deepEqual(saved.picks, [expected]);
      assert.deepEqual(saved.original, [...source]);
      const bytes = Uint8Array.from(saved.current);
      assert.equal(Buffer.from(bytes.subarray(0, 8)).toString('hex'), 'd0cf11e0a1b11ae1');
      const reopened = new engine.HwpDocument(bytes);
      try {
        assert.equal(reopened.getTextRange(0,0,0,reopened.getParagraphLength(0,0)), '글 방향 보존 확인');
        const parts = new Map(readOwnedZip(reopened.exportHwpx()));
        assert.match(parts.get('Contents/header.xml').toString('utf8'), new RegExp('<hh:paraPr id="0"[^>]* textDir="' + direction + '"'));
      } finally { reopened.free(); }
      if (outputDir) await writeFile(join(outputDir, direction + '.hwp'), bytes);
      console.log('PASS', direction, 'HWP save and reopen');
      continue;
    }
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
        if (outputDir) await writeFile(join(outputDir, direction + '.hwpx'), bytes);
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
