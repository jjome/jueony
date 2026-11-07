import assert from 'node:assert/strict';
import {nestedNamedCellFixture} from './nested-named-cell-fixture.mjs';
import {readStructure} from '../../src/adapters/rhwp/structure.ts';

/** The two sibling tables share cell coordinates and field names. Their first
 * paragraph values differ; a third field in the parent cell stays in place. */
export function nestedClickHereFixture(HwpDocument){
 const d=nestedNamedCellFixture(HwpDocument);
 try{
  assert.equal(JSON.parse(d.renameField('공통 이름','')).renamed,2);
  const [left,right]=readStructure(d).nestedTables;
  const add=(table,steps,pos,value)=>{
   const created=JSON.parse(d.insertClickHereFieldByPath(table.section,table.paragraph,JSON.stringify(steps),pos,'입력 안내','도움말','공통 이름',true));
   assert.ok(created.ok);
   if(value)assert.ok(JSON.parse(d.setFieldValue(created.fieldId,value)).ok);
  };
  const leaf=(t,p)=>[...t.ancestors,{controlIndex:t.control,cellIndex:1,cellParaIndex:p}];
  add(left,[{...left.ancestors[0],cellParaIndex:0}],1,'부모');
  add(left,leaf(left,0),4,'');add(left,leaf(left,0),1,'좌😀');
  add(right,leaf(right,0),1,'우😀');add(right,leaf(right,1),2,'');
  d.applyCharFormatInCellByPath(left.section,left.paragraph,JSON.stringify(leaf(left,0)),1,3,'{"italic":true}');
  return d;
 }catch(e){d.free();throw e;}
}

export function rightSiblingLayout(doc){
 const [parent,,table]=JSON.parse(doc.getPageControlLayout(0)).controls;
 const runs=JSON.parse(doc.getPageTextLayout(0)).runs.filter(r=>r.cellPath?.length===2&&r.cellPath[0].cellIndex===1);
 assert.equal(table.rowCount,3);assert.equal(table.cells.length,5);
 const last=table.cells.filter(c=>c.row===2);
 assert.deepEqual(last.map(c=>c.col),[0,1]);
 for(const c of last)assert.ok(Math.abs(c.h-table.cells[0].h)<0.2,'last row must have its full declared track');
 assert.deepEqual(runs.filter(r=>last.some(c=>c.cellIdx===r.cellPath[1].cellIndex)).map(r=>r.text),['E','F']);
 return {parentHeight:parent.h,table,runs};
}
