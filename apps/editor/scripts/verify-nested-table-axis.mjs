import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {loadReviewEngine} from './lib/hancom-review.mjs';
import {readStructure} from '../src/adapters/rhwp/structure.ts';
import {executeDocumentOperations} from '../src/adapters/rhwp/execute.ts';
import {verifyPreservedExport} from '../src/adapters/rhwp/preservation.ts';
import {validateEditOperations} from '../src/modules/document/public/index.ts';

const {HwpDocument}=await loadReviewEngine(resolve(process.env.JUEONY_ENGINE_PACKAGE));
const template=HwpDocument.createEmpty();template.createBlankDocument();
const inner='<table><tr><td>a</td><td>b</td></tr><tr><td>c</td><td>d</td></tr></table>';
template.pasteHtml(0,0,0,'<table><tr><td>Left'+inner+'</td><td>Right'+inner+'</td></tr></table>');
const save=(doc,format)=>format==='hwp'?doc.exportHwp():doc.exportHwpx();
const state=(d,format)=>({name:'nested.'+format,revision:'v1',structure:readStructure(d),limitations:[],nodes:[]});
const apply=(doc,s,op)=>executeDocumentOperations(doc,s,validateEditOperations([op],s));
const path=(t,index,p=0)=>JSON.stringify([...t.ancestors,{controlIndex:t.control,cellIndex:index,cellParaIndex:p}]);
const table=readStructure(template).nestedTables[1],args=[table.section,table.paragraph];
template.insertTextInCellByPath(...args,path(table,0),1,'tail');
template.splitParagraphInCellByPath(...args,path(table,0),1);
template.applyCharFormatInCellByPath(...args,path(table,0,1),1,3,'{"italic":true}');
try{
 for(const format of ['hwp','hwpx']){
  for(const kind of ['insert_table_row','insert_table_column','delete_table_row','delete_table_column']){
   const doc=new HwpDocument(save(template,format));
   try{
    const s=state(doc,format),[sibling,original]=s.structure.nestedTables,old=save(doc,format);
    assert.equal(original.axisEditable,true);
    const insert=kind.startsWith('insert'),row=kind.endsWith('row');
    const op={kind,target:original.id,index:1,...(insert?{values:['추가😀','']}:{})};
    const undo=doc.saveSnapshot();const cursor=apply(doc,s,op);assert.equal(cursor.cellPath[0].cellIndex,1);
    const artifact=format==='hwp'?doc.exportHwpWithReport():doc.exportHwpxWithReport();
    try{
     const bytes=artifact.takeBytes();verifyPreservedExport(doc,bytes,format,JSON.parse(artifact.contentLoss()),b=>new HwpDocument(b));
     const reopened=new HwpDocument(bytes);
     try{
      const [other,edited]=readStructure(reopened).nestedTables;
      assert.deepEqual(other,sibling);assert.equal(edited.rows,2+(row?(insert?1:-1):0));assert.equal(edited.columns,2+(row?0:(insert?1:-1)));
      const expected=row?(insert?['a\ntail','b','추가😀','','c','d']:['a\ntail','b']):
       insert?['a\ntail','추가😀','b','c','','d']:['a\ntail','c'];
      assert.deepEqual(edited.cells.map(c=>c.text),expected);
      assert.equal(JSON.parse(reopened.getCellCharPropertiesAtByPath(...args,path(edited,0,1),1)).italic,true);
     }finally{reopened.free();}
     const redo=doc.saveSnapshot();doc.restoreSnapshot(undo);assert.deepEqual(save(doc,format),old);
     doc.restoreSnapshot(redo);assert.deepEqual(save(doc,format),bytes);doc.discardSnapshot(undo);doc.discardSnapshot(redo);
    }finally{artifact.free();}
    console.log('PASS',format,kind,'target, parent/sibling, mixed formats, undo/redo, saved reopen');
   }finally{doc.free();}
  }
  const doc=new HwpDocument(save(template,format));
  try{
   const s=state(doc,format),child=s.structure.nestedTables[1],op={kind:'insert_table_row',target:child.id,index:2,values:['x','y']};
   assert.throws(()=>validateEditOperations([op,op],s));assert.throws(()=>apply(doc,s,{...op,index:3}));
   const mutate=doc.insertTextInCellByPath.bind(doc),bytes=save(doc,format);
   let calls=0;doc.insertTextInCellByPath=(...a)=>{if(++calls===2)throw Error('fault');return mutate(...a);};
   assert.throws(()=>apply(doc,s,op),/fault/);assert.deepEqual(save(doc,format),bytes);doc.insertTextInCellByPath=mutate;
   doc.setCellProperties(...args,child.ancestors[0].controlIndex,child.ancestors[0].cellIndex,'{"cellProtect":true}');
   const protectedBytes=save(doc,format);
   assert.throws(()=>apply(doc,s,op));assert.throws(()=>doc.editNestedTableAxis(...args,path(child,0),true,true,2));
   assert.deepEqual(save(doc,format),protectedBytes);
   console.log('PASS',format,'stale and protected ancestor refusal, atomic partial-write rollback');
  }finally{doc.free();}
 }
}finally{template.free();}

const deepTemplate=HwpDocument.createEmpty();deepTemplate.createBlankDocument();
deepTemplate.pasteHtml(0,0,0,`<table><tr><td>Outer<table><tr><td>Left${inner}</td><td>Right${inner}</td></tr></table></td></tr></table>`);
try{
 const doc=new HwpDocument(deepTemplate.exportHwpx());
 try{
  const s=state(doc,'hwpx'),deep=s.structure.nestedTables.filter(t=>t.ancestors.length===2);
  assert.equal(deep.length,2);
  const [sibling,target]=deep,op={kind:'insert_table_column',target:target.id,index:0,values:['앞','뒤']};
  apply(doc,s,op);
  const reopened=new HwpDocument(doc.exportHwpx());
  try{
   const edited=readStructure(reopened).nestedTables;
   assert.deepEqual(edited.find(t=>t.id===sibling.id),sibling);
   assert.deepEqual(edited.find(t=>t.id===target.id).cells.map(c=>c.text),['앞','a','b','뒤','c','d']);
  }finally{reopened.free();}
  console.log('PASS hwpx deep nested path with identical sibling grid');
 }finally{doc.free();}
}finally{deepTemplate.free();}
