import assert from 'node:assert/strict';
import {spawn,execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdir,mkdtemp,readdir,readFile,rename,writeFile} from 'node:fs/promises';
import {dirname,join,relative,resolve} from 'node:path';
import puppeteer from 'puppeteer-core';
import {supplyDirectoryToPicker} from './lib/chromium-directory-drop.mjs';

assert.equal(process.platform,'win32');
const userSid=process.env.JUEONY_TEST_WINDOWS_SID;
assert.match(userSid??'',/^S-1-[\d-]+$/u);
const bundle=resolve(process.env.JUEONY_TEST_BUNDLE);
const output=resolve(process.env.JUEONY_TEST_OUTPUT);
const port=Number(process.env.JUEONY_TEST_PORT??5246);
const origin=`http://127.0.0.1:${port}`;
if(await fetch(origin+'/api/health').then(()=>true,()=>false))throw Error('Test port already in use');
await mkdir(output,{recursive:true});
const fixtures=await mkdtemp(join(output,'native-files-'));
const built=JSON.parse(await readFile(resolve(bundle,'dist/build-evidence.json'),'utf8'));
const fixtureData=[
  {name:'rollback-source',files:[['evidence.txt','unchanged if disconnect fails']]},
  {name:'moved-source',files:[['evidence.txt','original file moved'],['nested/case.txt','nested original moved']]},
  {name:'permissions-source',files:[['evidence.txt','directory listing denied but original preserved']]},
];
for(const {name,files} of fixtureData){
  for(const [relativePath,content] of files){
    const file=join(fixtures,name,relativePath);
    await mkdir(dirname(file),{recursive:true});
    await writeFile(file,content);
  }
}
const build={customSourceSha256:built.customSourceSha256,engineWasmSha256:built.engineWasmSha256};
const verified=[],externalRequests=[],errors=[];
const report={
  build,verified,externalRequests,errors,
  handleAcquisition:'Native Windows File System Access handles from a staged Chromium folder drop, supplied to the application through its picker entry point',
};
const fileHashes=async(folder,files)=>Promise.all(files.map(async([path])=>({
  path,sha256:createHash('sha256').update(await readFile(join(folder,path))).digest('hex'),
})));
const before=new Map(await Promise.all(fixtureData.map(async({name,files})=>[name,await fileHashes(join(fixtures,name),files)])));
const containedPath=name=>{
  const path=resolve(fixtures,name);
  assert.equal(relative(fixtures,path),name);
  assert.match(name,/^[a-z-]+$/u);
  return path;
};
const aclFolder=containedPath('permissions-source');
const changeAcl=(action,rule)=>execFileSync('icacls.exe',[aclFolder,action,rule],{stdio:'pipe',windowsHide:true});
const server=spawn(process.execPath,['server.mjs'],{
  cwd:bundle,windowsHide:true,stdio:'ignore',env:{...process.env,JUEONY_PORT:String(port),JUEONY_CONNECTION_STORE:'memory',JUEONY_REFERENCE_INDEX:':memory:'},
});
let browser,page,denied=false,denyIndexClear=false,deniedIndexClears=0;
const pass=label=>{verified.push(label);console.log('PASS',label);};

async function attach(name,expectLink=true){
  await supplyDirectoryToPicker(page,containedPath(name));
  const handle=await page.evaluate(async name=>{
    const handle=window.nativeTestHandles[name];
    return (await (await handle.getFileHandle('evidence.txt')).getFile()).text();
  },name);
  assert.equal(handle,fixtureData.find(item=>item.name===name).files[0][1]);
  await page.click('#add-folder');
  if(expectLink)await waitForRoot(name,true);
  else await page.waitForFunction(()=>document.getElementById('app-status').textContent.includes('로컬 저장에 실패'));
}

const roots=()=>page.$$eval('.folder-root > .folder-row > button:first-of-type',elements=>elements.map(element=>element.textContent.slice(2)));
const status=()=>page.$eval('#app-status',element=>element.textContent);
async function rootButton(name,which){
  const element=await page.evaluateHandle((name,which)=>{
    const rows=[...document.querySelectorAll('.folder-root > .folder-row')];
    const row=rows.find(row=>row.querySelector('button')?.textContent.slice(2)===name);
    return which==='selection'?row?.querySelector('input'):row?.querySelector(which==='expand'?'button:first-of-type':'button:last-of-type');
  },name,which);
  const button=element.asElement();
  assert.ok(button,`Folder control missing for ${name}`);
  return button;
}
function waitForRoot(name,present){
  return page.waitForFunction((name,present)=>
    [...document.querySelectorAll('.folder-root > .folder-row > button:first-of-type')].some(element=>element.textContent.slice(2)===name)===present,{},name,present);
}
async function persisted(){
  return page.evaluate(async()=>{
    const db=await new Promise((resolve,reject)=>{
      const request=indexedDB.open('jueony-workspaces',1);
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(request.error);
    });
    try{
      return await new Promise((resolve,reject)=>{
        const request=db.transaction('state').objectStore('state').get('current');
        request.onsuccess=()=>resolve({folders:request.result.folders.map(({name})=>name),split:request.result.split});
        request.onerror=()=>reject(request.error);
      });
    }finally{db.close();}
  });
}
async function abortNextFolderWrite(name,present){
  await page.evaluate((name,present)=>{
    const put=IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put=function(record,...keys){
      const request=put.call(this,record,...keys);
      if(this.name==='state'&&Array.isArray(record?.folders)&&record.folders.some(folder=>folder.name===name)===present){
        IDBObjectStore.prototype.put=put;
        this.transaction.abort();
      }
      return request;
    };
  },name,present);
}
async function saveUnrelatedPreference(){
  const startingSplit=await page.$eval('#sidebar-split',element=>Number(element.getAttribute('aria-valuenow')));
  await page.focus('#sidebar-split');
  await page.keyboard.press('ArrowDown');
  let saved;
  for(let attempt=0;attempt<50;attempt++){
    saved=await persisted();
    if(saved.split===startingSplit+3)return saved;
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  throw Error('Workspace preference change did not persist');
}
async function assertUnavailable(name,reason){
  const outcome=await page.evaluate(async name=>{
    try{
      const entries=[];
      for await(const [entry] of window.nativeTestHandles[name].entries())entries.push(entry);
      return {entries};
    }catch(error){return {name:error.name};}
  },name);
  assert.ok(outcome.name,`Browser still enumerated ${name}: ${JSON.stringify(outcome)}`);
  report[reason]={browserError:outcome.name};
  const expand=await rootButton(name,'expand');
  await expand.click();
  await page.waitForFunction(()=>document.getElementById('app-status').textContent.includes('다시 연결'));
  assert.equal(await expand.evaluate(node=>node.getAttribute('aria-expanded')),'false');
  report[reason].uiStatus=await status();
}
async function disconnect(name){
  await (await rootButton(name,'disconnect')).click();
  await waitForRoot(name,false);
  assert.ok(!(await persisted()).folders.includes(name));
}

try{
  for(let attempt=0;attempt<100;attempt++){
    if(server.exitCode!==null)throw Error('Windows review server stopped');
    if(await fetch(origin+'/api/health').then(response=>response.ok,()=>false))break;
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  browser=await puppeteer.launch({executablePath:process.env.JUEONY_TEST_BROWSER??'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless:true,args:['--disable-background-networking','--no-first-run'],defaultViewport:{width:1440,height:900}});
  page=await browser.newPage();
  page.setDefaultTimeout(12000);
  page.on('pageerror',error=>errors.push(String(error)));
  await page.setRequestInterception(true);
  page.on('request',request=>{
    const url=new URL(request.url());
    if(['http:','https:'].includes(url.protocol)&&url.origin!==origin){
      externalRequests.push(url.origin);void request.abort();
    }else if(denyIndexClear&&url.origin===origin&&url.pathname==='/api/reference-index/clear'){
      deniedIndexClears++;
      void request.respond({status:503,contentType:'application/json',body:JSON.stringify({error:'검수용 색인 연결 오류'})});
    }else void request.continue();
  });
  await page.goto(origin);
  await page.waitForFunction(()=>document.getElementById('app-status').textContent.includes('준비 완료'));
  for(const {name} of fixtureData)await attach(name);
  assert.deepEqual((await persisted()).folders,fixtureData.map(item=>item.name));
  pass('linked three genuine Windows directory handles and read their original files');

  await (await rootButton('rollback-source','selection')).click();
  await page.waitForFunction(()=>document.getElementById('reference-summary').textContent.includes('rollback-source'));
  await abortNextFolderWrite('rollback-source',false);
  await (await rootButton('rollback-source','disconnect')).click();
  await page.waitForFunction(()=>document.getElementById('app-status').textContent.includes('로컬 저장에 실패'));
  assert.ok((await roots()).includes('rollback-source'));
  assert.deepEqual((await saveUnrelatedPreference()).folders,fixtureData.map(item=>item.name));
  await page.waitForFunction(()=>document.getElementById('reference-summary').textContent.includes('rollback-source'));
  pass('failed unlink preserves its persisted link and selected reference during a later settings save');

  const moving=containedPath('moved-source'),moved=containedPath('moved-source-renamed');
  await rename(moving,moved);
  await assertUnavailable('moved-source','moved');
  await disconnect('moved-source');
  const movedAfter=await fileHashes(moved,fixtureData[1].files);
  assert.deepEqual(movedAfter,before.get('moved-source'));
  report.moved.hashes=movedAfter;
  pass('disconnected a moved Windows folder and confirmed both original hashes at its new location');

  changeAcl('/deny',`*${userSid}:(RD)`);
  denied=true;
  await assert.rejects(readdir(aclFolder),error=>error.code==='EACCES'||error.code==='EPERM');
  await assertUnavailable('permissions-source','permissionRevoked');
  await disconnect('permissions-source');
  changeAcl('/remove:d',`*${userSid}`);
  denied=false;
  assert.deepEqual(await readdir(aclFolder),['evidence.txt']);
  const deniedAfter=await fileHashes(aclFolder,fixtureData[2].files);
  assert.deepEqual(deniedAfter,before.get('permissions-source'));
  report.permissionRevoked.hashes=deniedAfter;
  pass('disconnected a Windows folder after an OS read/list permission denial and verified its original bytes');

  await page.click('#ranked-search');
  denyIndexClear=true;
  await disconnect('rollback-source');
  await page.waitForFunction(()=>document.getElementById('app-status').textContent.includes('이전 검색 색인을 정리하지 못했습니다'));
  assert.equal(deniedIndexClears,1);
  denyIndexClear=false;
  await page.reload();
  await page.waitForFunction(()=>document.getElementById('app-status').textContent.includes('준비 완료'));
  assert.deepEqual(await roots(),[]);
  assert.deepEqual((await persisted()).folders,[]);
  await abortNextFolderWrite('rollback-source',true);
  await attach('rollback-source',false);
  assert.deepEqual(await roots(),[]);
  assert.deepEqual((await saveUnrelatedPreference()).folders,[]);
  pass('a failed reconnect stays absent during a later settings save');
  assert.deepEqual(await fileHashes(containedPath('rollback-source'),fixtureData[0].files),before.get('rollback-source'));
  assert.deepEqual(externalRequests,[]);
  assert.deepEqual(errors,[]);
  pass('an index cleanup failure cannot restore a removed link; reopening preserves all three Windows file sets');
}catch(error){
  report.failure=String(error);
  if(page&&!page.isClosed())report.failureStatus=await status().catch(()=>null);
  throw error;
}finally{
  try{
    if(denied)changeAcl('/remove:d',`*${userSid}`);
    await writeFile(join(output,'result.json'),JSON.stringify(report,null,2)+'\n');
  }finally{
    await browser?.close();
    server.kill();
  }
}
