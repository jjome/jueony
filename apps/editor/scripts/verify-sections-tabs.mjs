// Functional diagnostics on the fresh patched engine. Not a Hancom visual golden.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {verifyPreservedExport} from '../src/adapters/rhwp/preservation.ts';
const app=resolve(dirname(fileURLToPath(import.meta.url)),'..'),repo=resolve(app,'../..');
if(!process.env.JUEONY_ENGINE_PACKAGE)throw new Error('JUEONY_ENGINE_PACKAGE must name the fresh engine pkg');
const pkg=resolve(repo,process.env.JUEONY_ENGINE_PACKAGE),out=resolve(app,process.env.JUEONY_TEST_OUTPUT??'evidence/sections-tabs');
const build=JSON.parse(await readFile(join(pkg,'jueony-engine-build.json'),'utf8'));
const {default:init,HwpDocument}=await import(pathToFileURL(join(pkg,'rhwp.js')).href);
await init({module_or_path:await readFile(join(pkg,'rhwp_bg.wasm'))});
assert.equal(typeof HwpDocument.prototype.insertSectionBreak,'function','fresh engine must export the actual section-break API');
await mkdir(out,{recursive:true});
const parse=v=>typeof v==='string'?JSON.parse(v):v;
const sections=d=>Array.from({length:d.getSectionCount()},(_,s)=>Array.from({length:d.getParagraphCount(s)},(_,p)=>d.getTextRange(s,p,0,d.getParagraphLength(s,p))));
function blank(texts=['앞 문단','가😀나\t다','마지막 문단']){
 const d=HwpDocument.createEmpty();d.createBlankDocument();
 for(let p=0;p<texts.length;p++){if(p)d.splitParagraph(0,p-1,d.getParagraphLength(0,p-1));d.insertText(0,p,0,texts[p]);}
 d.setSectionDef(0,JSON.stringify({defaultTabSpacing:8000}));return d;
}
const results=[],failures=[],documents=[];
async function run(name,fn){try{const data=await fn();results.push({name,data});console.log('PASS',name);}catch(e){failures.push({name,error:String(e),stack:e.stack});console.error('FAIL',name,e);}}
async function roundtrip(d,name){
 for(const format of ['hwp','hwpx']){
  const artifact=d[format==='hwp'?'exportHwpWithReport':'exportHwpxWithReport']();
  let bytes,report;
  try{bytes=artifact.takeBytes();report=verifyPreservedExport(d,bytes,format,artifact.contentLoss(),b=>new HwpDocument(b));}
  finally{artifact.free();}
  assert.equal(report.status,'checked');const reopened=new HwpDocument(bytes);
  try{assert.deepEqual(sections(reopened),sections(d));assert.equal(reopened.getSectionCount(),d.getSectionCount());}
  finally{reopened.free();}
  await writeFile(join(out,name+'.'+format),bytes);documents.push(name+'.'+format);
 }
}
await run('section boundaries: first/start/middle/end/last/empty, HWP+HWPX reopen and snapshot restore',async()=>{
 const cases=[{texts:['ABC','DEF'],p:0,o:0,w:[[''],['ABC','DEF']]},{texts:['ABC','DEF'],p:1,o:0,w:[['ABC'],['DEF']]},{texts:['ABC','DEF'],p:0,o:1,w:[['A'],['BC','DEF']]},{texts:['ABC','DEF'],p:0,o:3,w:[['ABC'],['DEF']]},{texts:['ABC','DEF'],p:1,o:3,w:[['ABC','DEF'],['']]},{texts:[''],p:0,o:0,w:[[''],['']]},{texts:['ABC','','DEF'],p:1,o:0,w:[['ABC'],['','DEF']]}];
 for(let i=0;i<cases.length;i++){const c=cases[i],d=blank(c.texts);try{const before=sections(d),saved=d.saveSnapshot();
  const result=parse(d.insertSectionBreak(0,c.p,c.o));assert.equal(result.ok,true);assert.equal(result.sectionIdx,1);assert.deepEqual(sections(d),c.w);assert.ok(parse(d.getDocumentInfo()).pageCount>=2);
  await roundtrip(d,'boundary-'+i);d.restoreSnapshot(saved);assert.deepEqual(sections(d),before);d.discardSnapshot(saved);
 }finally{d.free();}}return {cases:cases.length};
});
await run('mixed Korean/emoji/tab text and character runs survive split and both saves',async()=>{
 const d=blank();try{d.applyCharFormat(0,1,0,2,JSON.stringify({bold:true}));const text=sections(d)[0][1];
  const before=Array.from(text,(_,i)=>parse(d.getCharPropertiesAt(0,1,i)).bold);
  assert.equal(parse(d.insertSectionBreak(0,1,2)).ok,true);assert.equal(sections(d)[0].at(-1)+sections(d)[1][0],text);
  const flags=[...Array.from(sections(d)[0].at(-1),(_,i)=>parse(d.getCharPropertiesAt(0,1,i)).bold),...Array.from(sections(d)[1][0],(_,i)=>parse(d.getCharPropertiesAt(1,0,i)).bold)];assert.deepEqual(flags,before);
  await roundtrip(d,'mixed-runs-tabs');return {sections:sections(d)};
 }finally{d.free();}
});
await run('middle section split retains later section properties and distinct tab distances',async()=>{
 const d=blank(['ONE','TWO','THREE']);try{d.insertSectionBreak(0,1,0);d.insertSectionBreak(1,1,0);d.setSectionDef(2,JSON.stringify({defaultTabSpacing:12000}));const lastPage=parse(d.getPageDef(2));
  d.insertSectionBreak(1,0,1);assert.deepEqual(sections(d),[['ONE'],['T'],['WO'],['THREE']]);assert.equal(parse(d.getSectionDef(3)).defaultTabSpacing,12000);assert.deepEqual(parse(d.getPageDef(3)),lastPage);
  await roundtrip(d,'four-sections');return {sections:sections(d)};
 }finally{d.free();}
});
await run('invalid offsets and control-bearing split target leave document unchanged',async()=>{
 const d=blank();try{const before=sections(d);for(const a of [[99,0,0],[0,99,0],[0,0,999]])assert.throws(()=>d.insertSectionBreak(...a));assert.deepEqual(sections(d),before);
  const table=parse(d.createTable(0,1,0,2,2));const p=table.paraIdx??1;const controls=parse(d.getControls());assert.throws(()=>d.insertSectionBreak(0,p,0));assert.deepEqual(parse(d.getControls()),controls);
  return {table,sections:sections(d)};
 }finally{d.free();}
});
await run('table and header survive moving to a new BodyText stream',async()=>{
 const d=blank(['INTRO','SPLIT HERE','TABLE','END']);try{d.createHeaderFooter(0,true,0);d.insertTextInHeaderFooter(0,true,0,0,0,'공통 머리말');const table=parse(d.createTable(0,2,0,2,2));d.insertTextInCell(0,table.paraIdx,table.controlIdx,0,0,0,'업무 표');
  d.insertSectionBreak(0,1,5);const controls=parse(d.getControls());assert.ok(controls.some(c=>c.ctrlId==='tbl'));await roundtrip(d,'table-header-sections');return {controls};
 }finally{d.free();}
});
await run('new table properties match exported HWP and HWPX without a section split',async()=>{
 const d=blank(['INTRO','TABLE','END']);try{
  const table=parse(d.createTable(0,1,0,2,2));d.insertTextInCell(0,table.paraIdx,table.controlIdx,0,0,0,'새 표 기본 속성');
  await roundtrip(d,'new-table-properties');return {properties:parse(d.getTableProperties(0,table.paraIdx,table.controlIdx))};
 }finally{d.free();}
});
await run('section default tab 20/40/60pt updates current layout and round-trips raw values',async()=>{
 const d=blank(['A\tB\tC','NEXT']);try{const observations=[];
  for(const [pt,raw] of [[20,4000],[40,8000],[60,12000]]){const before=d.saveSnapshot(),beforeCursor=parse(d.getCursorRect(0,0,2));d.setSectionDef(0,JSON.stringify({defaultTabSpacing:raw}));assert.equal(parse(d.getSectionDef(0)).defaultTabSpacing,raw);
   const cursor=parse(d.getCursorRect(0,0,2));observations.push({pt,raw,cursor});await writeFile(join(out,'tabs-'+pt+'pt.svg'),d.renderPageSvg(0));await roundtrip(d,'tabs-'+pt+'pt');d.restoreSnapshot(before);assert.deepEqual(parse(d.getCursorRect(0,0,2)),beforeCursor);d.discardSnapshot(before);
  }
  return {observations,note:'Cursor/SVG observations are diagnostics, not independent Hancom pixel parity.'};
 }finally{d.free();}
});
await run('distinct section tab layouts and explicit paragraph stops survive settings changes',async()=>{
 const d=blank(['A\tB\tC','A\tB\tC']);try{
  d.insertSectionBreak(0,1,0);d.setSectionDef(0,JSON.stringify({defaultTabSpacing:4000}));d.setSectionDef(1,JSON.stringify({defaultTabSpacing:12000}));
  const first=parse(d.getCursorRect(0,0,2)),second=parse(d.getCursorRect(1,0,2));
  assert.ok(second.x>first.x,'60pt section must advance farther than 20pt section');
  d.applyParaFormat(0,0,JSON.stringify({tabStops:[{position:18000,type:0,leader:0}]}));
  const explicit=parse(d.getParaPropertiesAt(0,0)).tabStops;assert.equal(explicit.length,1);
  d.setSectionDef(0,JSON.stringify({defaultTabSpacing:8000}));assert.deepEqual(parse(d.getParaPropertiesAt(0,0)).tabStops,explicit);
  assert.equal(parse(d.getSectionDef(1)).defaultTabSpacing,12000);
  assert.deepEqual(parse(d.getCursorRect(1,0,2)),second);
  await roundtrip(d,'scoped-and-explicit-tabs');return {first,second,explicit};
 }finally{d.free();}
});
await run('default tab updates nested table cell and own header geometry without losing cell text',async()=>{
 const d=blank(['BODY','TABLE']);try{
  d.createHeaderFooter(0,true,0);d.insertTextInHeaderFooter(0,true,0,0,0,'H\tI');
  const table=parse(d.createTable(0,1,0,2,2));d.insertTextInCell(0,table.paraIdx,table.controlIdx,0,0,0,'A\tB');
  const observations=[];
  for(const raw of [4000,12000]){
   d.setSectionDef(0,JSON.stringify({defaultTabSpacing:raw}));
   observations.push({raw,cell:parse(d.getCursorRectInCell(0,table.paraIdx,table.controlIdx,0,0,2)),header:parse(d.getCursorRectInHeaderFooter(0,true,0,0,2,-1))});
  }
  assert.ok(observations[1].cell.x>observations[0].cell.x);assert.ok(observations[1].header.x>observations[0].header.x);
  await roundtrip(d,'nested-cell-header-tabs');return {observations};
 }finally{d.free();}
});
await writeFile(join(out,'engine-result.json'),JSON.stringify({build,results,failures,documents,nativeHancom:'NOT_RUN',note:'Fresh WASM functional diagnostics and engine round-trips. No new rendering fixture/golden or Hancom equivalence assertion.'},null,2));
if(failures.length)process.exitCode=1;
