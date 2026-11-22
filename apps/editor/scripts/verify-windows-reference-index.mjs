import assert from 'node:assert/strict';
import {spawn,execFileSync} from 'node:child_process';
import {once} from 'node:events';
import {mkdir,mkdtemp,readdir,readFile,rename,stat,unlink,utimes,writeFile} from 'node:fs/promises';
import {join,relative,resolve} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import http from 'node:http';
import puppeteer from 'puppeteer-core';
import {supplyDirectoryToPicker} from './lib/chromium-directory-drop.mjs';

assert.equal(process.platform,'win32');
const sid=process.env.JUEONY_TEST_WINDOWS_SID;
assert.match(sid??'',/^S-1-[\d-]+$/u);
const bundle=resolve(process.env.JUEONY_TEST_BUNDLE);
const output=resolve(process.env.JUEONY_TEST_OUTPUT);
const port=Number(process.env.JUEONY_TEST_PORT??5256);
const origin=`http://127.0.0.1:${port}`;
if(await fetch(origin+'/api/health').then(()=>true,()=>false))throw Error('Test port already in use');
await mkdir(output,{recursive:true});
const files=await mkdtemp(join(output,'fixtures-'));
const indexFile=join(files,'review.sqlite');
const build=JSON.parse(await readFile(join(bundle,'dist/build-evidence.json'),'utf8'));
const result={build:{customSourceSha256:build.customSourceSha256,engineWasmSha256:build.engineWasmSha256},verified:[],requests:[],externalRequests:[],errors:[]};
const pass=label=>{result.verified.push(label);console.log('PASS',label);};
const fixture=(name,file)=>{
  const directory=resolve(files,name);
  assert.equal(relative(files,directory),name);
  assert.match(name,/^[a-z-]+$/u);
  if(file)assert.match(file,/^[a-z-]+\.txt$/u);
  return file?join(directory,file):directory;
};
for(const [name,file,text] of [
  ['kept','facts.txt','자료식별자 변경전 승인번호 610'],
  ['missing','moved.txt','별도검수 이동예정 승인번호 721'],
  ['restricted','permissions.txt','권한검수 확인일 2026년11월22일'],
  ['unselected','ignored.txt','제외전용확정코드 900'],
]){
  await mkdir(fixture(name),{recursive:true});
  await writeFile(fixture(name,file),text);
}
const fixedTime=new Date('2024-02-10T00:00:00Z');
await utimes(fixture('kept','facts.txt'),fixedTime,fixedTime);
let server,browser,page,provider,denied=false;
const changeAcl=(action,rule)=>execFileSync('icacls.exe',[fixture('restricted'),action,rule],{stdio:'pipe',windowsHide:true});
const pause=()=>new Promise(resolve=>setTimeout(resolve,100));
const active=()=>fetch(origin+'/api/health').then(response=>response.ok,()=>false);
async function start(){
  server=spawn(join(bundle,'runtime/node.exe'),['server.mjs'],{
    cwd:bundle,windowsHide:true,stdio:'ignore',env:{...process.env,JUEONY_PORT:String(port),JUEONY_CONNECTION_STORE:'memory',JUEONY_REFERENCE_INDEX:indexFile},
  });
  for(let attempt=0;attempt<100;attempt++){
    if(server.exitCode!==null||server.signalCode!==null)throw Error('Index launcher stopped');
    if(await active())return;
    await pause();
  }
  throw Error('Index launcher did not start');
}
async function stop(){
  if(!server||server.exitCode!==null||server.signalCode!==null)return;
  const closed=once(server,'exit');
  server.kill();
  await closed;
}
function databaseIds(){
  const db=new DatabaseSync(indexFile,{readOnly:true});
  try{
    const scopes=db.prepare('SELECT scope FROM scopes').all();
    assert.ok(scopes.length<=1);
    if(!scopes.length)return [];
    const key=scopes[0].scope;
    assert.match(key,/^[0-9a-f]{64}$/u);
    return db.prepare(`SELECT chunk FROM fts_${key} ORDER BY chunk`).all().map(row=>row.chunk);
  }finally{db.close();}
}
const rootButton=name=>page.evaluateHandle(name=>[...document.querySelectorAll('.folder-root > .folder-row > button:first-of-type')]
  .find(button=>button.textContent.slice(2)===name),name);
async function toggleRoot(name){
  const button=(await rootButton(name)).asElement();
  assert.ok(button,`Folder ${name} unavailable`);
  const checkbox=(await button.evaluateHandle(node=>node.parentElement.querySelector('input'))).asElement();
  await checkbox.click();
}
async function nextIndex(trigger){
  const pending=page.waitForResponse(response=>response.url().startsWith(origin+'/api/reference-index/'));
  await trigger();
  const response=await pending;
  const path=new URL(response.url()).pathname;
  const update=await response.json();
  result.requests.push({path,httpStatus:response.status(),...update});
  assert.equal(response.status(),200);
  assert.equal(path,'/api/reference-index/search','A refresh discarded the entire chat index');
  return update;
}
async function tick(){
  await page.evaluate(()=>window.referenceIndexTick());
}
const ready=()=>page.waitForFunction(()=>document.getElementById('app-status').textContent.includes('준비 완료'));

async function verifyChatRetrieval(){
  const requests=[];
  provider=http.createServer(async(req,res)=>{
    try{
      let body='';
      for await(const chunk of req)body+=chunk;
      const input=JSON.parse(JSON.parse(body).messages[1].content);
      requests.push(input);
      const reply={message:'검색 근거 확인',sourceIds:input.references.map(item=>item.id),operations:[]};
      res.writeHead(200,{'Content-Type':'application/json'});
      res.end(JSON.stringify({choices:[{message:{content:JSON.stringify(reply)}}]}));
    }catch{res.writeHead(400).end();}
  });
  await new Promise((resolve,reject)=>{provider.once('error',reject);provider.listen(0,'127.0.0.1',resolve);});
  const fill=(id,text)=>page.$eval('#'+id,(element,text)=>{
    element.value=text;
    element.dispatchEvent(new Event('input',{bubbles:true}));
  },text);
  await page.click('#connection-settings');
  await page.click('#new-connection');
  await page.select('#config-adapter','openai-compatible');
  await fill('config-label','검수용 선택 자료');
  await fill('config-endpoint',`http://127.0.0.1:${provider.address().port}/v1`);
  await fill('config-model','reference-index-fixture');
  await page.click('#model-form button[type=submit]');
  await page.waitForFunction(()=>!document.getElementById('model-dialog').open);
  async function ask(question){
    await fill('request-input',question);
    await page.click('#send-request');
    await page.waitForFunction(question=>{
      const messages=document.getElementById('messages');
      const lastUser=[...messages.querySelectorAll('.message.user')].at(-1);
      return lastUser?.textContent.includes(question)&&messages.getAttribute('aria-busy')==='false';
    },{},question);
    assert.equal(await page.$eval('#app-status',element=>element.textContent),'AI 요청이 완료되었습니다.');
    const entry=requests.at(-1);
    assert.equal(entry.instruction,question);
    return entry.references;
  }
  const facts=await ask('자료식별자 변경후 승인번호를 알려 주세요.');
  assert.ok(facts.some(source=>source.name.startsWith('kept/facts.txt')&&source.text.includes('935')));
  assert.ok(!facts.some(source=>/610|721|900/u.test(source.text)));
  assert.deepEqual(await ask('제외전용확정코드'),[]);
  result.chat={updatedApprovedReference:true,oldAndUnselectedOmitted:true,provider:'local deterministic fixture'};
}

try{
  await start();
  browser=await puppeteer.launch({
    executablePath:process.env.JUEONY_TEST_BROWSER??'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,
    args:['--disable-background-networking','--no-first-run'],defaultViewport:{width:1440,height:900},
  });
  page=await browser.newPage();
  page.setDefaultTimeout(12000);
  page.on('pageerror',error=>result.errors.push(String(error)));
  await page.setRequestInterception(true);
  page.on('request',request=>{
    const url=new URL(request.url());
    if(['http:','https:'].includes(url.protocol)&&url.origin!==origin){
      result.externalRequests.push(url.origin);void request.abort();
    }else void request.continue();
  });
  await page.evaluateOnNewDocument(()=>{
    const setInterval=window.setInterval;
    window.setInterval=(callback,delay,...args)=>{
      if(delay===90000&&typeof callback==='function')window.referenceIndexTick=callback;
      return setInterval.call(window,callback,delay,...args);
    };
  });
  await page.goto(origin);
  await ready();
  for(const name of ['kept','missing','restricted','unselected']){
    await supplyDirectoryToPicker(page,fixture(name));
    await page.click('#add-folder');
    await page.waitForFunction(name=>[...document.querySelectorAll('.folder-root .folder-row > button:first-of-type')]
      .some(button=>button.textContent.slice(2)===name),{},name);
  }
  await page.click('#ranked-search');
  await toggleRoot('kept');
  await toggleRoot('restricted');
  await (await rootButton('missing')).asElement().click();
  await page.waitForSelector('button.file-label[title="missing/moved.txt"]');
  await page.click('.folder-row:has(button.file-label[title="missing/moved.txt"]) input[type=checkbox]');
  assert.deepEqual(await nextIndex(tick),{hits:[],inserted:3,deleted:0});
  const initialIds=databaseIds();
  assert.equal(initialIds.length,3);
  assert.deepEqual(await nextIndex(tick),{hits:[],inserted:0,deleted:0});
  pass('the real persistent FTS index reused unchanged files and omitted an unselected fourth folder');

  const moving=fixture('missing','moved.txt');
  const archived=fixture('missing','moved-away.txt');
  await rename(moving,archived);
  assert.deepEqual(await nextIndex(()=>page.click('#refresh-folders')),{hits:[],inserted:0,deleted:1});
  const afterMove=databaseIds();
  assert.equal(afterMove.length,2);
  assert.ok(afterMove.every(id=>initialIds.includes(id)));
  pass('moving away a directly selected Windows file removed only that file from the index');

  changeAcl('/deny',`*${sid}:(RD)`);
  denied=true;
  await assert.rejects(readdir(fixture('restricted')),error=>['EACCES','EPERM'].includes(error.code));
  assert.deepEqual(await nextIndex(tick),{hits:[],inserted:0,deleted:1});
  const afterDenial=databaseIds();
  assert.equal(afterDenial.length,1);
  assert.ok(afterMove.includes(afterDenial[0]));
  pass('the Windows ACL denial removed that folder and retained the other approved folder');

  const kept=fixture('kept','facts.txt'),before=await stat(kept);
  await writeFile(kept,'자료식별자 변경후 승인번호 935');
  await utimes(kept,before.atime,before.mtime);
  const after=await stat(kept);
  assert.equal(after.size,before.size);
  assert.equal(after.mtimeMs,before.mtimeMs);
  assert.deepEqual(await nextIndex(tick),{hits:[],inserted:1,deleted:1});
  assert.notDeepEqual(databaseIds(),afterDenial);
  pass('same-length same-timestamp Windows file replacement was detected by content hash');

  changeAcl('/remove:d',`*${sid}`);
  denied=false;
  assert.deepEqual(await readdir(fixture('restricted')),['permissions.txt']);
  assert.deepEqual(await nextIndex(tick),{hits:[],inserted:1,deleted:0});
  const restoredIds=databaseIds();
  assert.equal(restoredIds.length,2);
  const transient=fixture('kept','transient.txt');
  await writeFile(transient,'새로 들어온 검수 항목');
  assert.deepEqual(await nextIndex(tick),{hits:[],inserted:1,deleted:0});
  await unlink(transient);
  assert.deepEqual(await nextIndex(tick),{hits:[],inserted:0,deleted:1});
  assert.deepEqual(databaseIds(),restoredIds);
  pass('creating and deleting a child of a selected directory updated only that child');
  await stop();
  await start();
  await page.reload();
  await ready();
  await page.waitForFunction(()=>document.querySelectorAll('.folder-root').length===4);
  await toggleRoot('kept');
  await toggleRoot('restricted');
  assert.deepEqual(await nextIndex(tick),{hits:[],inserted:0,deleted:0});
  assert.deepEqual(databaseIds(),restoredIds);
  pass('restored Windows permission reindexed its file and launcher restart preserved the correctly scoped SQLite rows');
  await verifyChatRetrieval();
  pass('the chat received the new approved content and no unselected evidence');
  assert.deepEqual(result.errors,[]);
  assert.deepEqual(result.externalRequests,[]);
}catch(error){
  result.failure=String(error);
  throw error;
}finally{
  try{
    if(denied)changeAcl('/remove:d',`*${sid}`);
    await writeFile(join(output,'result.json'),JSON.stringify(result,null,2)+'\n');
  }finally{
    await browser?.close();
    if(provider){provider.closeAllConnections();await new Promise(resolve=>provider.close(resolve));}
    await stop();
  }
}
