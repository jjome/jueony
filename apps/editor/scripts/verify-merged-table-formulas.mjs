import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {loadReviewEngine} from './lib/hancom-review.mjs';
import {validateEditOperations} from '../src/modules/document/public/index.ts';
import {executeDocumentOperations} from '../src/adapters/rhwp/execute.ts';
import {verifyPreservedExport} from '../src/adapters/rhwp/preservation.ts';
import {readStructure} from '../src/adapters/rhwp/structure.ts';
import {readTableFormulaFields} from '../src/adapters/rhwp/table-formula-fields.ts';

const {HwpDocument} = await loadReviewEngine(resolve(process.env.JUEONY_ENGINE_PACKAGE));
const out = resolve(process.env.JUEONY_TEST_OUTPUT ?? resolve(import.meta.dirname,'../../../build/merged-table-formulas'));
await mkdir(out,{recursive:true});
const seed = HwpDocument.createEmpty();
seed.createBlankDocument();
const created = JSON.parse(seed.createTable(0,0,0,3,4));
const at = [0,created.paraIdx,created.controlIdx];
seed.mergeTableCells(...at,0,0,0,1); // A1:B1 numeric input
seed.mergeTableCells(...at,1,0,2,0); // A2:A3 stored field
seed.insertTextInCell(...at,0,0,0,'2');
seed.insertTextInCell(...at,1,0,0,'5'); // C1 has physical index 1
try {
 for (const ext of ['hwp','hwpx']) {
  const write = ext === 'hwp' ? 'exportHwp' : 'exportHwpx';
  const doc = new HwpDocument(seed[write]());
  try {
   const snapshot = () => ({name:'merged.'+ext,revision:'current',nodes:[],limitations:[],
    structure:readStructure(doc),tableFormulaFields:readTableFormulaFields(doc,true,true)});
   const target = snapshot().structure.tables[0].id;
   const apply = op => {
    const base = snapshot();
    executeDocumentOperations(doc,base,validateEditOperations([op],base));
   };
   const fields = d => readTableFormulaFields(d).fields;
   const values = d => fields(d).map(f=>[f.row,f.column,f.displayedValue]);
   const insert = (row,column,formula) => apply({kind:'insert_table_formula_field',target,row,column,
    originalText:'',formula,resultFormat:'%g'});
   const update = (row,column,formula) => {
    const field = fields(doc).find(f=>f.row===row&&f.column===column);
    apply({kind:'update_table_formula_field',target,row,column,fieldId:field.fieldId,
     originalCommand:field.storedCommand,formula,resultFormat:'%g'});
   };
   insert(0,3,'=SUM(LEFT)');
   insert(1,0,'=SUM(A1:C1)+MOD(C1,3)');
   insert(1,1,'=IF(C1,ABS(A3)+LOG10(100),0)');
   assert.deepEqual(values(doc),[[0,3,'7'],[1,0,'9'],[1,1,'11']]);
   const before = doc.saveSnapshot();
   update(1,0,'=SUM(BELOW)+SQRT(16)+B1+ROUND(2.5)');
   assert.deepEqual(values(doc),[[0,3,'7'],[1,0,'9'],[1,1,'11']]);
   apply({kind:'set_table_cell',target,row:0,column:2,originalText:'5',text:'8'});
   update(1,0,'=SUM(A1:C1)+COUNT(A1:B1)');
   assert.deepEqual(values(doc),[[0,3,'10'],[1,0,'11'],[1,1,'13']]);
   const after = doc.saveSnapshot();
   doc.restoreSnapshot(before);
   assert.deepEqual(values(doc),[[0,3,'7'],[1,0,'9'],[1,1,'11']]);
   doc.restoreSnapshot(after); doc.discardSnapshot(before); doc.discardSnapshot(after);
   const originalBytes = doc[write]();
   const owner=fields(doc).find(f=>f.row===1&&f.column===0);
   const scalarCases=[
    ['ABS(-3)',3],['SQRT(16)',4],['EXP(0)',1],['LOG(1)',0],['LOG10(100)',2],
    ['SIN(0)',0],['COS(0)',1],['TAN(0)',0],['ASIN(0)',0],['ACOS(1)',0],['ATAN(0)',0],
    ['RADIAN(0)',0],['SIGN(-3)',-1],['INT(-2.9)',-2],['CEILING(-2.9)',-2],
    ['FLOOR(-2.9)',-3],['ROUND(-2.5)',-3],['TRUNC(-2.9)',-2],['MOD(7,3)',1],['IF(0,1/0,4)',4]
   ];
   for(const [expr,value] of scalarCases){
    const preview=JSON.parse(doc.previewTableFormulaField(owner.section,owner.paragraph,owner.path[0].controlIndex,
     owner.path[0].cellIndex,owner.fieldId,owner.storedCommand,'='+expr,'%g'));
    assert.equal(preview.result,value,expr);
   }
   for (const bad of ['=A3','=B2','=SQRT(-1)','=SIGN(SQRT(-1))','=ROUND(1,2)','=MOD(3,0)','=IF(1,2)','=UNKNOWN(5)']) {
    assert.throws(()=>update(1,0,bad),undefined,bad);
    assert.deepEqual(doc[write](),originalBytes,bad);
   }
   assert.throws(()=>insert(2,0,'=0'));
   const artifact = doc[write+'WithReport']();
   try {
    const bytes = artifact.takeBytes();
    verifyPreservedExport(doc,bytes,ext,artifact.contentLoss(),b=>new HwpDocument(b));
    const file = resolve(out,'merged-formulas.'+ext);
    await writeFile(file,bytes);
    const reopened = new HwpDocument(await readFile(file));
    try { assert.deepEqual(fields(reopened),fields(doc)); }
    finally { reopened.free(); }
    const wire = JSON.parse(execFileSync('python',[resolve(import.meta.dirname,'lib/read-native-formula-fields.py'),file],{encoding:'utf8'}));
    const commands = ext==='hwp' ? wire.fields.map(f=>f.command) :
     wire.map(f=>Object.fromEntries(f.params.map(([,k,v])=>[k,v])).Command);
    assert.deepEqual(commands,fields(doc).map(f=>f.storedCommand));
   } finally { artifact.free(); }
   console.log('PASS',ext,'merged owners, function arity/domain, numeric refresh, dependent results, undo/redo and saved fields');
  } finally { doc.free(); }
 }
} finally { seed.free(); }
