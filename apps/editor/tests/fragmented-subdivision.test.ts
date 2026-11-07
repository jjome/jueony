import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {readStructure} from '../src/adapters/rhwp/structure.ts';
import {readTableSubdivisionSources} from '../src/adapters/rhwp/table-subdivision.ts';
import {recordPublishedCanvasMetrics,subdivisionCopyMetrics} from '../src/adapters/rhwp/subdivision-canvas-metrics.ts';
import {executeDocumentOperations} from '../src/adapters/rhwp/execute.ts';
import {validateEditOperations,type Snapshot} from '../src/modules/document/public/index.ts';
import {fragmentedSubdivisionTable,fragmentedParagraphBands} from '../scripts/lib/fragmented-subdivision.mjs';

const pkg = process.env.JUEONY_ENGINE_PACKAGE ?? fileURLToPath(new URL('../node_modules/@rhwp/core/',import.meta.url));
const {default:init,HwpDocument} = await import(pathToFileURL(resolve(pkg,'rhwp.js')).href);
await init({module_or_path:await readFile(resolve(pkg,'rhwp_bg.wasm'))});
const at=[0,1,0] as const, target='s0p1t0';
const command={kind:'split_table_cell_into',target,row:0,column:0,rows:1,columns:3} as const;
const save=(d:any,ext:string):Uint8Array=>ext==='hwp'?d.exportHwp():d.exportHwpx();
function snapshot(d:any,ext:string):Snapshot {
  const name='이어진 셀.'+ext, structure=readStructure(d);
  return {structure,name,nodes:[],revision:'fixture',limitations:[],tableSubdivisionSources:readTableSubdivisionSources(d,structure.tables,name)};
}
function boxes(d:any) {
  return Array.from({length:d.pageCount()},(_,p)=>JSON.parse(d.getPageControlLayout(p)).controls.find((f:any)=>f.type==='table'));
}

for (const ext of ['hwp','hwpx']) for (const merged of [false,true]) {
  test(ext+' splits a '+(merged?'merged multi-paragraph':'plain hard-line-break')+' cell spanning three pages',()=>{
    const src=fragmentedSubdivisionTable(HwpDocument,{merged,hardBreaks:!merged}), d=new HwpDocument(save(src,ext));src.free();
    try {
      const s=snapshot(d,ext), source=boxes(d), old=save(d,ext), undo=d.saveSnapshot(), text=s.structure!.tables[0].cells[0].text;
      assert.equal(source.length,3);
      assert.ok(s.tableSubdivisionSources![target].frames!.every(f=>f.cells.some(c=>c.index===0&&c.lineSignature)));
      executeDocumentOperations(d,s,validateEditOperations([command],s));
      const after=boxes(d);
      assert.equal(after.length,3);
      for (const [page,f] of source.entries()) {
        const parent=f.cells.find((c:any)=>c.row===0&&c.col===0);
        const divided=after[page].cells.filter((c:any)=>c.row===0&&c.x>=parent.x-0.2&&c.x<parent.x+parent.w-0.2);
        assert.equal(divided.length,3);
        for(const [index,c] of divided.entries()) {
          assert.equal(c.y,parent.y);assert.equal(c.h,parent.h);
          assert.ok(Math.abs(c.x-parent.x-index*parent.w/3)<=0.2);
          assert.ok(Math.abs(c.w-parent.w/3)<=0.2);
        }
      }
      const result=save(d,ext), redo=d.saveSnapshot(), reopened=new HwpDocument(result);
      try {
        assert.deepEqual(boxes(reopened),after);
        assert.equal(readStructure(reopened).tables[0].cells[0].text,text);
        if(merged) assert.equal(JSON.parse(reopened.getCellCharPropertiesAt(...at,0,19,0)).bold,true);
        d.restoreSnapshot(undo);assert.deepEqual(save(d,ext),old);
        d.restoreSnapshot(redo);assert.deepEqual(save(d,ext),result);
      } finally {reopened.free();d.discardSnapshot(redo);d.discardSnapshot(undo);}
    } finally {d.free();}
  });
}

for (const ext of ['hwp','hwpx']) test(ext+' restores the original bytes when a narrowed cell changes page breaks',()=>{
  const src=fragmentedSubdivisionTable(HwpDocument,{wrapped:true}),d=new HwpDocument(save(src,ext));src.free();
  try {
    const s=snapshot(d,ext),before=save(d,ext);
    assert.ok(s.tableSubdivisionSources![target].frames!.length>1);
    assert.throws(()=>executeDocumentOperations(d,s,validateEditOperations([command],s)),/외형|쪽이 달라/);
    assert.deepEqual(save(d,ext),before);
  } finally {d.free();}
});
for (const ext of ['hwp','hwpx']) test(ext+' distributes two long paragraphs to equal vertical bands across pages',()=>{
  const src=fragmentedParagraphBands(HwpDocument),d=new HwpDocument(save(src,ext));src.free();
  try {
    const s=snapshot(d,ext), source=boxes(d);
    const bands={...command,rows:2,columns:1,distributeParagraphs:true};
    executeDocumentOperations(d,s,validateEditOperations([bands],s));
    const copy=new HwpDocument(save(d,ext));
    try {
      const originalHeight=source.reduce((n,f)=>n+(f.cells.find((c:any)=>c.row===0)?.h??0),0);
      const after=boxes(copy);
      assert.equal(after.length,source.length);
      for(const row of [0,1]) {
        const fragments=after.flatMap(f=>f.cells.filter((c:any)=>c.row===row&&c.col===0));
        assert.ok(Math.abs(fragments.reduce((n,c)=>n+c.h,0)-originalHeight/2)<0.2);
        assert.equal(readStructure(copy).tables[0].cells.find(c=>c.row===row&&c.column===0)?.text,'word '.repeat(110)+row);
      }
    } finally {copy.free();}
  } finally {d.free();}
});
for (const fault of ['original index','native offset','neighbor line','retained line']) test('fragment proof rejects a changed '+fault,()=>{
  const doc=fragmentedSubdivisionTable(HwpDocument);
  const d=new HwpDocument(doc.exportHwpx());doc.free();
  try {
    const s=snapshot(d,'hwpx'), original=d.exportHwpx(), read=d.getPageTextLayout.bind(d);
    d.getPageTextLayout=(page:number)=>{
      const result=JSON.parse(read(page));
      const post=JSON.parse(d.getTableDimensions(...at)).cellCount!==s.structure!.tables[0].cells.length;
      if (fault.endsWith('line') && post && page===0) {
        const line=result.runs.find((r:any)=>r.controlIdx===0&&r.parentParaIdx===1&&r.text===(fault==='neighbor line'?'C2':'C0'));
        assert.ok(line);line.x+=1;
      } else if(page===1 && !fault.endsWith('line')) {
        const line=result.runs.find((r:any)=>r.controlIdx===0&&r.parentParaIdx===1&&r.cellIdx===0&&r.text);
        assert.ok(line);
        if(fault==='original index')line.cellIdx=1;else line.charStart++;
      }
      return JSON.stringify(result);
    };
    assert.throws(()=>executeDocumentOperations(d,s,[command]));
    assert.deepEqual(d.exportHwpx(),original);
    if(!fault.endsWith('line'))assert.equal(snapshot(d,'hwpx').tableSubdivisionSources![target].editable,false);
  } finally {d.free();}
});

test('a copy uses the published Canvas batch only for the matching live document and fonts',()=>{
  const source=fragmentedSubdivisionTable(HwpDocument),bytes=source.exportHwpx();source.free();
  const live=new HwpDocument(bytes),copy=new HwpDocument(bytes),different=new HwpDocument(bytes);
  const wasm={borrowDocumentHandle:()=>live,documentGeneration:5,canvasMetricFontGeneration:8};
  const generation={document:5,fonts:8};
  try {
    const batch=JSON.parse(live.collectCanvasMetricRequests(5,8));
    assert.ok(batch.requests.length);
    const replies=JSON.stringify(batch.requests.map((r:any)=>({...r,resolvedFont:r.font,measuredAdvancePx:18.3})));
    live.registerCanvasMetricReplies(5,8,batch.revision,replies);live.selectCanvasMetrics(true);
    const s=snapshot(live,'hwpx');
    assert.throws(()=>subdivisionCopyMetrics(wasm,s,[command]),/글꼴/);
    recordPublishedCanvasMetrics(live,generation,replies);
    const prepare=subdivisionCopyMetrics(wasm,s,[command])!;
    assert.throws(()=>prepare(live),/사본/);
    prepare(copy);
    assert.deepEqual(boxes(copy),boxes(live));assert.equal(copy.getPageTextLayout(0),live.getPageTextLayout(0));
    different.insertText(0,0,0,'🐸');
    assert.throws(()=>prepare(different));
    assert.equal(different.canvasMetricsActive(),false);
    wasm.canvasMetricFontGeneration++;assert.throws(()=>prepare(different),/글꼴/);wasm.canvasMetricFontGeneration--;
    wasm.documentGeneration++;assert.throws(()=>prepare(different),/글꼴/);wasm.documentGeneration--;
    wasm.borrowDocumentHandle=()=>different;assert.throws(()=>prepare(different),/글꼴/);wasm.borrowDocumentHandle=()=>live;
    recordPublishedCanvasMetrics(live,generation,'[]');assert.throws(()=>prepare(different),/글꼴/);
  } finally {different.free();copy.free();live.free();}
});
