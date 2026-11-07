import assert from 'node:assert/strict';
import {spawn,execFileSync} from 'node:child_process';
import http from 'node:http';
import {mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import puppeteer from 'puppeteer-core';
import {loadReviewEngine} from './lib/hancom-review.mjs';

const repo=resolve(import.meta.dirname,'../../..'), dist=resolve(process.env.JUEONY_TEST_DIST);
const out=resolve(repo,process.env.JUEONY_TEST_OUTPUT??'build/table-formula-input');
await mkdir(out,{recursive:true});
const {HwpDocument}=await loadReviewEngine(resolve(process.env.JUEONY_ENGINE_PACKAGE));
const port=Number(process.env.JUEONY_TEST_PORT??4862), origin='http://127.0.0.1:'+port;
const results=[],errors=[],dialogs=[],calls=[];
const provider=http.createServer(async(req,res)=>{
  try {
    let body='';for await (const chunk of req) body+=chunk;
    const input=JSON.parse(JSON.parse(body).messages[1].content);
    const table=input.document.structure.tables[0], cell=table.cells.find(c=>c.row===0&&c.column===0);
    assert.equal(cell.text,'2');calls.push(input.instruction);
    const op={kind:'set_table_cell',target:table.id,row:0,column:0,originalText:cell.text,text:'11'};
    const value={message:'참조 숫자를 변경했습니다.',sourceIds:[],operations:[op]};
    res.setHeader('Content-Type','application/json');res.end(JSON.stringify({choices:[{message:{content:JSON.stringify(value)}}]}));
  }catch(error){res.writeHead(500);res.end(String(error));}
});
function model(doc, pos){
  return {
    source:doc.getTextInCell(...pos,0,0,0,doc.getCellParagraphLength(...pos,0,0)),
    fields:JSON.parse(doc.getFieldList()).filter(f=>f.fieldType==='formula').map(f=>f.command)
  };
}
function expected(n){
  return {source:String(n),fields:[`=A1*2??%.1f;;${(n*2).toFixed(1)}`,`=B1+1??%g;;${n*2+1}`,'=9??%g;;9']};
}
function fixture(ext,protectedResult=false){
  const doc=HwpDocument.createEmpty();
  try {
    doc.createBlankDocument();const t=JSON.parse(doc.createTable(0,0,0,1,4)), pos=[0,t.paraIdx,t.controlIdx];
    doc.insertTextInCell(...pos,0,0,0,'2');
    doc.insertTableFormulaField(...pos,1,'','=A1*2','%.1f');
    doc.insertTableFormulaField(...pos,2,'','=B1+1','%g');
    doc.insertTableFormulaField(...pos,3,'','=9','%g');
    if(protectedResult)doc.setCellProperties(...pos,2,'{"cellProtect":true}');
    assert.equal(doc.tableFormulaInputHasDependents(...pos,0),true);
    return {bytes:[...doc[ext==='hwp'?'exportHwp':'exportHwpx']()],pos};
  }finally{doc.free();}
}
if(await fetch(origin+'/api/health').then(()=>true,()=>false)) throw Error('Review port in use');
await new Promise(r=>provider.listen(0,'127.0.0.1',r));
const server=spawn(process.execPath,['apps/launcher/server.mjs'],{cwd:repo,windowsHide:true,stdio:'ignore',
  env:{...process.env,JUEONY_PORT:String(port),JUEONY_DIST:dist,JUEONY_CONNECTION_STORE:'memory'}});
let browser;
try{
  for(let i=0;i<100;i++){if(await fetch(origin+'/api/health').then(r=>r.ok,()=>false)) break;await new Promise(r=>setTimeout(r,100));}
  browser=await puppeteer.launch({executablePath:process.env.JUEONY_TEST_BROWSER??'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    headless:true,userDataDir:await mkdtemp(resolve(out,'profile-')),args:['--disable-background-networking','--no-first-run']});
  const page=await browser.newPage();page.on('pageerror',e=>errors.push(String(e)));
  page.on('dialog',d=>{dialogs.push(d.message());return d.dismiss();});
  await page.goto(origin);await page.waitForFunction(()=>document.getElementById('app-status')?.textContent.includes('준비 완료'));
  const fill=(id,value)=>page.$eval('#'+id,(e,v)=>{e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));},value);
  await page.click('#connection-settings');await page.click('#new-connection');await page.select('#config-adapter','openai-compatible');
  await fill('config-label','계산 검수');await fill('config-endpoint','http://127.0.0.1:'+provider.address().port+'/v1');
  await fill('config-model','fixture');await fill('config-key','synthetic');await page.$eval('#config-remember',e=>e.checked=false);
  await page.click('#model-form button[type=submit]');await page.waitForFunction(()=>!document.getElementById('model-dialog').open);
  for(const ext of ['hwp','hwpx']){
    const frame=await(await page.$('.editor-frame:not([hidden])')).contentFrame();
    async function open(protectedResult=false){
      const {bytes,pos}=fixture(ext,protectedResult);
      await frame.evaluate(async(bytes,pos,name)=>{
        const root=await navigator.storage.getDirectory(),handle=await root.getFileHandle(name,{create:true});
        const writer=await handle.createWritable();await writer.write(new Uint8Array(bytes));await writer.close();
        await window.jueonyEditor.open(new Uint8Array(bytes),name,handle,false);
        const automation=window.rhwpStudio.automation;
        automation.registerCommand({id:'ext:formula-input',label:'검수',canExecute:()=>true,execute:s=>{window.__formulaServices=s;}});
        automation.execute('ext:formula-input');automation.unregisterCommand('ext:formula-input');
        window.__inputAddress=pos;
      },bytes,pos,'numeric'+(protectedResult?'-locked':'')+'.'+ext);
      return pos;
    }
    const observe=()=>frame.evaluate(()=>{
      const api=window.jueonyEditor, table=api.snapshot().structure.tables[0];
      return {source:table.cells[0].text,fields:api.snapshot().tableFormulaFields.fields.map(f=>f.storedCommand)};
    });
    async function cursor(start,end=start){
      await frame.evaluate((start,end)=>{
        const ih=window.__formulaServices.getInputHandler(), [sectionIndex,parentParaIndex,controlIndex]=window.__inputAddress;
        const position=charOffset=>({sectionIndex,paragraphIndex:0,parentParaIndex,controlIndex,cellIndex:0,cellParaIndex:0,charOffset,
          cellPath:[{controlIndex,cellIndex:0,cellParaIndex:0}]});
        ih.cursor.exitBlockSelectionMode();ih.cursor.clearSelection();
        ih.cursor.moveTo(position(start));
        if(start!==end){ ih.cursor.setAnchor(); ih.cursor.moveTo(position(end)); if(!ih.cursor.hasSelection())throw Error('Cell selection missing'); }
        ih.updateCaret();ih.focus();
      },start,end);
    }
    const command=id=>frame.evaluate(id=>{if(!window.jueonyEditor.executeCommand('edit:'+id).ok)throw Error(id);},id);
    const history=()=>frame.evaluate(()=>window.__formulaServices.getInputHandler().history.undoStack.length);
    const save=async(name,pos,want)=>{
      const bytes=await frame.evaluate(async()=>{
        const api=window.jueonyEditor;const status=await api.save();if(status!=='saved')throw Error('save '+status);
        return [...new Uint8Array(await (await api.fileHandle().getFile()).arrayBuffer())];
      });
      const path=resolve(out,name+'.'+ext);
      await writeFile(path,new Uint8Array(bytes));
      const reopened=new HwpDocument(new Uint8Array(bytes));try{assert.deepEqual(model(reopened,pos),want);}finally{reopened.free();}
      const raw=JSON.parse(execFileSync('python',[resolve(import.meta.dirname,'lib/read-native-formula-fields.py'),path],{encoding:'utf8'}));
      assert.deepEqual(ext==='hwp'?raw.fields.map(f=>f.command):raw.map(f=>f.params.find(([,key])=>key==='Command')[2]),want.fields);
      if(ext==='hwpx')assert.deepEqual(raw.map(f=>f.params.find(([,key])=>key==='LastResult')[2]),want.fields.map(c=>c.split(';;')[1]));
    };
    const pos=await open();await cursor(1);
    const initial=await history();await page.keyboard.press('3');
    assert.deepEqual(await observe(),expected(23));assert.equal(await history(),initial+1);
    await command('undo');assert.deepEqual(await observe(),expected(2));await command('redo');assert.deepEqual(await observe(),expected(23));
    await save('typed',pos,expected(23));results.push(ext+' typing, undo/redo, save/reopen');
    await cursor(2);await page.keyboard.press('Backspace');assert.deepEqual(await observe(),expected(2));
    await cursor(0,1);const beforeReplace=await history();await page.keyboard.press('7');assert.deepEqual(await observe(),expected(7));assert.equal(await history(),beforeReplace+1);
    await command('undo');assert.deepEqual(await observe(),expected(2));results.push(ext+' Backspace and selected-number replacement');
    await cursor(1);const beforeInvalid=await history(), alerts=dialogs.length;await page.keyboard.press('x');
    assert.deepEqual(await observe(),expected(2));assert.equal(await history(),beforeInvalid);assert.equal(dialogs.length,alerts+1);
    await open(true);await cursor(1);const locked=await history();await page.keyboard.press('3');
    assert.deepEqual(await observe(),expected(2));assert.equal(await history(),locked);results.push(ext+' invalid and protected dependent roll back');
    await open();await fill('request-input','A1 숫자를 11로 바꿔줘');
    const generated=page.waitForResponse(r=>r.url()===origin+'/api/generate');await page.click('#send-request');await generated;
    await page.waitForFunction(()=>!document.getElementById('send-request').disabled);
    assert.equal(await page.$eval('#request-error',e=>e.hidden?'':e.textContent),'');
    assert.deepEqual(await observe(),expected(11));
    const undo=(await page.$$('.message-actions button')).reverse();
    for(const button of undo)if(await button.evaluate(b=>b.textContent==='요청 되돌리기')){await button.click();break;}
    await page.waitForFunction(()=>document.getElementById('app-status').textContent.includes('되돌렸습니다'));
    assert.deepEqual(await observe(),expected(2));await command('redo');assert.deepEqual(await observe(),expected(11));
    await save('agent',pos,expected(11));results.push(ext+' Agent edit, request undo, redo, save/reopen');
  }
  assert.equal(calls.length,2);assert.deepEqual(errors,[]);console.log('PASS',results.length,results);
}finally{
  await writeFile(resolve(out,'result.json'),JSON.stringify({results,errors,dialogs,calls},null,2));
  await browser?.close();server.kill();provider.close();
}
