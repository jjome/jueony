import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {inflateRawSync} from 'node:zlib';
import {createPictureFieldParagraph,mixedPictureFieldArgs as args,mixedPictureFieldText,multiplePictureFieldText,inspectMixedPictureFields} from './lib/cell-paragraph-picture-fields.mjs';
import {readStructure} from '../src/adapters/rhwp/structure.ts';
import {readCellParagraphSources} from '../src/adapters/rhwp/cell-paragraph.ts';
import {executeDocumentOperations} from '../src/adapters/rhwp/execute.ts';
import {validateEditOperations} from '../src/modules/document/public/index.ts';

const pkg=resolve(process.env.JUEONY_ENGINE_PACKAGE),out=resolve(process.env.JUEONY_TEST_OUTPUT??'build/cell-paragraph-picture-fields');
await mkdir(out,{recursive:true});
const {default:init,HwpDocument}=await import(pathToFileURL(pkg+'/rhwp.js'));
await init({module_or_path:await readFile(pkg+'/rhwp_bg.wasm')});
const json=v=>typeof v==='string'?JSON.parse(v):v,results=[];
const pattern=process.env.JUEONY_CASE_PATTERN?new RegExp(process.env.JUEONY_CASE_PATTERN,'u'):undefined;
const snap=(d,name)=>{const structure=readStructure(d);return {revision:'r1',name,nodes:[],limitations:[],structure,cellParagraphSources:readCellParagraphSources(d,structure.tables,name)};};
const paragraph=s=>s.cellParagraphSources.s0p1t0.cells?.find(c=>c.index===4)?.paragraphs.find(p=>p.index===0);
const command=(s,text)=>({kind:'replace_cell_paragraph',target:'s0p1t0',row:1,column:1,paragraph:0,originalText:paragraph(s)?.text,text});
function candidate(d,s,op){const token=d.saveSnapshot();try{validateEditOperations([op],s);return executeDocumentOperations(d,s,[op]);}catch(error){d.restoreSnapshot(token);throw error;}finally{d.discardSnapshot(token);}}
function resources(bytes){
 const b=Buffer.from(bytes),map={};let at=0;
 while(at+30<b.length&&b.readUInt32LE(at)===0x04034b50){
  const method=b.readUInt16LE(at+8),size=b.readUInt32LE(at+18),nameLength=b.readUInt16LE(at+26),extra=b.readUInt16LE(at+28);
  const name=b.subarray(at+30,at+30+nameLength).toString(),start=at+30+nameLength+extra;
  assert.equal(b.readUInt16LE(at+6)&8,0);
  if(name==='Contents/header.xml'||name.startsWith('BinData/'))map[name]=(method===0?b.subarray(start,start+size):inflateRawSync(b.subarray(start,start+size))).toString('base64');
  at=start+size;
 }
 assert.ok(map['Contents/header.xml']);return map;
}
for(const format of ['hwp','hwpx']){
 if(pattern&&!pattern.test(format+' mixed picture-field suffix and picture gaps'))continue;
 const template=await createPictureFieldParagraph(HwpDocument,resolve(out,'fixture-'+format));
 const save=d=>format==='hwp'?d.exportHwp():d.exportHwpx(),original=save(template);template.free();
 const d=new HwpDocument(original),name='그림 누름틀.'+format;
 try{
  const before=save(d),undo=d.saveSnapshot(),originalFields=json(d.getFieldList()),originalAssets=resources(d.exportHwpx());
  const sourceFile=resolve(out,'before.'+format);await writeFile(sourceFile,before);
  const nativeSource=inspectMixedPictureFields(sourceFile),anchors=Array.from(d.getCellPictureTextAnchors(...args)??[]);
  assert.deepEqual(anchors,[10,16,17]);assert.equal(originalFields[0].value,'필드😀');
  const s=snap(d,name),p=paragraph(s);
  assert.equal(s.cellParagraphSources.s0p1t0.editable,true);
  assert.equal(p.text,mixedPictureFieldText);assert.equal(p.editableFrom,18);
  assert.deepEqual(p.pictureTextRanges,[{start:5,end:9},{start:11,end:15}]);
  // This remains excluded from the structural axis capability.
  assert.equal(s.structure.tables[0].cells[4].axisPicture,undefined);
  for(const [label,text] of [
   ['field value',p.text.replace('필드😀','변경😀')],
   ['field end guard',p.text.replace('😀 뒤','😀새뒤')],
   ['overlapping boundary',p.text.replace('필드😀 뒤문구','필드대체')],
  ]){
   assert.throws(()=>candidate(d,s,command(s,text)),undefined,label);
   assert.deepEqual(save(d),before,label+' rollback');
  }
  let text=p.text,anchorShift=0;
  for(const [label,from,to] of [['suffix','일반문구','수정문구'],['before-picture','뒤문구','새문구추가'],['between-pictures','중간문구','변경문구']]){
   const current=snap(d,name);text=text.replace(from,to);candidate(d,current,command(current,text));
   if(label==='before-picture')anchorShift=2;
   const file=resolve(out,label+'.'+format);await writeFile(file,save(d));
   assert.deepEqual(inspectMixedPictureFields(file),nativeSource.map(c=>c.row===1&&c.col===1?{...c,text,
    slots:c.slots.map(s=>s.kind===11?{...s,offset:s.offset+anchorShift,utf16Offset:s.utf16Offset+anchorShift}:s)}:c));
   const reopened=new HwpDocument(await readFile(file));
   try{
    assert.equal(reopened.getTextInCell(...args,0,reopened.getCellParagraphLength(...args)),text);
    assert.deepEqual(json(reopened.getFieldList()),originalFields);
    assert.equal(json(reopened.getFieldValue(originalFields[0].fieldId)).value,'필드😀');
    assert.equal(json(reopened.getCellCharPropertiesAt(...args,1)).textColor,'#246789');
    assert.deepEqual(Array.from(reopened.getCellPictureTextAnchors(...args)),anchors.map(a=>a+anchorShift));
    assert.deepEqual(resources(reopened.exportHwpx()),originalAssets);
   }finally{reopened.free();}
  }
  const saved=save(d),redo=d.saveSnapshot();d.restoreSnapshot(undo);assert.deepEqual(save(d),before);
  d.restoreSnapshot(redo);assert.deepEqual(save(d),saved);d.discardSnapshot(undo);d.discardSnapshot(redo);
  const latest=snap(d,name),lookup=d.getFieldValue.bind(d);
  d.getFieldValue=id=>id===originalFields[0].fieldId?JSON.stringify({ok:true,value:'다른 값'}):lookup(id);
  assert.equal(snap(d,name).cellParagraphSources.s0p1t0.editable,false);
  d.getFieldValue=lookup;
  // A valid source and mutation still cannot accept a reopened foreign field ID.
  d.constructor=function(bytes){const copy=new HwpDocument(bytes),read=copy.getFieldValue.bind(copy);copy.getFieldValue=id=>id===originalFields[0].fieldId?JSON.stringify({ok:true,value:'다른 값'}):read(id);return copy;};
  assert.throws(()=>candidate(d,latest,command(latest,text.replace('수정문구','최종문구'))));
  assert.deepEqual(save(d),saved);d.constructor=HwpDocument;
  for(const properties of [{fieldName:'문단 전체 필드'},{cellProtect:true}]){
   const guarded=new HwpDocument(before);
   try{assert.equal(json(guarded.setCellProperties(0,1,0,4,JSON.stringify(properties))).ok,true);assert.equal(snap(guarded,name).cellParagraphSources.s0p1t0.editable,false);}
   finally{guarded.free();}
  }
  for(const mode of ['empty','enclosing']){
   const src=await createPictureFieldParagraph(HwpDocument,resolve(out,mode+'-'+format),mode),guarded=new HwpDocument(save(src));src.free();
   try{
    assert.equal(guarded.getCellPictureTextAnchors(...args),undefined,mode+' anchors');
    assert.equal(snap(guarded,name).cellParagraphSources.s0p1t0.editable,false,mode+' owner');
   }finally{guarded.free();}
  }
  results.push({format,edits:3,allPictureAnchorsShiftedBy:anchorShift,rejectedEdits:3,undoRedo:true,reopenedFieldIdentityFault:true,foreignLookup:true,namedOwnerRejected:true,protectedOwnerRejected:true,emptyAndEnclosingFieldsRejected:true});
  console.log('PASS',format,'mixed picture/ClickHere: suffix, before/between pictures, raw slots, fields, resources, reopen, undo/redo, refusals and rollback');
 }finally{d.free();}
}
for(const format of ['hwp','hwpx']){
 if(pattern&&!pattern.test(format+' prefix and inter-field picture text'))continue;
 const template=await createPictureFieldParagraph(HwpDocument,resolve(out,'prefix-'+format),'multiple');
 const save=d=>format==='hwp'?d.exportHwp():d.exportHwpx(),d=new HwpDocument(save(template));template.free();
 const name='누름틀 앞과 사이.'+format;
 try{
  const s=snap(d,name),p=paragraph(s),before=save(d),fields=json(d.getFieldList()),assets=resources(d.exportHwpx());
  assert.equal(p.text,multiplePictureFieldText);
  assert.deepEqual(fields.map(f=>[f.fieldId,f.name,f.startCharIdx,f.endCharIdx,f.value]),[
   [702,'입력값',6,9,'필드😀'],[703,'입력값',15,18,'둘째값']]);
  assert.deepEqual(p.pictureTextRanges,[{start:0,end:5},{start:10,end:14},{start:19,end:23},{start:25,end:29}]);
  const file=resolve(out,'prefix-original.'+format);await writeFile(file,before);
  const raw=inspectMixedPictureFields(file),originalSlots=raw.find(c=>c.row===1&&c.col===1).slots;
  assert.deepEqual(originalSlots.map(s=>s.offset),[6,9,15,18,24,30,31]);
  assert.deepEqual(originalSlots.map(s=>s.utf16Offset),[6,18,32,43,57,71,80]);
  const replaceAt=(text,at)=>Array.from(text).map((c,i)=>i===at?'X':c).join('');
  for(const at of [5,6,9,14,15,18]){
   assert.throws(()=>candidate(d,s,command(s,replaceAt(p.text,at))),undefined,'field boundary '+at);
   assert.deepEqual(save(d),before);
  }
  assert.throws(()=>candidate(d,s,command(s,p.text.replace('앞글 필드😀 사이문구','잘못된 범위'))));
  assert.deepEqual(save(d),before);
  const readFields=d.getFieldList.bind(d);
  d.getFieldList=()=>JSON.stringify(json(readFields()).map(f=>f.fieldId===703?{...f,fieldId:702}:f));
  assert.equal(snap(d,name).cellParagraphSources.s0p1t0.editable,false);d.getFieldList=readFields;
  const undo=d.saveSnapshot();
  let text=p.text;
  const phases=[
   {label:'prefix-emoji',text:'😀추가'+text,scalars:[9,12,18,21,27,33,34],units:[10,22,36,47,61,75,84],shift:[3,3]},
   {label:'inter-field-delete',text:('😀추가'+text).replace('사이문구','사이'),scalars:[9,12,16,19,25,31,32],units:[10,22,34,45,59,73,82],shift:[3,1]},
  ];
  for(const phase of phases){
   const current=snap(d,name),cursor=candidate(d,current,command(current,phase.text));text=phase.text;
   assert.equal(cursor.charOffset,paragraph(snap(d,name)).editableFrom);
   const saved=resolve(out,phase.label+'.'+format);await writeFile(saved,save(d));
   assert.deepEqual(inspectMixedPictureFields(saved),raw.map(c=>c.row===1&&c.col===1?{...c,text,
    slots:originalSlots.map((slot,i)=>({...slot,offset:phase.scalars[i],utf16Offset:phase.units[i]}))}:c));
   const expectedFields=fields.map((f,i)=>({...f,...Object.fromEntries(['startCharIdx','endCharIdx','startPos','endPos'].map(k=>[k,f[k]+phase.shift[i]]))}));
   const reopened=new HwpDocument(await readFile(saved));
   try{
    assert.deepEqual(json(d.getFieldList()),expectedFields);assert.deepEqual(json(reopened.getFieldList()),expectedFields);
    assert.deepEqual(Array.from(reopened.getCellPictureTextAnchors(...args)),phase.scalars.slice(4));
    for(const [i,field] of expectedFields.entries()){
     assert.equal(json(reopened.getFieldValue(field.fieldId)).value,field.value);
     assert.equal(json(reopened.getCellCharPropertiesAt(...args,field.startCharIdx)).textColor,['#246789','#975324'][i]);
    }
    assert.deepEqual(resources(reopened.exportHwpx()),assets);
   }finally{reopened.free();}
  }
  const after=save(d),redo=d.saveSnapshot();d.restoreSnapshot(undo);assert.deepEqual(save(d),before);
  d.restoreSnapshot(redo);assert.deepEqual(save(d),after);d.discardSnapshot(undo);d.discardSnapshot(redo);
  // A mutated same-name neighbor field must not be accepted as a planned move.
  const current=snap(d,name),insert=d.insertTextInCell.bind(d);let changed=false;
  d.insertTextInCell=(...a)=>{const result=insert(...a);changed=true;d.setFieldValue(703,'잘못된 값');return result;};
  assert.throws(()=>candidate(d,current,command(current,'앞'+text)));assert.equal(changed,true);
  d.insertTextInCell=insert;assert.deepEqual(save(d),after);
  results.push({format,case:'prefix-and-inter-field',edits:2,prefixScalarDelta:3,prefixUtf16Delta:4,
   interFieldDelta:-2,boundaryRefusals:7,duplicateFieldIdRejected:true,neighborFieldFaultRollback:true,undoRedo:true});
  console.log('PASS',format,'prefix +3 scalars/+4 UTF16 and inter-field -2: two same-name field IDs, values/styles, raw field/picture slots, reopen, boundary refusal and rollback');
 }finally{d.free();}
}
await writeFile(resolve(out,'results.json'),JSON.stringify({engine:pkg,results},null,2));
assert.ok(results.length);console.log('PASS',results.length,'formats');
