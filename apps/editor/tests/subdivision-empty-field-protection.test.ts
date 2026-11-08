import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {readStructure} from '../src/adapters/rhwp/structure.ts';
import {readTableSubdivisionSources} from '../src/adapters/rhwp/table-subdivision.ts';
import {executeDocumentOperations} from '../src/adapters/rhwp/execute.ts';
import type {Snapshot} from '../src/modules/document/public/index.ts';

const pkg=process.env.JUEONY_ENGINE_PACKAGE ?? fileURLToPath(new URL('../node_modules/@rhwp/core/',import.meta.url));
const {default:init,HwpDocument}=await import(pathToFileURL(resolve(pkg,'rhwp.js')).href);
await init({module_or_path:await readFile(resolve(pkg,'rhwp_bg.wasm'))});
const at=[0,1,0] as const,target='s0p1t0';
const operation={kind:'split_table_cell_into',target,row:0,column:0,rows:1,columns:3} as const;
const bytes=(d:any,format:string):Uint8Array=>format==='hwp'?d.exportHwp():d.exportHwpx();

function emptyNeighborField(){
  const d=HwpDocument.createEmpty();
  d.createBlankDocument();d.insertText(0,0,0,'앞');d.splitParagraph(0,0,1);d.createTable(...at,2,2);
  for(let i=0;i<4;i++){
    d.setCellProperties(...at,i,'{"width":9000,"height":5000}');
    d.insertTextInCell(...at,i,0,0,'칸'+i);
  }
  d.mergeTableCells(...at,0,0,0,1);
  d.insertClickHereFieldInCell(...at,1,0,0,false,'','','빈필드',true);
  return d;
}

function snapshot(d:any,format:string):Snapshot{
  const structure=readStructure(d),name='빈 이웃 누름틀.'+format;
  return {name,structure,nodes:[],limitations:[],revision:'empty-field',
    tableSubdivisionSources:readTableSubdivisionSources(d,structure.tables,name)};
}

for(const format of ['hwp','hwpx'])test(format+' rejects and preserves an invisible zero-length neighbor field through save and reopen',()=>{
  const source=emptyNeighborField(),original=bytes(source,format),d=new HwpDocument(original);source.free();
  try{
    const fields=JSON.parse(d.getFieldList()),field=fields.find((v:any)=>v.name==='빈필드');
    assert.ok(field);assert.equal(field.guide,'');assert.equal(field.value,'');
    assert.equal(field.startCharIdx,field.endCharIdx);
    const before=bytes(d,format),s=snapshot(d,format);
    assert.equal(s.tableSubdivisionSources?.[target]?.editable,false);
    assert.throws(()=>executeDocumentOperations(d,s,[operation]));
    assert.deepEqual(bytes(d,format),before);
    assert.throws(()=>d.splitCellOnGrid(...at,0,0,1,3,false),
      'native split must reject before moving the empty field owner');
    assert.deepEqual(bytes(d,format),before);
    const reopened=new HwpDocument(bytes(d,format));
    try{
      assert.deepEqual(JSON.parse(reopened.getFieldList()),fields);
      assert.equal(snapshot(reopened,format).tableSubdivisionSources?.[target]?.editable,false);
      assert.deepEqual(bytes(reopened,format),before);
    }finally{reopened.free();}
  }finally{d.free();}
});
