import puppeteer from 'puppeteer-core';
import {mkdir,readFile,writeFile,readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import init,{HwpDocument} from '@rhwp/core';
await init({module_or_path:await readFile('node_modules/@rhwp/core/rhwp_bg.wasm')});
const appUrl=process.env.JUEONY_TEST_URL??'http://127.0.0.1:4193/';
const evidence=resolve('evidence/mvp');await mkdir(evidence,{recursive:true});
const calls=[];
const provider=http.createServer(async(req,res)=>{let body='';for await(const chunk of req)body+=chunk;const payload=JSON.parse(body);calls.push(payload);const input=JSON.parse(payload.messages[1].content);const nodes=input.document.nodes;
 const result=input.instruction.includes('읽기')?{message:'자료를 확인했습니다.',sourceIds:input.references.map(s=>s.id),operations:[]}:input.instruction.includes('초안')?{message:'검증 서버가 새 초안 명령을 반환했습니다.',sourceIds:input.references.map(s=>s.id),operations:[{kind:'create_document',paragraphs:['올해 업무 계획','추진 목적을 정리합니다.','일정을 검토합니다.']}]}
 :{message:'검증 서버가 여러 위치 변경 명령을 반환했습니다.',sourceIds:[],operations:[{kind:'replace_body_text',target:nodes[0].id,start:0,count:Array.from(nodes[0].text).length,text:'수정된 업무 계획'},{kind:'insert_body_paragraphs',after:nodes.at(-1).id,paragraphs:['추가 검토 사항']}]};
 if(input.instruction.includes('지연'))await new Promise(r=>setTimeout(r,2000));
 res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({choices:[{message:{content:JSON.stringify(result)}}]}));});
await new Promise(r=>provider.listen(4194,'127.0.0.1',r));
const browser=await puppeteer.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,args:['--no-first-run','--disable-background-networking'],defaultViewport:{width:1440,height:960}});
const page=await browser.newPage();const errors=[],externalRequests=[];page.on('request',r=>{if(/^https?:/.test(r.url())&&new URL(r.url()).origin!==new URL(appUrl).origin)externalRequests.push(r.url());});page.on('pageerror',e=>{errors.push(e.stack??e.message);console.error('PAGE',e.stack)});page.on('dialog',d=>d.accept(d.type()==='prompt'?'검증 업무 B':undefined));
const results=[];const downloads=await browser.target().createCDPSession();
const activeFrame=async()=>{const h=await page.$('.editor-frame:not([hidden])');return h.contentFrame();};
async function saveArtifact(stage,expected){
 const dir=resolve(evidence,'downloads',stage+'-'+Date.now());await mkdir(dir,{recursive:true});
 await downloads.send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:dir});
 await page.click('#save-document');const frame=await activeFrame();
 await frame.waitForFunction(()=>document.querySelector('.modal-overlay input[type=text]')||document.getElementById('jueony-download-confirm'));
 const name=await frame.$('.modal-overlay input[type=text]');if(name){await name.evaluate(e=>{e.value='mvp-review.hwp';});await frame.click('.modal-overlay .dialog-btn-primary');}
 await frame.waitForSelector('#jueony-download-confirm');
 let files=[];for(let i=0;i<80;i++){files=(await readdir(dir)).filter(f=>f.endsWith('.hwp'));if(files.length)break;await new Promise(r=>setTimeout(r,100));}
 assert.ok(files.length,'actual HWP download');const bytes=await readFile(resolve(dir,files[0]));const doc=new HwpDocument(bytes);
 try{const body=Array.from({length:doc.getParagraphCount(0)},(_,p)=>doc.getTextRange(0,p,0,doc.getParagraphLength(0,p)));assert.deepEqual(body,expected);
 await writeFile(resolve(evidence,stage+'.hwp'),bytes);const hwpx=doc.exportHwpx();await writeFile(resolve(evidence,stage+'.hwpx'),hwpx);const second=new HwpDocument(hwpx);try{assert.deepEqual(Array.from({length:second.getParagraphCount(0)},(_,p)=>second.getTextRange(0,p,0,second.getParagraphLength(0,p))),expected);}finally{second.free();}
 }finally{doc.free();}
 await frame.click('#jueony-download-confirm button[value=saved]');await page.waitForFunction(()=>document.getElementById('app-status').textContent.includes('파일에 저장'));
}
async function engineEdit(text){return page.evaluate(async(text)=>{const api=[...document.querySelectorAll('.editor-frame')].find(f=>!f.hidden).contentWindow.jueonyEditor;for(let i=0;i<100&&api.busy();i++)await new Promise(r=>setTimeout(r,100));const s=api.snapshot();return api.apply(crypto.randomUUID(),s,{message:'동시 편집 검증',sourceIds:[],operations:[{kind:'replace_body_text',target:s.nodes[0].id,start:0,count:Array.from(s.nodes[0].text).length,text}]});},text);}
const pass=(name)=>{results.push(name);console.log('PASS',name);};
const clickText=async(selector,text)=>{const handles=await page.$$(selector);for(const h of handles)if(await h.evaluate((e,t)=>e.textContent.includes(t),text)){await h.click();return;}throw new Error('Missing button '+text);};
const waitIdle=()=>page.waitForFunction(()=>!document.getElementById('send-request').disabled,{timeout:60000});
const snapshot=()=>page.evaluate(()=>[...document.querySelectorAll('.editor-frame')].find(f=>!f.hidden).contentWindow.jueonyEditor.snapshot());
async function send(text){await page.type('#request-input',text);await page.click('#send-request');await page.waitForFunction(()=>document.getElementById('send-request').disabled);await waitIdle();}
try{
 await page.goto(appUrl+'?storage=download');
 await page.waitForFunction(()=>[...document.querySelectorAll('.editor-frame')].some(f=>f.contentWindow?.jueonyEditor?.snapshot)&&document.getElementById('app-status').textContent.includes('준비 완료'),{timeout:60000});
 assert.equal((await snapshot()).nodes.length,1);pass('three panes and live editor ready');
 const duplicate=await browser.newPage();await duplicate.goto(appUrl);await duplicate.waitForFunction(()=>document.getElementById('app-status').textContent.includes('다른 Jueony 창'));assert.equal(await duplicate.$eval('#app-shell',e=>e.inert),true);await duplicate.close();pass('second window cannot overwrite workspace storage');
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
 await saveArtifact('01-created',first.nodes.map(n=>n.text));
 await send('앞뒤 항목을 수정해줘');
 const changed=await snapshot();assert.equal(changed.nodes[0].text,'수정된 업무 계획');assert.equal(changed.nodes.at(-1).text,'추가 검토 사항');pass('one request edits multiple positions without approval');
 await saveArtifact('02-applied',changed.nodes.map(n=>n.text));
 const undo=await page.$$('.message-actions button');await undo.at(-1).click();await page.waitForFunction(()=>document.getElementById('app-status').textContent.includes('되돌렸습니다'));
 assert.deepEqual((await snapshot()).nodes.map(n=>n.text),first.nodes.map(n=>n.text));pass('request-level undo through engine history');
 await saveArtifact('03-reverted',first.nodes.map(n=>n.text));pass('actual HWP UI downloads and HWP/HWPX round trips for created/applied/reverted documents');
 await page.type('#request-input','지연 수정');await page.click('#send-request');await page.waitForFunction(()=>document.getElementById('run-status').textContent.includes('응답 대기'));await page.click('#cancel-run');await waitIdle();await new Promise(r=>setTimeout(r,2200));assert.deepEqual((await snapshot()).nodes.map(n=>n.text),first.nodes.map(n=>n.text));pass('cancelled late response does not edit');
 await page.type('#request-input','지연 수정');await page.click('#send-request');await page.waitForFunction(()=>document.getElementById('run-status').textContent.includes('응답 대기'));await engineEdit('사용자 동시 편집');await waitIdle();assert.equal((await snapshot()).nodes[0].text,'사용자 동시 편집');assert.match(await page.$eval('#messages',e=>e.textContent),/충돌/);pass('concurrent engine mutation rejects stale generation');
 await send('앞뒤 수정');await engineEdit('후속 사용자 편집 보존');const latestUndo=await page.$$('.message-actions button');await latestUndo.at(-1).click();await page.waitForFunction(()=>document.getElementById('app-status').textContent.includes('문서가 변경'));assert.equal((await snapshot()).nodes[0].text,'후속 사용자 편집 보존');pass('request undo cannot erase a later edit');
 await clickText('.file-label','하위');await page.waitForFunction(()=>[...document.querySelectorAll('.file-label')].some(e=>e.textContent==='계획서.hwpx'));await clickText('.file-label','계획서.hwpx');await page.waitForFunction(()=>[...document.querySelectorAll('.editor-frame')].find(f=>!f.hidden)?.contentWindow?.jueonyEditor?.state().name==='계획서.hwpx');
 await engineEdit('참고 문서의 미저장 최신 내용');await page.evaluate(()=>{const row=[...document.querySelectorAll('.folder-row')].find(r=>r.textContent==='계획서.hwpx');row.querySelector('input').click();});await send('참고 자료 읽기');const liveInput=JSON.parse(calls.at(-1).messages[1].content);assert.ok(liveInput.references.some(r=>r.text.includes('참고 문서의 미저장 최신 내용')&&r.limitation.includes('미저장')));pass('tree HWPX opens and selected live reference includes unsaved content');
 const dbState=await page.evaluate(()=>new Promise((resolve,reject)=>{const r=indexedDB.open('jueony-workspaces');r.onsuccess=()=>{const db=r.result;const get=db.transaction('state').objectStore('state').get('current');get.onsuccess=()=>{resolve(JSON.stringify(get.result));db.close();};get.onerror=()=>reject(get.error);};}));assert.ok(!dbState.includes('test-only-secret'));pass('credential absent from persisted app state');
 await page.click('#sidebar-split');await page.keyboard.press('ArrowDown');const splitValue=await page.$eval('#sidebar-split',e=>e.getAttribute('aria-valuenow'));
 await page.click('#add-chat');assert.equal(await page.$eval('#messages',e=>e.textContent.includes('올해 계획서')),false);pass('independent chats');
 await page.click('#add-workspace');await page.waitForFunction(()=>document.getElementById('workspace-select').selectedOptions[0].text==='검증 업무 B'&&document.querySelectorAll('.folder-root').length===0);assert.equal(await page.$$eval('.document-tab-wrap',els=>els.filter(e=>getComputedStyle(e).display!=='none').length),1);pass('workspace isolation');
 const options=await page.$$eval('#workspace-select option',els=>els.map(e=>({value:e.value,text:e.textContent})));
 await page.select('#workspace-select',options.find(o=>o.text==='내 업무').value);await page.waitForFunction(()=>document.querySelectorAll('.folder-root').length===2);
 await page.screenshot({path:resolve(evidence,'workspace.png'),fullPage:true});
 await new Promise(r=>setTimeout(r,2200));
 await page.reload();await page.waitForFunction(()=>document.getElementById('app-status').textContent.includes('준비 완료'),{timeout:60000});
 assert.equal(await page.$eval('#sidebar-split',e=>e.getAttribute('aria-valuenow')),splitValue);
 assert.equal((await snapshot()).nodes[0].text,'참고 문서의 미저장 최신 내용');
 const inputFrame=await activeFrame();await inputFrame.focus('[aria-label="문서 편집 입력"]');await page.keyboard.type('X');await page.waitForFunction(()=>[...document.querySelectorAll('.editor-frame')].find(f=>!f.hidden).contentWindow.jueonyEditor.snapshot().nodes.some(n=>n.text.includes('X')));pass('manual keyboard input changes the same live document');
 assert.equal(await page.$$eval('#workspace-select option',els=>els.length),2);assert.equal(await page.$$('.folder-root').then(e=>e.length),2);pass('restart restores workspace chats folders and documents');
 await page.click('#connection-settings');await page.click('#clear-credentials');await page.waitForFunction(()=>document.getElementById('config-status').textContent.includes('모두 삭제'));await page.click('#close-settings');pass('connection credentials can be cleared explicitly');
 await writeFile(resolve(evidence,'result.json'),JSON.stringify({results,errors,externalRequests,runtime:await browser.version(),build:await page.evaluate(()=>fetch('/build-evidence.json').then(r=>r.json())),provider:'local deterministic protocol fixture; NOT a live LLM',folderAccess:'OPFS directory handles; NOT native Windows picker'},null,2));
 assert.deepEqual(errors,[]);assert.deepEqual(externalRequests,[]);console.log(JSON.stringify({passed:results.length,errors}));
}catch(error){await page.screenshot({path:resolve(evidence,'failure.png'),fullPage:true}).catch(()=>{});await writeFile(resolve(evidence,'failure.json'),JSON.stringify({error:String(error),errors,results,status:await page.$eval('#app-status',e=>e.textContent).catch(()=>''),frames:await page.$$eval('.editor-frame',els=>els.map(e=>({hidden:e.hidden,ready:!!e.contentWindow?.jueonyEditor,name:e.contentWindow?.jueonyEditor?.state().name})))},null,2));console.error(error);process.exitCode=1;}finally{await browser.close();provider.close();}
