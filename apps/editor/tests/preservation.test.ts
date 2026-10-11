import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {deflateRawSync,inflateRawSync} from 'node:zlib';
import init,{HwpDocument} from '@rhwp/core';
import {capturePreservationEvidence,comparePreservationEvidence,PreservationError,verifyPreservedExport} from '../src/adapters/rhwp/preservation.ts';
import {captionPatch} from '../src/adapters/rhwp/manual-commands.ts';

await init({module_or_path:await readFile(new URL('../node_modules/@rhwp/core/rhwp_bg.wasm',import.meta.url))});
const blank=()=>{const doc=HwpDocument.createEmpty();doc.createBlankDocument();return doc;};
const clean=(format:'hwp'|'hwpx')=>({schemaVersion:1,outputFormat:format,count:0,losses:[]});
const check=(doc:HwpDocument,format:'hwp'|'hwpx')=>{
 const artifact=format==='hwp'?doc.exportHwpWithReport():doc.exportHwpxWithReport();
 try{return verifyPreservedExport(doc,artifact.takeBytes(),format,artifact.contentLoss(),bytes=>new HwpDocument(bytes));}finally{artifact.free();}
};

// A controlled malformed-but-parseable HWP fixture: replace the column definition
// four-character ID with an unsupported one. The production serializer must report
// its disappearance even though @rhwp/core 0.8.7's contentLoss producer misses it.
// This helper only rewrites already-allocated CFB sectors; it is not a file parser
// used by the app and cannot alter any user file.
function withUnknownControl(source:Uint8Array):Uint8Array {
 const file=Buffer.from(source),sectorSize=1<<file.readUInt16LE(30),miniSize=1<<file.readUInt16LE(32);
 const sector=(id:number)=>file.subarray((id+1)*sectorSize,(id+2)*sectorSize);
 const fat=Buffer.concat(Array.from({length:file.readUInt32LE(44)},(_,i)=>sector(file.readUInt32LE(76+i*4))));
 const chain=(first:number,table:Buffer)=>{const result:number[]=[];for(let id=first;id<0xfffffffa;id=table.readUInt32LE(id*4)){assert.ok(!result.includes(id),'CFB chain must not cycle');result.push(id);}return result;};
 const full=(first:number)=>{const ids=chain(first,fat);return {ids,bytes:Buffer.concat(ids.map(sector))};};
 const writeFull=(ids:number[],bytes:Buffer)=>ids.forEach((id,i)=>bytes.subarray(i*sectorSize,(i+1)*sectorSize).copy(sector(id)));
 const dir=full(file.readUInt32LE(48)),entries=[];
 for(let offset=0;offset<dir.bytes.length;offset+=128){const nameSize=dir.bytes.readUInt16LE(offset+64);if(nameSize<2)continue;entries.push({offset,name:dir.bytes.subarray(offset,offset+nameSize-2).toString('utf16le'),first:dir.bytes.readUInt32LE(offset+116),size:Number(dir.bytes.readBigUInt64LE(offset+120))});}
 const root=entries.find(e=>e.name==='Root Entry')!,section=entries.find(e=>e.name==='Section0')!;
 assert.ok(root&&section);const rootStream=full(root.first),miniFat=full(file.readUInt32LE(60)).bytes;
 const mini=section.size<file.readUInt32LE(56),ids=chain(section.first,mini?miniFat:fat),unit=mini?miniSize:sectorSize;
 const blocks=ids.map(id=>mini?rootStream.bytes.subarray(id*miniSize,(id+1)*miniSize):sector(id));
 const raw=inflateRawSync(Buffer.concat(blocks).subarray(0,section.size));let changed=0;
 for(let marker=raw.indexOf(Buffer.from('dloc'));marker>=0;marker=raw.indexOf(Buffer.from('dloc'),marker+4)){raw.write('zzzz',marker,'ascii');changed++;}
 assert.ok(changed>=1,'blank fixture must contain the column control ID');
 const compressed=deflateRawSync(raw,{level:9});assert.ok(compressed.length<=ids.length*unit,'fixture must fit allocated sectors');
 const padded=Buffer.alloc(ids.length*unit);compressed.copy(padded);blocks.forEach((block,i)=>padded.subarray(i*unit,(i+1)*unit).copy(block));
 if(mini)writeFull(rootStream.ids,rootStream.bytes);
 dir.bytes.writeBigUInt64LE(BigInt(compressed.length),section.offset+120);writeFull(dir.ids,dir.bytes);return file;
}

for(const format of ['hwp','hwpx'] as const)test(`${format}: actual WASM mixed character runs survive export/reopen`,()=>{
 const doc=blank();try{
  doc.insertText(0,0,0,'앞😀굵은글 뒤');doc.applyCharFormat(0,0,2,5,JSON.stringify({bold:true,textColor:'#ff0000'}));
  const report=check(doc,format);assert.equal(report.status,'checked');assert.ok(report.checked.includes('section/0/paragraph/0'));
  assert.ok(report.unverified.length>0,'same-engine evidence must retain unverified coverage');
 }finally{doc.free();}
});

test('body text equality cannot conceal a lost non-first character run',()=>{
 const doc=blank();let reopened:HwpDocument|undefined;try{
  doc.insertText(0,0,0,'보통 굵음');doc.applyCharFormat(0,0,3,5,JSON.stringify({bold:true}));
  const before=capturePreservationEvidence(doc);reopened=new HwpDocument(doc.exportHwp());reopened.applyCharFormat(0,0,0,5,JSON.stringify({bold:false}));
  assert.equal(doc.getTextFileUnicode(),reopened.getTextFileUnicode());
  const report=comparePreservationEvidence(before,capturePreservationEvidence(reopened),'hwp',clean('hwp'));
  assert.equal(report.status,'blocked');assert.ok(report.issues.some(i=>i.path==='section/0/paragraph/0'));
  assert.ok(!JSON.stringify(report).includes('보통 굵음'),'reports must omit document contents');
 }finally{reopened?.free();doc.free();}
});

test('an omitted unidentified control is blocked even when serializer reports zero losses',()=>{
 const doc=blank();try{
  const before=capturePreservationEvidence(doc),after=capturePreservationEvidence(doc);
  assert.ok(Array.isArray(before.values.controls));before.values.controls.push({ctrlId:'',ctrlCh:0,userDesc:'',list:0,para:0,controlIndex:2,props:{}});
  const report=comparePreservationEvidence(before,after,'hwpx',clean('hwpx'));
  assert.equal(report.status,'blocked');assert.ok(report.issues.some(i=>i.path==='controls'));
 }finally{doc.free();}
});

test('actual WASM Unknown-control HWPX omission is blocked despite a zero-loss native report',()=>{
 const original=blank();let doc:HwpDocument|undefined;
 try{
  doc=new HwpDocument(withUnknownControl(original.exportHwp()));
  assert.ok(JSON.parse(doc.getControls()).some((c:{ctrlId:string})=>c.ctrlId===''));
  const artifact=doc.exportHwpxWithReport();try{
   assert.equal(JSON.parse(artifact.contentLoss()).count,0,'reproduces pinned engine omission reporting gap');
   assert.throws(()=>verifyPreservedExport(doc!,artifact.takeBytes(),'hwpx',artifact.contentLoss(),b=>new HwpDocument(b)),error=>{
    assert.ok(error instanceof PreservationError);assert.ok(error.report.issues.some(i=>i.path==='controls'));return true;
   });
  }finally{artifact.free();}
 }finally{doc?.free();original.free();}
});

test('image asset byte changes are blocked independently of matching text and counts',()=>{
 const doc=blank();try{
  const before=capturePreservationEvidence(doc),after=capturePreservationEvidence(doc);
  before.values['image-resources']=['first hash'];after.values['image-resources']=['different hash'];
  const report=comparePreservationEvidence(before,after,'hwp',clean('hwp'));
  assert.equal(report.status,'blocked');assert.ok(report.issues.some(i=>i.path==='image-resources'));
 }finally{doc.free();}
});

test('malformed and nonzero serializer reports cannot be interpreted as no loss',()=>{
 const doc=blank();try{
  const evidence=capturePreservationEvidence(doc);
  for(const report of [undefined,'not-json',{count:0},clean('hwpx'),{...clean('hwp'),count:1},{...clean('hwp'),count:1,losses:[{code:'controlOmitted'}]}]){
   assert.equal(comparePreservationEvidence(evidence,evidence,'hwp',report).status,'blocked');
  }
 }finally{doc.free();}
});

test('reopened handle is freed after failed comparison and source document is untouched',()=>{
 const doc=blank();try{
  doc.insertText(0,0,0,'원본 유지');let freed=0;const before=doc.getTextFileUnicode();
  assert.throws(()=>verifyPreservedExport(doc,doc.exportHwp(),'hwp',clean('hwp'),bytes=>{
   const reopened=new HwpDocument(bytes);reopened.insertText(0,0,0,'오류');const release=reopened.free.bind(reopened);reopened.free=()=>{freed++;release();};return reopened;
  }),PreservationError);
  assert.equal(freed,1);assert.equal(doc.getTextFileUnicode(),before);
 }finally{doc.free();}
});

for(const format of ['hwp','hwpx'] as const)test(`${format}: actual native image payload is checked without emitting image bytes`,()=>{
 const doc=blank();try{
  const png=Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==','base64'));
  doc.insertPicture(0,0,0,'',png,3000,3000,1,1,'png','검사 그림');
  assert.equal((capturePreservationEvidence(doc).values['image-resources'] as string[]).length,1);
  const report=check(doc,format);assert.equal(report.status,'checked');assert.ok(report.checked.includes('image-resources'));
 }finally{doc.free();}
});

for(const format of ['hwp','hwpx'] as const)test(`${format}: durable page hide and caption properties preserve their values`,()=>{
 const doc=blank();try{
  doc.setPageHide(0,0,true,false,false,false,false,true);
  const created=JSON.parse(doc.createShapeControl(JSON.stringify({sectionIdx:0,paraIdx:0,charOffset:0,width:9000,height:4000,treatAsChar:true,textWrap:'Square'})));
  doc.attachCaptionAt(created.paraIdx,created.controlIdx);
  doc.setShapeProperties(0,created.paraIdx,created.controlIdx,JSON.stringify({captionDirection:'Top',captionVertAlign:'Center',captionSpacing:850,captionWidth:8504}));
  const report=check(doc,format);assert.equal(report.status,'checked');assert.ok(report.checked.includes('objects'));
 }finally{doc.free();}
});

test('a changed durable hide flag is detected even when the control still exists',()=>{
 const doc=blank();try{
  doc.setPageHide(0,0,true,false,false,false,false,false);const before=capturePreservationEvidence(doc);
  doc.setPageHide(0,0,false,true,false,false,false,false);const after=capturePreservationEvidence(doc);
  const report=comparePreservationEvidence(before,after,'hwp',clean('hwp'));
  assert.equal(report.status,'blocked');assert.ok(report.issues.some(i=>i.path==='section/0/paragraph/0'));
 }finally{doc.free();}
});

for(const format of ['hwp','hwpx'] as const)test(`${format}: fixture table including all cell character runs is checked`,async()=>{
 const doc=new HwpDocument(await readFile(new URL('../fixtures/schedule-table.hwp',import.meta.url)));
 try{
  const before=capturePreservationEvidence(doc);assert.ok((before.values.cells as unknown[]).length>0);
  assert.equal(check(doc,format).status,'checked');
 }finally{doc.free();}
});

test('HWPX table caption right-middle/remove/undo compares resolved wrap rather than stale raw attr bits',async()=>{
 const doc=new HwpDocument(await readFile(new URL('../fixtures/schedule-table.hwpx',import.meta.url)));
 try{
  const table=JSON.parse(doc.getObjects()).find((o:{kind:string})=>o.kind==='table'),p=table.para,c=table.controlIndex;
  doc.setTableProperties(0,p,c,JSON.stringify(captionPatch(JSON.parse(doc.getTableProperties(0,p,c)),'rm',true)));
  const id=doc.saveSnapshot();
  try{
   doc.setTableProperties(0,p,c,JSON.stringify(captionPatch(JSON.parse(doc.getTableProperties(0,p,c)),'none',true)));
   assert.equal(check(doc,'hwpx').status,'checked');
   doc.restoreSnapshot(id);
   assert.equal(JSON.parse(doc.getTableProperties(0,p,c)).captionDirection,1);
   assert.equal(JSON.parse(doc.getTableProperties(0,p,c)).captionVertAlign,1);
   const reopened=new HwpDocument(doc.exportHwpx());try{
    const beforeControl=JSON.parse(doc.getControls()).find((o:{ctrlId:string})=>o.ctrlId==='tbl');
    const afterControl=JSON.parse(reopened.getControls()).find((o:{ctrlId:string})=>o.ctrlId==='tbl');
    assert.notEqual(beforeControl.props.TextWrap,afterControl.props.TextWrap,'reproduce the raw-bits drift');
    assert.equal(JSON.parse(doc.getTableProperties(0,p,c)).textWrap,JSON.parse(reopened.getTableProperties(0,p,c)).textWrap);
   }finally{reopened.free();}
   assert.equal(check(doc,'hwpx').status,'checked');
   const before=capturePreservationEvidence(doc);
   doc.setTableProperties(0,p,c,JSON.stringify({textWrap:'BehindText'}));
   const changed=comparePreservationEvidence(before,capturePreservationEvidence(doc),'hwpx',clean('hwpx'));
   assert.equal(changed.status,'blocked');assert.ok(changed.issues.some(i=>i.path==='controls'));
  }finally{doc.discardSnapshot(id);}
 }finally{doc.free();}
});

for(const format of ['hwp','hwpx'] as const)test(`${format}: header text is read beyond the root control list`,()=>{
 const doc=blank();try{
  doc.createHeaderFooter(0,true,0);doc.insertTextInHeaderFooter(0,true,0,0,0,'공문 머리말');
  const report=check(doc,format);assert.equal(report.status,'checked');assert.ok(report.checked.includes('section/0/header/0'));
 }finally{doc.free();}
});
