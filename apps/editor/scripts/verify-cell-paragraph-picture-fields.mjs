import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {inflateRawSync} from 'node:zlib';
import {createPictureFieldParagraph,mixedPictureFieldArgs as args,mixedPictureFieldText,inspectMixedPictureFields} from './lib/cell-paragraph-picture-fields.mjs';
import {readStructure} from '../src/adapters/rhwp/structure.ts';
import {readCellParagraphSources} from '../src/adapters/rhwp/cell-paragraph.ts';
import {executeDocumentOperations} from '../src/adapters/rhwp/execute.ts';
import {validateEditOperations} from '../src/modules/document/public/index.ts';

const pkg=resolve(process.env.JUEONY_ENGINE_PACKAGE),out=resolve(process.env.JUEONY_TEST_OUTPUT??'build/cell-paragraph-picture-fields');
await mkdir(out,{recursive:true});
const {default:init,HwpDocument}=await import(pathToFileURL(pkg+'/rhwp.js'));
await init({module_or_path:await readFile(pkg+'/rhwp_bg.wasm')});
const json=v=>typeof v==='string'?JSON.parse(v):v,results=[];
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
 if(process.env.JUEONY_CASE_PATTERN&&!new RegExp(process.env.JUEONY_CASE_PATTERN,'u').test(format))continue;
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
    slots:c.slots.map(s=>s.kind===11?{...s,offset:s.offset+anchorShift}:s)}:c));
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
await writeFile(resolve(out,'results.json'),JSON.stringify({engine:pkg,results},null,2));
assert.ok(results.length);console.log('PASS',results.length,'formats');
