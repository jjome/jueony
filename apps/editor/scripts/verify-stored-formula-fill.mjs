import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {loadReviewEngine} from './lib/hancom-review.mjs';
import {readAutoFillPlan,executeAutoFill} from '../src/adapters/rhwp/table-auto-fill-native.ts';

const {HwpDocument}=await loadReviewEngine(resolve(process.env.JUEONY_ENGINE_PACKAGE));
for(const ext of ['hwp','hwpx']){
 const seed=HwpDocument.createEmpty();seed.createBlankDocument();
 const {paraIdx,controlIdx}=JSON.parse(seed.createTable(0,0,0,3,4)),at=[0,paraIdx,controlIdx];
 for(const [i,v] of ['1','2','3','4','5','6','7','8','9','10','11','12'].entries())seed.insertTextInCell(...at,i,0,0,v);
 const getFields=d=>JSON.parse(d.getFieldList()).filter(f=>f.fieldType==='formula');
 const save=d=>ext==='hwp'?d.exportHwp():d.exportHwpx();
 const seedField=JSON.parse(seed.insertTableFormulaField(...at,7,'8','=D1+2','%.1f'));
 const block={sec:0,ppi:paraIdx,ci:controlIdx,anchor:{row:1,col:3},focus:{row:1,col:0}};
 const doc=new HwpDocument(save(seed));seed.free();
 try {
  const baseline=save(doc),initialFields=getFields(doc);
  const read=(output='formula')=>readAutoFillPlan(doc,block,'days',output);
  const plan=read();assert.deepEqual(plan.values,['=D1+2','=C1+2 → 5.0','=B1+2 → 4.0','=A1+2 → 3.0']);
  assert.deepEqual(save(doc),baseline);
  // Throw *after* the second real insertion, proving rollback of both cells.
  const real=doc.insertTableFormulaField;let attempts=0;
  doc.insertTableFormulaField=function(...args){const value=real.apply(doc,args);if(++attempts===2)throw Error('late field write');return value;};
  try{assert.throws(()=>executeAutoFill(doc,plan),/late field write/);}finally{delete doc.insertTableFormulaField;}
  assert.deepEqual(save(doc),baseline);assert.deepEqual(getFields(doc),initialFields);
  doc.setCellProperties(...at,5,'{"cellProtect":true}');const protectedBytes=save(doc);assert.throws(()=>read(),/보호/);assert.deepEqual(save(doc),protectedBytes);
  doc.setCellProperties(...at,5,'{"cellProtect":false}');
  doc.deleteTextInCell(...at,2,0,0,1);doc.insertTextInCell(...at,2,0,0,'9');const stale=save(doc);
  assert.throws(()=>executeAutoFill(doc,plan),/바뀌었/);assert.deepEqual(save(doc),stale);assert.deepEqual(getFields(doc),initialFields);
  assert.equal(read().storedFill.steps[0].value,'11.0');
  // Same expression and number in a pre-existing destination field keep its ID.
  const existing=JSON.parse(doc.insertTableFormulaField(...at,5,'6','=1','%g'));
  const before=save(doc);assert.throws(()=>read('value'),/기존 계산식/);assert.deepEqual(save(doc),before);
  const update=read();executeAutoFill(doc,update);
  assert.equal(getFields(doc).find(f=>f.fieldId===existing.fieldId).command,'=B1+2??%.1f;;4.0');
  assert.equal(getFields(doc).find(f=>f.fieldId===seedField.fieldId).command,seedField.command);
  assert.equal(new Set(getFields(doc).map(f=>f.fieldId)).size,4);
  assert.equal(read().storedFill.changed,false);
  // Directional references are recomputed at each destination.
  const current=getFields(doc).find(f=>f.fieldId===seedField.fieldId);
  doc.updateTableFormulaField(...at,7,current.fieldId,current.command,'=AVG(ABOVE)','%.1f');
  const direction=read();assert.deepEqual(direction.values,['=AVG(ABOVE)','=AVG(ABOVE) → 9.0','=AVG(ABOVE) → 2.0','=AVG(ABOVE) → 1.0']);
  executeAutoFill(doc,direction);assert.ok(getFields(doc).every(f=>f.command.startsWith('=AVG(ABOVE)??%.1f;;')));
  const reopen=new HwpDocument(save(doc));try{assert.deepEqual(getFields(reopen),getFields(doc));}finally{reopen.free();}
  console.log('PASS',ext,'reverse and directional field copy, protection, stale input rejection, late failure rollback, stable IDs, no-op, field-safe writes and reopen');
 }finally{doc.free();}
}
