import assert from 'node:assert/strict';import {readFile,writeFile,mkdir} from 'node:fs/promises';import {resolve} from 'node:path';import {pathToFileURL} from 'node:url';
import {verifyPreservedExport,capturePreservationEvidence} from '../src/adapters/rhwp/preservation.ts';
import {conversionRecordFixture} from './verify-format-conversion-fixture.mjs';
const pkg=resolve(process.env.JUEONY_ENGINE_PACKAGE),out=resolve(process.env.JUEONY_TEST_OUTPUT??'build/textbox-alignment-native');await mkdir(out,{recursive:true});
const {default:init,HwpDocument}=await import(pathToFileURL(pkg+'/rhwp.js'));await init({module_or_path:await readFile(pkg+'/rhwp_bg.wasm')});
const j=v=>typeof v==='string'?JSON.parse(v):v,results=[],failures=[];
async function scenario(name,run){try{await run();results.push(name);console.log('PASS',name);}catch(e){failures.push({name,error:String(e),stack:e.stack});console.error('FAIL',name,e.message);}}
function exported(d,format){const a=d[format==='hwp'?'exportHwpWithReport':'exportHwpxWithReport']();try{const loss=JSON.parse(a.contentLoss());return {bytes:a.takeBytes(),loss};}finally{a.free();}}
function blockedMeaning(d,bytes,format,loss){assert.throws(()=>verifyPreservedExport(d,bytes,format,loss,b=>new HwpDocument(b)),error=>error.report?.issues.some(i=>i.code==='changed')&&!error.report.issues.some(i=>i.path==='serializer-report'));}
function fixture(){const d=HwpDocument.createEmpty();d.createBlankDocument();d.insertText(0,0,0,'본문 그대로');d.splitParagraph(0,0,d.getParagraphLength(0,0));d.createShapeControl(JSON.stringify({sectionIdx:0,paraIdx:1,charOffset:0,shapeType:'textbox',width:18000,height:10000,horzOffset:20000,vertOffset:24000,treatAsChar:false}));d.insertTextInCell(0,1,0,0,0,0,'가😀나 글상자 내용');d.splitParagraphInCell(0,1,0,0,0,3);d.applyCharFormatInCell(0,1,0,0,1,1,2,'{"bold":true}');return d;}
for(const alignment of ['Top','Center','Bottom'])for(const format of ['hwp','hwpx'])await scenario(`${alignment} -> ${format}: real textbox meaning, runs and repeated save`,async()=>{
 const d=fixture();try{d.setShapeProperties(0,1,0,JSON.stringify({tbVerticalAlign:alignment}));const before=capturePreservationEvidence(d),original=d.exportHwpx(),artifact=d[format==='hwp'?'exportHwpWithReport':'exportHwpxWithReport']();let r;
  try{const loss=JSON.parse(artifact.contentLoss()),bytes=artifact.takeBytes();verifyPreservedExport(d,bytes,format,loss,b=>new HwpDocument(b));r=new HwpDocument(bytes);assert.equal(j(r.getShapeProperties(0,1,0)).tbVerticalAlign,alignment);assert.deepEqual(capturePreservationEvidence(d),before);assert.deepEqual(d.exportHwpx(),original);
   const second=r[format==='hwp'?'exportHwpWithReport':'exportHwpxWithReport']();try{const loss2=JSON.parse(second.contentLoss()),bytes2=second.takeBytes();verifyPreservedExport(r,bytes2,format,loss2,b=>new HwpDocument(b));await writeFile(resolve(out,alignment+'-repeated.'+format),bytes2);}finally{second.free();}
   await writeFile(resolve(out,alignment+'.'+format),bytes);
  }finally{r?.free();artifact.free();}
 }finally{d.free();}
});
await scenario('new textbox default is Top before and after HWP with no explicit setter',()=>{const d=fixture();try{const r=new HwpDocument(d.exportHwp());try{assert.equal(j(d.getShapeProperties(0,1,0)).tbVerticalAlign,'Top');assert.equal(j(r.getShapeProperties(0,1,0)).tbVerticalAlign,'Top');}finally{r.free();}}finally{d.free();}});
await scenario('existing HWP textbox preserves unrelated list_attr bits while semantic alignment changes',()=>{
 const d=fixture();let initial;try{initial=d.exportHwp();}finally{d.free();}
 const source=conversionRecordFixture(initial,({tag,data})=>{if(tag===72&&data.length>=24){const attr=data.readUInt32LE(4);data.writeUInt32LE((attr|0x10000400)>>>0,4);return true;}return false;});
 const r=new HwpDocument(source);try{r.setShapeProperties(0,1,0,'{"tbVerticalAlign":"Bottom"}');const bytes=r.exportHwp();let observed;
  conversionRecordFixture(bytes,({tag,data})=>{if(tag===72&&data.length>=24){observed=data.readUInt32LE(4);return true;}return false;});assert.equal(observed&0x10000400,0x10000400);assert.equal((observed>>>5)&3,2);
  const x=new HwpDocument(bytes);try{assert.equal(j(x.getShapeProperties(0,1,0)).tbVerticalAlign,'Bottom');assert.equal(x.getTextFileUnicode(),r.getTextFileUnicode());}finally{x.free();}
 }finally{r.free();}
});
function reservedSource(){const d=fixture();try{return conversionRecordFixture(d.exportHwp(),({tag,data})=>{if(tag===72&&data.length>=24){data.writeUInt32LE(((data.readUInt32LE(4)&~0x60)|0x10000460)>>>0,4);return true;}return false;});}finally{d.free();}}
function listBits(bytes){let observed;conversionRecordFixture(bytes,({tag,data})=>{if(tag===72&&data.length>=24){observed=data.readUInt32LE(4);return true;}return false;});assert.ok(Number.isSafeInteger(observed));return observed;}
await scenario('reserved raw alignment 3 stays unknown and unchanged across repeat HWP save',()=>{
 const d=new HwpDocument(reservedSource());try{assert.equal(j(d.getShapeProperties(0,1,0)).tbVerticalAlignKnown,false);const before=capturePreservationEvidence(d);for(let count=0;count<2;count++){const {bytes,loss}=exported(d,'hwp');assert.equal(listBits(bytes)&0x10000460,0x10000460);verifyPreservedExport(d,bytes,'hwp',loss,b=>new HwpDocument(b));const r=new HwpDocument(bytes);try{assert.equal(j(r.getShapeProperties(0,1,0)).tbVerticalAlignKnown,false);assert.deepEqual(capturePreservationEvidence(r),before);}finally{r.free();}}const converted=exported(d,'hwpx');blockedMeaning(d,converted.bytes,'hwpx',converted.loss);}finally{d.free();}
});
for(const [code,alignment] of ['Top','Center','Bottom'].entries())await scenario(`reserved raw3 explicit ${alignment} setter updates only supported alignment bits`,()=>{
 const d=new HwpDocument(reservedSource());try{const bodies=d.getTextFileUnicode(),first=j(d.getCellCharPropertiesAt(0,1,0,0,0,0)),second=j(d.getCellCharPropertiesAt(0,1,0,0,1,1));d.setShapeProperties(0,1,0,JSON.stringify({tbVerticalAlign:alignment}));assert.equal(j(d.getShapeProperties(0,1,0)).tbVerticalAlignKnown,true);assert.equal(d.getTextFileUnicode(),bodies);assert.deepEqual(j(d.getCellCharPropertiesAt(0,1,0,0,0,0)),first);assert.deepEqual(j(d.getCellCharPropertiesAt(0,1,0,0,1,1)),second);
  const {bytes,loss}=exported(d,'hwp'),bits=listBits(bytes);assert.equal(bits&0x10000400,0x10000400);assert.equal((bits>>>5)&3,code);verifyPreservedExport(d,bytes,'hwp',loss,b=>new HwpDocument(b));const r=new HwpDocument(bytes);try{assert.equal(j(r.getShapeProperties(0,1,0)).tbVerticalAlign,alignment);assert.equal(j(r.getShapeProperties(0,1,0)).tbVerticalAlignKnown,true);}finally{r.free();}
 }finally{d.free();}
});
await scenario('unsupported alignment setter never normalizes reserved raw3',()=>{const d=new HwpDocument(reservedSource());try{d.setShapeProperties(0,1,0,'{"tbVerticalAlign":"unsupported"}');assert.equal(j(d.getShapeProperties(0,1,0)).tbVerticalAlignKnown,false);assert.equal((listBits(d.exportHwp())>>>5)&3,3);}finally{d.free();}});
await scenario('real textbox alignment corruption remains blocked by unchanged preservation guard',()=>{const d=fixture();try{const r=new HwpDocument(d.exportHwpx());try{r.setShapeProperties(0,1,0,'{"tbVerticalAlign":"Bottom"}');const corrupted=exported(r,'hwpx');blockedMeaning(d,corrupted.bytes,'hwpx',corrupted.loss);}finally{r.free();}}finally{d.free();}});
await writeFile(resolve(out,'result.json'),JSON.stringify({results,failures,engine:JSON.parse(await readFile(resolve(pkg,'jueony-engine-build.json'),'utf8')),scope:'Native textbox alignment storage; same-engine resolved story/run properties. No session fingerprint tolerance relaxation; Hancom NOT_RUN.'},null,2));if(failures.length)process.exitCode=1;
