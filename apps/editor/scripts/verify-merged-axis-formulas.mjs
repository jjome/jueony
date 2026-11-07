import {mergedAxisFormulaFixture} from './lib/merged-axis-formula-fixture.mjs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {loadReviewEngine} from './lib/hancom-review.mjs';
import {readStructure} from '../src/adapters/rhwp/structure.ts';
import {readTableFormulaFields} from '../src/adapters/rhwp/table-formula-fields.ts';
import {executeDocumentOperations} from '../src/adapters/rhwp/execute.ts';
import {validateEditOperations} from '../src/modules/document/public/index.ts';

const {HwpDocument}=await loadReviewEngine(resolve(process.env.JUEONY_ENGINE_PACKAGE));
const out=resolve(process.env.JUEONY_TEST_OUTPUT??resolve(import.meta.dirname,'../../../build/merged-axis-formulas'));
await mkdir(out,{recursive:true});
const seed=mergedAxisFormulaFixture(HwpDocument);
const table=readStructure(seed).tables[0],at=[table.section,table.paragraph,table.control];
const stored=d=>readTableFormulaFields(d).fields.map(f=>[f.row,f.column,f.fieldId,f.storedCommand]);
try{
 for(const format of ['hwp','hwpx']){
  const exportName=format==='hwp'?'exportHwp':'exportHwpx';
  for(const axis of ['row','column']){
   const doc=new HwpDocument(seed[exportName]());
   try{
    const state=d=>({name:'axis.'+format,revision:'live',nodes:[],limitations:[],structure:readStructure(d)});
    const target=state(doc).structure.tables[0].id;
    const apply=(op,d=doc)=>{const snap=state(d);executeDocumentOperations(d,snap,validateEditOperations([op],snap));};
    const insert={kind:'insert_table_'+axis,target,index:0,values:['8','','','']};
    const remove={kind:'delete_table_'+axis,target,index:0};
    const original=stored(doc),before=doc.saveSnapshot();
    assert.equal(original.length,2);
    apply(insert);
    const moved=stored(doc),want=axis==='row'
     ? [[2,2,original[0][2],'=SUM(A3:B3)+B2??%.2f;;12.00'],[3,3,original[1][2],'=C3*2??%g;;24']]
     : [[1,3,original[0][2],'=SUM(B2:C2)+C1??%.2f;;12.00'],[2,4,original[1][2],'=D2*2??%g;;24']];
    assert.deepEqual(moved,want);
    const after=doc.saveSnapshot();doc.restoreSnapshot(before);assert.deepEqual(stored(doc),original);
    doc.restoreSnapshot(after);assert.deepEqual(stored(doc),want);doc.discardSnapshot(before);doc.discardSnapshot(after);
    const file=resolve(out,'insert-'+axis+'.'+format);await writeFile(file,doc[exportName]());
    const raw=JSON.parse(execFileSync('python',[resolve(import.meta.dirname,'lib/read-native-formula-fields.py'),file],{encoding:'utf8'}));
    const commands=format==='hwp'?raw.fields.map(f=>f.command):raw.map(f=>f.params.find(([,k])=>k==='Command')[2]);
    assert.deepEqual(commands,want.map(f=>f[3]));
    const reopened=new HwpDocument(await readFile(file));
    try{
     assert.deepEqual(stored(reopened),want);apply(remove,reopened);assert.deepEqual(stored(reopened),original);
     const back=new HwpDocument(reopened[exportName]());try{assert.deepEqual(stored(back),original);}finally{back.free();}
    }finally{reopened.free();}
    apply(remove);
    const unchanged=doc[exportName]();
    for(const invalid of [
     {kind:'insert_table_column',target,index:1,values:['','','','']},
     {kind:'delete_table_column',target,index:0},{kind:'delete_table_row',target,index:1}
    ]){
     assert.throws(()=>apply(invalid),/계산식/);
     assert.deepEqual(doc[exportName](),unchanged);
    }
    const intercepted=new Proxy(doc,{get(d,key){
     if(key==='updateTableFormulaField')return (...args)=>{
       const reply=JSON.parse(d.updateTableFormulaField(...args));reply.value='failed';return JSON.stringify(reply);
     };
     const value=Reflect.get(d,key,d);return typeof value==='function'?value.bind(d):value;
    }});
    assert.throws(()=>apply(insert,intercepted),/계산식/);assert.deepEqual(doc[exportName](),unchanged);
    console.log('PASS',format,axis,'A1/range and dependent-field remap, mixed-format results, undo/redo, rejected edits, rollback, raw disk and reopen');
   }finally{doc.free();}
  }
  const doc=new HwpDocument(seed[exportName]());
  try{
   const snapshot=()=>({name:'axis.'+format,revision:'live',nodes:[],limitations:[],structure:readStructure(doc)});
   const target=snapshot().structure.tables[0].id;
   const apply=(op,base=snapshot())=>executeDocumentOperations(doc,base,validateEditOperations([op],base));
   const first=()=>readTableFormulaFields(doc).fields[0];
   const update=expr=>{const f=first();doc.updateTableFormulaField(...at,f.path[0].cellIndex,f.fieldId,f.storedCommand,expr,f.resultFormat);};
   const old=snapshot();
   update('=SUM(LEFT)');
   const unopened=doc[exportName]();
   const insert={kind:'insert_table_row',target,index:0,values:['','','','']};
   assert.throws(()=>apply(insert,old),/바뀌었습니다/);
   assert.throws(()=>apply({kind:'insert_table_column',target,index:0,values:['','','','']}),/계산식/);
   assert.deepEqual(doc[exportName](),unopened);
   apply(insert);assert.equal(first().storedCommand,'=SUM(LEFT)??%.2f;;7.00');
   apply({kind:'delete_table_row',target,index:0});
   update('=B1+5');
   apply({kind:'delete_table_column',target,index:1});
   assert.equal(first().storedCommand,'=A1+5??%.2f;;10.00');
   const reopened=new HwpDocument(doc[exportName]());
   try{assert.deepEqual(stored(reopened),stored(doc));}finally{reopened.free();}
   console.log('PASS',format,'direction membership, stale definition and surviving owner of deleted covered slot');
  }finally{doc.free();}
 }
}finally{seed.free();}
