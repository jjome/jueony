import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {loadReviewEngine} from './lib/hancom-review.mjs';
import {nestedCaptionFixture} from './lib/nested-caption-fixture.mjs';
import {readOwnedZip,writeOwnedZip} from './lib/owned-zip.mjs';
import {readStructure} from '../src/adapters/rhwp/structure.ts';
import {executeDocumentOperations} from '../src/adapters/rhwp/execute.ts';
import {readNestedAxisCaptions,sameNestedCaptionPlacement} from '../src/adapters/rhwp/nested-axis-captions.ts';

const {HwpDocument}=await loadReviewEngine(resolve(process.env.JUEONY_ENGINE_PACKAGE));
const state=(d,ext)=>({name:'빈 줄 중첩 캡션.'+ext,revision:'v1',structure:readStructure(d),nodes:[],limitations:[]});
const path=t=>JSON.stringify([...t.ancestors,{controlIndex:t.control,cellIndex:0,cellParaIndex:0}]);
const stories=d=>JSON.parse(d.getDocumentStoryInformation()).paragraphs.filter(p=>p.story==='caption');
function inspect(d,table,count,multiline){
 const source=JSON.parse(d.getTableAxisCaptionEvidenceByPath(table.section,table.paragraph,path(table)));
 assert.equal(source.kind,'paragraphs');
 assert.deepEqual(source.paragraphs.map(p=>p.text),[multiline?'캡션 제목😀뒤':'캡션 제목',...Array(count).fill(''),'둘째 설명']);
 for(const p of source.paragraphs.filter(p=>p.text==='')){
  assert.deepEqual(p.runs.map(r=>r.start_pos),[0]);assert.deepEqual(p.lines.map(l=>l.text_start),[0]);
  assert.equal(p.lines[0].line_height,1000);assert.equal(p.lines[0].line_spacing,600);
 }
 const controls=JSON.parse(d.getPageControlLayout(0)).controls,owner=controls[2];
 const runs=JSON.parse(d.getPageTextLayout(0)).runs.filter(r=>r.cellPath?.at(-1)?.cellIndex===65534).slice(-(multiline?5+count:4+count));
 const blanks=runs.filter(r=>r.text==='');
 assert.equal(blanks.length,count);
 for(const [i,r] of blanks.entries()){
  assert.equal(r.cellPath.at(-1).cellParaIndex,i+1);assert.equal(r.charStart,0);assert.equal(r.bold,true);assert.deepEqual(r.charX,[0]);
  assert.equal(r.charShapeId,source.paragraphs[i+1].runs[0].char_shape_id);
  assert.equal(r.paraShapeId,source.paragraphs[i+1].paragraphShape);
  assert.ok(Math.abs(r.h-1000/75)<.11);
 }
 const lines=[...new Set(runs.map(r=>r.y))];
 assert.equal(lines.length,count+(multiline?3:2));
 for(let i=1;i<lines.length;i++)assert.ok(Math.abs(lines[i]-lines[i-1]-1600/75)<.11);
 const bottom=Math.max(...runs.map(r=>r.y+r.h));
 if(source.direction==='Top')assert.ok(Math.abs(owner.y-bottom-283/75)<.21);
 if(source.direction==='Bottom')assert.ok(Math.abs(runs[0].y-owner.y-owner.h-283/75)<.21);
 const xml=readOwnedZip(d.exportHwpx()).find(([n])=>n==='Contents/section0.xml')[1].toString();
 return {source,stories:stories(d),xml:xml.match(/<hp:caption [\s\S]*?<\/hp:caption>/g).map(s=>s.replace(/(<hp:p id=")\d+(")/g,'$1$2')),
  sibling:controls[1],evidence:readNestedAxisCaptions(d,readStructure(d),table)};
}
for(const ext of ['hwp','hwpx']){
 const save=d=>ext==='hwp'?d.exportHwp():d.exportHwpx();
 for(const [direction,kind,count,multiline,align] of [
  ['TOP','insert_table_row',1,true,'TOP'],['BOTTOM','delete_table_row',2,false,'TOP'],
  ['LEFT','delete_table_column',1,true,'CENTER'],['RIGHT','insert_table_column',1,false,'BOTTOM'],
  ['TOP','delete_table_column',1,false,'TOP']
 ]){
  const seed=nestedCaptionFixture(HwpDocument,{direction,extraParagraph:true,emptyParagraphs:count,multiline,compact:true,
   tall:direction==='LEFT'||direction==='RIGHT',siblingCaption:direction==='BOTTOM',align});
  const d=new HwpDocument(save(seed));seed.free();
  try{
   const snapshot=state(d,ext),t=snapshot.structure.nestedTables[1],before=inspect(d,t,count,multiline),bytes=save(d),undo=d.saveSnapshot();
   assert.equal(t.axisEditable,true);
   const insert=kind.startsWith('insert'),row=kind.endsWith('_row'),index=insert?1:0;
   const values=Array.from({length:row?t.columns:t.rows},(_,i)=>'새 칸 '+i);
   executeDocumentOperations(d,snapshot,[{kind,target:t.id,index,...(insert?{values}:{})}]);
   const output=save(d),reopened=new HwpDocument(output);
   try{for(const doc of [d,reopened]){
    const actual=readStructure(doc).nestedTables[1],after=inspect(doc,actual,count,multiline);
    assert.equal(actual.rows,t.rows+(row?(insert?1:-1):0));
    assert.equal(actual.columns,t.columns+(row?0:(insert?1:-1)));
    assert.deepEqual(after.source,before.source);assert.deepEqual(after.stories,before.stories);
    assert.deepEqual(after.xml,before.xml);assert.deepEqual(after.sibling,before.sibling);
    assert.ok(sameNestedCaptionPlacement(before.evidence,after.evidence));
   }}finally{reopened.free();}
   const redo=d.saveSnapshot();d.restoreSnapshot(undo);assert.deepEqual(save(d),bytes);
   d.restoreSnapshot(redo);assert.deepEqual(save(d),output);d.discardSnapshot(undo);d.discardSnapshot(redo);
   console.log('PASS',ext,direction,kind,count,'blank paragraphs, caret format, line spacing, undo/redo and reopen');
  }finally{d.free();}
 }
 const seed=nestedCaptionFixture(HwpDocument,{direction:'BOTTOM',extraParagraph:true,emptyParagraphs:1,compact:true});
 const d=new HwpDocument(save(seed));seed.free();
 try{
  const snapshot=state(d,ext),t=snapshot.structure.nestedTables[1],bytes=save(d),edit=d.editNestedTableAxis.bind(d),layout=d.getPageTextLayout.bind(d);
  let changed=false;
  d.editNestedTableAxis=(...args)=>{const result=edit(...args);changed=true;return result;};
  d.getPageTextLayout=(...args)=>{const value=JSON.parse(layout(...args));
   if(changed)for(const r of value.runs)if(r.cellPath?.at(-1)?.cellIndex===65534&&r.text==='')r.charX=[2];
   return JSON.stringify(value);
  };
  assert.throws(()=>executeDocumentOperations(d,snapshot,[{kind:'delete_table_row',target:t.id,index:0}]),/캡션/);
  assert.equal(changed,true);assert.deepEqual(save(d),bytes);
  console.log('PASS',ext,'changed blank-line caret rejected with byte-identical rollback');
 }finally{d.free();}
 const seedMissing=nestedCaptionFixture(HwpDocument,{extraParagraph:true,emptyParagraphs:1,compact:true}),parts=readOwnedZip(seedMissing.exportHwpx());seedMissing.free();
 const section=parts.find(([n])=>n==='Contents/section0.xml');
 const originalXml=section[1].toString();let removed=0;
 const stripped=originalXml.replace(/<hp:caption\b[\s\S]*?<\/hp:caption>/,caption=>caption.replace(/<hp:p\b[^>]*>[\s\S]*?<\/hp:p>/g,paragraph=>{
  if(!/<hp:t(?:\/>|><\/hp:t>)/.test(paragraph))return paragraph;
  removed++;return paragraph.replace(/<hp:linesegarray>[\s\S]*?<\/hp:linesegarray>/,'');
 }));
 assert.equal(removed,1);assert.notEqual(stripped,originalXml);section[1]=Buffer.from(stripped);
 const missing=new HwpDocument(writeOwnedZip(parts)),copy=new HwpDocument(save(missing));missing.free();
 try{
  const t=readStructure(copy).nestedTables[1],bytes=save(copy);
  assert.ok(!t.axisEditable);
  assert.throws(()=>copy.editNestedTableAxis(t.section,t.paragraph,path(t),true,false,0));
  assert.deepEqual(save(copy),bytes);
  console.log('PASS',ext,'blank paragraph without stored line geometry refused');
 }finally{copy.free();}
}
