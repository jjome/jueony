import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {loadReviewEngine} from './lib/hancom-review.mjs';
import {nestedClickHereFixture,rightSiblingLayout} from './lib/nested-click-here-fixture.mjs';
import {nestedNamedCellFixture} from './lib/nested-named-cell-fixture.mjs';
import {readOwnedZip,writeOwnedZip} from './lib/owned-zip.mjs';
import {readStructure} from '../src/adapters/rhwp/structure.ts';
import {executeDocumentOperations} from '../src/adapters/rhwp/execute.ts';
import {validateEditOperations} from '../src/modules/document/public/index.ts';

const {HwpDocument}=await loadReviewEngine(resolve(process.env.JUEONY_ENGINE_PACKAGE)),fixture=nestedClickHereFixture(HwpDocument);
const state=(d,ext)=>({name:'중첩 누름틀.'+ext,revision:'v1',structure:readStructure(d),nodes:[],limitations:[]});
const fields=d=>JSON.parse(d.getFieldList());
const path=(t,i,p=0)=>JSON.stringify([...t.ancestors,{controlIndex:t.control,cellIndex:i,cellParaIndex:p}]);
function paragraph(d,t,owner){
 const field=fields(d).find(f=>f.fieldId===owner.clickHereFieldIds[0]),at=[t.section,t.paragraph,path(t,owner.index)];
 const length=d.getCellParagraphLengthByPath(...at);
 return {shape:JSON.parse(d.getParaShapeSet(field.listId,0)),runs:JSON.parse(d.getCharShapeRunsInCellByPath(...at,0,length)),
  characters:Array.from({length},(_,i)=>JSON.parse(d.getCellCharPropertiesAtByPath(...at,i)))};
}

// Shift only the sole right inline table's 3000 HU host line across the
// declaration and require the full sibling to occupy the same parent row.
function adjacentHostHeight(archive,height){
 const parts=readOwnedZip(archive),section=parts.find(([n])=>n==='Contents/section0.xml'),xml=section[1].toString();
 const right=xml.indexOf('<hp:t>오른쪽</hp:t>'),start=xml.indexOf('</hp:tbl>',right),end=xml.indexOf('</hp:p>',start);
 assert.ok(right>=0&&end>start&&start>right);
 const tag=xml.slice(start,end),expected='vertsize="3000" textheight="3000"';
 assert.equal(tag.split(expected).length,2);
 section[1]=Buffer.from(xml.slice(0,start)+tag.replace(expected,`vertsize="${height}" textheight="${height}"`)+xml.slice(end));
 return writeOwnedZip(parts);
}
try{
 for(const ext of ['hwp','hwpx']){
  const save=d=>ext==='hwp'?d.exportHwp():d.exportHwpx();
  for(const [kind,index,values,row,col,span,selected=0] of [
   ['insert_table_row',0,['X','Y'],1,1,2],['delete_table_row',0,null,0,1,1,1],['delete_table_row',0,null,0,1,1],
   ['insert_table_column',1,['X','Y','Z'],0,2,2],['delete_table_column',0,null,0,0,2]]){
   const doc=new HwpDocument(save(fixture));
   try{
    const s=state(doc,ext),tables=s.structure.nestedTables;
    const first=tables[selected],other=tables[1-selected],source=first.cells[1],original=fields(doc);
    assert.equal(first.axisEditable,true);assert.equal(source.fieldName,undefined);assert.equal(source.clickHereFieldIds.length,2);
    assert.equal(original.length,6);assert.equal(new Set(original.map(f=>f.fieldId)).size,6);
    const before=save(doc),style=paragraph(doc,first,source),undo=doc.saveSnapshot();
    const rightLayout=selected===0&&kind==='delete_table_row'?rightSiblingLayout(doc):undefined;
    if(selected===0)assert.equal(style.characters[1].italic,true);
    executeDocumentOperations(doc,s,[{kind,target:first.id,index,...(values?{values}:{})}]);
    const saved=save(doc),copy=new HwpDocument(saved);
    try{
     if(rightLayout){assert.deepEqual(rightSiblingLayout(doc),rightLayout);assert.deepEqual(rightSiblingLayout(copy),rightLayout);}
     const actualTables=readStructure(copy).nestedTables,edited=actualTables[selected],sibling=actualTables[1-selected];
     const owner=edited.cells.find(c=>c.row===row&&c.column===col);
     assert.deepEqual(sibling,other);assert.equal(owner.rowSpan,span);assert.equal(owner.text,source.text);
     assert.deepEqual(owner.clickHereFieldIds,source.clickHereFieldIds);
     assert.deepEqual(paragraph(copy,edited,owner),style);
     const stored=fields(copy);assert.equal(stored.length,original.length);
     for(const previous of original){
      const current=stored.find(f=>f.fieldId===previous.fieldId),expected=structuredClone(previous);
      if(source.clickHereFieldIds.includes(previous.fieldId))expected.location.path.at(-1).cellIndex=owner.index;
      assert.deepEqual({...current,listId:0},{...expected,listId:0});
      assert.equal(JSON.parse(copy.getFieldValue(previous.fieldId)).value,previous.value);
     }
     if(kind==='insert_table_row'){
      const leftId=source.clickHereFieldIds.find(id=>stored.find(f=>f.fieldId===id).value==='좌😀');
      assert.ok(JSON.parse(copy.setFieldValue(leftId,'왼쪽만')).ok);
      assert.equal(fields(copy).find(f=>f.fieldId===leftId).value,'왼쪽만');
      assert.ok(fields(copy).some(f=>f.name==='공통 이름'&&f.value==='우😀'));
     }
    }finally{copy.free();}
    const redo=doc.saveSnapshot();doc.restoreSnapshot(undo);assert.deepEqual(save(doc),before);
    doc.restoreSnapshot(redo);assert.deepEqual(save(doc),saved);doc.discardSnapshot(redo);doc.discardSnapshot(undo);
    console.log('PASS',ext,kind,selected===0?'left':'right','stored IDs, moved ranges, parent/sibling and undo/redo');
   }finally{doc.free();}
  }
  const base=new HwpDocument(fixture.exportHwp());
  try{
   const archive=base.exportHwpx(),heights=[];
   for(const hostHeight of [2999,3000,3001]){
    const source=new HwpDocument(adjacentHostHeight(archive,hostHeight)),doc=new HwpDocument(save(source));source.free();
    try{
     const s=state(doc,ext),[left]=s.structure.nestedTables,original=rightSiblingLayout(doc);
     executeDocumentOperations(doc,s,[{kind:'delete_table_row',target:left.id,index:0}]);
     const copy=new HwpDocument(save(doc));
     try{assert.deepEqual(rightSiblingLayout(copy),original);heights.push(original.parentHeight);}finally{copy.free();}
    }finally{doc.free();}
   }
   assert.ok(Math.max(...heights)-Math.min(...heights)<0.2,`one HU changed the parent row: ${heights}`);
   console.log('PASS',ext,'parent and fully painted sibling after left row deletion for 2999/3000/3001 HU');
  }finally{base.free();}
  const doc=new HwpDocument(save(fixture));
  try{
   const s=state(doc,ext),[left,right]=s.structure.nestedTables,before=save(doc),op={kind:'delete_table_column',target:left.id,index:1};
   assert.throws(()=>validateEditOperations([op],s),/필드/);
   assert.throws(()=>doc.editNestedTableAxis(left.section,left.paragraph,path(left,0),false,false,1));assert.deepEqual(save(doc),before);
   const update={kind:'delete_table_row',target:left.id,index:0},native=doc.editNestedTableAxis.bind(doc),id=right.cells[1].clickHereFieldIds[0];
   doc.editNestedTableAxis=(...args)=>{const res=native(...args);doc.setFieldValue(id,'손상');return res;};
   assert.throws(()=>executeDocumentOperations(doc,s,[update]));assert.deepEqual(save(doc),before);
   doc.editNestedTableAxis=native;
   const read=doc.getFieldInfoAtByPath.bind(doc);doc.getFieldInfoAtByPath=(...args)=>{const info=JSON.parse(read(...args));return JSON.stringify({...info,fieldId:0});};
   assert.ok(!state(doc,ext).structure.nestedTables[0].axisEditable);doc.getFieldInfoAtByPath=read;
   doc.insertClickHereFieldByPath(left.section,left.paragraph,path(left,1),0,'인접','','공통 이름',true);
   const ambiguous=save(doc);assert.ok(!state(doc,ext).structure.nestedTables[0].axisEditable);
   assert.throws(()=>doc.editNestedTableAxis(left.section,left.paragraph,path(left,0),true,false,0));assert.deepEqual(save(doc),ambiguous);
   console.log('PASS',ext,'owner deletion, adjacent ranges and ID mismatch refused; sibling mutation rolled back');
  }finally{doc.free();}
  const namedTemplate=nestedNamedCellFixture(HwpDocument),t=state(namedTemplate,ext).structure.nestedTables[1];
  const marker=JSON.parse(namedTemplate.insertClickHereFieldByPath(t.section,t.paragraph,path(t,1),2,'안내','','공통 이름',true));
  namedTemplate.setFieldValue(marker.fieldId,'입력');const mixed=new HwpDocument(save(namedTemplate));namedTemplate.free();
  try{
   const s=state(mixed,ext),target=s.structure.nestedTables[1],op={kind:'delete_table_column',target:target.id,index:0};
   const originalLayout=rightSiblingLayout(mixed);
   executeDocumentOperations(mixed,s,[op]);const reopened=new HwpDocument(save(mixed));
   try{
    const [outer,,right]=JSON.parse(reopened.getPageControlLayout(0)).controls,tail=right.cells.find(c=>c.row===2&&c.col===0);
    assert.equal(outer.h,originalLayout.parentHeight);assert.equal(right.h,originalLayout.table.h);
    assert.ok(tail);assert.equal(tail.h,originalLayout.table.cells.at(-1).h);
    assert.ok(JSON.parse(reopened.getPageTextLayout(0)).runs.some(r=>r.text==='F'&&r.cellPath?.length===2
      &&r.cellPath[0].cellIndex===1&&r.cellPath[1].cellIndex===tail.cellIdx));
    const belongs=f=>f.location.path?.length===2&&f.location.path[0].cellIndex===1&&f.location.path[1].cellIndex===0;
    const owned=fields(reopened).filter(belongs);
    assert.equal(owned.length,2);assert.equal(owned.find(f=>f.cellField).value,'Be입력ta');
    const actual=owned.find(f=>!f.cellField);assert.equal(actual.fieldId,marker.fieldId);assert.equal(actual.value,'입력');
    assert.deepEqual(owned.map(f=>f.name),['공통 이름','공통 이름']);
   }finally{reopened.free();}
   console.log('PASS',ext,'named cell and same-name stored field move together with independent values');
  }finally{mixed.free();}
 }
}finally{fixture.free();}
