import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';
import puppeteer from 'puppeteer-core';

// Exercise the real DOM controller against the document interaction contract.
// No document, saved workspace, credentials, or shared build output is touched.
const source=await readFile(new URL('../src/unified-chrome.ts',import.meta.url),'utf8');
const script=stripTypeScriptTypes(source);
const css=await readFile(new URL('../src/shell.css',import.meta.url),'utf8');
const browser=await puppeteer.launch({executablePath:process.env.JUEONY_BROWSER_PATH??'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,args:['--no-first-run','--disable-background-networking'],defaultViewport:{width:1200,height:800}});
const results=[],errors=[];
try {
 const page=await browser.newPage();page.on('pageerror',error=>errors.push(String(error)));
 await page.setContent('<style>'+css+'</style><input id="editor" value="선택한 문서 내용"><nav id="menus"></nav><div id="tools"></div>');
 await page.addScriptTag({type:'module',content:script+`
 window.calls=[];window.failures=[];window.allowed=true;window.itemAllowed=true;window.groupAllowed=true;
 const editor={commands:()=>['one','two','three','edit:undo'].map(id=>({id,label:id,enabled:window.allowed})),menus:()=>[
 {menuId:'file',label:'파일',items:[{label:'Unavailable',commandId:'absent',enabled:true},{label:'One',commandId:'one',enabled:window.itemAllowed},{label:'Group',enabled:window.groupAllowed,submenu:[{label:'Two',commandId:'two',enabled:true},{label:'Three',commandId:'three',enabled:true}]}]},
 {menuId:'edit',label:'편집',items:[{label:'Undo',commandId:'edit:undo',enabled:true}]}],executeCommand:()=>({ok:true}),focusEditor:()=>document.querySelector('#editor').focus()};
 window.current=editor;
 window.options={menus:document.querySelector('#menus'),tools:document.querySelector('#tools'),active:()=>window.current,execute:(id)=>window.calls.push(id),error:e=>window.failures.push(String(e))};
 window.chromeController=installUnifiedChrome(window.options);window.chromeController.refresh();window.installAgain=()=>{window.chromeController=installUnifiedChrome(window.options);window.chromeController.refresh();};
 `});
 await page.waitForFunction(()=>window.chromeController);
 const state=()=>page.evaluate(()=>({text:document.activeElement?.textContent,id:document.activeElement?.id,calls:window.calls,open:[...document.querySelectorAll('#menus details')].filter(detail=>detail.open).length,selection:[document.querySelector('#editor').selectionStart,document.querySelector('#editor').selectionEnd]}));
 await page.focus('#menus > details:first-child > summary');await page.keyboard.press('ArrowDown');assert.equal((await state()).text,'One');
 await page.keyboard.press('ArrowDown');assert.equal((await state()).text,'Group');await page.keyboard.press('ArrowRight');assert.equal((await state()).text,'Two');
 await page.keyboard.press('End');assert.equal((await state()).text,'Three');await page.keyboard.press('ArrowLeft');assert.equal((await state()).text,'Group');
 await page.keyboard.press('Escape');assert.equal((await state()).text,'파일');assert.equal((await state()).open,0);results.push('keyboard nested menu navigation, disabled skipping, Escape focus return');
 await page.focus('#menus > details:first-child > summary');await page.keyboard.press('ArrowRight');assert.equal((await state()).text,'편집');await page.keyboard.press('Home');assert.equal((await state()).text,'파일');results.push('menubar Left/Right and Home roving focus');
 await page.evaluate(()=>{const input=document.querySelector('#editor');input.focus();input.setSelectionRange(1,5);});
 await page.click('#menus > details:first-child > summary');await page.click('[data-editor-command="one"]');assert.deepEqual((await state()).selection,[1,5]);assert.equal((await state()).id,'editor');assert.deepEqual((await state()).calls,['one']);results.push('pointer command preserves focused editor selection');
 await page.evaluate(()=>{window.itemAllowed=false;window.chromeController.refresh();});assert.equal(await page.$eval('[data-editor-command="one"]',element=>element.disabled),true);
 await page.evaluate(()=>{window.groupAllowed=false;window.chromeController.refresh();});assert.equal(await page.$eval('[data-editor-command="two"]',element=>element.disabled),true);results.push('per-item and ancestor menu gates');
 await page.evaluate(()=>{window.itemAllowed=true;window.groupAllowed=true;window.chromeController.refresh();window.allowed=false;document.querySelector('[data-editor-command="one"]').click();});assert.deepEqual((await state()).calls,['one']);results.push('invocation rechecks changed command gates');
 await page.evaluate(()=>{window.allowed=true;window.chromeController.refresh();document.querySelector('#menus > details').open=true;window.current={...window.current};window.chromeController.refresh();});assert.equal((await state()).open,0);results.push('document switch closes stale menus');
 await page.evaluate(()=>window.installAgain());await page.focus('#menus > details:first-child > summary');await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');assert.deepEqual((await state()).calls,['one','one']);results.push('reinstall replaces handlers without duplicate invocation');
 await page.setViewport({width:320,height:360,deviceScaleFactor:2});await page.click('#menus > details:last-child > summary');
 const bounds=await page.$eval('#menus > details:last-child > .unified-menu-popup',element=>{const rect=element.getBoundingClientRect();return {left:rect.left,right:rect.right,top:rect.top,bottom:rect.bottom,width:innerWidth,height:innerHeight};});
 assert.ok(bounds.left>=0&&bounds.right<=bounds.width&&bounds.bottom<=bounds.height&&bounds.top>=0,JSON.stringify(bounds));results.push('320px viewport / 200% device scale popup remains bounded');
 await page.evaluate(()=>{window.chromeController.dispose();window.calls=[];});await page.keyboard.press('ArrowDown');assert.deepEqual((await state()).calls,[]);results.push('controller disposal detaches global handlers');
 assert.deepEqual(errors,[]);assert.deepEqual(await page.evaluate(()=>window.failures),[]);
 process.stdout.write(JSON.stringify({ok:true,cases:results.length,results,pageErrors:errors},null,2)+'\n');
}finally{await browser.close();}
