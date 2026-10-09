import puppeteer from 'puppeteer-core';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
const evidence=resolve('evidence/mvp');await mkdir(evidence,{recursive:true});
const calls=[];
const provider=http.createServer(async(req,res)=>{let body='';for await(const chunk of req)body+=chunk;const payload=JSON.parse(body);calls.push(payload);const input=JSON.parse(payload.messages[1].content);const nodes=input.document.nodes;
 const result=input.instruction.includes('초안')?{message:'검증 서버가 새 초안 명령을 반환했습니다.',sourceIds:input.references.map(s=>s.id),operations:[{kind:'create_document',paragraphs:['올해 업무 계획','추진 목적을 정리합니다.','일정을 검토합니다.']}]}
 :{message:'검증 서버가 여러 위치 변경 명령을 반환했습니다.',sourceIds:[],operations:[{kind:'replace_body_text',target:nodes[0].id,start:0,count:Array.from(nodes[0].text).length,text:'수정된 업무 계획'},{kind:'insert_body_paragraphs',after:nodes.at(-1).id,paragraphs:['추가 검토 사항']}]};
 if(input.instruction.includes('지연'))await new Promise(r=>setTimeout(r,2000));
 res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({choices:[{message:{content:JSON.stringify(result)}}]}));});
await new Promise(r=>provider.listen(4194,'127.0.0.1',r));
const browser=await puppeteer.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,args:['--no-first-run','--disable-background-networking'],defaultViewport:{width:1440,height:960}});
const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept(d.type()==='prompt'?'검증 업무 B':undefined));
const results=[];
const pass=(name)=>{results.push(name);console.log('PASS',name);};
const clickText=async(selector,text)=>{const handles=await page.$$(selector);for(const h of handles)if(await h.evaluate((e,t)=>e.textContent.includes(t),text)){await h.click();return;}throw new Error('Missing button '+text);};
const waitIdle=()=>page.waitForFunction(()=>!document.getElementById('send-request').disabled,{timeout:60000});
const snapshot=()=>page.evaluate(()=>[...document.querySelectorAll('.editor-frame')].find(f=>!f.hidden).contentWindow.jueonyEditor.snapshot());
async function send(text){await page.type('#request-input',text);await page.click('#send-request');await page.waitForFunction(()=>document.getElementById('send-request').disabled);await waitIdle();}
try{
 await page.goto('http://127.0.0.1:4193/?storage=download');
 await page.waitForFunction(()=>[...document.querySelectorAll('.editor-frame')].some(f=>f.contentWindow?.jueonyEditor?.snapshot)&&document.getElementById('app-status').textContent.includes('준비 완료'),{timeout:60000});
 assert.equal((await snapshot()).nodes.length,1);pass('three panes and live editor ready');
 await page.click('#connection-settings');await page.type('#config-label','검증용 호환 서버');await page.type('#config-endpoint','http://127.0.0.1:4194/v1');await page.type('#config-model','fixture-model');await page.type('#config-key','test-only-secret');await page.click('#model-form button[type=submit]');
 await page.waitForFunction(()=>!document.getElementById('model-dialog').open);pass('provider and model configuration');
 const fixture=[...await readFile('fixtures/three-paragraphs.hwpx')];
 await page.evaluate(async(bytes)=>{
  const root=await navigator.storage.getDirectory();const a=await root.getDirectoryHandle('검증자료A',{create:true});const sub=await a.getDirectoryHandle('하위',{create:true});const b=await root.getDirectoryHandle('검증자료B',{create:true});
  for(const [dir,name,data] of [[a,'참고.txt','작년 계획: 교육 3회 실시'],[sub,'계획서.hwpx',new Uint8Array(bytes)],[b,'별도.txt','두 번째 폴더 자료']]){const f=await dir.getFileHandle(name,{create:true});const w=await f.createWritable();await w.write(data);await w.close();}
  const queue=[a,b];window.showDirectoryPicker=async()=>queue.shift();
 },fixture);
 await page.click('#add-folder');await page.waitForFunction(()=>document.querySelectorAll('.folder-root').length===1);
 await page.click('#add-folder');await page.waitForFunction(()=>document.querySelectorAll('.folder-root').length===2);pass('two linked directory handles and tree');
 await clickText('.folder-row button','검증자료A');await page.waitForSelector('.file-label');
 await page.evaluate(()=>{const row=[...document.querySelectorAll('.folder-row')].find(r=>r.textContent.includes('참고.txt'));row.querySelector('input').click();});
 await send('지정한 자료를 참고해 올해 계획서 초안을 작성해줘');
 const first=await snapshot();assert.deepEqual(first.nodes.map(n=>n.text),['올해 업무 계획','추진 목적을 정리합니다.','일정을 검토합니다.']);
 assert.equal(calls[0].model,'fixture-model');assert.equal(JSON.parse(calls[0].messages[1].content).references.length,1);pass('chat to real editor new document, selected reference and model passed');
 await send('앞뒤 항목을 수정해줘');
 const changed=await snapshot();assert.equal(changed.nodes[0].text,'수정된 업무 계획');assert.equal(changed.nodes.at(-1).text,'추가 검토 사항');pass('one request edits multiple positions without approval');
 const undo=await page.$$('.message-actions button');await undo.at(-1).click();await page.waitForFunction(()=>document.getElementById('app-status').textContent.includes('되돌렸습니다'));
 assert.deepEqual((await snapshot()).nodes.map(n=>n.text),first.nodes.map(n=>n.text));pass('request-level undo through engine history');
 await page.click('#add-chat');assert.equal(await page.$eval('#messages',e=>e.textContent.includes('올해 계획서')),false);pass('independent chats');
 await page.click('#add-workspace');await page.waitForFunction(()=>document.getElementById('workspace-select').selectedOptions[0].text==='검증 업무 B'&&document.querySelectorAll('.folder-root').length===0);pass('workspace isolation');
 const options=await page.$$eval('#workspace-select option',els=>els.map(e=>({value:e.value,text:e.textContent})));
 await page.select('#workspace-select',options.find(o=>o.text==='내 업무').value);await page.waitForFunction(()=>document.querySelectorAll('.folder-root').length===2);
 await page.screenshot({path:resolve(evidence,'workspace.png'),fullPage:true});
 await page.waitForTimeout?.(2000);await new Promise(r=>setTimeout(r,2200));
 await page.reload();await page.waitForFunction(()=>document.getElementById('app-status').textContent.includes('준비 완료'),{timeout:60000});
 assert.equal(await page.$$eval('#workspace-select option',els=>els.length),2);assert.equal(await page.$$('.folder-root').then(e=>e.length),2);pass('restart restores workspace chats folders and documents');
 await writeFile(resolve(evidence,'result.json'),JSON.stringify({results,errors,provider:'local deterministic protocol fixture; NOT a live LLM',folderAccess:'OPFS directory handles; NOT native Windows picker'},null,2));
 console.log(JSON.stringify({passed:results.length,errors}));
}catch(error){await page.screenshot({path:resolve(evidence,'failure.png'),fullPage:true}).catch(()=>{});await writeFile(resolve(evidence,'failure.json'),JSON.stringify({error:String(error),errors,results},null,2));console.error(error);process.exitCode=1;}finally{await browser.close();provider.close();}
