import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer-core';

const repo=resolve(import.meta.dirname,'../../..');
const dist=resolve(repo,process.env.JUEONY_TEST_DIST),pkg=resolve(repo,process.env.JUEONY_ENGINE_PACKAGE);
const out=resolve(repo,process.env.JUEONY_TEST_OUTPUT);
const port=Number(process.env.JUEONY_TEST_PORT??5091),providerPort=port+1;
const origin='http://127.0.0.1:'+port,providerOrigin='http://127.0.0.1:'+providerPort;
const localModelPort=process.env.JUEONY_TEST_MACRO_LOCAL_MODEL_PORT;
if(localModelPort!==undefined)assert.match(localModelPort,/^[1-9]\d{0,4}$/u);
const localModelEndpoint=localModelPort&&new URL('/v1/chat/completions','http://127.0.0.1:'+localModelPort);
const wait=ms=>new Promise(done=>setTimeout(done,ms));
await mkdir(out,{recursive:true});
const {default:init,HwpDocument}=await import(pathToFileURL(resolve(pkg,'rhwp.js')).href);
await init({module_or_path:await readFile(resolve(pkg,'rhwp_bg.wasm'))});
const build=JSON.parse(await readFile(resolve(dist,'build-evidence.json'),'utf8'));
const engine=JSON.parse(await readFile(resolve(pkg,'jueony-engine-build.json'),'utf8'));
assert.equal(build.engineWasmSha256,engine.wasmSha256);
const results=[],failures=[],providerCalls=[],pageErrors=[],externalRequests=[],consoleErrors=[];
let browser,page,alterResponse=false;

const provider=createServer(async(req,res)=>{
  try{
    let raw='';for await(const chunk of req)raw+=chunk;
    const input=JSON.parse(JSON.parse(raw).messages[1].content);
    const generation={message:'기록한 입력과 정렬을 재생했습니다.',sourceIds:[],operations:[]};
    if(input.document.revision!=='connection-test'){
      assert.deepEqual(input.references,[]);
      assert.equal(input.document.name,'불러온 본문 편집 기록');
      assert(input.document.nodes.every(node=>node.text==='편집 대상 문단'));
      assert.doesNotMatch(JSON.stringify(input),/업무 원문|보존할 문단|사업 원문|TES|manual-source/u);
      const request=JSON.parse(input.instruction.split('\n').at(-1));
      const text=request.operations.find(op=>op.kind==='replace_body_text');
      assert.match(text.text,/^\[\[RECORDED_TEXT_\d+\]\]$/u);
      const useLocalModel=Boolean(localModelEndpoint&&!alterResponse);
      providerCalls.push({operations:structuredClone(request.operations),altered:alterResponse,localModel:useLocalModel});
      if(useLocalModel){
        const response=await fetch(localModelEndpoint,{method:'POST',redirect:'error',
          headers:{'Content-Type':'application/json'},body:raw,signal:AbortSignal.timeout(200_000)});
        res.writeHead(response.status,{'Content-Type':'application/json'});
        res.end(await response.text());
        return;
      }
      if(alterResponse)text.text='[[OTHER_TEXT]]';
      generation.operations=request.operations;
    }
    res.setHeader('Content-Type','application/json');
    res.end(JSON.stringify({choices:[{message:{content:JSON.stringify(generation)}}]}));
  }catch(error){res.writeHead(500);res.end(String(error));}
});
for(const address of [origin+'/api/health',providerOrigin])assert.equal(await fetch(address).then(()=>true,()=>false),false,'test port occupied');
await new Promise((done,fail)=>provider.listen(providerPort,'127.0.0.1',done).once('error',fail));
const server=spawn(process.execPath,[process.env.JUEONY_TEST_SERVER??'apps/launcher/server.mjs'],{cwd:repo,windowsHide:true,stdio:'ignore',
  env:{...process.env,JUEONY_PORT:String(port),JUEONY_DIST:dist,JUEONY_CONNECTION_STORE:'memory'}});

function fixture(format){
  const doc=HwpDocument.createEmpty();
  try{
    doc.createBlankDocument();doc.insertText(0,0,0,'업무 원문 😀 끝');
    doc.splitParagraph(0,0,doc.getParagraphLength(0,0));doc.insertText(0,1,0,'보존할 문단');
    return format==='hwp'?doc.exportHwp():doc.exportHwpx();
  }finally{doc.free();}
}
const frame=async()=>(await page.$('.editor-frame:not([hidden])')).contentFrame();
async function open(format,bytes){
  const f=await frame();
  await f.evaluate(async(byteArray,format)=>{
    const automation=window.rhwpStudio.automation;
    if(!window.__manualMacroServices){
      automation.registerCommand({id:'ext:manual-macro-inspect',label:'검수',canExecute:()=>true,execute:s=>window.__manualMacroServices=s});
      automation.execute('ext:manual-macro-inspect');automation.unregisterCommand('ext:manual-macro-inspect');
    }
    const name='manual-source.'+format,root=await navigator.storage.getDirectory();
    const handle=await root.getFileHandle(name,{create:true}),writable=await handle.createWritable();
    await writable.write(new Uint8Array(byteArray));await writable.close();
    await window.jueonyEditor.open(new Uint8Array(byteArray),name,handle,false);
  },[...bytes],format);
  return f;
}
async function move(f,start,end=start){
  await f.evaluate(({start,end})=>{
    const input=window.__manualMacroServices.getInputHandler();
    const cursor=input.cursor,w=window.__manualMacroServices.wasm;
    cursor.clearSelection();
    const position=charOffset=>({sectionIndex:0,paragraphIndex:0,charOffset:charOffset<0?w.getParagraphLength(0,0):charOffset});
    cursor.moveTo(position(start));
    if(start!==end){cursor.setAnchor();cursor.moveTo(position(end));input.updateSelection();}
    input.updateCaret();input.focus();
  },{start,end});
}
async function body(f){return f.evaluate(()=>{
  const w=window.__manualMacroServices.wasm;
  return {text:[0,1].map(p=>w.getTextRange(0,p,0,w.getParagraphLength(0,p))),alignment:w.getParaPropertiesAt(0,0).alignment};
});}
const revisionBytes=async f=>f.evaluate(()=>[...window.jueonyEditor.recovery().bytes]);
const button=async id=>page.click('#'+id);
const ready=()=>page.waitForFunction(()=>document.getElementById('app-status').textContent.includes('준비 완료'));
async function importRecord(path){
  await button('macro-manager');
  const selected=page.waitForFileChooser();
  await button('import-alignment-macro');
  await (await selected).accept([path]);
  await page.waitForFunction(()=>document.getElementById('alignment-macro-status').textContent.includes('기록한 편집'));
}
async function loadRecord(){
  await button('macro-manager');
  await page.$eval('#alignment-library-select',select=>select.selectedIndex=select.options.length-1);
  await button('load-alignment-record');
  await page.waitForFunction(()=>document.getElementById('alignment-macro-status').textContent.includes('기록한 편집'));
}
async function configure(){
  await button('connection-settings');await page.waitForSelector('#model-dialog[open]');await button('new-connection');
  await page.select('#config-adapter','openai-compatible');
  for(const [id,value] of [['config-label','수동 편집 검수'],['config-endpoint',providerOrigin+'/v1'],['config-model','local-macro-test'],['config-key','synthetic-macro-key']]){
    await page.$eval('#'+id,(field,next)=>{field.value=next;field.dispatchEvent(new Event('input',{bubbles:true}));},value);
  }
  await page.click('#model-form button[type=submit]');await page.waitForFunction(()=>!document.getElementById('model-dialog').open);
}

try{
  for(let index=0;index<100;index++){
    if(await fetch(origin+'/api/health').then(response=>response.ok,()=>false))break;
    await wait(100);
  }
  browser=await puppeteer.launch({executablePath:process.env.JUEONY_TEST_BROWSER??'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    headless:true,userDataDir:resolve(out,'profile'),args:['--no-first-run','--disable-background-networking'],defaultViewport:{width:1400,height:1000}});
  page=await browser.newPage();page.on('pageerror',error=>pageErrors.push(String(error)));page.on('console',message=>{
    if(message.type()==='error')consoleErrors.push(message.text());
  });page.on('dialog',dialog=>dialog.accept());
  await page.setRequestInterception(true);page.on('request',request=>{
    if(request.url().startsWith(origin)||request.url().startsWith('blob:')||request.url().startsWith('data:'))void request.continue();
    else {externalRequests.push(request.url());void request.abort();}
  });
  const cdp=await page.target().createCDPSession();
  await cdp.send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:out});
  await page.goto(origin);await ready();
  await configure();
  for(const format of ['hwp','hwpx']){
    try{
      const source=fixture(format);
      let f=await open(format,source);
      const original=await body(f),originalBytes=await revisionBytes(f);
      await button('macro-manager');await button('start-alignment-macro');
      await move(f,-1);await page.keyboard.type(' TEST');await page.keyboard.press('Backspace');
      await move(f,0,2);await cdp.send('Input.insertText',{text:'사업'});
      await move(f,-1);await cdp.send('Input.imeSetComposition',{text:'ㅎ',selectionStart:1,selectionEnd:1});
      await cdp.send('Input.imeSetComposition',{text:'한글',selectionStart:2,selectionEnd:2});
      await cdp.send('Input.insertText',{text:'한글'});
      assert.equal((await f.evaluate(()=>window.jueonyEditor.executeCommand('format:align-center'))).ok,true);
      const applied=await body(f);
      assert.deepEqual(applied,{text:['사업 원문 😀 끝 TES한글','보존할 문단'],alignment:'center'});
      await button('macro-manager');await button('finish-alignment-macro');
      await page.waitForFunction(()=>document.getElementById('app-status').textContent.includes('본문 편집 매크로를 이 업무에 기록'));
      if(format==='hwp'){
        await button('export-alignment-macro');
        for(let index=0;index<80&&!(await readdir(out)).includes('jueony-manual-edit.json');index++)await wait(50);
        const exported=JSON.parse(await readFile(resolve(out,'jueony-manual-edit.json'),'utf8'));
        assert(exported.steps.some(step=>step.commandId==='format:align-center'));
        assert.equal(exported.steps.filter(step=>step.arguments.text==='한글').length,1);
        assert(!exported.steps.some(step=>step.arguments.text==='ㅎ'));
      }
      await button('close-macros');
      if(format==='hwpx'){await page.reload();await ready();}
      f=await open(format,source);
      if(format==='hwp')await importRecord(resolve(out,'jueony-manual-edit.json'));
      else await loadRecord();
      await button('replay-alignment-macro');
      await page.waitForFunction(()=>document.getElementById('app-status').textContent.includes('본문 편집 매크로를 재생'));
      assert.deepEqual(await body(f),applied);
      assert.equal((await f.evaluate(()=>window.jueonyEditor.executeCommand('edit:undo'))).ok,true);
      assert.deepEqual(await body(f),original);
      assert.deepEqual(await revisionBytes(f),originalBytes);

      await open(format,source);
      for(const altered of [true,false]){
        alterResponse=altered;
        await loadRecord();await button('agent-alignment-macro');
        assert.equal(await page.$eval('#request-input',input=>input.value),'불러온 편집 기록 적용');
        const response=page.waitForResponse(r=>r.url()===origin+'/api/generate',{timeout:localModelEndpoint?210_000:30_000});
        await button('send-request');await response;
        await page.waitForFunction(()=>!document.getElementById('send-request').disabled);
        const error=await page.$eval('#request-error',element=>element.hidden?'':element.textContent);
        if(altered){assert.match(error,/다른 편집을 제안/u);assert.deepEqual(await revisionBytes(f),originalBytes);}
        else {assert.equal(error,'');assert.deepEqual(await body(f),applied);}
      }
      const saved=await f.evaluate(async()=>{
        const api=window.jueonyEditor,status=await api.save(),file=await api.fileHandle().getFile();
        return {status,bytes:[...new Uint8Array(await file.arrayBuffer())]};
      });
      assert.equal(saved.status,'saved');
      const reopened=new HwpDocument(new Uint8Array(saved.bytes));
      try{
        assert.equal(reopened.getSourceFormat(),format);
        assert.equal(reopened.getTextRange(0,0,0,reopened.getParagraphLength(0,0)),applied.text[0]);
        assert.equal(JSON.parse(reopened.getParaPropertiesAt(0,0)).alignment,'center');
      }finally{reopened.free();}
      assert.equal((await f.evaluate(()=>window.jueonyEditor.executeCommand('edit:undo'))).ok,true);
      assert.deepEqual(await revisionBytes(f),originalBytes);
      results.push({format,recordedKeyboard:true,committedComposition:true,replayed:format==='hwp'?'json-import':'workspace-reload',modelPlaceholder:true,originalRestored:true});
      console.log('PASS',format,'actual keyboard, IME commit, stored replay, private model exchange, save and undo');
    }catch(error){failures.push({format,message:String(error),stack:error.stack});console.error('FAIL',format,error);await page.screenshot({path:resolve(out,format+'-failure.png')});}
  }
  if(!failures.length){
    const f=await open('hwpx',fixture('hwpx'));
    await button('macro-manager');await button('start-alignment-macro');
    await f.evaluate(()=>{
      const input=window.__manualMacroServices.getInputHandler();
      input.cursor.moveTo({sectionIndex:0,paragraphIndex:0,charOffset:3});input.cursor.setAnchor();
      input.cursor.moveTo({sectionIndex:0,paragraphIndex:1,charOffset:2});input.updateSelection();input.focus();
    });
    await page.keyboard.press('Delete');
    await page.waitForFunction(()=>document.getElementById('app-status').textContent.includes('한 일반 본문 문단'));
    await button('macro-manager');
    assert.equal(await page.$eval('#finish-alignment-macro',button=>button.disabled),true);
    assert.equal(await page.$$eval('#alignment-library-select option',entries=>entries.length),2);
    await button('close-macros');
    assert.equal((await f.evaluate(()=>window.jueonyEditor.executeCommand('edit:undo'))).ok,true);
    assert.deepEqual((await body(f)).text,['업무 원문 😀 끝','보존할 문단']);
    results.push({crossParagraphRecordingRefused:true,userUndoAvailable:true});
    console.log('PASS multi-paragraph selection cancels recording and retains normal Undo');
  }
  assert.deepEqual(pageErrors,[]);assert.deepEqual(consoleErrors,[]);assert.deepEqual(externalRequests,[]);
}finally{
  await writeFile(resolve(out,'result.json'),JSON.stringify({build,engine,results,failures,providerCalls,pageErrors,consoleErrors,externalRequests},null,2));
  await browser?.close();server.kill();provider.closeAllConnections();await new Promise(done=>provider.close(done));
}
if(failures.length)process.exitCode=1;
