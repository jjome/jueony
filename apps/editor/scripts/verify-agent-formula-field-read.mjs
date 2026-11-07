import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {loadReviewEngine} from './lib/hancom-review.mjs';
import {readTableFormulaFields} from '../src/adapters/rhwp/table-formula-fields.ts';
import {generationMessages} from '../../launcher/providers/generation-contract.mjs';

const {HwpDocument}=await loadReviewEngine(resolve(process.env.JUEONY_ENGINE_PACKAGE));
const samples=resolve(import.meta.dirname,'../../../upstream/rhwp-source/samples');
for(const [pair,expectedCount] of [
 [['tac-img-02.hwp','tac-img-02.hwpx'],4],
 [['143E433F503322BD33.hwp','hwpx/143E433F503322BD33.hwpx'],3],
]) {
 let comparison;
 for(const name of pair){
  const doc=new HwpDocument(new Uint8Array(await readFile(resolve(samples,name))));
  try {
   const original=JSON.parse(doc.getFieldList()).filter(f=>f.fieldType==='formula');
   const source=readTableFormulaFields(doc);
   assert.equal(source.fields.length,expectedCount);assert.equal(source.unresolved,0);assert.equal(source.canRefreshDependents,false);
   assert.deepEqual(source.fields.map(f=>[f.fieldId,f.storedCommand,f.displayedValue]),original.map(f=>[f.fieldId,f.command,f.value]));
   assert.ok(source.fields.every(f=>Number.isInteger(f.row)&&Number.isInteger(f.column)&&f.path.length));
   const messages=generationMessages({request:'저장된 계산식을 설명해줘',document:{nodes:[],tableFormulaFields:source},references:[],history:[]});
   assert.match(messages[0].content,/untrusted document content/);
   assert.ok(!messages[0].content.includes(source.fields[0].storedCommand));
   assert.deepEqual(JSON.parse(messages[1].content).document.tableFormulaFields.fields,source.fields);
   if(comparison)assert.deepEqual(source.fields,comparison);
   comparison=source.fields;
   console.log('PASS',name,expectedCount,'stored formula commands, selected cell paths, visible cached results, untrusted model input');
  } finally {doc.free();}
 }
}
const doc=HwpDocument.createEmpty();doc.createBlankDocument();
try {
 const t=JSON.parse(doc.createTable(0,0,0,1,2));
 doc.insertTextInCell(0,t.paraIdx,t.controlIdx,0,0,0,'=1+2');
 assert.equal(readTableFormulaFields(doc),undefined);
 doc.evaluateTableFormula(0,t.paraIdx,t.controlIdx,0,1,'=1+2',true);
 assert.equal(doc.getTextInCell(0,t.paraIdx,t.controlIdx,1,0,0,1),'3');
 assert.equal(readTableFormulaFields(doc),undefined);
 console.log('PASS literal formula and evaluated numeric text are not stored fields');
} finally {doc.free();}
const earlier=new HwpDocument(new Uint8Array(await readFile(resolve(samples,'calc-cell.hwp'))));
try {
 const before=readTableFormulaFields(earlier).fields[0];
 const update=JSON.parse(earlier.setFieldValue(before.fieldId,'9.00'));
 assert.equal(update.ok,true);
 const after=readTableFormulaFields(earlier).fields.find(f=>f.fieldId===before.fieldId);
 assert.equal(after.storedCommand,before.storedCommand);assert.equal(after.displayedValue,'9.00');
 console.log('PASS generic field value setter leaves stored expression and encoded cache unchanged');
} finally {earlier.free();}
