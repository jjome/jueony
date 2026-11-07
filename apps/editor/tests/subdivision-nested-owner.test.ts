import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {readStructure} from '../src/adapters/rhwp/structure.ts';
import {readTableSubdivisionSources} from '../src/adapters/rhwp/table-subdivision.ts';
import {nestedSubdivisionEvidence,subdivisionNestedOwner} from '../src/adapters/rhwp/subdivision-nested-owner.ts';
import {executeDocumentOperations} from '../src/adapters/rhwp/execute.ts';
import {validateEditOperations,type Snapshot} from '../src/modules/document/public/index.ts';
import {subdivisionNestedTable} from '../scripts/lib/subdivision-nested-table.mjs';
const pkg=process.env.JUEONY_ENGINE_PACKAGE ?? fileURLToPath(new URL('../node_modules/@rhwp/core/',import.meta.url));
const {default:init,HwpDocument}=await import(pathToFileURL(resolve(pkg,'rhwp.js')).href);
await init({module_or_path:await readFile(resolve(pkg,'rhwp_bg.wasm'))});
const op={kind:'split_table_cell_into',target:'s0p1t0',row:0,column:0,rows:1,columns:3} as const;
const bytes=(d:any,ext:string):Uint8Array=>ext==='hwp'?d.exportHwp():d.exportHwpx();
const snapshot=(d:any,ext:string):Snapshot=>{
  const structure=readStructure(d),name='중첩 양식.'+ext;
  return {name,structure,nodes:[],limitations:[],revision:'test',tableSubdivisionSources:readTableSubdivisionSources(d,structure.tables,name)};
};
const nestedInk=(d:any)=>({
  boxes:JSON.parse(d.getPageControlLayout(0)).controls.filter((c:any)=>c.type==='table'&&c.stableIndex?.length>3),
  runs:JSON.parse(d.getPageTextLayout(0)).runs.filter((r:any)=>r.cellPath?.length===2),
});
for(const ext of ['hwp','hwpx'])test(ext+' retains the nested table in the original first piece and reopens every inner cell and line',()=>{
  const src=subdivisionNestedTable(HwpDocument),d=new HwpDocument(bytes(src,ext));src.free();
  try{
    const s=snapshot(d,ext),old=bytes(d,ext),ink=nestedInk(d),undo=d.saveSnapshot();
    try{
      assert.deepEqual(s.tableSubdivisionSources![op.target].cells!.map(c=>[c.row,c.column]),[[0,0]]);
      assert.throws(()=>validateEditOperations([{...op,distributeParagraphs:true}],s),/중첩/);
      executeDocumentOperations(d,s,validateEditOperations([op],s));
      const copy=new HwpDocument(bytes(d,ext));
      try{for(const result of [d,copy]){
        const st=readStructure(result);
        assert.equal(st.tables[0].cells.length,s.structure!.tables[0].cells.length+2);
        assert.equal(st.nestedTables?.length,1);
        assert.deepEqual(st.nestedTables![0].ancestors,s.structure!.nestedTables![0].ancestors);
        assert.deepEqual(st.nestedTables![0].cells.map(c=>c.text),['X','Y']);
        assert.deepEqual(nestedInk(result),ink);
      }}finally{copy.free();}
      d.restoreSnapshot(undo);assert.deepEqual(bytes(d,ext),old);assert.deepEqual(nestedInk(d),ink);
    }finally{d.discardSnapshot(undo);}
  }finally{d.free();}
});
for(const fault of ['too wide','displaced'])test('a '+fault+' nested table leaves the original bytes and path intact',()=>{
  const src=subdivisionNestedTable(HwpDocument,fault==='too wide'?9000:5200),d=new HwpDocument(src.exportHwpx());src.free();
  try{
    const s=snapshot(d,'hwpx'),old=d.exportHwpx(),ink=nestedInk(d),count=s.structure!.tables[0].cells.length;
    let changed=false;
    if(fault==='displaced'){
      const read=d.getTableCellBboxesByPath.bind(d);
      d.getTableCellBboxesByPath=(...args:any[])=>{
        const boxes=JSON.parse(read(...args));
        if(JSON.parse(d.getTableDimensions(0,1,0)).cellCount>count){boxes[0].y+=1;changed=true;}
        return JSON.stringify(boxes);
      };
    }
    assert.equal(s.tableSubdivisionSources![op.target].editable,true);
    assert.throws(()=>executeDocumentOperations(d,s,[op]));
    if(fault==='displaced')assert.equal(changed,true);
    assert.deepEqual(d.exportHwpx(),old);assert.deepEqual(nestedInk(d),ink);
  }finally{d.free();}
});
test('an inner cell painted over its neighbor rejects even when both layout APIs report the same box',()=>{
  const d=subdivisionNestedTable(HwpDocument);
  try{
    const table=readStructure(d).tables[0],owner=subdivisionNestedOwner(d,table)!;
    const readPage=d.getPageControlLayout.bind(d),readPath=d.getTableCellBboxesByPath.bind(d);
    d.getPageControlLayout=(page:number)=>{
      const layout=JSON.parse(readPage(page));
      layout.controls.find((c:any)=>c.stableIndex?.length>3).cells[0].w+=2;
      return JSON.stringify(layout);
    };
    d.getTableCellBboxesByPath=(...args:any[])=>{
      const boxes=JSON.parse(readPath(...args));boxes[0].w+=2;return JSON.stringify(boxes);
    };
    assert.throws(()=>nestedSubdivisionEvidence(d,table,owner),/중첩 표/);
  }finally{d.free();}
});
