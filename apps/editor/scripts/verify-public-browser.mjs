// Independent browser profile, no LLM and no production credentials.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {readFile,writeFile,mkdir,mkdtemp,rmdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import puppeteer from 'puppeteer-core';
const directory=resolve('../../.tools/public-documents'),out=join(directory,'browser');await mkdir(out,{recursive:true});
const temp=await mkdtemp(join(tmpdir(),'jueony-public-ui-'));
const origin='http://127.0.0.1:4205',results=[],errors=[],external=[];let server,browser;
try{
 assert.equal(await fetch(origin+'/api/health').then(()=>true,()=>false),false);
 server=spawn(process.execPath,['../launcher/server.mjs'],{windowsHide:true,stdio:'ignore',env:{...process.env,JUEONY_PORT:'4205',JUEONY_DIST:resolve('dist'),JUEONY_CONNECTION_STORE:join(temp,'unused.dpapi')}});
 for(let i=0;i<100;i++){if(server.exitCode!==null)throw new Error('Server exited');if(await fetch(origin+'/api/health').then(r=>r.ok,()=>false))break;await new Promise(r=>setTimeout(r,100));}
 browser=await puppeteer.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,args:['--no-first-run','--disable-background-networking'],defaultViewport:{width:1700,height:1100}});
 const page=await browser.newPage();page.setDefaultTimeout(60000);page.on('dialog',d=>d.accept());page.on('pageerror',e=>errors.push(e.message));
 page.on('request',req=>{if(/^https?:/.test(req.url())&&new URL(req.url()).origin!==origin)external.push(req.url());});
 // Block external requests, not merely observe them.
 await page.setRequestInterception(true);page.on('request',req=>/^https?:/.test(req.url())&&new URL(req.url()).origin!==origin?req.abort():req.continue());
 await page.goto(origin+'/?storage=download');await page.waitForFunction(()=>document.getElementById('app-status').textContent.includes('준비 완료'));
 const manifest=JSON.parse(await readFile(join(directory,'manifest.json'),'utf8'));
 for(const source of manifest.filter(s=>s.status==='downloaded')){
  const bytes=[...await readFile(join(directory,source.file))];
  const result=await page.evaluate(async({bytes,name})=>{
   const api=document.querySelector('.editor-frame:not([hidden])').contentWindow.jueonyEditor;
   await api.open(new Uint8Array(bytes),name);const before=api.snapshot();
   const table=before.structure.tables.find(t=>t.cells.some(c=>c.editable&&c.rowSpan===1&&c.columnSpan===1));
   const cell=table?.cells.find(c=>c.editable&&c.rowSpan===1&&c.columnSpan===1);let edited=false,undo=false;
   if(cell){const receipt=await api.apply('public-'+name,before,{message:'로컬 공개 문서 검사',sourceIds:[],operations:[{kind:'set_table_cell',target:table.id,row:cell.row,column:cell.column,originalText:cell.text,text:'브라우저 검사 셀'}]});
    edited=api.snapshot().structure.tables.find(t=>t.id===table.id).cells.find(c=>c.row===cell.row&&c.column===cell.column).text==='브라우저 검사 셀';
    await api.undoRequest(receipt);const after=api.snapshot();undo=JSON.stringify(after.structure)===JSON.stringify(before.structure)&&after.plainText===before.plainText;
   }
   return {name,pages:api.state().pageCount,tables:before.structure.tables.length,edited:cell?edited:'not applicable',undo:cell?undo:'not applicable'};
  },{bytes,name:source.file});
  assert.ok(result.pages>0);assert.notEqual(result.edited,false);assert.notEqual(result.undo,false);
  await page.screenshot({path:join(out,source.id+'.png'),fullPage:true});results.push({...result,id:source.id,status:'PASS'});console.log('PASS '+source.id+' browser open/edit/undo');
 }
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
 await writeFile(join(out,'report.json'),JSON.stringify({status:'PASS',scope:'Actual editor UI, external HTTP requests blocked; no independent Hancom comparison',runtime:await browser.version(),results,errors,externalRequests:external},null,2));
}finally{await browser?.close();if(server?.exitCode===null){const closed=once(server,'exit');server.kill();await closed;}await rmdir(temp);}
