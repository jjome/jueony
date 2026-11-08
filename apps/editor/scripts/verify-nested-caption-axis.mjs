import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {loadReviewEngine} from './lib/hancom-review.mjs';
import {nestedCaptionFixture} from './lib/nested-caption-fixture.mjs';
import {readOwnedZip} from './lib/owned-zip.mjs';
import {readStructure} from '../src/adapters/rhwp/structure.ts';
import {executeDocumentOperations} from '../src/adapters/rhwp/execute.ts';

const {HwpDocument}=await loadReviewEngine(resolve(process.env.JUEONY_ENGINE_PACKAGE));
const state=(d,ext)=>({name:'중첩 캡션.'+ext,revision:'v1',structure:readStructure(d),nodes:[],limitations:[]});
const nativePath=t=>JSON.stringify([...t.ancestors,{controlIndex:t.control,cellIndex:0,cellParaIndex:0}]);
function drawn(d){
 const rows=JSON.parse(d.getPageTextLayout(0)).runs.filter(r=>r.cellPath?.at(-1)?.cellIndex===65534);
 assert.deepEqual(rows.map(r=>[r.text,r.bold,r.charStart]),[['캡션 ',false,0],['제목',true,3]]);
 const [parent,sibling,target]=JSON.parse(d.getPageControlLayout(0)).controls;
 const story=JSON.parse(d.getDocumentStoryInformation()).paragraphs.filter(p=>p.story==='caption');
 assert.equal(story.length,1);assert.equal(story[0].text,'캡션 제목');
 const xml=readOwnedZip(d.exportHwpx()).find(([n])=>n==='Contents/section0.xml')[1].toString();
 const caption=xml.match(/<hp:caption [\s\S]*?<\/hp:caption>/g);assert.equal(caption.length,1);
 // Paragraph instance IDs can be reordered by the format writer.
 return {story,xml:caption[0].replace(/(<hp:p id=")\d+(")/g,'$1$2'),sibling,parent:parent.h,
  bottom:rows[0].y-target.y-target.h,top:target.y-rows[0].y-rows[0].h};
}
for(const ext of ['hwp','hwpx']){
 const save=d=>ext==='hwp'?d.exportHwp():d.exportHwpx();
 for(const [kind,index,values,direction] of [
  ['insert_table_row',1,['새 행',''], 'BOTTOM'],['delete_table_row',0,null,'TOP'],
  ['insert_table_column',1,['새 열',''],'TOP'],['delete_table_column',0,null,'BOTTOM']]){
  const seed=nestedCaptionFixture(HwpDocument,{direction}),d=new HwpDocument(save(seed));seed.free();
  try{
   const base=state(d,ext),[left,right]=base.structure.nestedTables,at=[right.section,right.paragraph,nativePath(right)];
   const before=drawn(d),snapshot=d.saveSnapshot(),bytes=save(d),props=JSON.parse(d.getTableAxisCaptionEvidenceByPath(...at));
   assert.equal(props.kind,'plain');assert.equal(props.direction,direction==='TOP'?'Top':'Bottom');assert.equal(props.text,'캡션 제목');
   assert.equal(right.axisEditable,true);
   executeDocumentOperations(d,base,[{kind,target:right.id,index,...(values?{values}:{})}]);
   const data=save(d),reopened=new HwpDocument(data);
   try{
    const [sibling,actual]=readStructure(reopened).nestedTables;assert.deepEqual(sibling,left);
    assert.equal(actual.rows,right.rows+(kind.endsWith('_row')?(values?1:-1):0));
    assert.equal(actual.columns,right.columns+(kind.endsWith('_column')?(values?1:-1):0));
    assert.deepEqual(JSON.parse(reopened.getTableAxisCaptionEvidenceByPath(...at)),props);
    for(const copy of [d,reopened]){
     const current=drawn(copy),gap=direction==='TOP'?'top':'bottom';
     assert.deepEqual(current.story,before.story);assert.deepEqual(current.sibling,before.sibling);
     assert.equal(current.xml,before.xml);assert.ok(Math.abs(current[gap]-before[gap])<=.21);
    }
   }finally{reopened.free();}
   const redo=d.saveSnapshot();d.restoreSnapshot(snapshot);assert.deepEqual(save(d),bytes);
   d.restoreSnapshot(redo);assert.deepEqual(save(d),data);d.discardSnapshot(snapshot);d.discardSnapshot(redo);
   console.log('PASS',ext,direction,kind,'caption path, source formatting, gap, sibling and saved model');
  }finally{d.free();}
 }
 const twins=nestedCaptionFixture(HwpDocument,{siblingCaption:true}),pair=new HwpDocument(save(twins));twins.free();
 try{
  const s=state(pair,ext),right=s.structure.nestedTables[1];
  const markers=d=>JSON.parse(d.getDocumentStoryInformation()).paragraphs.filter(p=>p.story==='caption');
  const original=markers(pair);assert.equal(original.length,2);assert.equal(original[0].text,original[1].text);
  assert.notEqual(original[0].path,original[1].path);
  executeDocumentOperations(pair,s,[{kind:'delete_table_column',target:right.id,index:0}]);
  const copy=new HwpDocument(save(pair));try{assert.deepEqual(markers(copy),original);}finally{copy.free();}
  console.log('PASS',ext,'duplicate sibling caption text resolved by its painted table owner');
 }finally{pair.free();}
 for(const options of [{complex:'empty'},{complex:'bookmark'}]){
  const seed=nestedCaptionFixture(HwpDocument,options),d=new HwpDocument(save(seed));seed.free();
  try{
   const [left,right]=readStructure(d).nestedTables,before=save(d),at=[right.section,right.paragraph,nativePath(right)];
   assert.ok(left.axisEditable);assert.ok(!right.axisEditable);
   assert.equal(JSON.parse(d.getTableAxisCaptionEvidenceByPath(...at)).kind,'complex');
   assert.throws(()=>d.editNestedTableAxis(...at,true,false,0));assert.deepEqual(save(d),before);
  }finally{d.free();}
 }
 const seed=nestedCaptionFixture(HwpDocument),d=new HwpDocument(save(seed));seed.free();
 try{
  const s=state(d,ext),t=s.structure.nestedTables[1],bytes=save(d),get=d.getTableAxisCaptionEvidenceByPath.bind(d);
  const edit=d.editNestedTableAxis.bind(d);let changed=false;
  d.editNestedTableAxis=(...args)=>{const result=edit(...args);changed=true;return result;};
  d.getTableAxisCaptionEvidenceByPath=(...args)=>{
   const value=JSON.parse(get(...args));return JSON.stringify(changed&&value?{...value,width:value.width+1}:value);
  };
  assert.throws(()=>executeDocumentOperations(d,s,[{kind:'delete_table_column',target:t.id,index:0}]),/캡션/);
  assert.deepEqual(save(d),bytes);
  console.log('PASS',ext,'empty and control-bearing captions refused; changed stored position rolled back');
 }finally{d.free();}
}
