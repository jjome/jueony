import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {loadReviewEngine} from './lib/hancom-review.mjs';
import {validateEditOperations} from '../src/modules/document/public/index.ts';
import {readStructure} from '../src/adapters/rhwp/structure.ts';
import {readTableFormulaFields} from '../src/adapters/rhwp/table-formula-fields.ts';
import {executeDocumentOperations} from '../src/adapters/rhwp/execute.ts';
import {tableFormulaReceipt} from '../src/adapters/rhwp/update-table-formula-field.ts';
import {verifyPreservedExport} from '../src/adapters/rhwp/preservation.ts';

const {HwpDocument}=await loadReviewEngine(resolve(process.env.JUEONY_ENGINE_PACKAGE));
const original=await readFile(resolve(import.meta.dirname,'../../../upstream/rhwp-source/samples/calc-cell.hwp'));
for(const format of ['hwp','hwpx']){
 const author=new HwpDocument(new Uint8Array(original));
 const bytes=format==='hwp'?author.exportHwp():author.exportHwpx();author.free();
 const doc=new HwpDocument(bytes);
 try {
  const snapshot=()=>({name:'test.'+format,revision:'r1',nodes:[],limitations:[],structure:readStructure(doc),tableFormulaFields:readTableFormulaFields(doc,true)});
  const field=d=>readTableFormulaFields(d).fields.find(f=>f.expression==='=SUM(A2,C1,D2)');
  const stored=field(doc),table=snapshot().structure.tables[0];assert.ok(stored);
  const proposal=cap=>({kind:'update_table_formula_field',target:cap.tableId,row:cap.row,column:cap.column,fieldId:cap.fieldId,
    originalCommand:cap.storedCommand,formula:cap.expression,resultFormat:cap.resultFormat});
  const apply=(base,op)=>executeDocumentOperations(doc,base,validateEditOperations([op],base));
  const saved=snapshot(),operation=proposal(stored);
  assert.equal(saved.tableFormulaFields.canEdit,true);
  assert.throws(()=>apply(saved,operation),/현재 값과 같/);
  const malformed=new Proxy(doc,{get(native,key){
   if(key==='previewTableFormulaField')return (...args)=>{
    const result=JSON.parse(native.previewTableFormulaField(...args));
    if(args[6]==='=42')result.dependentChanges=[{cellIndex:stored.path[0].cellIndex,fieldId:stored.fieldId,
      previousCommand:stored.storedCommand,previousValue:stored.displayedValue,command:result.command,value:result.value}];
    return JSON.stringify(result);
   };
   const method=Reflect.get(native,key,native);return typeof method==='function'?method.bind(native):method;
  }});
  assert.throws(()=>executeDocumentOperations(malformed,saved,[{...operation,formula:'=42'}]),/의존 계산식/);
  assert.deepEqual(field(doc),stored);
  // A2 changes. The existing field's displayed value and command remain cached.
  const input=table.cells.find(c=>c.row===1&&c.column===0);
  assert.equal(input.text,'3');const args=[table.section,table.paragraph,table.control,input.index,0];
  doc.deleteTextInCell(...args,0,1);doc.insertTextInCell(...args,0,'8');
  assert.equal(field(doc).displayedValue,'13');
  const before=snapshot(),undo=doc.saveSnapshot();
  apply(before,operation);const after=field(doc);
  assert.equal(after.displayedValue,'18');assert.equal(after.storedCommand,'=SUM(A2,C1,D2)??%g,;;18');
  assert.deepEqual(readTableFormulaFields(doc).fields.filter(f=>f.fieldId!==after.fieldId).map(f=>f.storedCommand),
    saved.tableFormulaFields.fields.filter(f=>f.fieldId!==after.fieldId).map(f=>f.storedCommand));
  assert.throws(()=>apply(before,operation),/원문|변경/);
  const artifact=format==='hwp'?doc.exportHwpWithReport():doc.exportHwpxWithReport();
  try {
   const output=artifact.takeBytes(),loss=JSON.parse(artifact.contentLoss());
   verifyPreservedExport(doc,output,format,loss,b=>new HwpDocument(b));
   const r=new HwpDocument(output);try{assert.equal(field(r).storedCommand,after.storedCommand);}finally{r.free();}
  }finally{artifact.free();}
  assert.equal(JSON.parse(doc.restoreSnapshot(undo)).ok,true);doc.discardSnapshot(undo);
  assert.deepEqual(field(doc),stored);
  // Same displayed number can conceal an actual change to the native formula.
  const sameValue={...operation,formula:'=13'},base=snapshot();apply(base,sameValue);
  const receipt=tableFormulaReceipt(doc,base,sameValue);
  assert.equal(receipt.before.value,receipt.after.value);assert.notEqual(receipt.before.command,receipt.after.command);
  console.log('PASS',format,'cached input edit, explicit recomputation of existing field, original rejection, safe reopen and undo');
  if(process.env.JUEONY_REVIEW_FORMULA_DEPENDENTS==='1'){
   const cols=snapshot().tableFormulaFields,avg=cols.fields.find(f=>f.expression==='=AVG(ABOVE)'),dependent=cols.fields.find(f=>f.expression==='=13');
   assert.equal(cols.canRefreshDependents,true);
   const link={...proposal(dependent),formula:'=A3*2+C1'};apply(snapshot(),link);
   // A2 was 8, so AVG(ABOVE) recalculates to 4.5. Establish the current cache
   // first. Then change C1, which only the dependent reads.
   const avgOp=proposal(avg);apply(snapshot(),avgOp);
   const fresh=snapshot().tableFormulaFields.fields.find(f=>f.fieldId===avg.fieldId);
   const c1=table.cells.find(c=>c.row===0&&c.column===2),args=[table.section,table.paragraph,table.control,c1.index,0];
   doc.deleteTextInCell(...args,0,1);doc.insertTextInCell(...args,0,'4');
   const initial=snapshot(),refresh=proposal(fresh);apply(initial,refresh);
   const delta=tableFormulaReceipt(doc,initial,refresh);
   assert.deepEqual(delta.before,delta.after);assert.equal(delta.dependents.length,1);
   assert.equal(delta.dependents[0].fieldId,dependent.fieldId);assert.equal(Number(delta.dependents[0].after.value),Number(delta.dependents[0].before.value)+1);
   console.log('PASS',format,'explicit dependent-only refresh, exact command and unchanged target receipt');
  }
 }finally{doc.free();}
}
