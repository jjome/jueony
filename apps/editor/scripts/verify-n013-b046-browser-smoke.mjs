import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {mkdir, readFile, rm, writeFile} from 'node:fs/promises';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import puppeteer from 'puppeteer-core';
import init, {HwpDocument} from '../node_modules/@rhwp/core/rhwp.js';

const app=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const repo=resolve(app,'../..');
const dist=resolve(process.env.JUEONY_TEST_DIST??join(app,'evidence/dist-format-dialog-seam'));
const out=resolve(process.env.JUEONY_TEST_OUTPUT??join(app,'evidence/n013-b046-browser-smoke'));
const port=Number(process.env.JUEONY_TEST_PORT??4681),origin=`http://127.0.0.1:${port}`;
const delay=ms=>new Promise(done=>setTimeout(done,ms));
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
const digest=value=>createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
const sameBytes=(left,right)=>left.length===right.length&&left.every((value,index)=>value===right[index]);
const bytesFrom=async page=>page.evaluate(()=>Array.from(window.jueonyEditor.recovery().bytes));
const stateFrom=async page=>page.evaluate(()=>window.jueonyEditor.state());
const readDoc=bytes=>new HwpDocument(new Uint8Array(bytes));
const results=[],pageErrors=[],consoleErrors=[],expectedStartupErrors=[],externalRequests=[];
const pass=(name,detail)=>{results.push({name,...(detail?{detail}:{})});console.log('PASS',name);};
const shape=()=>({fontFamilies:Array(7).fill('함초롬바탕'),fontSize:1000,bold:false,italic:false,underline:false,strikethrough:false,subscript:false,superscript:false,emboss:false,engrave:false,kerning:false,underlineColor:'#000000',strikeColor:'#000000',textColor:'#000000',shadeColor:'#ffffff',shadowColor:'#000000',underlineType:'None',shadowType:0,outlineType:0,emphasisDot:0,underlineShape:0,strikeShape:0,shadowOffsetX:0,shadowOffsetY:0,ratios:Array(7).fill(100),spacings:Array(7).fill(0),relativeSizes:Array(7).fill(100),charOffsets:Array(7).fill(0)});
const para=()=>({alignment:'justify',lineSpacingType:'Percent',lineSpacing:160,marginLeft:0,marginRight:0,indent:0,spacingBefore:0,spacingAfter:0,widowOrphan:false,keepWithNext:false,keepLines:false,pageBreakBefore:false,fontLineHeight:false,singleLine:false,autoSpaceKrEn:false,autoSpaceKrNum:false,borderConnect:false,borderIgnoreMargin:false,verticalAlign:0,englishBreakUnit:0,koreanBreakUnit:0});

await mkdir(out,{recursive:true});
await init({module_or_path:await readFile(new URL('../node_modules/@rhwp/core/rhwp_bg.wasm',import.meta.url))});
const fixture=HwpDocument.createEmpty();fixture.createBlankDocument();fixture.insertText(0,0,0,'브라우저 스타일 번호키 검증');
const fixtureBytes=fixture.exportHwpx(),catalog=JSON.parse(fixture.getStyleList()),initialStyle=JSON.parse(fixture.getStyleAt(0,0));
const target=catalog.find(style=>style.type===0&&style.id!==initialStyle.id&&catalog.filter(other=>other.name.normalize('NFC')===style.name.normalize('NFC')).length===1);
assert.ok(target,'a unique alternate paragraph style is required');fixture.free();
const profile={format:'jueony-style-gallery-profile',version:1,id:'browser.smoke',name:'브라우저 검증',organization:'Jueony 검증',gallery:[{id:'current',label:'현재 문서',package:{format:'jueony-styles',version:1,styles:[{name:'검증 패키지 스타일',englishName:'BrowserSmokePackage',type:0,next:0,char:shape(),para:para()}]}}],shortcuts:[{slot:0,styleName:target.name}]};
const profileSha256=digest(profile),documentSha256=digest(catalog);
const shortcut={format:'jueony-style-shortcut-profile',version:1,profileId:profile.id,profileName:profile.name,entryId:'current',profileSha256,documentSha256,slots:[{slot:0,styleId:target.id,styleName:target.name,styleType:0,source:'document'}]};

if(await fetch(origin).then(()=>true,()=>false))throw new Error(`Test port ${port} is occupied`);
const server=spawn(process.execPath,['apps/launcher/server.mjs'],{cwd:repo,windowsHide:true,stdio:'ignore',env:{...process.env,JUEONY_PORT:String(port),JUEONY_DIST:dist,JUEONY_CONNECTION_STORE:'memory'}});
let browser,page,peer,stage='server startup',profileDir;
async function intercept(target){
  target.on('pageerror',error=>pageErrors.push(String(error)));
  target.on('console',message=>{if(message.type()==='error'){const text=message.text();if(/새 문서 생성 실패:.*새 문서 날짜 초기화/u.test(text))expectedStartupErrors.push(text);else consoleErrors.push(text);}});
  target.on('dialog',dialog=>dialog.dismiss());
  await target.setRequestInterception(true);
  target.on('request',request=>{if(/^https?:/u.test(request.url())&&!request.url().startsWith(origin+'/')){externalRequests.push(request.url());void request.abort();}else void request.continue();});
}
async function ready(target){
  await target.waitForFunction(()=>window.jueonyEditor?.open&&window.jueonyEditor?.snapshot&&window.rhwpStudio?.automation,{timeout:90000});
  await target.evaluate(()=>window.jueonyEditor.ready);
}
async function openFixture(target,name='n013-b046-smoke.hwpx'){
  await target.evaluate(async({bytes,name})=>window.jueonyEditor.open(new Uint8Array(bytes),name,null,false),{bytes:Array.from(fixtureBytes),name});
  await target.waitForFunction(name=>window.jueonyEditor.state().name===name&&!window.jueonyEditor.busy(),{timeout:30000},name);
}
async function seedShortcut(target,record=shortcut){
  await target.evaluate(({profile,record})=>{localStorage.setItem('jueony-style-gallery-profile',JSON.stringify(profile));localStorage.setItem('jueony-style-shortcut-profile',JSON.stringify(record));},{profile,record});
}
async function focusAndShortcut(target){
  await target.evaluate(()=>window.jueonyEditor.focusEditor());
  await target.keyboard.down('Control');await target.keyboard.press('1');await target.keyboard.up('Control');await delay(120);
}
async function outline(target){return target.evaluate(()=>{
  const scroll=document.getElementById('scroll-content'),canvas=scroll?.querySelector('canvas.document-page-canvas'),pages=[...scroll?.querySelectorAll('canvas.document-page-canvas')??[]].map(node=>{const rect=node.getBoundingClientRect();return{top:rect.top,bottom:rect.bottom,height:rect.height,shadow:getComputedStyle(node).boxShadow};});
  const gaps=pages.slice(1).map((item,index)=>Math.round((item.top-pages[index].bottom)*100)/100);
  return{hidden:scroll?.classList.contains('page-outline-hidden')===true,shadow:canvas?getComputedStyle(canvas).boxShadow:null,gaps,menuChecked:document.querySelector('[data-cmd="view:page-outline"]')?.getAttribute('aria-checked'),statusPressed:document.getElementById('sb-page-outline')?.getAttribute('aria-pressed'),settings:localStorage.getItem('rhwp-settings')};
});}
try{
  for(let i=0;i<120;i++){if(server.exitCode!==null)throw new Error('Test server exited');if(await fetch(origin+'/api/health').then(response=>response.ok,()=>false))break;await delay(100);}
  stage='browser launch';
  profileDir=join(out,`edge-${Date.now()}`);
  browser=await puppeteer.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,userDataDir:profileDir,protocolTimeout:120000,defaultViewport:{width:1500,height:1050},args:['--no-first-run','--disable-background-networking','--disable-background-timer-throttling','--disable-renderer-backgrounding']});
  page=await browser.newPage();await intercept(page);await page.goto(origin+'/editor.html?storage=download&skipRecovery=1');await ready(page);await openFixture(page);

  stage='N013 settings UI';await seedShortcut(page);
  await page.evaluate(()=>[...document.querySelectorAll('#jueony-title button')].find(button=>button.textContent==='스타일 번호키')?.click());
  await page.waitForFunction(name=>document.querySelector('dialog[open]')?.textContent.includes(`Ctrl+1 → ${name}`),{},target.name);
  let dialog=await page.evaluate(()=>({text:document.querySelector('dialog[open]')?.textContent,status:document.querySelector('dialog[open] [role=status]')?.textContent}));
  assert.match(dialog.text, new RegExp(`Ctrl\\+1 → ${target.name}`));assert.match(dialog.status,/현재 문서와 연결됨/u);
  const dialogBefore=await bytesFrom(page),dialogState=await stateFrom(page);await focusAndShortcut(page);assert.deepEqual(await stateFrom(page),dialogState);assert.ok(sameBytes(dialogBefore,await bytesFrom(page)));
  await page.evaluate(()=>[...document.querySelectorAll('dialog[open] button')].find(button=>button.textContent==='해제')?.click());
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('jueony-style-shortcut-profile')).slots.length),0);
  await page.evaluate(()=>[...document.querySelectorAll('dialog[open] button')].find(button=>button.textContent==='기본 번호키로 재설정')?.click());
  assert.equal(await page.evaluate(()=>localStorage.getItem('jueony-style-shortcut-profile')),null);
  assert.match(await page.evaluate(()=>document.querySelector('dialog[open] [role=status]')?.textContent),/사용자 지정이 없습니다/u);
  await page.evaluate(()=>[...document.querySelectorAll('dialog[open] button')].find(button=>button.textContent==='닫기')?.click());
  pass('N013 settings UI shows, clears and resets the exact slot mapping; dialog blocks execution');

  stage='N013 valid shortcut and reopen';await seedShortcut(page);
  const baseline=await bytesFrom(page),baselineState=await stateFrom(page);await focusAndShortcut(page);
  const applied=await bytesFrom(page),appliedState=await stateFrom(page);assert.notEqual(appliedState.revision,baselineState.revision);assert.equal(appliedState.dirty,true);assert.equal(sameBytes(applied,baseline),false);
  let reopened=readDoc(applied);try{assert.equal(JSON.parse(reopened.getStyleAt(0,0)).id,target.id);assert.equal(JSON.parse(reopened.getStyleAt(0,0)).name,target.name);}finally{reopened.free();}
  assert.equal((await page.evaluate(()=>window.jueonyEditor.executeCommand('edit:undo'))).ok,true);await delay(120);
  assert.ok(sameBytes(baseline,await bytesFrom(page)),'undo must restore exact exported HWPX bytes');
  reopened=readDoc(await bytesFrom(page));try{assert.equal(JSON.parse(reopened.getStyleAt(0,0)).id,initialStyle.id);}finally{reopened.free();}
  pass('N013 Ctrl+1 applies the stored style and exported HWPX reopens; undo restores exact bytes');

  stage='N013 IME and stale blocking';
  const blockedBefore=await bytesFrom(page),blockedState=await stateFrom(page);
  const ime=await page.evaluate(()=>{window.jueonyEditor.focusEditor();const event=new KeyboardEvent('keydown',{key:'1',code:'Digit1',ctrlKey:true,isComposing:true,bubbles:true,cancelable:true});document.activeElement?.dispatchEvent(event);return{isComposing:event.isComposing,prevented:event.defaultPrevented};});
  assert.equal(ime.isComposing,true);assert.equal(ime.prevented,true);assert.deepEqual(await stateFrom(page),blockedState);assert.ok(sameBytes(blockedBefore,await bytesFrom(page)));
  await seedShortcut(page,{...shortcut,documentSha256:'0'.repeat(64)});await focusAndShortcut(page);assert.deepEqual(await stateFrom(page),blockedState);assert.ok(sameBytes(blockedBefore,await bytesFrom(page)));
  pass('N013 IME and stale document evidence fail closed without revision or byte changes',ime);

  stage='B046 two-page baseline';await seedShortcut(page);await page.evaluate(()=>window.jueonyEditor.focusEditor());
  const breakResult=await page.evaluate(()=>window.rhwpStudio.automation.execute('page:break'));
  if(breakResult.ok)await page.waitForFunction(()=>window.jueonyEditor.state().pageCount>1,{timeout:15000});
  const viewBaselineBytes=await bytesFrom(page),viewBaselineState=await stateFrom(page),visible=await outline(page);assert.equal(visible.hidden,false);assert.notEqual(visible.shadow,'none');
  stage='B046 cross tab';peer=await browser.newPage();await intercept(peer);await peer.goto(origin+'/editor.html?storage=download&skipRecovery=1');await ready(peer);await openFixture(peer,'b046-peer.hwpx');
  const peerBytes=await bytesFrom(peer),peerState=await stateFrom(peer);assert.equal((await outline(peer)).hidden,false);
  stage='B046 menu toggle';
  assert.equal(await page.evaluate(()=>{const item=document.querySelector('[data-cmd="view:page-outline"]');if(!(item instanceof HTMLElement))return false;item.click();return true;}),true);
  await page.waitForFunction(()=>document.getElementById('scroll-content')?.classList.contains('page-outline-hidden'));
  await peer.waitForFunction(()=>document.getElementById('scroll-content')?.classList.contains('page-outline-hidden'));
  const hidden=await outline(page),peerHidden=await outline(peer);assert.equal(hidden.shadow,'none');assert.equal(hidden.menuChecked,'false');assert.equal(hidden.statusPressed,'false');assert.equal(peerHidden.hidden,true);
  if(visible.gaps.length&&hidden.gaps.length)assert.ok(hidden.gaps.every(gap=>Math.abs(gap)<=1),`hidden page gaps: ${hidden.gaps}`);
  assert.deepEqual(await stateFrom(page),viewBaselineState);assert.ok(sameBytes(viewBaselineBytes,await bytesFrom(page)));assert.deepEqual(await stateFrom(peer),peerState);assert.ok(sameBytes(peerBytes,await bytesFrom(peer)));
  stage='B046 status toggle';assert.equal(await page.evaluate(()=>{const button=document.getElementById('sb-page-outline');if(!(button instanceof HTMLButtonElement))return false;button.click();return true;}),true);await page.waitForFunction(()=>!document.getElementById('scroll-content')?.classList.contains('page-outline-hidden'));await peer.waitForFunction(()=>!document.getElementById('scroll-content')?.classList.contains('page-outline-hidden'));
  const restored=await outline(page),peerRestored=await outline(peer);assert.notEqual(restored.shadow,'none');assert.equal(restored.menuChecked,'true');assert.equal(restored.statusPressed,'true');assert.equal(peerRestored.hidden,false);
  assert.deepEqual(await stateFrom(page),viewBaselineState);assert.ok(sameBytes(viewBaselineBytes,await bytesFrom(page)));assert.deepEqual(await stateFrom(peer),peerState);assert.ok(sameBytes(peerBytes,await bytesFrom(peer)));
  pass('B046 menu/status toggles page gap and shadow, sync cross-tab, and preserve dirty/revision/bytes',{pageBreakCreated:breakResult.ok,visibleGaps:visible.gaps,hiddenGaps:hidden.gaps,stored:restored.settings});

  await page.screenshot({path:join(out,'n013-b046-browser-smoke.png'),fullPage:true});
  assert.deepEqual(pageErrors,[]);assert.deepEqual(consoleErrors,[]);assert.deepEqual(externalRequests,[]);
  await writeFile(join(out,'result.json'),JSON.stringify({pass:true,dist,results,pageErrors,consoleErrors,expectedStartupErrors,externalRequests,build:JSON.parse(await readFile(join(dist,'build-evidence.json'),'utf8')),limits:['Headless Edge against the existing isolated dist; no product source or Hancom 2024 was touched.','The isolated dist reports its known blank-document stored-time initializer mismatch; the verifier opens an explicit owned HWPX fixture before exercising either feature.','N013 browser smoke uses a real persisted document-style assignment; portable package import remains covered by its focused engine tests.']},null,2));
}catch(error){
  console.error(error);process.exitCode=1;
  await page?.screenshot({path:join(out,'failure.png'),fullPage:true}).catch(()=>{});
  await writeFile(join(out,'failure.json'),JSON.stringify({stage,error:String(error.stack??error),results,pageErrors,consoleErrors,expectedStartupErrors,externalRequests},null,2));
}finally{await browser?.close();server.kill();if(profileDir)await rm(profileDir,{recursive:true,force:true}).catch(()=>{});}
