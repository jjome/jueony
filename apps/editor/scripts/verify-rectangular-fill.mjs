import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {loadReviewEngine} from './lib/hancom-review.mjs';
import {readAutoFillPlan,executeAutoFill} from '../src/adapters/rhwp/table-auto-fill-native.ts';
import {readStructure} from '../src/adapters/rhwp/structure.ts';
import {readTableFormulaFields} from '../src/adapters/rhwp/table-formula-fields.ts';
import {validateEditOperations} from '../src/modules/document/public/index.ts';
import {executeDocumentOperations} from '../src/adapters/rhwp/execute.ts';
import {verifyPreservedExport} from '../src/adapters/rhwp/preservation.ts';
const {HwpDocument}=await loadReviewEngine(resolve(process.env.JUEONY_ENGINE_PACKAGE));
for(const ext of ['hwp','hwpx']){
 const save=ext==='hwp'?'exportHwp':'exportHwpx', blank=HwpDocument.createEmpty();blank.createBlankDocument();
 const table=JSON.parse(blank.createTable(0,0,0,3,4)),at=[0,table.paraIdx,table.controlIdx];
 const input=['1','2','3','4','5','6','7','8','9','10','11','12'];
 input.forEach((s,i)=>blank.insertTextInCell(...at,i,0,0,s));
 const reopened=()=>new HwpDocument(blank[save]());
 const block=axis=>({sec:0,ppi:at[1],ci:at[2],anchor:{row:0,col:0},focus:{row:2,col:3},axis});
 const text=d=>readStructure(d).tables[0].cells.map(c=>c.text);
 const snap=d=>({name:'rect.'+ext,revision:'R',nodes:[],limitations:[],structure:readStructure(d),tableFormulaFields:readTableFormulaFields(d,true)});
 const op=(s,mode,axis,startRow=0)=>({kind:'fill_table_series',target:s.structure.tables[0].id,startRow,startColumn:0,endRow:2,endColumn:3,mode,axis});
 const agent=(d,cmd)=>{const s=snap(d);return executeDocumentOperations(d,s,validateEditOperations([cmd],s));};
 const guard=d=>{const a=d[save+'WithReport']();try{const b=a.takeBytes();verifyPreservedExport(d,b,ext,a.contentLoss(),x=>new HwpDocument(x));return new HwpDocument(b);}finally{a.free();}};
 const plain=reopened();
 try{
  const put=(i,s)=>{plain.deleteTextInCell(...at,i,0,0,plain.getCellParagraphLength(...at,i,0));plain.insertTextInCell(...at,i,0,0,s);};
  const values=['1','3','a','b','10','15','c','d','제01호','제02호','e','f'];
  values.forEach((v,i)=>put(i,v));const b=block('rows');
  assert.throws(()=>readAutoFillPlan(plain,b)); // heterogeneous seed kinds
  put(8,'11');put(9,'22');
  const plan=readAutoFillPlan(plain,b),old=plain[save]();
  assert.deepEqual(plan.changedCells,[2,3,6,7,10,11]);
  const mutation=plain.insertTextInCell;
  plain.insertTextInCell=function(...args){const r=mutation.apply(this,args);if(args[3]===7)throw Error('intentional later row');return r;};
  try{assert.throws(()=>executeAutoFill(plain,plan),/intentional later row/);}finally{delete plain.insertTextInCell;}
  assert.deepEqual(plain[save](),old);
  plain.setCellProperties(...at,7,'{"cellProtect":true}');assert.throws(()=>readAutoFillPlan(plain,b),/보호/);plain.setCellProperties(...at,7,'{"cellProtect":false}');
  const before=plain.saveSnapshot();agent(plain,op(snap(plain),'days','rows'));const check=guard(plain);
  try{assert.deepEqual(text(check),['1','3','5','7','10','15','20','25','11','22','33','44']);}finally{check.free();}
  plain.restoreSnapshot(before);plain.discardSnapshot(before);assert.deepEqual(plain[save](),old);
  const s=snap(plain);assert.throws(()=>validateEditOperations([op(s,'days',undefined)],s),/방향/);
 }finally{plain.free();}
 const dates=reopened();
 try{
  const data=['2024-01-31','2024-02-29','2024-04-30','2024-11-30','2024-02-29','2024-03-29','2024-05-30','2024-12-30'];
  data.forEach((v,i)=>{dates.deleteTextInCell(...at,i,0,0,dates.getCellParagraphLength(...at,i,0));dates.insertTextInCell(...at,i,0,0,v);});
  agent(dates,op(snap(dates),'months','columns'));const check=guard(dates);try{assert.deepEqual(text(check).slice(8),['2024-03-31','2024-04-29','2024-06-30','2025-01-30']);}finally{check.free();}
 }finally{dates.free();}
 for(const mode of ['formula','calculated-value']){
  const d=reopened();try{
   d.insertTableFormulaField(...at,4,'5','=A1*2','%.1f');d.insertTableFormulaField(...at,8,'9','=A2+1','%.1f');
   const original=d[save](),undo=d.saveSnapshot(),s=snap(d);
   agent(d,op(s,mode,'rows',1));const after=d[save](),redo=d.saveSnapshot(),check=guard(d);
   try{
    assert.deepEqual(text(check),['1','2','3','4','2.0','4.0','6.0','8.0','3.0','5.0','7.0','9.0']);
    const fields=JSON.parse(check.getFieldList());assert.equal(fields.length,mode==='formula'?8:2);
    if(mode==='formula')assert.equal(fields.at(-1).command,'=D2+1??%.1f;;9.0');
   }finally{check.free();}
   d.restoreSnapshot(undo);assert.deepEqual(d[save](),original);d.restoreSnapshot(redo);assert.deepEqual(d[save](),after);d.discardSnapshot(redo);d.discardSnapshot(undo);
  }finally{d.free();}
 }
 blank.free();
 console.log('PASS',ext,'row seeds, column month ends, rectangular native formula and fixed values across rows, protected cells, atomic failure, undo/redo and guarded save/reopen');
}
