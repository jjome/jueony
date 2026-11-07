import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {generationSchema,editKinds} from '../src/modules/document/public/wire-schema.mjs';
import {validateEditOperations} from '../src/modules/document/public/index.ts';
import {readStructure} from '../src/adapters/rhwp/structure.ts';
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
