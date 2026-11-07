import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {loadReviewEngine} from './lib/hancom-review.mjs';
import {readStructure} from '../src/adapters/rhwp/structure.ts';
import {executeDocumentOperations} from '../src/adapters/rhwp/execute.ts';
import {verifyPreservedExport} from '../src/adapters/rhwp/preservation.ts';

const {HwpDocument}=await loadReviewEngine(resolve(process.env.JUEONY_ENGINE_PACKAGE));
const value=v=>JSON.parse(v);
const model=HwpDocument.createEmpty();
model.createBlankDocument();
model.insertText(0,0,0,'작성자: 이름 / 업무');
model.splitParagraph(0,0,model.getParagraphLength(0,0));
model.pasteHtml(0,1,0,'<table><tr><td>계획<table><tr><td>월</td><td>화</td></tr><tr><td>수</td><td>목</td></tr></table></td></tr></table>');
model.insertClickHereField(0,0,5,'이름','담당 부서','작성자',true);
model.addBookmark(0,0,9,'업무 위치');
try{
 for(const format of ['hwp','hwpx']){
  const save=d=>format==='hwp'?d.exportHwp():d.exportHwpx();
  const doc=new HwpDocument(save(model));
  try{
   const state={revision:'r1',name:'일정.'+format,structure:readStructure(doc),nodes:[],limitations:[]};
   const [target]=state.structure.nestedTables;
   assert.equal(target.axisEditable,true);
   const op={kind:'insert_table_column',target:target.id,index:1,values:['예정','완료']};
   const before=save(doc),undo=doc.saveSnapshot();
   const records=d=>[value(d.getFieldList()),value(d.getBookmarks())];
   const baseline=records(doc);
   const apply=()=>executeDocumentOperations(doc,state,[op]);
   apply();
   const artifact=format==='hwp'?doc.exportHwpWithReport():doc.exportHwpxWithReport();
   try{
    const saved=artifact.takeBytes();
    verifyPreservedExport(doc,saved,format,value(artifact.contentLoss()),b=>new HwpDocument(b));
    const reopened=new HwpDocument(saved);
    try{
     assert.deepEqual(records(reopened),baseline);
     assert.deepEqual(readStructure(reopened).nestedTables[0].cells.map(c=>c.text),['월','예정','화','수','완료','목']);
     assert.equal(reopened.getTextRange(0,0,0,reopened.getParagraphLength(0,0)),'작성자: 이름 / 업무');
    }finally{reopened.free();}
    const redo=doc.saveSnapshot();doc.restoreSnapshot(undo);assert.deepEqual(save(doc),before);
    doc.restoreSnapshot(redo);assert.deepEqual(save(doc),saved);doc.discardSnapshot(redo);
   }finally{artifact.free();doc.restoreSnapshot(undo);doc.discardSnapshot(undo);}
   const edit=doc.editNestedTableAxis.bind(doc);
   doc.editNestedTableAxis=(...args)=>{const result=edit(...args);doc.renameBookmark('업무 위치','다른 위치');return result;};
   assert.throws(apply);assert.deepEqual(records(doc),baseline);assert.deepEqual(save(doc),before);
   doc.editNestedTableAxis=edit;
   const fieldAt=doc.getFieldInfoAt.bind(doc);
   doc.getFieldInfoAt=(...args)=>JSON.stringify({...value(fieldAt(...args)),fieldId:999});
   assert.ok(!readStructure(doc).nestedTables[0].axisEditable);
   console.log('PASS',format,'nested column edit with anchored body markers, save, undo/redo and rollback');
  }finally{doc.free();}
 }
}finally{model.free();}
