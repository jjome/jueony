import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import test from 'node:test';
import {pathToFileURL} from 'node:url';
import {readCitedReference,readReferences,resolveReferenceOrigin,type ExtractedReference} from '../src/adapters/files/references.ts';
import {readHwpReference} from '../src/adapters/rhwp/reference-locations.ts';
import {createReferenceFacade,findSpreadsheetLocation,validSourceLocations,type SourceLocation} from '../src/modules/references/public/index.ts';

const scope={workspaceId:'work',chatId:'chat'};
const hash=(text:string|Uint8Array)=>createHash('sha256').update(text).digest('hex');

test('qualified Excel queries resolve only a unique observed cell on the named sheet',()=>{
 const cells:SourceLocation[]=[
  {start:10,end:19,address:{kind:'xlsx',sheet:'예산',cell:'C2'}},
  {start:20,end:30,address:{kind:'xlsx',sheet:'예산',cell:'C20'}},
  {start:32,end:42,address:{kind:'xlsx',sheet:'집행',cell:'C2'}},
  {start:45,end:53,address:{kind:'xlsx',sheet:'집행',cell:'D4'}},
 ];
 assert.equal(findSpreadsheetLocation(cells,'Excel 예산 시트 Ｃ２의 저장 금액'),cells[0]);
 assert.equal(findSpreadsheetLocation(cells,'집행 시트 C2'),cells[2]);
 assert.equal(findSpreadsheetLocation(cells,'예산 C20'),cells[1]);
 assert.equal(findSpreadsheetLocation(cells,'D4의 값'),cells[3]);
 assert.equal(findSpreadsheetLocation(cells,'C2의 값'),undefined);
 assert.equal(findSpreadsheetLocation(cells,'예산 D4'),undefined);
 assert.equal(findSpreadsheetLocation(cells,'예산 C2와 C20'),undefined);
});

test('real HWP and HWPX map duplicate table numbers, units and dated body text to their own locations',{
 skip:!process.env.JUEONY_ENGINE_PACKAGE&&'requires the restored Jueony engine',
},async()=>{
 const pkg=resolve(process.env.JUEONY_ENGINE_PACKAGE!);
 const wasm=await import(pathToFileURL(resolve(pkg,'rhwp.js')).href);
 await wasm.default({module_or_path:await readFile(resolve(pkg,'rhwp_bg.wasm'))});
 const original=wasm.HwpDocument.createEmpty();
 try{
  original.createBlankDocument();
  const header='🗓️ 2026-09-01 확정 예산';
  original.insertText(0,0,0,header);
  const table=JSON.parse(original.createTable(0,0,Array.from(header).length,2,2));
  for(const [index,text] of ['단위 천원','사업비 1,200','총액','1,200'].entries()){
   original.insertTextInCell(0,table.paraIdx,table.controlIdx,index,0,0,text);
  }
  for(const format of ['hwp','hwpx']){
   const bytes=format==='hwp'?original.exportHwp():original.exportHwpx();
   const document=new wasm.HwpDocument(bytes);
   try{
    const source=readHwpReference(document);
    const locations=source.locations!;
    assert.equal(source.text,JSON.parse(document.getTextFileUnicode()));
    assert(validSourceLocations(locations,source.text.length));
    assert.deepEqual(locations.map(place=>source.text.slice(place.start,place.end)),[header,'단위 천원','사업비 1,200','총액','1,200']);
    assert.deepEqual(locations.slice(1).map(place=>place.address.kind==='hwp'&&[place.address.cell?.row,place.address.cell?.column]),[[0,0],[0,1],[1,0],[1,1]]);
    assert.equal(locations[0].address.kind,'hwp');
    const unknown=new Proxy(document,{get(target,key){
     if(key==='getControls')return()=>JSON.stringify([...JSON.parse(target.getControls()),{list:1,ctrlId:'gso'}]);
     const value=Reflect.get(target,key,target);
     return typeof value==='function'?value.bind(target):value;
    }});
    const limited=readHwpReference(unknown);
    assert.equal(limited.text,source.text);
    assert.equal(limited.locations,undefined);
   }finally{document.free();}
  }
 }finally{original.free();}
});

test('HWP and HWPX map identical full paragraphs in one nested table and leave other duplicate lines unresolved',{
 skip:!process.env.JUEONY_ENGINE_PACKAGE&&'requires the restored Jueony engine',
},async()=>{
 const pkg=resolve(process.env.JUEONY_ENGINE_PACKAGE!);
 const engine=await import(pathToFileURL(resolve(pkg,'rhwp.js')).href);
 await engine.default({module_or_path:await readFile(resolve(pkg,'rhwp_bg.wasm'))});
 const original=engine.HwpDocument.createEmpty();
 try{
  original.createBlankDocument();
  original.pasteHtml(0,0,0,'<p>별도 금액</p><table><tr><td>상위 예산표<table><tr><td>중첩 사업비 3,250천원</td><td>중복 금액</td></tr><tr><td>중복 금액</td><td>🗓️ 2026년 정산</td></tr><tr><td>별도 금액</td><td>보존 셀</td></tr></table></td></tr></table>');
  for(const bytes of [original.exportHwp(),original.exportHwpx()]){
   const doc=new engine.HwpDocument(bytes);
   try{
    const source=readHwpReference(doc),locations=source.locations!;
    assert(validSourceLocations(locations,source.text.length));
    const repeated=locations.filter(place=>source.text.slice(place.start,place.end)==='중복 금액');
    assert.deepEqual(repeated.map(({address})=>address.kind==='hwp'&&[address.cell?.row,address.cell?.column]),[[0,1],[1,0]]);
    assert(repeated[0].start<repeated[1].start);
    assert.equal(source.text.split('\r\n').filter(line=>line==='별도 금액').length,2);
    assert(!locations.some(place=>source.text.slice(place.start,place.end)==='별도 금액'));
    const nested=locations.find(place=>source.text.slice(place.start,place.end)==='🗓️ 2026년 정산')?.address;
    assert.equal(nested?.kind,'hwp');
    if(nested?.kind!=='hwp')throw Error('Missing nested HWP address');
    assert.deepEqual(nested.ancestors?.map(({row,column})=>[row,column]),[[0,0]]);
    assert.deepEqual([nested.cell?.row,nested.cell?.column],[1,1]);
    assert.equal(validSourceLocations([{start:0,end:1,address:{...nested,ancestors:Array(8).fill(nested.cell)}}],1),false);
   }finally{doc.free();}
  }
 }finally{original.free();}
});

test('retrieval slices complete evidence locations with source version and excludes unselected coordinates',async()=>{
 const prefix='자료 행\r\n'.repeat(200),target='2026년 합계 1,200천원',text=prefix+target;
 const location:SourceLocation={start:prefix.length,end:text.length,address:{kind:'xlsx',sheet:'예산',cell:'C8'}};
 const source={id:'root/sample.hwpx',name:'확정 예산',text,characters:text.length,sha256:hash(text),
  locations:[location],sourceVersion:{kind:'open-document' as const,revision:'rev'}};
 const facade=createReferenceFacade({digest:async value=>hash(value)});
 const {references,retrieval}=await facade.retrieve(scope,[source],'2026년 합계 1,200천원');
 const result=references[0], actual=result.locations![0];
 assert.equal(result.sourceVersion?.revision,'rev');
 assert.equal(result.text.slice(actual.start,actual.end),target);
 assert.equal(actual.start,location.start-result.locator.start);
 assert.deepEqual(retrieval.hits[0].locations,result.locations);
 await assert.rejects(facade.index(scope,[{...source,locations:[{...location,end:text.length+1}]}]),/위치/);
});

test('source opening accepts only the original selected workspace or attachment chat and matching file bytes',async()=>{
 const bytes=new TextEncoder().encode('original'),file=new File([bytes],'source.hwpx');
 const temporary=[{id:'attachment:test',workspaceId:'work',chatId:'chat',file}];
 const origin=await resolveReferenceOrigin('attachment:test',[],scope,temporary);
 assert.deepEqual(await readCitedReference(origin,hash(bytes)),{bytes,name:file.name});
 const sheet=new File([bytes],'source.xlsx');
 assert.deepEqual(await readCitedReference({file:sheet},hash(bytes),'xlsx'),{bytes,name:sheet.name});
 await assert.rejects(readCitedReference({file:sheet},hash('changed'),'xlsx'),/원본 자료가 바뀌었습니다/);
 await assert.rejects(readCitedReference({file:sheet},hash(bytes)),/형식/);
 await assert.rejects(readCitedReference(origin,hash('changed')),/원본 자료가 바뀌었습니다/);
 await assert.rejects(resolveReferenceOrigin('attachment:test',[],{...scope,chatId:'other'},temporary),/원본 자료/);
 const allowed={name:'root',id:'root-id',workspaceId:'work',handle:{
  queryPermission:async()=> 'granted',getFileHandle:async(path:string)=>{
   assert.equal(path,file.name);return {queryPermission:async()=> 'granted',getFile:async()=>file};
  },
 } as unknown as FileSystemDirectoryHandle};
 const fromFolder=await resolveReferenceOrigin('root-id/root/source.hwpx',[allowed],scope,temporary);
 assert.deepEqual(await readCitedReference(fromFolder,hash(bytes)),{bytes,name:file.name});
 await assert.rejects(resolveReferenceOrigin('root-id/root/../source.hwpx',[allowed],scope,temporary),/원본 자료/);
 await assert.rejects(resolveReferenceOrigin('root-id/root/source.hwpx',[allowed],{...scope,workspaceId:'other'},temporary),/원본 자료/);
});

test('background extraction reuses verified bytes and reparses an equal-size change with the same timestamp',async()=>{
 const lastModified=100;
 let file=new File(['원본'],'scope.hwpx',{lastModified}),parses=0;
 const handle={kind:'file',name:file.name,queryPermission:async()=> 'granted',getFile:async()=>file} as unknown as FileSystemFileHandle;
 const folders=[{id:'root',name:'자료',workspaceId:'work',handle:{queryPermission:async()=> 'granted'} as unknown as FileSystemDirectoryHandle}];
 const selected=[{id:'root/자료/scope.hwpx',workspaceId:'work',rootId:'root',path:'자료/scope.hwpx',handle}];
 let previous=new Map<string,ExtractedReference>();
 const signal=new AbortController().signal;
 async function read(){
  const next=new Map<string,ExtractedReference>();
  const sources=await readReferences(selected,folders,'work',async bytes=>{
   parses++;
   return {text:new TextDecoder().decode(bytes),locations:[{start:0,end:2,address:{kind:'hwp',section:0,paragraph:0,offset:0}}]};
  },signal,undefined,undefined,false,{previous,next});
  previous=next;
  return sources;
 }
 const first=await read();assert.equal(parses,1);
 assert.deepEqual(await read(),first);assert.equal(parses,1);
 file=new File(['수정'],file.name,{lastModified});
 const second=await read();assert.equal(parses,2);
 assert.equal(second[0].text,'수정');assert.notEqual(second[0].sha256,first[0].sha256);
 assert.deepEqual(second[0].locations,first[0].locations);
});
