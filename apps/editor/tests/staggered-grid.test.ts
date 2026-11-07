import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {readStructure} from '../src/adapters/rhwp/structure.ts';
import {readTableSubdivisionSources} from '../src/adapters/rhwp/table-subdivision.ts';
import {executeDocumentOperations} from '../src/adapters/rhwp/execute.ts';
import {validateEditOperations,type Snapshot,type EditOp} from '../src/modules/document/public/index.ts';
import {witnessedTrackEdges} from '../src/modules/document/public/engine-integration.ts';
import {continuedMergedTable,fragmentedMergedCell} from '../scripts/lib/continued-merged-table.mjs';

const pkg = process.env.JUEONY_ENGINE_PACKAGE ?? fileURLToPath(new URL('../node_modules/@rhwp/core/',import.meta.url));
const {default:init,HwpDocument} = await import(pathToFileURL(resolve(pkg,'rhwp.js')).href);
await init({module_or_path:await readFile(resolve(pkg,'rhwp_bg.wasm'))});
const target='s0p1t0', at=[0,1,0] as const;
const serialize=(doc:any, format:string):Uint8Array=>format==='hwp'?doc.exportHwp():doc.exportHwpx();
function staggered(format:string, vertical:boolean) {
  const doc=HwpDocument.createEmpty();
  try {
    doc.createBlankDocument();
    doc.insertText(0,0,0,'표 앞'); doc.splitParagraph(0,0,3); doc.createTable(...at,3,3);
    for (let i=0; i<9; i++) {
      const width=[5000,7000,9000][i%3],height=[6000,9000,12000][Math.floor(i/3)];
      doc.setCellProperties(...at,i,JSON.stringify({width,height}));
      doc.insertTextInCell(...at,i,0,0,'글'+i);
    }
    doc.applyCharFormatInCell(...at,vertical?3:1,0,0,2,'{"bold":true}');
    // No cell occupies the middle track alone. Each of its two boundaries is
    // fixed by a different row (or column).
    if (vertical) {
      doc.mergeTableCells(...at,0,0,1,0); doc.mergeTableCells(...at,1,1,2,1); doc.mergeTableCells(...at,0,2,1,2);
    } else {
      doc.mergeTableCells(...at,0,0,0,1); doc.mergeTableCells(...at,1,1,1,2); doc.mergeTableCells(...at,2,0,2,1);
    }
    return new HwpDocument(serialize(doc,format));
  } finally { doc.free(); }
}
function snapshot(doc:any, format:string):Snapshot {
  const structure=readStructure(doc), name='엇갈린 격자.'+format;
  return {structure,name,nodes:[],limitations:[],revision:'fixture',tableSubdivisionSources:readTableSubdivisionSources(doc,structure.tables,name)};
}
for (const format of ['hwpx','hwp']) test(format+' splits an intact continuation-page owner and rejects an inconsistent neighbor height',()=>{
  const source=continuedMergedTable(HwpDocument);
  if(format==='hwpx') source.setTableProperties(...at,'{"pageBreak":2}');
  const doc=new HwpDocument(serialize(source,format));source.free();
  try {
    const s=snapshot(doc,format);
    assert.ok(s.tableSubdivisionSources![target].frames!.length>1);
    const op:EditOp={kind:'split_table_cell_into',target,row:17,column:0,rows:1,columns:3,distributeParagraphs:true};
    roundtrip(doc,format,()=>{
      executeDocumentOperations(doc,s,validateEditOperations([op],s));
      const after=readStructure(doc).tables[0];
      assert.deepEqual(after.cells.filter(c=>c.row===17).map(c=>c.text),['cell 34','cell 35','']);
      assert.equal(after.cells[0].text,'cell 0');
      assert.equal(doc.pageCount(),3);
    });
  } finally { doc.free(); }
  const fragmented=fragmentedMergedCell(HwpDocument), split=new HwpDocument(serialize(fragmented,format));fragmented.free();
  try {
    const s=snapshot(split,format), before=serialize(split,format);
    const op:EditOp={kind:'split_table_cell_into',target,row:0,column:0,rows:1,columns:2};
    assert.equal(s.tableSubdivisionSources![target].editable,false);
    assert.throws(()=>executeDocumentOperations(split,s,[op]));
    assert.deepEqual(serialize(split,format),before);
  }
  finally {split.free();}
});
function roundtrip(doc:any, format:string, edit:()=>void) {
  const before=serialize(doc,format), undo=doc.saveSnapshot();
  try {
    edit();
    const after=serialize(doc,format), redo=doc.saveSnapshot(), copy=new HwpDocument(after);
    try {
      assert.deepEqual(readStructure(copy),readStructure(doc));
      doc.restoreSnapshot(undo); assert.deepEqual(serialize(doc,format),before);
      doc.restoreSnapshot(redo); assert.deepEqual(serialize(doc,format),after);
    } finally {copy.free();doc.discardSnapshot(redo);}
  } finally {doc.discardSnapshot(undo);}
}

for (const format of ['hwpx','hwp']) for (const row of [false,true]) {
  test(format+' splits through new '+(row?'horizontal':'vertical')+' grid lines among multiple merged cells',()=>{
    const doc=staggered(format,row);
    try {
      const s=snapshot(doc,format), t=s.structure!.tables[0], command:EditOp={kind:'split_table_cell_into',target,row:0,column:0,
        rows:row?3:1,columns:row?1:3,distributeParagraphs:true};
      assert.equal(s.tableSubdivisionSources![target].exactGrid,true);
      const untouched=t.cells.find(c=>c.row===1&&c.column===1)!;
      roundtrip(doc,format,()=>{
        executeDocumentOperations(doc,s,validateEditOperations([command],s));
        const after=readStructure(doc).tables[0];
        const slots=after.cells.filter(c=>row?c.column===0 && c.row<4:c.row===0 && c.column<4);
        assert.deepEqual(slots.map(c=>c.text),['글0',row?'글3':'글1','']);
        assert.equal(JSON.parse(doc.getCellCharPropertiesAt(...at,slots[1].index,0,0)).bold,true);
        assert.deepEqual(slots.map(c=>c.properties[row?'height':'width']),row?[5000,5000,5000]:[4000,4000,4000]);
        assert.ok(after.cells.some(c=>c.text===untouched.text && c.properties.width===untouched.properties.width && c.properties.height===untouched.properties.height));
      });
    } finally {doc.free();}
  });
  for (const insert of [false,true]) test(format+' '+(insert?'inserts':'deletes')+' a '+(row?'row':'column')+' resolved from overlapping spans',()=>{
    const doc=staggered(format,row);
    try {
      const s=snapshot(doc,format);
      assert.deepEqual(witnessedTrackEdges(s.structure!.tables[0],row),row?[0,6000,15000,27000]:[0,5000,12000,21000]);
      const kind=(insert?'insert':'delete')+'_table_'+(row?'row':'column');
      const op={kind,target,index:1,...(insert?{values:['','','']}:{})} as EditOp;
      roundtrip(doc,format,()=>{
        executeDocumentOperations(doc,s,validateEditOperations([op],s));
        const after=readStructure(doc).tables[0], merged=after.cells[0], dimension=row?'height':'width';
        assert.equal(merged.text,row?'글0\n글3':'글0\n글1');
        assert.equal(merged.properties[dimension],row?(insert?24000:6000):(insert?19000:5000));
      });
    } finally {doc.free();}
  });
}

for (const format of ['hwp','hwpx']) for (const row of [false,true]) {
  test(format+' '+(row?'row':'column')+' edit keeps named cell and click-here field on the surviving owner',()=>{
    const source=staggered(format,row);
    source.insertClickHereFieldInCell(...at,0,0,0,false,'안내','원본 설명','입력',true);
    source.setFieldValueByName('입력','확정 값');
    source.setCellProperties(...at,1,'{"fieldName":"이름셀"}');
    const doc=new HwpDocument(serialize(source,format)); source.free();
    try {
      const s=snapshot(doc,format), first=s.structure!.tables[0].cells[0], named=s.structure!.tables[0].cells[1];
      assert.ok(first.axisFieldSignature);
      assert.ok(named.axisFieldSignature);
      const write:EditOp=row?{kind:'insert_table_row',target,index:0,values:['가','나','다']}:
        {kind:'insert_table_column',target,index:0,values:['가','나','다']};
      roundtrip(doc,format,()=>{
        executeDocumentOperations(doc,s,validateEditOperations([write],s));
        const t=readStructure(doc).tables[0];
        const fields=JSON.parse(doc.getFieldList());
        assert.equal(fields.length,2);
        assert.equal(fields.find((f:any)=>!f.cellField).name,'입력');
        assert.equal(fields.find((f:any)=>!f.cellField).value,'확정 값');
        assert.equal(fields.find((f:any)=>f.cellField).name,'이름셀');
        assert.equal(t.cells.find(c=>c.axisFieldSignature===first.axisFieldSignature)?.text,first.text);
        assert.equal(t.cells.find(c=>c.axisFieldSignature===named.axisFieldSignature)?.text,named.text);
      });
      const now=snapshot(doc,format), owner=now.structure!.tables[0].cells.find(c=>c.axisFieldSignature===first.axisFieldSignature)!;
      const remove:EditOp=row?{kind:'delete_table_column',target,index:owner.column}:{kind:'delete_table_row',target,index:owner.row};
      const before=serialize(doc,format);
      assert.throws(()=>validateEditOperations([remove],now),/필드/);
      assert.deepEqual(serialize(doc,format),before);
    } finally { doc.free(); }
  });
}

test('undetermined internal column has no fallback width for an Agent axis edit',()=>{
  const d=HwpDocument.createEmpty();
  try {
    d.createBlankDocument();d.insertText(0,0,0,'표');d.splitParagraph(0,0,1);d.createTable(...at,3,3);
    for(let r=0;r<3;r++) d.mergeTableCells(...at,r,0,r,1);
    const s=snapshot(d,'hwpx'), before=serialize(d,'hwpx');
    const op:EditOp={kind:'delete_table_column',target,index:1};
    assert.throws(()=>executeDocumentOperations(d,s,[op]),/확인하지 못했습니다/);
    assert.deepEqual(serialize(d,'hwpx'),before);
  } finally {d.free();}
});

for(const format of ['hwp','hwpx']) for(const row of [true,false]){
 test(format+' '+(row?'row':'column')+' refuses inserted cell sizes at a hidden grid boundary',()=>{
  const seed=HwpDocument.createEmpty();
  try{
   seed.createBlankDocument();seed.insertText(0,0,0,'표');seed.splitParagraph(0,0,1);seed.createTable(...at,3,3);
   // Each missing width/height would happen to match the native default
   // (1800/400), but only the sum of the two hidden tracks survives in the file.
   for(let i=0;i<9;i++)seed.setCellProperties(...at,i,'{"width":1800,"height":400}');
   for(let i=0;i<3;i++){
    if(row)seed.mergeTableCells(...at,i,0,i,1);
    else seed.mergeTableCells(...at,0,i,1,i);
   }
   const doc=new HwpDocument(serialize(seed,format));
   try{
    const s=snapshot(doc,format),before=serialize(doc,format);
    const op:EditOp={kind:row?'insert_table_row':'insert_table_column',target,index:3,values:['','','']};
    assert.throws(()=>executeDocumentOperations(doc,s,validateEditOperations([op],s)),/행 높이 또는 열 너비/);
    assert.deepEqual(readStructure(doc),s.structure);assert.deepEqual(serialize(doc,format),before);
   }finally{doc.free();}
  }finally{seed.free();}
 });
 test(format+' '+(row?'row':'column')+' verifies inserted cell sizes resolved from staggered neighbors',()=>{
  const doc=staggered(format,!row);
  try{
   const s=snapshot(doc,format),end=3;
   const op:EditOp={kind:row?'insert_table_row':'insert_table_column',target,index:end,values:['가','나','다']};
   const method=row?'insertTableRow':'insertTableColumn', insert=doc[method].bind(doc);
   doc[method]=(...args:any[])=>{
    const reply=insert(...args);
    const created=readStructure(doc).tables[0].cells.find(c=>(row?c.row:c.column)===end)!;
    doc.setCellProperties(...at,created.index,JSON.stringify(row?{width:1800}:{height:400}));
    return reply;
   };
   const original=serialize(doc,format);
   assert.throws(()=>executeDocumentOperations(doc,s,validateEditOperations([op],s)),/추가한 셀의 행 높이 또는 열 너비/);
   assert.deepEqual(serialize(doc,format),original);
   doc[method]=insert;
   roundtrip(doc,format,()=>{
    executeDocumentOperations(doc,s,validateEditOperations([op],s));
    const created=readStructure(doc).tables[0].cells.filter(c=>(row?c.row:c.column)===end);
    assert.deepEqual(created.map(c=>[c.properties.width,c.properties.height]),row?
     [[5000,12000],[7000,12000],[9000,12000]]:[[9000,6000],[9000,9000],[9000,12000]]);
   });
  }finally{doc.free();}
 });
}

for(const format of ['hwp','hwpx'])test(format+' retains the cross-axis size when deleting its last width witness',()=>{
 const seed=HwpDocument.createEmpty();
 try{
  seed.createBlankDocument();seed.insertText(0,0,0,'표');seed.splitParagraph(0,0,1);seed.createTable(...at,2,3);
  for(let i=0;i<6;i++)seed.setCellProperties(...at,i,JSON.stringify({width:[5000,7000,9000][i%3],height:4000}));
  seed.mergeTableCells(...at,1,0,1,1);
  const doc=new HwpDocument(serialize(seed,format));
  try{
   const s=snapshot(doc,format),before=serialize(doc,format);
   const op:EditOp={kind:'delete_table_row',target,index:0};
   // Only the first row stores 5000 and 7000 separately. After removing it,
   // the native operation can shrink the outer width from 21000 to 12600.
   assert.throws(()=>executeDocumentOperations(doc,s,validateEditOperations([op],s)),/표 외곽 치수/);
   assert.equal(JSON.parse(doc.getTableProperties(...at)).tableWidth,21000);
   assert.deepEqual(readStructure(doc),s.structure);assert.deepEqual(serialize(doc,format),before);
  }finally{doc.free();}
 }finally{seed.free();}
});

test('a post-edit field value change rolls the whole axis edit back',()=>{
  const doc=staggered('hwpx',false);
  try {
    doc.insertClickHereFieldInCell(...at,0,0,0,false,'안내','설명','누름틀',true);
    doc.setFieldValueByName('누름틀','첫 값');
    const s=snapshot(doc,'hwpx'), bytes=serialize(doc,'hwpx');
    const insert=doc.insertTableColumn.bind(doc);
    doc.insertTableColumn=(...args:any[])=>{
      const result=insert(...args);doc.setFieldValueByName('누름틀','다른 값');return result;
    };
    const op:EditOp={kind:'insert_table_column',target,index:1,values:['','','']};
    assert.throws(()=>executeDocumentOperations(doc,s,validateEditOperations([op],s)),/필드/);
    assert.deepEqual(serialize(doc,'hwpx'),bytes);
  } finally {doc.free();}
});
