import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {loadReviewEngine} from './lib/hancom-review.mjs';
import {nestedCaptionCursorFixture,probeNestedCaptionCursors} from './lib/nested-caption-cursor.mjs';
import {readStructure} from '../src/adapters/rhwp/structure.ts';
import {executeDocumentOperations} from '../src/adapters/rhwp/execute.ts';
const {HwpDocument}=await loadReviewEngine(resolve(process.env.JUEONY_ENGINE_PACKAGE));
for(const ext of ['hwp','hwpx'])for(const deep of [false,true]){
 const save=d=>ext==='hwp'?d.exportHwp():d.exportHwpx(),seed=nestedCaptionCursorFixture(HwpDocument,deep);
 const d=new HwpDocument(save(seed));seed.free();
 try{
  const bytes=save(d),owners=readStructure(d).nestedTables,before=probeNestedCaptionCursors(d,owners);
  assert.ok(before.some(r=>r.path.length===(deep?3:2)));
  const duplicate=before.filter(r=>r.text==='캡션 제목😀뒤');assert.equal(duplicate.length,deep?3:2);
  assert.equal(new Set(duplicate.map(r=>JSON.stringify(r.path))).size,duplicate.length);
  assert.equal(new Set(duplicate.map(r=>JSON.stringify(r.positions[0]))).size,duplicate.length);
  const target=before.find(r=>r.text===''),owner=owners.find(t=>t.id===target.owner),at=[owner.section,owner.paragraph,JSON.stringify(target.path)];
  assert.throws(()=>d.getCursorRectByPath(...at,1));
  assert.throws(()=>d.getCursorRectByPath(...at.slice(0,2),JSON.stringify([...target.path.slice(0,-1),{...target.path.at(-1),cellParaIndex:99}]),0));
  assert.throws(()=>d.getCursorRectByPath(...at.slice(0,2),JSON.stringify([{...target.path[0],cellIndex:999},...target.path.slice(1)]),0));
  let refused=false;
  try{const value=JSON.parse(d.insertTextInCellByPath(...at,0,'금지'));refused=value.ok!==true;}catch{refused=true;}
  assert.equal(refused,true);assert.deepEqual(save(d),bytes);
  const copy=new HwpDocument(bytes);try{assert.deepEqual(probeNestedCaptionCursors(copy,readStructure(copy).nestedTables),before);}finally{copy.free();}
  if(!deep){
   const structure=readStructure(d),table=structure.nestedTables[1];
   executeDocumentOperations(d,{name:'caption-cursor.'+ext,revision:'v1',structure,nodes:[],limitations:[]},
    [{kind:'insert_table_row',target:table.id,index:1,values:['추가','']}]);
   const after=readStructure(d);assert.equal(after.nestedTables[1].rows,table.rows+1);
   probeNestedCaptionCursors(d,after.nestedTables);
   const saved=new HwpDocument(save(d));
   try{probeNestedCaptionCursors(saved,readStructure(saved).nestedTables);}finally{saved.free();}
  }
  console.log('PASS',ext,deep?'three-level':'sibling','caption full paths, Korean/emoji/empty carets, invalid paths, mutation refusal and reopen');
 }finally{d.free();}
}
