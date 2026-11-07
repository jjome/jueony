import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {loadReviewEngine} from './lib/hancom-review.mjs';
import {validateEditOperations} from '../src/modules/document/public/index.ts';
import {executeDocumentOperations} from '../src/adapters/rhwp/execute.ts';
import {verifyPreservedExport} from '../src/adapters/rhwp/preservation.ts';
import {readStructure} from '../src/adapters/rhwp/structure.ts';
import {readTableFormulaFields} from '../src/adapters/rhwp/table-formula-fields.ts';

const {HwpDocument}=await loadReviewEngine(resolve(process.env.JUEONY_ENGINE_PACKAGE));
const out=resolve(process.env.JUEONY_TEST_OUTPUT??resolve(import.meta.dirname,'../../../build/nested-table-formulas'));
await mkdir(out,{recursive:true});
const seed=HwpDocument.createEmpty();
seed.createBlankDocument();
const inner='<table><tr><td>4</td><td></td><td></td></tr></table>';
seed.pasteHtml(0,0,0,`<table><tr><td>왼쪽${inner}</td><td>오른쪽${inner}</td></tr></table>`);
try {
 for(const ext of ['hwp','hwpx']){
  const write=ext==='hwp'?'exportHwp':'exportHwpx',doc=new HwpDocument(seed[write]());
  try {
   const snapshot=()=>({name:'nested.'+ext,revision:'current',nodes:[],limitations:[],
    structure:readStructure(doc),tableFormulaFields:readTableFormulaFields(doc,true,true)});
   const tables=snapshot().structure.nestedTables;
   assert.equal(tables.length,2);
   const target=tables[1].id;
   const apply=op=>{const base=snapshot();return executeDocumentOperations(doc,base,validateEditOperations([op],base));};
   const insert=(column,formula,tableId=target)=>apply({kind:'insert_table_formula_field',target:tableId,row:0,column,
    originalText:'',formula,resultFormat:'%g'});
   const fields=d=>readTableFormulaFields(d).fields;
   const display=d=>fields(d).map(f=>[f.tableId,f.row,f.column,f.expression,f.displayedValue]);
   const edit=(formula,original)=>apply({kind:'update_table_formula_field',target,row:0,column:1,
    fieldId:original.fieldId,originalCommand:original.storedCommand,formula,resultFormat:'%g'});
   insert(1,'=A1+1',tables[0].id);
   const cursor=insert(1,'=A1+1');
   assert.deepEqual(cursor.cellPath.slice(0,-1),tables[1].ancestors);
   insert(2,'=SQRT(B1+4)');
   const original=fields(doc).find(f=>f.tableId===target&&f.column===1);
   const before=doc.saveSnapshot();
   edit('=A1*3',original);
   const current=fields(doc).filter(f=>f.tableId===target);
   assert.deepEqual(current.map(f=>f.displayedValue),['12','4']);
   assert.throws(()=>edit('=42',original));
   const denied=doc[write]();
   assert.throws(()=>edit('=C1',current[0]));
   assert.deepEqual(doc[write](),denied);
   apply({kind:'set_table_cell',target,row:0,column:0,originalText:'4',text:'7'});
   assert.deepEqual(display(doc),[[tables[0].id,0,1,'=A1+1','5'],[target,0,1,'=A1*3','21'],[target,0,2,'=SQRT(B1+4)','5']]);
   const after=doc.saveSnapshot();
   doc.restoreSnapshot(before);
   assert.deepEqual(fields(doc).map(f=>f.displayedValue),['5','5','3']);
   doc.restoreSnapshot(after); doc.discardSnapshot(after); doc.discardSnapshot(before);
   const ancestor=tables[1].ancestors[0];
   doc.setCellProperties(tables[1].section,tables[1].paragraph,ancestor.controlIndex,ancestor.cellIndex,'{"cellProtect":true}');
   const locked=doc[write](),candidate=fields(doc)[1];
   assert.throws(()=>doc.updateTableFormulaFieldByPath(candidate.section,candidate.paragraph,JSON.stringify(candidate.path),
    candidate.fieldId,candidate.storedCommand,'=42','%g'));
   assert.deepEqual(doc[write](),locked);
   doc.setCellProperties(tables[1].section,tables[1].paragraph,ancestor.controlIndex,ancestor.cellIndex,'{"cellProtect":false}');
   const artifact=doc[write+'WithReport']();
   try{
    const bytes=artifact.takeBytes();
    verifyPreservedExport(doc,bytes,ext,artifact.contentLoss(),b=>new HwpDocument(b));
    const file=resolve(out,'nested-formulas.'+ext);
    await writeFile(file,bytes);
    const reopened=new HwpDocument(await readFile(file));
    try{
     assert.deepEqual(fields(reopened),fields(doc));
     assert.deepEqual(readStructure(reopened).nestedTables.map(t=>t.cells.map(c=>c.text)),
      [['4','5',''],['7','21','5']]);
    }finally{reopened.free();}
   }finally{artifact.free();}
   console.log('PASS',ext,'nested owner identity, formula insertion/update, numeric refresh, ancestor protection, undo/redo and disk reopen');
  }finally{doc.free();}
 }
}finally{seed.free();}
