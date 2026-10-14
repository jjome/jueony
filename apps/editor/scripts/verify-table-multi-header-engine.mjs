import {readAgentTableHeaderSources} from '../src/adapters/rhwp/agent-table-header.ts';
import {readAgentTablePaginationSources} from '../src/adapters/rhwp/agent-table-pagination.ts';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {execFileSync} from 'node:child_process';
import {readPageBorderSettings,writePageBorderSettings} from '../src/adapters/rhwp/page-border-settings.ts';
import {readMasterPages} from '../src/adapters/rhwp/master-pages.ts';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {readAgentStyleNextSources} from '../src/adapters/rhwp/agent-style-next.ts';
import {nextParagraphStyle} from '../src/adapters/rhwp/style-flow.ts';
import {readAgentStyleRenameSources} from '../src/adapters/rhwp/agent-style-rename.ts';
import {readAgentStyleCreationSources} from '../src/adapters/rhwp/agent-style-create.ts';
import {readAgentParagraphOutlineSources} from '../src/adapters/rhwp/agent-paragraph-outline.ts';
import {readAgentParagraphLists} from '../src/adapters/rhwp/agent-paragraph-list.ts';
import {readAgentParagraphDecorationSources} from '../src/adapters/rhwp/agent-paragraph-decoration.ts';
import {readAgentParagraphTabSources} from '../src/adapters/rhwp/agent-paragraph-tabs.ts';
import {readStructure} from '../src/adapters/rhwp/structure.ts';
import {executeDocumentOperations} from '../src/adapters/rhwp/execute.ts';
import {validateEditOperations} from '../src/modules/document/public/index.ts';
import {capturePreservationEvidence,verifyPreservedExport} from '../src/adapters/rhwp/preservation.ts';
import {preflightDocumentEdit} from '../src/adapters/rhwp/edit-preflight.ts';
const repo=resolve(dirname(fileURLToPath(import.meta.url)),'../../..'),pkg=resolve(repo,process.env.JUEONY_ENGINE_PACKAGE),out=resolve(repo,process.env.JUEONY_TEST_OUTPUT??'docs/evidence/table-multi-header-2026-10-14/table-multi-header-native');await mkdir(out,{recursive:true});
const {default:init,HwpDocument}=await import(pathToFileURL(resolve(pkg,'rhwp.js')).href);await init({module_or_path:await readFile(resolve(pkg,'rhwp_bg.wasm'))});
const results=[],failures=[],json=v=>typeof v==='string'?JSON.parse(v):v;
async function scenario(name,run){try{await run();results.push(name);console.log('PASS',name);}catch(error){failures.push({name,error:String(error),stack:error.stack});console.error('FAIL',name,error);}}
function body(format='hwpx'){const d=HwpDocument.createEmpty();d.createBlankDocument();for(const [i,text] of ['제목 😀','첫 본문','둘째 본문'].entries()){if(i)d.splitParagraph(0,i-1,d.getParagraphLength(0,i-1));d.insertText(0,i,0,text);}const loaded=new HwpDocument(d[format==='hwp'?'exportHwp':'exportHwpx']());d.free();return loaded;}
const rawSnap=(d,f='hwpx')=>({revision:'fixture',name:'sections.'+f,limitations:[],structure:readStructure(d),nodes:Array.from({length:d.getSectionCount()},(_,s)=>Array.from({length:d.getParagraphCount(s)},(_,p)=>({id:`s${s}p${p}`,section:s,paragraph:p,text:d.getTextRange(s,p,0,d.getParagraphLength(s,p)),editable:!json(d.getControls()).some(c=>c.list===0&&c.para===Array.from({length:s},(_,i)=>d.getParagraphCount(i)).reduce((a,b)=>a+b,0)+p&&!['secd','cold'].includes(c.ctrlId))}))).flat()});
const snap=(d,f='hwpx')=>{const s=rawSnap(d,f);const lists=readAgentParagraphLists(d,s.nodes);return {...s,tableHeaderSources:readAgentTableHeaderSources(d,s.structure.tables),tablePaginationSources:readAgentTablePaginationSources(d,s.structure.tables),...lists,...readAgentStyleCreationSources(d),...readAgentStyleRenameSources(d),...readAgentStyleNextSources(d),...readAgentParagraphOutlineSources(d,s.nodes,lists.listCatalog),paragraphTabSources:readAgentParagraphTabSources(d,s.nodes),paragraphDecorationSources:readAgentParagraphDecorationSources(d,s.nodes)};};
const wrapper=(d,f)=>({fileName:'sections.'+f,borrowDocumentHandle:()=>d,getWasmModuleExports:()=>({HwpDocument})});
function edit(d,f,operations){const s=snap(d,f),ops=validateEditOperations(operations,s);preflightDocumentEdit(wrapper(d,f),copy=>executeDocumentOperations(copy,s,ops));return executeDocumentOperations(d,s,ops);}
const line=(restart='page')=>({kind:'set_line_numbers',section:0,enabled:true,restart,countBy:2,startNumber:10,distanceMm:4});
async function saved(d,f,name){const bytes=d[f==='hwp'?'exportHwp':'exportHwpx']();await writeFile(resolve(out,name+'.'+f),bytes);return new HwpDocument(bytes);}





const op=(target,headerRows=1,repeatHeader=true,paginationMode='row')=>({kind:'set_table_header',target,headerRows,repeatHeader,paginationMode});
function tableDoc(f='hwpx',second=false){const d=HwpDocument.createEmpty();d.createBlankDocument();d.insertText(0,0,0,'표 앞 본문 😀');d.splitParagraph(0,0,d.getParagraphLength(0,0));const t=json(d.createTable(0,1,0,3,2));assert.equal(t.ok,true);for(let c=0;c<6;c++)d.insertTextInCell(0,t.paraIdx,t.controlIdx,c,0,0,'업무 '+c);d.applyCharFormatInCell(0,t.paraIdx,t.controlIdx,2,0,0,4,JSON.stringify({bold:true,fontSize:1200}));d.setCellProperties(0,t.paraIdx,t.controlIdx,3,JSON.stringify({fillType:'solid',fillColor:'#ffeeaa'}));if(second){d.splitParagraph(0,1,d.getParagraphLength(0,1));const other=json(d.createTable(0,2,0,2,2));assert.equal(other.ok,true);}const x=new HwpDocument(d[f==='hwp'?'exportHwp':'exportHwpx']());d.free();return x;}

const expectedAfter=(before,t,operation)=>{const expected=structuredClone(before.values);const flat=t.paragraph+Array.from({length:t.section},(_,i)=>Number(expected[`section/${i}/paragraph-count`])).reduce((a,b)=>a+b,0);const o=expected.objects.find(v=>v.object.kind==='table'&&v.object.para===flat&&v.object.controlIndex===t.control);Object.assign(o.properties,{pageBreak:['none','cell','row'].indexOf(operation.paginationMode),repeatHeader:operation.repeatHeader});for(const cell of expected.cells.filter(v=>v.list.hostListId===0&&v.list.sectionIndex===t.section&&v.list.hostPara===t.paragraph&&v.list.controlIndex===t.control)){const c=t.cells.find(v=>v.index===cell.list.cellIndex);cell.properties.isHeader=c.row<operation.headerRows;}return expected;};
for(const f of ['hwp','hwpx'])await scenario(`${f}: two leading rows repeat, shrink, extend, title-only/all and clear with exact preservation and snapshot undo/reopen`,async()=>{
 const d=tableDoc(f,true);try{const id=snap(d,f).structure.tables[0].id;
  for(const operation of [op(id,2),op(id,1),op(id,2,false,'cell'),op(id,3,false,'none'),op(id,0,false,'row')]){
   const s=snap(d,f),t=s.structure.tables[0],before=capturePreservationEvidence(d),bytes=d[f==='hwp'?'exportHwp':'exportHwpx'](),token=d.saveSnapshot();
   edit(d,f,[operation]);assert.deepEqual(capturePreservationEvidence(d).values,expectedAfter(before,t,operation));assert.equal(snap(d,f).structure.tables[0].headerRows,operation.headerRows);assert.equal(snap(d,f).tableHeaderSources[id].editable,true);
   const after=d[f==='hwp'?'exportHwp':'exportHwpx'](),x=await saved(d,f,`multi-${operation.headerRows}-${operation.repeatHeader?'repeat':operation.paginationMode}`);assert.equal(snap(x,f).structure.tables[0].headerRows,operation.headerRows);assert.deepEqual(snap(x,f).structure.tables[0].pagination,{mode:operation.paginationMode,repeatHeader:operation.repeatHeader});x.free();
   d.restoreSnapshot(token);d.discardSnapshot(token);assert.deepEqual(d[f==='hwp'?'exportHwp':'exportHwpx'](),bytes);edit(d,f,[operation]);assert.deepEqual(d[f==='hwp'?'exportHwp':'exportHwpx'](),after);
  }
 }finally{d.free();}
});
for(const f of ['hwp','hwpx'])await scenario(`${f}: pre-existing complete two-row block stays editable and can change without reducing other attributes`,async()=>{
 const d=tableDoc(f);try{const t=snap(d,f).structure.tables[0];for(const c of t.cells.filter(c=>c.row<2))d.setCellProperties(t.section,t.paragraph,t.control,c.index,'{"isHeader":true}');const x=new HwpDocument(d[f==='hwp'?'exportHwp':'exportHwpx']());try{const s=snap(x,f);assert.equal(s.structure.tables[0].headerRows,2);assert.equal(s.tableHeaderSources[t.id].editable,true);edit(x,f,[op(t.id,2)]);const z=await saved(x,f,'multi-existing');assert.equal(snap(z,f).structure.tables[0].headerRows,2);assert.equal(snap(z,f).structure.tables[0].pagination.repeatHeader,true);z.free();}finally{x.free();}}finally{d.free();}
});
await scenario('partial second row/gap/scattered/unknown title flags remain readonly, not silently normalized',()=>{
 for(const mode of ['partial','gap','unknown']){const d=tableDoc();try{const t=snap(d).structure.tables[0];for(const i of mode==='partial'?[0,1,2]:mode==='gap'?[0,1,4,5]:[])d.setCellProperties(0,1,t.control,i,'{"isHeader":true}');if(mode==='unknown'){const original=d.getCellProperties.bind(d);d.getCellProperties=(...args)=>{const p=json(original(...args));if(args[3]===0)delete p.isHeader;return JSON.stringify(p);};}const s=snap(d);assert.equal(s.structure.tables[0].headerRows,null);assert.equal(s.tableHeaderSources[t.id].editable,false);const bytes=d.exportHwpx();assert.throws(()=>edit(d,'hwpx',[op(t.id,2)]));assert.deepEqual(d.exportHwpx(),bytes);}finally{d.free();}}
});
await scenario('multi-row protected/mixed/merged sources and invalid whole-table repeat refuse before changes',()=>{
 for(const mode of ['protect','mixed','merge','all-repeat','overflow']){const d=tableDoc();try{const t=snap(d).structure.tables[0];if(mode==='protect')d.setCellProperties(0,1,t.control,2,'{"cellProtect":true}');if(mode==='mixed')d.applyCharFormatInCell(0,1,t.control,2,0,0,1,'{"italic":true}');if(mode==='merge')d.mergeTableCells(0,1,t.control,1,0,1,1);const bytes=d.exportHwpx();assert.throws(()=>edit(d,'hwpx',[op(t.id,mode==='all-repeat'?3:mode==='overflow'?4:2)]));assert.deepEqual(d.exportHwpx(),bytes);}finally{d.free();}}
});
await scenario('third title-cell failure and unexpected later flag restore the full request snapshot',()=>{
 for(const mode of ['third','extra']){const d=tableDoc();try{const s=snap(d),t=s.structure.tables[0],bytes=d.exportHwpx(),token=d.saveSnapshot(),set=d.setCellProperties.bind(d),tableSet=d.setTableProperties.bind(d);let count=0;d.setCellProperties=(...args)=>{const v=set(...args);if(mode==='third'&&++count===3)throw new Error('injected third header-cell failure');return v;};d.setTableProperties=(...args)=>{const v=tableSet(...args);if(mode==='extra')set(0,1,t.control,4,'{"isHeader":true}');return v;};assert.throws(()=>executeDocumentOperations(d,s,[op(t.id,2)]));d.restoreSnapshot(token);d.discardSnapshot(token);assert.deepEqual(d.exportHwpx(),bytes);}finally{d.free();}}
});
await scenario('newer header count or protected second row invalidates detached request capability',()=>{
 for(const mode of ['flags','protect']){const d=tableDoc();try{const s=snap(d),t=s.structure.tables[0];for(const i of mode==='flags'?[0,1,2,3]:[2])d.setCellProperties(0,1,t.control,i,mode==='flags'?'{"isHeader":true}':'{"cellProtect":true}');const bytes=d.exportHwpx();assert.throws(()=>executeDocumentOperations(d,s,[op(t.id,2)]));assert.deepEqual(d.exportHwpx(),bytes);}finally{d.free();}}
});
const svgText=svg=>[...svg.matchAll(/<text\b[^>]*>(.*?)<\/text>/gs)].map(v=>v[1].replace(/<[^>]*>/g,'')).join('');
function multipage(rows=30){const d=HwpDocument.createEmpty();d.createBlankDocument();const made=json(d.createTable(0,0,0,rows,2));for(let c=0;c<rows*2;c++)d.insertTextInCell(0,0,made.controlIdx,c,0,0,c<6?`HEAD-${c}-Z`:`BODY-${String(c).padStart(2,'0')}-Z work\nsecond line\nthird line`);return d;}
for(const f of ['hwp','hwpx'])for(const count of [2,3])await scenario(`${f}: ${count} leading rows render every title exactly once on every page, body labels once overall, repeat off and reopen retain data`,async()=>{
 const original=multipage(),d=new HwpDocument(original[f==='hwp'?'exportHwp':'exportHwpx']());original.free();try{const t=snap(d,f).structure.tables[0],textBefore=d.getTextFileUnicode();edit(d,f,[op(t.id,count)]);assert.ok(d.pageCount()>=2);assert.ok(d.pageCount()<10);
  let all='';for(let p=0;p<d.pageCount();p++){const svg=d.renderPageSvg(p),text=svgText(svg);for(let c=0;c<count*2;c++)assert.equal(text.split(`HEAD-${c}-Z`).length-1,1,`page ${p+1} title ${c}`);all+=text;await writeFile(resolve(out,`multi-${count}-${f}-page-${p+1}.svg`),svg);}
  for(let c=count*2;c<6;c++)assert.equal(all.split(`HEAD-${c}-Z`).length-1,1);for(let c=6;c<60;c++)assert.equal(all.split(`BODY-${String(c).padStart(2,'0')}-Z`).length-1,1);assert.equal(all.split('secondline').length-1,54);assert.equal(all.split('thirdline').length-1,54);assert.equal(d.getTextFileUnicode(),textBefore);
  let x=await saved(d,f,`multi-${count}-multipage-repeat`);assert.equal(snap(x,f).structure.tables[0].headerRows,count);for(let p=0;p<x.pageCount();p++)for(let c=0;c<count*2;c++)assert.equal(svgText(x.renderPageSvg(p)).split(`HEAD-${c}-Z`).length-1,1);x.free();
  edit(d,f,[op(t.id,count,false,'row')]);for(let p=0;p<d.pageCount();p++)for(let c=0;c<count*2;c++)assert.equal(svgText(d.renderPageSvg(p)).includes(`HEAD-${c}-Z`),p===0);x=await saved(d,f,`multi-${count}-multipage-off`);assert.equal(snap(x,f).structure.tables[0].headerRows,count);x.free();
 }finally{d.free();}
});
await scenario('multi-row later-section table uses flattened identity without changing earlier content',async()=>{const d=tableDoc();try{assert.equal(json(d.insertSectionBreak(0,0,0)).ok,true);const x=new HwpDocument(d.exportHwpx());try{const t=snap(x).structure.tables[0];assert.equal(t.section,1);const before=capturePreservationEvidence(x);edit(x,'hwpx',[op(t.id,2)]);assert.deepEqual(capturePreservationEvidence(x).values,expectedAfter(before,t,op(t.id,2)));const z=await saved(x,'hwpx','multi-later-section');assert.equal(snap(z).structure.tables[0].headerRows,2);z.free();}finally{x.free();}}finally{d.free();}});
for(const f of ['hwp','hwpx'])await scenario(`${f}: oversized 60-row repeated title block refuses on actual fragment layout, preflight preserves original`,async()=>{
 const original=multipage(80),d=new HwpDocument(original[f==='hwp'?'exportHwp':'exportHwpx']());original.free();try{const s=snap(d,f),id=s.structure.tables[0].id,bytes=d[f==='hwp'?'exportHwp':'exportHwpx']();assert.equal(s.tableHeaderSources[id].editable,true);assert.throws(()=>edit(d,f,[op(id,60)]),/각 표 조각|실제/);assert.deepEqual(d[f==='hwp'?'exportHwp':'exportHwpx'](),bytes);const x=await saved(d,f,'multi-tall-source');assert.equal(snap(x,f).structure.tables[0].headerRows,0);x.free();}finally{d.free();}
});
await scenario('missing/unreadable/incomplete actual fragment evidence refuses and snapshot restores flags',()=>{
 for(const mode of ['missing','throw','no-fragment','no-title','no-body','hidden-body','overflow']){const d=tableDoc();try{const s=snap(d),t=s.structure.tables[0],bytes=d.exportHwpx(),token=d.saveSnapshot();const original=d.getPageControlLayout.bind(d);if(mode==='missing')d.getPageControlLayout=undefined;else d.getPageControlLayout=(...args)=>{if(mode==='throw')throw new Error('injected layout read failure');const data=json(original(...args));if(mode==='no-fragment')data.controls=[];for(const c of data.controls.filter(c=>c.type==='table')){if(mode==='no-title')c.cells=c.cells.filter(v=>v.row>0);if(mode==='no-body')c.cells=c.cells.filter(v=>v.row<2);if(mode==='overflow')c.cells[0].h=10000;if(mode==='hidden-body')for(const cell of c.cells.filter(v=>v.row>=2))cell.y=10000;}return JSON.stringify(data);};assert.throws(()=>executeDocumentOperations(d,s,[op(t.id,2)]));d.restoreSnapshot(token);d.discardSnapshot(token);assert.deepEqual(d.exportHwpx(),bytes);}finally{d.free();}}
});
await writeFile(resolve(out,'result.json'),JSON.stringify({results,failures,engine:JSON.parse(await readFile(resolve(pkg,'jueony-engine-build.json'),'utf8')),note:'Complete contiguous leading title rows only. Exact flag/policy preservation, two/three-row continuation labels/body contents, oversized title-block actual-fragment refusal, HWP/HWPX save/reopen and rollback. Existing engine unchanged. Native Hancom and paid models NOT_RUN; no full layout parity claim.'},null,2));if(failures.length)process.exitCode=1;
