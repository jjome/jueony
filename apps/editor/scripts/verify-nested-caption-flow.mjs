import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {loadReviewEngine} from './lib/hancom-review.mjs';
import {nestedCaptionFixture} from './lib/nested-caption-fixture.mjs';
import {readOwnedZip} from './lib/owned-zip.mjs';
import {readStructure} from '../src/adapters/rhwp/structure.ts';
import {executeDocumentOperations} from '../src/adapters/rhwp/execute.ts';

const {HwpDocument}=await loadReviewEngine(resolve(process.env.JUEONY_ENGINE_PACKAGE));
const snapshot=(d,ext)=>({name:'중첩 여러 줄.'+ext,revision:'v1',structure:readStructure(d),nodes:[],limitations:[]});
const path=t=>JSON.stringify([...t.ancestors,{controlIndex:t.control,cellIndex:0,cellParaIndex:0}]);
const witness=d=>JSON.parse(d.getDocumentStoryInformation()).paragraphs.filter(p=>p.story==='caption');
const axisProof=(d,t)=>JSON.parse(d.getTableAxisCaptionEvidenceByPath(t.section,t.paragraph,path(t)));
const close=(a,b)=>assert.ok(Math.abs(a-b)<=.21,`${a} differs from ${b}`);
function rendered(d,direction,align){
 const [,sibling,table]=JSON.parse(d.getPageControlLayout(0)).controls;
 const all=JSON.parse(d.getPageTextLayout(0)).runs.filter(r=>r.cellPath?.at(-1)?.cellIndex===65534);
 // The fixture paints the left host before the right one. With twins, check
 // the first caption against its own table independently of the target.
 const other=all.slice(0,-5),runs=all.slice(-5);
 assert.equal(other.length,direction==='BOTTOM'?5:0);
 if(other.length)close(other[0].y-sibling.y-sibling.h,283*96/7200);
 assert.deepEqual(runs.map(r=>[r.text,r.bold,r.cellPath.at(-1).cellParaIndex,r.charStart]),[
  ['캡션 ',false,0,0],['제목😀',true,0,3],['뒤',true,0,6],['둘째 ',false,1,0],['설명',true,1,3]
 ]);
 const first=runs[0],last=runs.at(-1),end=last.y+last.h,height=end-first.y;
 const gap={TOP:table.y-end,BOTTOM:first.y-table.y-table.h,LEFT:table.x-first.x-8504*96/7200,RIGHT:first.x-table.x-table.w}[direction];
 close(gap,283*96/7200);
 if(['LEFT','RIGHT'].includes(direction)){
  const slack=Math.max(0,table.h-height);close(first.y-table.y,align==='CENTER'?slack/2:align==='BOTTOM'?slack:0);
 }
 const part=readOwnedZip(d.exportHwpx()).find(([n])=>n==='Contents/section0.xml')[1].toString();
 const captions=part.match(/<hp:caption [\s\S]*?<\/hp:caption>/g).map(c=>c.replace(/(<hp:p id=")\d+(")/g,'$1$2'));
 return {sibling,other,captions,points:runs.map(r=>[r.x-first.x,r.y-first.y,r.w,r.h])};
}
for(const ext of ['hwp','hwpx']){
 const save=d=>ext==='hwp'?d.exportHwp():d.exportHwpx();
 for(const [direction,align,kind,index] of [['TOP','TOP','insert_table_row',1],['BOTTOM','TOP','delete_table_row',0],
  ['LEFT','CENTER','delete_table_column',0],['LEFT','CENTER','delete_table_row',1],['RIGHT','BOTTOM','insert_table_column',1]]){
  const siblings=direction==='BOTTOM',tall=direction==='LEFT'||direction==='RIGHT';
  const seed=nestedCaptionFixture(HwpDocument,{direction,align,multiline:true,extraParagraph:true,compact:true,tall,siblingCaption:siblings});
  const d=new HwpDocument(save(seed));seed.free();
  try{
   const s=snapshot(d,ext),t=s.structure.nestedTables[1],proof=axisProof(d,t),stories=witness(d),before=rendered(d,direction,align);
   assert.equal(t.axisEditable,true);assert.equal(proof.kind,'paragraphs');
   assert.deepEqual(proof.paragraphs.map(p=>[p.text,p.runs.map(r=>r.start_pos),p.lines.map(l=>l.text_start)]),
    [['캡션 제목😀뒤',[0,3],[0,7]],['둘째 설명',[0,3],[0]]]);
   assert.equal(stories.length,siblings?4:2);
   const count=kind.endsWith('_column')?t.rows:t.columns,values=Array.from({length:count},(_,i)=>'추가'+i);
   const sn=d.saveSnapshot(),original=save(d);
   executeDocumentOperations(d,s,[{kind,target:t.id,index,...(kind.startsWith('insert')?{values}:{})}]);
   const bytes=save(d),copy=new HwpDocument(bytes);
   try{for(const doc of [d,copy]){
    const actual=readStructure(doc).nestedTables[1],draw=rendered(doc,direction,align);
    assert.equal(actual.rows,t.rows+(kind.endsWith('_row')?(kind.startsWith('insert')?1:-1):0));
    assert.equal(actual.columns,t.columns+(kind.endsWith('_column')?(kind.startsWith('insert')?1:-1):0));
    assert.deepEqual(axisProof(doc,actual),proof);assert.deepEqual(witness(doc),stories);
    assert.deepEqual(draw.captions,before.captions);assert.deepEqual(draw.other,before.other);assert.deepEqual(draw.sibling,before.sibling);
    draw.points.forEach((point,i)=>point.forEach((v,j)=>close(v,before.points[i][j])));
   }}finally{copy.free();}
   const redo=d.saveSnapshot();d.restoreSnapshot(sn);assert.deepEqual(save(d),original);d.restoreSnapshot(redo);assert.deepEqual(save(d),bytes);
   d.discardSnapshot(redo);d.discardSnapshot(sn);
   console.log('PASS',ext,direction,align,kind,'two paragraphs, three lines, formatting, placement and reopen');
  }finally{d.free();}
 }
 const seed=nestedCaptionFixture(HwpDocument,{direction:'RIGHT',compact:false}),outside=new HwpDocument(save(seed));seed.free();
 try{const s=snapshot(outside,ext),t=s.structure.nestedTables[1],bytes=save(outside);
  assert.throws(()=>executeDocumentOperations(outside,s,[{kind:'delete_table_column',target:t.id,index:0}]),/캡션/);
  assert.deepEqual(save(outside),bytes);
 }finally{outside.free();}
 const sample=nestedCaptionFixture(HwpDocument,{direction:'BOTTOM',compact:true,multiline:true,extraParagraph:true}),d=new HwpDocument(save(sample));sample.free();
 try{const s=snapshot(d,ext),t=s.structure.nestedTables[1],bytes=save(d),render=d.getPageRenderTree.bind(d),edit=d.editNestedTableAxis.bind(d);let changed=false;
  // Narrowing the table changes the space between the two styled runs of
  // its justified first line, even though the text and line breaks survive.
  assert.throws(()=>executeDocumentOperations(d,s,[{kind:'delete_table_column',target:t.id,index:0}]),/캡션/);
  assert.deepEqual(save(d),bytes);
  d.editNestedTableAxis=(...args)=>{const reply=edit(...args);changed=true;return reply;};
  d.getPageRenderTree=(...args)=>{const root=JSON.parse(render(...args));
   function move(n){if(n.captionOwner?.captionOrdinal===1)n.bbox.y+=2;for(const c of n.children??[])move(c);}
   if(changed)move(root);return JSON.stringify(root);
  };
  assert.throws(()=>executeDocumentOperations(d,s,[{kind:'delete_table_row',target:t.id,index:0}]),/캡션/);
  assert.equal(changed,true);
  assert.deepEqual(save(d),bytes);
  // A live Canvas view can stay unchanged while portable evidence fails.
  // Check that the second measurement pass also rejects and restores both
  // the original document bytes and the active view's metric selection.
  let canvas=true;changed=false;
  d.canvasMetricsActive=()=>canvas;
  d.selectCanvasMetrics=enabled=>{canvas=enabled;return true;};
  d.getPageRenderTree=(...args)=>{
   const root=JSON.parse(render(...args));
   function move(n){if(n.captionOwner?.captionOrdinal===1)n.bbox.y+=2;for(const c of n.children??[])move(c);}
   if(changed&&!canvas)move(root);return JSON.stringify(root);
  };
  assert.throws(()=>executeDocumentOperations(d,s,[{kind:'delete_table_row',target:t.id,index:0}]),/캡션/);
  assert.equal(changed,true);assert.equal(canvas,true);assert.deepEqual(save(d),bytes);
  console.log('PASS',ext,'off-page side caption refused; changed justification and displaced later caption line rolled back');
  console.log('PASS',ext,'portable caption mismatch rolled back and Canvas metric selection restored');
 }finally{d.free();}
}
