import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {inflateRawSync} from 'node:zlib';
import init,{HwpDocument} from '../node_modules/@rhwp/core/rhwp.js';
import {readChartDataSource,replaceChartCategoryLabel,replaceChartSeriesName,replaceChartValue} from '../src/adapters/rhwp/chart-data-edit.ts';
import {hwpLogicalStreams} from '../scripts/lib/hwp-summary-evidence.mjs';
import {readOwnedZip} from '../scripts/lib/owned-zip.mjs';

await init({module_or_path:await readFile(new URL('../node_modules/@rhwp/core/rhwp_bg.wasm',import.meta.url))});

type Format='hwp'|'hwpx';
const samples:Record<Format,URL>={
 hwp:new URL('../../../upstream/rhwp-source/samples/chart/가로막대형/묶은가로막대형.hwp',import.meta.url),
 hwpx:new URL('../../../upstream/rhwp-source/samples/chart/가로막대형/묶은가로막대형.hwpx',import.meta.url),
};
const bytes=(doc:any,format:Format):Uint8Array=>doc[format==='hwp'?'exportHwp':'exportHwpx']();
const same=(value:any)=>{const copy=structuredClone(value);delete copy.revision;return copy;};
function ole(bytes:Uint8Array):Map<string,Buffer>{
 const b=Buffer.from(bytes),length=b.readUInt32LE(0);assert.equal(length,b.length-4);return hwpLogicalStreams(b.subarray(4));
}
function hwpEvidence(input:Uint8Array){
 const streams=hwpLogicalStreams(input),header=streams.get('FileHeader');assert.ok(header&&header.length>=40);
 const candidates=[] as {path:string;streams:Map<string,Buffer>}[];
 for(const [path,stored] of streams)if(/^BinData\/.*\.OLE$/i.test(path)){
  const expanded=(header.readUInt32LE(36)&1)!==0?inflateRawSync(stored,{maxOutputLength:32*1024*1024}):stored;
  try{const nested=ole(expanded);if(nested.has('OOXMLChartContents'))candidates.push({path,streams:nested});}catch{}
 }
 assert.equal(candidates.length,1);return{streams,path:candidates[0].path,nested:candidates[0].streams,xml:candidates[0].streams.get('OOXMLChartContents')!.toString()};
}
function hwpxEvidence(input:Uint8Array){
 const parts=new Map(readOwnedZip(input)),charts=[...parts].filter(([name])=>/^Chart\/chart\d+\.xml$/i.test(name));assert.equal(charts.length,1);
 const nested=[...parts].filter(([name])=>/^BinData\/.*\.ole$/i.test(name)).map(([path,value])=>({path,streams:ole(value)})).filter(item=>item.streams.has('OOXMLChartContents'));
 assert.equal(nested.length,1);return{parts,path:charts[0][0],xml:charts[0][1].toString(),nestedPath:nested[0].path,nested:nested[0].streams,nestedXml:nested[0].streams.get('OOXMLChartContents')!.toString()};
}
function expectedXml(before:string):string{
 const needle='<c:pt idx="0"><c:v>4.3</c:v></c:pt>',replacement='<c:pt idx="0"><c:v>9.9</c:v></c:pt>';
 assert.equal(before.split(needle).length-1,1);assert.match(before,/<c:barChart>/);assert.match(before,/<c:catAx>/);assert.match(before,/<c:valAx>/);assert.match(before,/<c:legendPos val="r"\/>/);
 assert.match(before,/<c:ext uri="CC8EB2C9-7E31-499d-B8F2-F6CE61031016"><ho:hncChartStyle /);return before.replace(needle,replacement);
}
function expectedSeriesNameXml(before:string):string{
 const formula='<c:f>Sheet1!$B$1</c:f>',needle='계열 1';assert.equal(before.split(formula).length-1,1);assert.equal(before.split(needle).length-1,1);
 assert.match(before,/<c:barChart>/);assert.match(before,/<c:catAx>/);assert.match(before,/<c:valAx>/);assert.match(before,/<c:legendPos val="r"\/>/);
 assert.match(before,/<c:ext uri="CC8EB2C9-7E31-499d-B8F2-F6CE61031016"><ho:hncChartStyle /);const after=before.replace(needle,'첫 계열');assert.equal(after.split(formula).length-1,1);return after;
}
function expectedCategoryLabelXml(before:string):string{
 const formula='<c:f>Sheet1!$A$2:$A$5</c:f>',needle='항목 1';assert.equal(before.split(formula).length-1,3);assert.equal(before.split(needle).length-1,3);
 assert.match(before,/<c:barChart>/);assert.match(before,/<c:catAx>/);assert.match(before,/<c:valAx>/);assert.match(before,/<c:legendPos val="r"\/>/);
 assert.match(before,/<c:ext uri="CC8EB2C9-7E31-499d-B8F2-F6CE61031016"><ho:hncChartStyle /);const after=before.split(needle).join('첫 항목');assert.equal(after.split(formula).length-1,3);return after;
}
function assertNestedPreserved(before:Map<string,Buffer>,after:Map<string,Buffer>){
 assert.deepEqual([...after.keys()].sort(),[...before.keys()].sort());
 for(const [name,value] of before)if(name!=='OOXMLChartContents')assert.deepEqual(after.get(name),value,`non-chart nested OLE stream changed: ${name}`);
}
function assertRawPreservation(format:Format,original:Uint8Array,saved:Uint8Array,expected:(xml:string)=>string=expectedXml){
 if(format==='hwp'){
  const before=hwpEvidence(original),after=hwpEvidence(saved);assert.equal(after.path,before.path);assert.equal(after.xml,expected(before.xml));assertNestedPreserved(before.nested,after.nested);
  assert.deepEqual([...after.streams.keys()].sort(),[...before.streams.keys()].sort());
  for(const [name,value] of before.streams)if(name!==before.path&&!/^DocInfo$|^BodyText\//.test(name))assert.deepEqual(after.streams.get(name),value,`non-chart HWP asset changed: ${name}`);
 }else{
  const before=hwpxEvidence(original),after=hwpxEvidence(saved);assert.equal(after.path,before.path);assert.equal(after.xml,expected(before.xml));assert.equal(after.nestedXml,expected(before.nestedXml));assertNestedPreserved(before.nested,after.nested);
  for(const [name,value] of before.parts)if(/^Preview\//.test(name))assert.deepEqual(after.parts.get(name),value,`non-chart HWPX asset changed: ${name}`);
 }
}

for(const format of ['hwp','hwpx'] as const)test(`one ${format.toUpperCase()} chart cache value preserves type, axes, legend, unknown OOXML and non-chart assets`,async()=>{
 const original=await readFile(samples[format]),doc:any=new HwpDocument(original);
 try{
  const beforeExport=bytes(doc,format),source=readChartDataSource(doc,0,'document:1'),undo=doc.saveSnapshot();
  assert.equal(source.plot,'bar');assert.equal(source.axis,'category');assert.deepEqual(source.series.map(series=>series.name),['계열 1','계열 2','계열 3']);assert.equal(source.series[0].values[0],'4.3');
  try{
   const result=replaceChartValue(doc,source,{revision:'document:1',index:0,series:0,point:0,original:'4.3',value:'9.9'},()=> 'document:1');
   assert.equal(result.after.series[0].values[0],'9.9');const saved=bytes(doc,format);assertRawPreservation(format,original,saved);
   const reopened:any=new HwpDocument(saved);try{const actual=readChartDataSource(reopened,0,'document:2');assert.deepEqual(same(actual),same(result.after));assert.equal(actual.plot,'bar');assert.equal(actual.axis,'category');assert.deepEqual(actual.series.map(series=>series.name),['계열 1','계열 2','계열 3']);}
   finally{reopened.free();}
   doc.restoreSnapshot(undo);assert.deepEqual(bytes(doc,format),beforeExport);
  }finally{doc.discardSnapshot(undo);}
 }finally{doc.free();}
});

for(const format of ['hwp','hwpx'] as const)test(`one ${format.toUpperCase()} series name change preserves its formula, chart structure, unknown OOXML and non-chart assets`,async()=>{
 const original=await readFile(samples[format]),doc:any=new HwpDocument(original);
 try{
  const beforeExport=bytes(doc,format),source=readChartDataSource(doc,0,'document:1'),undo=doc.saveSnapshot();
  try{
   const result=replaceChartSeriesName(doc,source,{revision:'document:1',index:0,series:0,original:'계열 1',value:'첫 계열'},()=> 'document:1');
   assert.equal(result.after.series[0].name,'첫 계열');assert.deepEqual(result.after.series[0].values,source.series[0].values);const saved=bytes(doc,format);assertRawPreservation(format,original,saved,expectedSeriesNameXml);
   const reopened:any=new HwpDocument(saved);try{const actual=readChartDataSource(reopened,0,'document:2');assert.deepEqual(same(actual),same(result.after));assert.equal(actual.plot,'bar');assert.equal(actual.axis,'category');assert.deepEqual(actual.series.map(series=>series.name),['첫 계열','계열 2','계열 3']);}
   finally{reopened.free();}
   doc.restoreSnapshot(undo);assert.deepEqual(bytes(doc,format),beforeExport);
  }finally{doc.discardSnapshot(undo);}
 }finally{doc.free();}
});

for(const format of ['hwp','hwpx'] as const)test(`one logical ${format.toUpperCase()} category label updates every shared cache and preserves formulas and chart structure`,async()=>{
 const original=await readFile(samples[format]),doc:any=new HwpDocument(original);
 try{
  const beforeExport=bytes(doc,format),source=readChartDataSource(doc,0,'document:1'),undo=doc.saveSnapshot(),valueCounts=source.series.map(series=>series.values.length);
  try{
   const result=replaceChartCategoryLabel(doc,source,{revision:'document:1',index:0,point:0,original:'항목 1',value:'첫 항목'},()=> 'document:1');
   assert.equal(result.after.labels[0],'첫 항목');assert.deepEqual(result.after.series.map(series=>series.values.length),valueCounts);const saved=bytes(doc,format);assertRawPreservation(format,original,saved,expectedCategoryLabelXml);
   const reopened:any=new HwpDocument(saved);try{const actual=readChartDataSource(reopened,0,'document:2');assert.deepEqual(same(actual),same(result.after));assert.equal(actual.plot,'bar');assert.equal(actual.axis,'category');assert.deepEqual(actual.series.map(series=>series.name),source.series.map(series=>series.name));assert.deepEqual(actual.series.map(series=>series.values.length),valueCounts);}
   finally{reopened.free();}
   doc.restoreSnapshot(undo);assert.deepEqual(bytes(doc,format),beforeExport);
  }finally{doc.discardSnapshot(undo);}
 }finally{doc.free();}
});

test('stale revisions and stale source are fail-closed and a malformed engine result rolls back atomically',async()=>{
 const doc:any=new HwpDocument(await readFile(samples.hwpx));
 try{
  const source=readChartDataSource(doc,0,'document:1'),before=doc.exportHwpx(),edit={revision:'document:1',index:0,series:0,point:0,original:'4.3',value:'9.9'};
  assert.throws(()=>replaceChartValue(doc,source,edit,()=> 'document:2'),/버전/);assert.deepEqual(doc.exportHwpx(),before);
  assert.throws(()=>replaceChartValue(doc,source,{...edit,original:'2.5'},()=> 'document:1'),/원문/);assert.deepEqual(doc.exportHwpx(),before);
  const proxy=new Proxy(doc,{get(target,key){
   if(key==='setChartDataByIndex')return(index:number,payload:string)=>{const result=JSON.parse(target.setChartDataByIndex(index,payload));if(JSON.parse(payload).dryRun)return JSON.stringify(result);return JSON.stringify({...result,ok:false});};
   const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;
  }});
  assert.throws(()=>replaceChartValue(proxy,source,edit,()=> 'document:1'),/실패/);assert.deepEqual(doc.exportHwpx(),before);
 }finally{doc.free();}
});

test('series name edit rejects stale ownership and rolls back after a malformed post-mutation result',async()=>{
 const doc:any=new HwpDocument(await readFile(samples.hwp));
 try{
  const source=readChartDataSource(doc,0,'document:1'),before=doc.exportHwp(),edit={revision:'document:1',index:0,series:0,original:'계열 1',value:'첫 계열'};
  assert.throws(()=>replaceChartSeriesName(doc,source,edit,()=> 'document:2'),/버전/);assert.deepEqual(doc.exportHwp(),before);
  assert.throws(()=>replaceChartSeriesName(doc,source,{...edit,original:'계열 2'},()=> 'document:1'),/원문/);assert.deepEqual(doc.exportHwp(),before);
  const proxy=new Proxy(doc,{get(target,key){
   if(key==='setChartDataByIndex')return(index:number,payload:string)=>{const result=JSON.parse(target.setChartDataByIndex(index,payload));if(JSON.parse(payload).dryRun)return JSON.stringify(result);return JSON.stringify({...result,ok:false});};
   const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;
  }});
  assert.throws(()=>replaceChartSeriesName(proxy,source,edit,()=> 'document:1'),/실패/);assert.deepEqual(doc.exportHwp(),before);
 }finally{doc.free();}
});

test('category label edit rejects stale ownership and rolls back after a malformed post-mutation result',async()=>{
 const doc:any=new HwpDocument(await readFile(samples.hwpx));
 try{
  const source=readChartDataSource(doc,0,'document:1'),before=doc.exportHwpx(),edit={revision:'document:1',index:0,point:0,original:'항목 1',value:'첫 항목'};
  assert.throws(()=>replaceChartCategoryLabel(doc,source,edit,()=> 'document:2'),/버전/);assert.deepEqual(doc.exportHwpx(),before);
  assert.throws(()=>replaceChartCategoryLabel(doc,source,{...edit,original:'항목 2'},()=> 'document:1'),/원문/);assert.deepEqual(doc.exportHwpx(),before);
  const proxy=new Proxy(doc,{get(target,key){
   if(key==='setChartDataByIndex')return(index:number,payload:string)=>{const result=JSON.parse(target.setChartDataByIndex(index,payload));if(JSON.parse(payload).dryRun)return JSON.stringify(result);return JSON.stringify({...result,ok:false});};
   const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;
  }});
  assert.throws(()=>replaceChartCategoryLabel(proxy,source,edit,()=> 'document:1'),/실패/);assert.deepEqual(doc.exportHwpx(),before);
 }finally{doc.free();}
});
