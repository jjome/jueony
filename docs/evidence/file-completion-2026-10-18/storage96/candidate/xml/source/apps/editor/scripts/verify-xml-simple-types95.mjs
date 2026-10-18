// Isolated headless Edge; no server, desktop input, native document, or user profile.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {resolve,relative,dirname,isAbsolute} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {build} from 'vite';
import puppeteer from 'puppeteer-core';

const app=resolve(dirname(fileURLToPath(import.meta.url)),'..');
assert.ok(isAbsolute(process.env.JUEONY_TEST_OUTPUT??''),'absolute, new JUEONY_TEST_OUTPUT required');
const out=resolve(process.env.JUEONY_TEST_OUTPUT);await mkdir(out,{recursive:false});
const sha=b=>createHash('sha256').update(b).digest('hex');
const xml='<?xml version="1.0" encoding="UTF-8"?><p:report xmlns:p="urn:own95"><!-- KEEP ROOT --><p:title>원문<!-- KEEP FIELD --> 😀</p:title><p:status>대기</p:status><p:count>2</p:count><p:amount>9007199254740992.2</p:amount></p:report>';
const xsd=`<?xml version="1.0" encoding="UTF-8"?><xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:o="urn:own95" targetNamespace="urn:own95" elementFormDefault="qualified">
 <xs:element name="report"><xs:complexType><xs:sequence><xs:element name="title" type="o:Title"/><xs:element name="status" type="o:Status"/><xs:element name="count" type="o:Count"/><xs:element name="amount" type="o:Amount"/></xs:sequence></xs:complexType></xs:element>
 <xs:simpleType name="Title"><xs:restriction base="xs:string"><xs:minLength value="1"/><xs:maxLength value="12"/></xs:restriction></xs:simpleType>
 <xs:simpleType name="Status"><xs:restriction base="xs:string"><xs:enumeration value="대기"/><xs:enumeration value="완료"/></xs:restriction></xs:simpleType>
 <xs:simpleType name="Count"><xs:restriction base="xs:integer"><xs:minInclusive value="1"/><xs:maxExclusive value="100"/></xs:restriction></xs:simpleType>
 <xs:simpleType name="Amount"><xs:restriction base="xs:decimal"><xs:minExclusive value="9007199254740992.1"/><xs:maxInclusive value="9007199254740992.3"/></xs:restriction></xs:simpleType>
</xs:schema>`;
await writeFile(out+'/own.xml',xml,{flag:'wx'});await writeFile(out+'/own.xsd',xsd,{flag:'wx'});
const restriction=(base,facets,name='T')=>`<xs:simpleType name="${name}"><xs:restriction base="${base}">${facets}</xs:restriction></xs:simpleType>`;
const scalar=(defs,type='T')=>`<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">${defs}<xs:element name="n" type="${type}"/></xs:schema>`;
const f=(name,value)=>`<xs:${name} value="${value}"/>`;
const values=list=>list.map(([text,valid])=>({xml:`<n>${text.replaceAll('&','&amp;').replaceAll('<','&lt;')}</n>`,valid}));
const oracleMatrix=[
 {id:'typed-integer-enumeration',schema:scalar(restriction('xs:integer',f('enumeration','+0002'))),schemaValid:true,values:values([['2',true],['+002',true],['3',false],['2.0',false]])},
 {id:'typed-decimal-zero-enumeration',schema:scalar(restriction('xs:decimal',f('enumeration','-0.0'))),schemaValid:true,values:values([['+0.00',true],['-0',true],['0.01',false],['NaN',false]])},
 {id:'precise-decimal-range',schema:scalar(restriction('xs:decimal',f('minExclusive','9007199254740992.000000000000000001')+f('maxInclusive','9007199254740992.000000000000000003'))),schemaValid:true,values:values([['9007199254740992.000000000000000001',false],['9007199254740992.000000000000000002',true],['9007199254740992.000000000000000003',true],['9007199254740992.000000000000000004',false]])},
 {id:'xml-character-length',schema:scalar(restriction('xs:string',f('length','2'))),schemaValid:true,values:values([['가😀',true],['e\u0301',true],['😀',false],[' A ',false]])},
 {id:'string-whitespace-enumeration',schema:scalar(restriction('xs:string',f('enumeration',' A '))),schemaValid:true,values:values([[' A ',true],['A',false],['  A ',false]])},
 {id:'inherited-enumeration-intersection',schema:scalar(restriction('xs:integer',f('enumeration','1')+f('enumeration','2'),'Base')+restriction('Base',f('minInclusive','2'))),schemaValid:true,values:values([['1',false],['2',true],['+002',true]])},
 {id:'valid-empty-value-space',schema:scalar(restriction('xs:integer',f('minInclusive','2')+f('enumeration','1'))),schemaValid:true,values:values([['1',false],['2',false]])},
 {id:'boolean-alias',schema:scalar(restriction('xs:boolean','')),schemaValid:true,values:values([['true',true],['1',true],[' false ',true],['TRUE',false]])},
 {id:'invalid-boolean-enumeration',schema:scalar(restriction('xs:boolean',f('enumeration','1'))),schemaValid:false,values:[]},
 {id:'invalid-widened-range',schema:scalar(restriction('xs:integer',f('minInclusive','3'),'Base')+restriction('Base',f('minInclusive','2'))),schemaValid:false,values:[]},
 {id:'invalid-base-enumeration-bound',schema:scalar(restriction('xs:integer',f('enumeration','1')+f('enumeration','2'),'Base')+restriction('Base',f('minInclusive','3'))),schemaValid:false,values:[]},
 {id:'same-inherited-exclusive-min-primary',schema:scalar(restriction('xs:integer',f('minExclusive','1')+f('maxExclusive','5'),'Base')+restriction('Base',f('minExclusive','1'))),schemaValid:true,values:values([['1',false],['2',true],['4',true],['5',false]])},
 {id:'same-inherited-exclusive-max-primary',schema:scalar(restriction('xs:integer',f('minExclusive','1')+f('maxExclusive','5'),'Base')+restriction('Base',f('maxExclusive','5'))),schemaValid:true,values:values([['1',false],['2',true],['4',true],['5',false]])},
 {id:'invalid-cyclic-type',schema:scalar(restriction('B','','T')+restriction('T','','B')),schemaValid:false,values:[]},
];
await writeFile(out+'/oracle-matrix.json',JSON.stringify(oracleMatrix,null,2),{flag:'wx'});
const imports={ui:'src/ui/xml-document-dialog.ts',codec:'src/adapters/xml/browser-parser.ts',core:'src/modules/xml-documents/public/index.ts',recovery:'src/adapters/storage/xml-recovery.ts'};
const local=p=>'./'+relative(out,resolve(app,p)).replaceAll('\\','/');
await writeFile(out+'/entry.mjs',`import{showXmlDocumentDialog}from'${local(imports.ui)}';import{browserXmlCodec}from'${local(imports.codec)}';import{createXmlWorkspace,restoreXmlWorkspace,compileXmlSchema,validateXmlInstance}from'${local(imports.core)}';import{createXmlRecoveryStore,indexedDbXmlRecoveryRecords}from'${local(imports.recovery)}';globalThis.xml95={showXmlDocumentDialog,browserXmlCodec,createXmlWorkspace,restoreXmlWorkspace,compileXmlSchema,validateXmlInstance,store:(workspaceId='own-work')=>createXmlRecoveryStore({scope:'headless95',workspaceId,records:indexedDbXmlRecoveryRecords(indexedDB)})};`,{flag:'wx'});
const compiled=await build({configFile:false,root:app,publicDir:false,logLevel:'warn',build:{write:false,minify:false,lib:{entry:out+'/entry.mjs',name:'Xml95',formats:['iife']}}});
const bundle=(Array.isArray(compiled)?compiled:[compiled]).flatMap(x=>x.output).filter(x=>x.type==='chunk').map(x=>x.code).join('\n');
assert.ok(bundle.includes('local-sequence-restrictions-v2'));await writeFile(out+'/bundle.js',bundle,{flag:'wx'});
await writeFile(out+'/review.html','<!doctype html><meta charset="utf-8"><title>Owned headless XML95 test</title>',{flag:'wx'});
const url=pathToFileURL(out+'/review.html').href,profile=resolve(out,'own-headless-profile'),downloads=resolve(out,'downloads');await mkdir(downloads);
const sourceFiles=[...Object.values(imports),'src/modules/xml-documents/domain/simple-types95.ts','src/modules/xml-documents/domain/schema.ts','src/modules/xml-documents/domain/recovery.ts','src/modules/xml-documents/application/workspace.ts','src/modules/xml-documents/public/contracts.ts','src/modules/xml-documents/ports/xml-codec.ts'];
const sourceHashes=await Promise.all(sourceFiles.map(async path=>({path,sha256:sha(await readFile(resolve(app,path)))})));
const results=[],failures=[],pageErrors=[],consoleErrors=[],externalRequests=[],downloadEvents=[];let browser,page,oracleObservations=[];
async function scenario(name,run){try{await run();results.push({name,status:'PASS'});console.log('PASS '+name);}catch(e){const failure={name,error:String(e),stack:e.stack};failures.push(failure);results.push({...failure,status:'FAIL'});console.log('FAIL '+name+': '+e);}}
async function launch(){
 browser=await puppeteer.launch({executablePath:process.env.JUEONY_EDGE_EXECUTABLE??'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,userDataDir:profile,args:['--no-first-run','--disable-background-networking','--disable-sync','--disable-component-update'],defaultViewport:{width:1200,height:900}});
 page=await browser.newPage();page.on('pageerror',e=>pageErrors.push(String(e)));page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});page.on('dialog',d=>d.accept());
 await page.setRequestInterception(true);page.on('request',r=>{if(r.url()!==url&&!r.url().startsWith('blob:')){externalRequests.push(r.url());void r.abort();}else void r.continue();});
 await page.goto(url);await page.addScriptTag({content:bundle});
 const cdp=await browser.target().createCDPSession();cdp.on('Browser.downloadWillBegin',e=>downloadEvents.push(e));cdp.on('Browser.downloadProgress',e=>downloadEvents.push(e));await cdp.send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:downloads,eventsEnabled:true});
}
const idle=()=>page.waitForFunction(()=>!document.querySelector('[data-xml-action="close"]')?.disabled);
async function click(action){await page.click(`[data-xml-action="${action}"]`);await idle();}
async function change(path,text){await page.$eval(`[data-xml-path="[${path}]"]`,e=>e.click());await page.$eval('[data-xml-value]',(e,text)=>e.value=text,text);await click('replace');}
const tree=()=>page.$$eval('[data-xml-tree] button',bs=>bs.map(b=>b.textContent));
async function download(action,name){await click(action);for(let i=0;i<100;i++){const names=await readdir(downloads);if(names.includes(name)&&!names.some(n=>n.endsWith('.crdownload')))return readFile(downloads+'/'+name);await new Promise(r=>setTimeout(r,50));}throw Error('Owned download did not complete: '+JSON.stringify({name,names:await readdir(downloads),events:downloadEvents,status:await page.$eval('[data-xml-status]',e=>e.textContent),error:await page.$eval('[data-xml-error]',e=>e.textContent)}));}
try{
 await launch();
 await scenario('raw namespace XML/XSD resolve forward named restrictions without any external resources',async()=>{
  const result=await page.evaluate(({xml,xsd})=>{const r=xml95,w=r.createXmlWorkspace(r.browserXmlCodec,xml,xsd);return w.snapshot();},{xml,xsd});assert.equal(result.profile,'local-sequence-restrictions-v2');assert.equal(result.fields[1].value,'원문 😀');assert.equal(result.fields[4].value,'9007199254740992.2');
 });
 await scenario('raw XML restriction chains intersect inherited enumeration values exactly',async()=>{
  const schema='<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema"><xs:simpleType name="Base"><xs:restriction base="xs:integer"><xs:enumeration value="1"/><xs:enumeration value="2"/></xs:restriction></xs:simpleType><xs:simpleType name="Child"><xs:restriction base="Base"><xs:minInclusive value="2"/></xs:restriction></xs:simpleType><xs:element name="n" type="Child"/></xs:schema>';
  const values=await page.evaluate(schema=>['1','2'].map(value=>{try{xml95.createXmlWorkspace(xml95.browserXmlCodec,`<n>${value}</n>`,schema);return true;}catch{return false;}}),schema);assert.deepEqual(values,[false,true]);
 });
 await scenario('raw XML oracle matrix preserves typed lexical/value and invalid-schema boundaries',async()=>{
  oracleObservations=await page.evaluate(matrix=>matrix.map(c=>{try{const compiled=xml95.compileXmlSchema(xml95.browserXmlCodec.parse(c.schema));return{id:c.id,schemaValid:true,values:c.values.map(v=>{const valid=xml95.validateXmlInstance(xml95.browserXmlCodec.parse(v.xml),compiled).length===0;if(valid&&xml95.createXmlWorkspace(xml95.browserXmlCodec,v.xml,c.schema).exportArtifact().xml!==v.xml)throw Error('unchanged lexical source lost');return valid;})};}catch(e){return{id:c.id,schemaValid:false,values:[],error:String(e)};}}),oracleMatrix);
  for(let i=0;i<oracleMatrix.length;i++){assert.equal(oracleObservations[i].schemaValid,oracleMatrix[i].schemaValid,oracleMatrix[i].id);if(oracleMatrix[i].schemaValid)assert.deepEqual(oracleObservations[i].values,oracleMatrix[i].values.map(v=>v.valid),oracleMatrix[i].id);}
 });
 await scenario('actual file inputs display existing XML dialog with honest HWT/XSL limits',async()=>{
  await page.evaluate(()=>xml95.showXmlDocumentDialog({recovery:xml95.store()}));await idle();await(await page.$('[data-xml-input="xml"]')).uploadFile(out+'/own.xml');await(await page.$('[data-xml-input="xsd"]')).uploadFile(out+'/own.xsd');await click('open');assert.equal(await page.$eval('[data-xml-error]',e=>e.textContent),'');assert.equal((await tree())[2],'status : 대기');assert.match(await page.$eval('#xml-document-workspace',e=>e.textContent),/HWT.*XSL.*지원하지/);
 });
 await scenario('invalid enumerated and exact-decimal edits preserve UI, history and acknowledged recovery bytes',async()=>{
  const before=await tree(),checkpoint=await page.evaluate(()=>xml95.store().read());for(const[path,value]of[[1,'거절'],[2,'100'],[3,'9007199254740992.1']]){await change(path,value);assert.notEqual(await page.$eval('[data-xml-error]',e=>e.textContent),'');assert.deepEqual(await tree(),before);assert.deepEqual(await page.evaluate(()=>xml95.store().read()),checkpoint);}assert.match(await page.$eval('[data-xml-status]',e=>e.textContent),/버전 0/);
 });
 await scenario('valid Unicode and enumerated edits update real DOM, then persist undo and redo branches',async()=>{
  await change(0,'수정 <값> & 😀');await change(1,'완료');await click('undo');const checkpoint=await page.evaluate(()=>xml95.store().read());assert.equal(checkpoint.state.past.length,1);assert.equal(checkpoint.state.future.length,1);assert.ok(checkpoint.state.current.includes('&lt;값&gt;'));assert.equal((await tree())[2],'status : 대기');
 });
 await scenario('closing the owned headless browser and reopening its own profile restores real IndexedDB history',async()=>{
  const expected=await page.evaluate(()=>xml95.store().read());await browser.close();browser=undefined;await launch();assert.deepEqual(await page.evaluate(()=>xml95.store().read()),expected);assert.equal(await page.evaluate(()=>xml95.store('other-work').read()),null);await page.evaluate(()=>xml95.showXmlDocumentDialog({recovery:xml95.store()}));await idle();await click('restore-recovery');assert.equal((await tree())[1],'title : 수정 <값> & 😀');await click('redo');assert.equal((await tree())[2],'status : 완료');
 });
 await scenario('actual UTF8 XML and exact XSD downloads reparse and retain comments and type declarations',async()=>{
  const exported=await download('export-xml','own.xml'),schema=await download('export-xsd','own.xsd');assert.equal(schema.toString(),xsd);const text=exported.toString();assert.ok(text.includes('<!-- KEEP ROOT -->'));assert.ok(text.includes('<!-- KEEP FIELD -->'));assert.ok(text.includes('&lt;값&gt;'));const value=await page.evaluate(({xml,xsd})=>xml95.createXmlWorkspace(xml95.browserXmlCodec,xml,xsd).snapshot(),{xml:text,xsd});assert.equal(value.fields[2].value,'완료');assert.equal(value.dirty,false);
 });
 await scenario('unsupported patterns, cyclic references and bad namespaces reject before replacing current XML',async()=>{
  const result=await page.evaluate(({xml,xsd})=>{const r=xml95,values=[xsd.replace('<xs:minLength value="1"/>','<xs:pattern value=".*"/>'),xsd.replace('base="xs:string"','base="o:Title"'),xsd.replace('xmlns:o="urn:own95"','xmlns:o="urn:spoof"')];return values.map(s=>{try{r.createXmlWorkspace(r.browserXmlCodec,xml,s);return false;}catch{return true;}});},{xml,xsd});assert.deepEqual(result,[true,true,true]);assert.equal((await tree())[2],'status : 완료');
 });
 await scenario('the original fixture bytes and all non-user browser error boundaries remain unchanged',async()=>{
  assert.equal((await readFile(out+'/own.xml')).toString(),xml);assert.equal((await readFile(out+'/own.xsd')).toString(),xsd);assert.deepEqual(pageErrors,[]);assert.deepEqual(consoleErrors,[]);assert.deepEqual(externalRequests,[]);
 });
}finally{
 await browser?.close();await writeFile(out+'/result.json',JSON.stringify({results,failures,pageErrors,consoleErrors,externalRequests,downloadEvents,oracleObservations,sourceHashes,bundleSha256:sha(bundle),verifierSha256:sha(await readFile(fileURLToPath(import.meta.url))),inputSha256:{xml:sha(xml),xsd:sha(xsd)},scope:'Exact current production XML module/DOM dialog in isolated headless Edge; file-origin real IndexedDB close/reopen; actual owned downloads. No server, visible GUI, native/Hancom/HWT mapping or general XSD/XSL support claim.'},null,2),{flag:'wx'});
}
if(failures.length)process.exitCode=1;
