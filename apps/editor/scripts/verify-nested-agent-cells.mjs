import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {loadReviewEngine} from './lib/hancom-review.mjs';
import {readStructure} from '../src/adapters/rhwp/structure.ts';
import {executeDocumentOperations} from '../src/adapters/rhwp/execute.ts';
import {verifyPreservedExport} from '../src/adapters/rhwp/preservation.ts';
import {describeStructure,validateEditOperations} from '../src/modules/document/public/index.ts';

const {HwpDocument}=await loadReviewEngine(resolve(process.env.JUEONY_ENGINE_PACKAGE));
const blank=HwpDocument.createEmpty();
blank.createBlankDocument();
const inner='<table><tr><td>동일😀</td><td>동일😀</td></tr></table>';
blank.pasteHtml(0,0,0,`<table><tr><td>왼쪽${inner}</td><td>오른쪽${inner}</td></tr></table>`);
const take=(doc,format)=>format==='hwp'?doc.exportHwp():doc.exportHwpx();
const snapshot=(doc,name)=>({revision:'r',name,nodes:[],limitations:[],structure:readStructure(doc)});
try {
  for (const format of ['hwp','hwpx']) {
    const name='nested.'+format,doc=new HwpDocument(take(blank,format));
    try {
      const base=snapshot(doc,name),tables=base.structure.nestedTables;
      assert.equal(tables.length,2); assert.notEqual(tables[0].id,tables[1].id);
      const table=tables[1],cell=table.cells[1],path=[...table.ancestors,{controlIndex:table.control,cellIndex:cell.index,cellParaIndex:0}];
      assert.equal(table.ancestors[0].cellIndex,1); assert.equal(table.ancestors[0].cellParaIndex,1);
      assert.ok(describeStructure(base.structure).includes(table.id));
      const op={kind:'set_table_cell',target:table.id,row:cell.row,column:cell.column,originalText:cell.text,text:'신규😀'};
      assert.throws(()=>executeDocumentOperations(doc,base,[{...op,text:'개행\n금지'}]),/제어문자/);
      assert.throws(()=>executeDocumentOperations(doc,base,[{...op,text:'X'.repeat(4001)}]),/4,000/);
      const apply=(state,cmd)=>executeDocumentOperations(doc,state,validateEditOperations([cmd],state));
      const before=doc.saveSnapshot();apply(base,op);
      const after=doc.saveSnapshot();
      const expected=tables.map(t=>t.cells.map(c=>c.text)); expected[1][1]=op.text;
      const texts=d=>readStructure(d).nestedTables.map(t=>t.cells.map(c=>c.text));
      assert.deepEqual(texts(doc),expected);
      const artifact=format==='hwp'?doc.exportHwpWithReport():doc.exportHwpxWithReport();
      try {
        const loss=JSON.parse(artifact.contentLoss()),bytes=artifact.takeBytes();
        verifyPreservedExport(doc,bytes,format,loss,b=>new HwpDocument(b));
        const reopened=new HwpDocument(bytes);
        try {assert.deepEqual(texts(reopened),expected);} finally {reopened.free();}
      } finally {artifact.free();}
      assert.throws(()=>apply(base,op),/원문|경로/);
      assert.equal(JSON.parse(doc.restoreSnapshot(before)).ok,true);
      assert.deepEqual(texts(doc),tables.map(t=>t.cells.map(c=>c.text)));
      assert.equal(JSON.parse(doc.restoreSnapshot(after)).ok,true);assert.deepEqual(texts(doc),expected);
      assert.throws(()=>validateEditOperations([op,op],base),/단독/);
      assert.throws(()=>validateEditOperations([{...op,target:table.id+'x'}],base),/표 ID/);
      assert.throws(()=>validateEditOperations([{...op,originalText:'stale'}],base),/원문/);
      assert.throws(()=>validateEditOperations([{kind:'format_table_cells',target:table.id,startRow:0,startColumn:0,rowCount:1,columnCount:1,properties:{bold:true}}],base),/표 ID/);
      const live=snapshot(doc,name);
      doc.applyCharFormatInCellByPath(table.section,table.paragraph,JSON.stringify(path),0,1,JSON.stringify({bold:true}));
      assert.equal(readStructure(doc).nestedTables[1].cells[1].editable,false);
      assert.throws(()=>apply(live,{...op,originalText:op.text,text:'실패'}),/경로|원문/);
      const [parent]=table.ancestors;
      doc.setCellProperties(table.section,table.paragraph,parent.controlIndex,parent.cellIndex,JSON.stringify({cellProtect:true}));
      assert.ok(readStructure(doc).nestedTables[1].cells.every(c=>!c.editable));
      assert.ok(readStructure(doc).nestedTables[0].cells.every(c=>c.editable));
      console.log('PASS',format,'distinct parents, native edit, undo/redo, guarded export/reopen, stale/mixed/protected refusal');
    } finally {doc.free();}
  }
} finally {blank.free();}
