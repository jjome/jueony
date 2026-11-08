import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import puppeteer from 'puppeteer-core';
import {loadReviewEngine} from './lib/hancom-review.mjs';
import {nestedCaptionCursorFixture,probeNestedCaptionCursors} from './lib/nested-caption-cursor.mjs';
import {readStructure} from '../src/adapters/rhwp/structure.ts';

const repo=resolve(import.meta.dirname,'../../..'),dist=resolve(process.env.JUEONY_TEST_DIST);
const {HwpDocument}=await loadReviewEngine(resolve(process.env.JUEONY_ENGINE_PACKAGE));
const port=Number(process.env.JUEONY_TEST_PORT??4683),origin='http://127.0.0.1:'+port;
if(await fetch(origin+'/api/health').then(()=>true,()=>false))throw Error('Review port occupied');
const launcher=spawn(process.execPath,['apps/launcher/server.mjs'],{cwd:repo,windowsHide:true,stdio:'ignore',
 env:{...process.env,JUEONY_PORT:String(port),JUEONY_DIST:dist,JUEONY_CONNECTION_STORE:'memory'}});
let browser;
try{
 for(let i=0;i<100;i++){if(await fetch(origin+'/api/health').then(r=>r.ok,()=>false))break;await new Promise(r=>setTimeout(r,100));}
 await mkdir(resolve(repo,'build'),{recursive:true});
 browser=await puppeteer.launch({executablePath:process.env.JUEONY_TEST_BROWSER??'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless:true,userDataDir:await mkdtemp(resolve(repo,'build/nested-caption-cursor-browser-')),args:['--no-first-run','--disable-background-networking']});
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('dialog',d=>d.dismiss());
 await page.goto(origin);await page.waitForFunction(()=>document.getElementById('app-status')?.textContent.includes('준비 완료'));
 for(const ext of ['hwp','hwpx']){
  const seed=nestedCaptionCursorFixture(HwpDocument,true),bytes=[...seed[ext==='hwp'?'exportHwp':'exportHwpx']()];seed.free();
  const frame=await(await page.$('.editor-frame:not([hidden])')).contentFrame();
  const open=async data=>frame.evaluate(async(bytes,ext)=>{
   const root=await navigator.storage.getDirectory(),handle=await root.getFileHandle('nested-caption-cursor.'+ext,{create:true}),writer=await handle.createWritable();
   await writer.write(new Uint8Array(bytes));await writer.close();await window.jueonyEditor.open(new Uint8Array(bytes),handle.name,handle,false);
  },data,ext);
  await open(bytes);
  const inspect=()=>frame.evaluate(source=>{
   const a=window.rhwpStudio.automation;let services;
   a.registerCommand({id:'ext:caption-cursor-review',label:'캡션 커서 검수',canExecute:()=>true,execute:s=>services=s});
   a.execute('ext:caption-cursor-review');a.unregisterCommand('ext:caption-cursor-review');
   const doc=services.wasm.borrowDocumentHandle(),snapshot=window.jueonyEditor.snapshot();
   const probe=new Function('return ('+source+')')();
   const exportBytes=()=>[...doc[doc.getSourceFormat()==='hwp'?'exportHwp':'exportHwpx']()];
   const before=exportBytes(),cursors=probe(doc,snapshot.structure.nestedTables),after=exportBytes();
   return {canvas:doc.canvasMetricsActive(),cursors,before,after,dirty:window.jueonyEditor.state().dirty};
  },probeNestedCaptionCursors.toString());
  const first=await inspect();assert.equal(first.canvas,true);assert.equal(first.dirty,false);
  assert.deepEqual(first.before,first.after);assert.ok(first.cursors.some(r=>r.path.length===3));
  const reopened=new HwpDocument(new Uint8Array(first.after));
  try{probeNestedCaptionCursors(reopened,readStructure(reopened).nestedTables);}finally{reopened.free();}
  await open(first.after);const second=await inspect();
  assert.equal(second.canvas,true);assert.equal(second.dirty,false);assert.deepEqual(second.before,second.after);
  assert.deepEqual(second.cursors,first.cursors);
  console.log('PASS',ext,'Edge Canvas three-level and sibling caption cursor paths, blank/Korean/emoji hit roundtrips, unchanged bytes and native/browser reopen');
 }
 assert.deepEqual(errors,[]);
}finally{await browser?.close();launcher.kill();}
