import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {generationSchema,editKinds} from '../src/modules/document/public/wire-schema.mjs';
import {validateEditOperations} from '../src/modules/document/public/index.ts';
import {readStructure} from '../src/adapters/rhwp/structure.ts';
import {readTableFormulaFields} from '../src/adapters/rhwp/table-formula-fields.ts';
import {executeDocumentOperations} from '../src/adapters/rhwp/execute.ts';

const pkg=process.env.JUEONY_ENGINE_PACKAGE??fileURLToPath(new URL('../node_modules/@rhwp/core/',import.meta.url));
const {default:init,HwpDocument}=await import(pathToFileURL(resolve(pkg,'rhwp.js')).href);
await init({module_or_path:await readFile(resolve(pkg,'rhwp_bg.wasm'))});
const snapshot=(d:any,name:string):any=>({name,revision:'test',nodes:[],limitations:[],structure:readStructure(d)});
const operation={kind:'fill_table_series',target:'s0p1t0',startRow:0,startColumn:0,endRow:0,endColumn:3,mode:'months'} as const;
function open(format:string,values:string[]) {
  const d=HwpDocument.createEmpty();
  try {
    d.createBlankDocument();d.splitParagraph(0,0,0);d.createTable(0,1,0,2,4);
    values.forEach((v,i)=>{if(v)d.insertTextInCell(0,1,0,i,0,0,v);});
    return new HwpDocument(format==='hwp'?d.exportHwp():d.exportHwpx());
  } finally { d.free(); }
}
test('all provider wire kinds have exactly one schema and series mode has explicit bounds',()=>{
  const schemas=generationSchema().properties.operations.items.anyOf;
  assert.deepEqual(schemas.map(s=>s.properties.kind.enum[0]).sort(),[...editKinds].sort());
  const series=schemas.find(s=>s.properties.kind.enum[0]==='fill_table_series')!;
  assert.deepEqual(series.required,Object.keys(operation));
  assert.deepEqual(series.properties.mode.enum,['days','months','years','formula','calculated-value']);
});

for(const format of ['hwp','hwpx']) test(format+' nested stored formula fill shifts addresses inside the chosen table',
  {skip:typeof HwpDocument.prototype.insertTableFormulaFieldByPath!=='function' && !process.env.JUEONY_ENGINE_PACKAGE?'requires the Jueony Rust engine':false},()=>{
  const blank=HwpDocument.createEmpty();blank.createBlankDocument();
  const inner='<table><tr><td></td><td></td><td></td></tr><tr><td>2</td><td>4</td><td>8</td></tr></table>';
  blank.pasteHtml(0,0,0,'<table><tr><td>첫째'+inner+'</td><td>둘째'+inner+'</td></tr></table>');
  const save=(d:any)=>format==='hwp'?d.exportHwp():d.exportHwpx();
  const d=new HwpDocument(save(blank));blank.free();
  try{
    const [sibling,table]=readStructure(d).nestedTables!;
    const root=[...table.ancestors,{controlIndex:table.control,cellIndex:0,cellParaIndex:0}];
    const seed=JSON.parse(d.insertTableFormulaFieldByPath(table.section,table.paragraph,JSON.stringify(root),'','=A2*2','%g'));
    assert.equal(seed.value,'4');
    const base={...snapshot(d,'계산.'+format),tableFormulaFields:readTableFormulaFields(d,true)};
    const op={...operation,target:table.id,endColumn:2,mode:'formula'} as const;
    const undo=d.saveSnapshot();
    executeDocumentOperations(d,base,validateEditOperations([op],base));
    const copy=new HwpDocument(save(d));
    try{
      const fields=readTableFormulaFields(copy,true)!.fields;
      assert.deepEqual(fields.map(f=>[f.tableId,f.expression,f.displayedValue]),
        [[table.id,'=A2*2','4'],[table.id,'=B2*2','8'],[table.id,'=C2*2','16']]);
      assert.deepEqual(readStructure(copy).nestedTables![0],sibling);
    }finally{copy.free();}
    d.restoreSnapshot(undo);d.discardSnapshot(undo);
    assert.deepEqual(readTableFormulaFields(d,true),base.tableFormulaFields);
  }finally{d.free();}
});

test('two fill lanes must agree on their shared owner before any cell is written',()=>{
  const d=open('hwpx',['1','2','old','','1','2','old','']);
  try{
    assert.equal(JSON.parse(d.mergeTableCells(0,1,0,0,3,1,3)).ok,true);
    const op={...operation,mode:'days',axis:'rows',endRow:1} as const;
    const snap=()=>snapshot(d,'병합.hwpx');
    const before=d.saveSnapshot();
    const base=snap();
    executeDocumentOperations(d,base,validateEditOperations([op],base));
    assert.equal(readStructure(d).tables[0].cells.find(c=>c.rowSpan===2)!.text,'4');
    d.restoreSnapshot(before);d.discardSnapshot(before);
    d.deleteTextInCell(0,1,0,5,0,0,1);d.insertTextInCell(0,1,0,5,0,0,'3');
    const conflict=snap(),bytes=d.exportHwpx();
    assert.throws(()=>executeDocumentOperations(d,conflict,validateEditOperations([op],conflict)),/서로 다른|여러 채우기/);
    assert.deepEqual(d.exportHwpx(),bytes);
    for(const i of [0,4]){
      d.deleteTextInCell(0,1,0,i,0,0,1);d.insertTextInCell(0,1,0,i,0,0,'=2');
    }
    const formulas=snap(),formulaOp={...op,mode:'formula'} as const;
    executeDocumentOperations(d,formulas,validateEditOperations([formulaOp],formulas));
    assert.equal(readStructure(d).tables[0].cells.find(c=>c.rowSpan===2)!.text,'=2');
  }finally{d.free();}
});
for (const format of ['hwpx','hwp']) for(const mode of ['months','formula','calculated-value'] as const) {
  test(format+' Agent '+mode+' fills the live range, saves and reopens',()=>{
    const inputs=mode==='months'?['2024-01-31','2024-02-29']:['=A2+$B$2'];
    const d=open(format,[inputs[0],inputs[1]??'','','','2','3','4','5']);
    try {
      const base=snapshot(d,'채우기.'+format), op=validateEditOperations([{...operation,mode}],base);
      const undo=d.saveSnapshot();executeDocumentOperations(d,base,op);
      const expected=mode==='months'?['2024-01-31','2024-02-29','2024-03-31','2024-04-30']:
        mode==='formula'?['=A2+$B$2','=B2+$B$2','=C2+$B$2','=D2+$B$2']:['=A2+$B$2','6','7','8'];
      const saved=format==='hwp'?d.exportHwp():d.exportHwpx(),copy=new HwpDocument(saved);
      try{assert.deepEqual(readStructure(copy).tables[0].cells.slice(0,4).map(c=>c.text),expected);}
      finally{copy.free();}
      d.restoreSnapshot(undo);d.discardSnapshot(undo);assert.deepEqual(readStructure(d),base.structure);
    } finally {d.free();}
  });
}
test('Agent series rejects a stale seed, invalid ranges, protected cells and bundled requests',()=>{
  const d=open('hwpx',['1','2','','']);
  try{
    const s=snapshot(d,'a.hwpx'),op={...operation,mode:'days'} as const;
    for(const bad of [{...op,endRow:1},{...op,endColumn:1},{...op,mode:'invalid'},{...op,startColumn:-1},{...op,force:true}])assert.throws(()=>validateEditOperations([bad],s));
    assert.throws(()=>validateEditOperations([op,op],s));
    d.insertTextInCell(0,1,0,0,0,0,'3');
    const bytes=d.exportHwpx();assert.throws(()=>executeDocumentOperations(d,s,[op]),/다시 조회/);assert.deepEqual(d.exportHwpx(),bytes);
    d.setCellProperties(0,1,0,3,'{"cellProtect":true}');assert.throws(()=>validateEditOperations([op],snapshot(d,'a.hwpx')),/보호/);
  }finally{d.free();}
});
for(const format of ['hwpx','hwp'])test(format+' Korean date spelling survives an Agent fill and reopen',()=>{
  const d=open(format,['2024. 1. 31.','2024. 2. 29.']);
  try {
    const base=snapshot(d,'공문.'+format);
    executeDocumentOperations(d,base,validateEditOperations([operation],base));
    const copy=new HwpDocument(format==='hwp'?d.exportHwp():d.exportHwpx());
    try{assert.deepEqual(readStructure(copy).tables[0].cells.slice(2,4).map(c=>c.text),['2024. 3. 31.','2024. 4. 30.']);}
    finally{copy.free();}
  } finally {d.free();}
});

for(const format of ['hwp','hwpx'])test(format+' fills physical owners once and preserves other nested tables',()=>{
  const source=HwpDocument.createEmpty();source.createBlankDocument();
  const row='<tr><td>2024. 2. 28. (수)</td><td>2024. 2. 29. (목)</td><td>기존</td></tr>';
  const inner='<table>'+row+'</table>';
  source.pasteHtml(0,0,0,'<table><tr><td>첫째'+inner+'</td><td>둘째'+inner+'</td></tr></table>');
  const exportFile=(d:any)=>format==='hwp'?d.exportHwp():d.exportHwpx();
  const d=new HwpDocument(exportFile(source));source.free();
  try{
    const base=snapshot(d,'중첩.'+format);
    const [a,b]=base.structure.nestedTables;
    const op={...operation,mode:'days',target:b.id,endColumn:2} as const;
    const undo=d.saveSnapshot();
    const cursor=executeDocumentOperations(d,base,validateEditOperations([op],base));
    assert.deepEqual(cursor.cellPath.slice(0,-1),b.ancestors);
    const copy=new HwpDocument(exportFile(d));
    try{
      const result=readStructure(copy).nestedTables!;
      assert.deepEqual(result[0],a);
      assert.equal(result[1].cells[2].text,'2024. 3. 1. (금)');
    }finally{copy.free();}
    d.restoreSnapshot(undo);d.discardSnapshot(undo);
    assert.deepEqual(readStructure(d).nestedTables,base.structure.nestedTables);
  }finally{d.free();}

  const merged=open(format,['1','2','','']);
  try{
    const at=[0,1,0];
    assert.equal(JSON.parse(merged.mergeTableCells(...at,0,2,0,3)).ok,true);
    const base=snapshot(merged,'병합.'+format);
    const op={...operation,mode:'days'} as const;
    const cells=base.structure.tables[0].cells;
    assert.equal(cells.find((c:any)=>c.row===0&&c.column===2).columnSpan,2);
    assert.throws(()=>validateEditOperations([{...op,endColumn:2}],base),/병합/);
    executeDocumentOperations(merged,base,validateEditOperations([op],base));
    const copy=new HwpDocument(exportFile(merged));
    try{assert.deepEqual(readStructure(copy).tables[0].cells.map(c=>[c.row,c.column,c.columnSpan,c.text]),
      cells.map((c:any)=>[c.row,c.column,c.columnSpan,c.row===0&&c.column===2?'3':c.text]));}
    finally{copy.free();}
  }finally{merged.free();}
});
