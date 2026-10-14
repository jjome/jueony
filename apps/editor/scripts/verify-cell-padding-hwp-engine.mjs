import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {readStructure} from '../src/adapters/rhwp/structure.ts';
import {capturePreservationEvidence} from '../src/adapters/rhwp/preservation.ts';
const repo=resolve(dirname(fileURLToPath(import.meta.url)),'../../..');
const pkg=resolve(repo,process.env.JUEONY_ENGINE_PACKAGE);
const out=resolve(repo,process.env.JUEONY_TEST_OUTPUT??'docs/evidence/cell-padding-hwp-2026-10-14/native');
await mkdir(out,{recursive:true});
const {default:init,HwpDocument}=await import(pathToFileURL(resolve(pkg,'rhwp.js')).href);
await init({module_or_path:await readFile(resolve(pkg,'rhwp_bg.wasm'))});
const json=JSON.parse,results=[],failures=[];
const patch={paddingLeft:567,paddingRight:850,paddingTop:283,paddingBottom:1134,applyInnerMargin:true};
function layout(d){return Array.from({length:d.pageCount()},(_,page)=>({page,controls:json(d.getPageControlLayout(page)).controls,runs:json(d.getPageTextLayout(page)).runs}));}
function same(a,b,path='layout'){
 if(typeof a==='number'&&typeof b==='number'){assert.ok(Math.abs(a-b)<=0.2,`${path}: ${a} != ${b}`);return;}
 if(Array.isArray(a)){assert.ok(Array.isArray(b));assert.equal(a.length,b.length,path);a.forEach((v,i)=>same(v,b[i],`${path}[${i}]`));return;}
 if(a&&typeof a==='object'){assert.deepEqual(Object.keys(a),Object.keys(b),path);for(const k of Object.keys(a))same(a[k],b[k],`${path}.${k}`);return;}
 assert.deepEqual(a,b,path);
}
function fixture(format,text,outerTop=283,align=1){const d=HwpDocument.createEmpty();d.createBlankDocument();d.insertText(0,0,0,'앞 본문');d.splitParagraph(0,0,4);const t=json(d.createTable(0,1,0,3,2));for(let i=0;i<6;i++){d.insertTextInCell(0,1,t.controlIdx,i,0,0,text?text+' '+i:'');d.setCellProperties(0,1,t.controlIdx,i,JSON.stringify({verticalAlign:align}));}d.setTableProperties(0,1,t.controlIdx,JSON.stringify({outerMarginTop:outerTop}));const x=new HwpDocument(d[format==='hwp'?'exportHwp':'exportHwpx']());d.free();return x;}
async function check(d,format,name){const live=layout(d),bytes=d[format==='hwp'?'exportHwp':'exportHwpx'](),x=new HwpDocument(bytes);try{same(live,layout(x));assert.deepEqual(capturePreservationEvidence(x).values,capturePreservationEvidence(d).values);await writeFile(resolve(out,name+'.'+format),bytes);await writeFile(resolve(out,name+'-layout.json'),JSON.stringify({live,reopened:layout(x)},null,2));}finally{x.free();}}
async function scenario(name,run){try{await run();results.push(name);console.log('PASS',name);}catch(error){failures.push({name,error:String(error),stack:error.stack});console.error('FAIL',name,error.message);}}
for(const format of ['hwp','hwpx'])for(const [label,text,align] of [['short','업무',1],['long','여러 줄을 만드는 자료와 추진 계획 '.repeat(12),0],['bottom','본문',2],['empty','',1]])await scenario(`${format}: ${label} custom and inherited padding preserve whole document geometry across save/reopen and snapshot`,async()=>{const d=fixture(format,text,283,align);try{const t=readStructure(d).tables[0],before=capturePreservationEvidence(d).values,token=d.saveSnapshot(),beforeBytes=d[format==='hwp'?'exportHwp':'exportHwpx']();for(const i of [0,1])assert.equal(json(d.setCellProperties(t.section,t.paragraph,t.control,i,JSON.stringify(patch))).ok,true);await check(d,format,`${format}-${label}-custom`);const after=readStructure(d).tables[0];for(let i=0;i<6;i++){assert.equal(after.cells[i].properties.width,t.cells[i].properties.width);assert.equal(after.cells[i].properties.height,t.cells[i].properties.height);assert.equal(after.cells[i].text,t.cells[i].text);}const applied=d[format==='hwp'?'exportHwp':'exportHwpx']();d.restoreSnapshot(token);assert.deepEqual(d[format==='hwp'?'exportHwp':'exportHwpx'](),beforeBytes);assert.deepEqual(capturePreservationEvidence(d).values,before);d.discardSnapshot(token);for(const i of [0,1])d.setCellProperties(t.section,t.paragraph,t.control,i,JSON.stringify(patch));assert.deepEqual(d[format==='hwp'?'exportHwp':'exportHwpx'](),applied);for(const i of [0,1])d.setCellProperties(t.section,t.paragraph,t.control,i,'{"applyInnerMargin":false}');await check(d,format,`${format}-${label}-inherited`);for(const i of [0,1]){const p=json(d.getCellProperties(t.section,t.paragraph,t.control,i));assert.equal(p.applyInnerMargin,false);for(const k of ['paddingLeft','paddingRight','paddingTop','paddingBottom'])assert.equal(p[k],patch[k]);}}finally{d.free();}});
for(const format of ['hwp','hwpx'])await scenario(`${format}: vertical-only custom changes and zero defaults use the same effective frame`,async()=>{const d=fixture(format,'업무');try{const t=readStructure(d).tables[0];for(const i of [0,1])d.setCellProperties(0,1,t.control,i,'{"applyInnerMargin":true,"paddingTop":567,"paddingBottom":850}');await check(d,format,format+'-vertical');d.setTableProperties(0,1,t.control,'{"paddingLeft":0,"paddingRight":0,"paddingTop":0,"paddingBottom":0}');for(const i of [0,1])d.setCellProperties(0,1,t.control,i,'{"applyInnerMargin":false}');await check(d,format,format+'-zero-defaults');}finally{d.free();}});
const unresolved=[];
// Diagnostic observations are recorded separately; their disagreement is NOT a
// successful compatibility result and keeps the normal HWP Agent gate closed.
for(const mode of ['multiple-tables','zero-defaults']){
 const d=fixture('hwp','업무');let x;
 try{
  d.applyCharFormatInCell(0,1,0,2,0,0,4,JSON.stringify({bold:true,fontSize:1200}));
  d.setCellProperties(0,1,0,3,JSON.stringify({fillType:'solid',fillColor:'#ffeeaa'}));
  if(mode==='multiple-tables'){d.splitParagraph(0,1,d.getParagraphLength(0,1));const t=json(d.createTable(0,2,0,2,2));assert.equal(t.ok,true);}
  else {d.setTableProperties(0,1,0,'{"paddingLeft":0,"paddingRight":0,"paddingTop":0,"paddingBottom":0}');for(const i of [0,1])d.setCellProperties(0,1,0,i,'{"applyInnerMargin":false,"paddingLeft":3000,"paddingRight":4000,"paddingTop":2000,"paddingBottom":1000}');}
  x=new HwpDocument(d.exportHwp());for(const i of [0,1])x.setCellProperties(0,1,0,i,JSON.stringify(patch));
  const bytes=x.exportHwp(),reopened=new HwpDocument(bytes);
  try{const live=layout(x),saved=layout(reopened);let discrepancy;try{same(live,saved);}catch(error){discrepancy=error.message;}
   const status=discrepancy?'UNRESOLVED_NATIVE_DIAGNOSTIC':'MATCHED_NATIVE_DIAGNOSTIC';
   unresolved.push({mode,status,discrepancy});await mkdir(resolve(out,'diagnostic'),{recursive:true});await writeFile(resolve(out,'diagnostic',mode+'.hwp'),bytes);await writeFile(resolve(out,'diagnostic',mode+'.json'),JSON.stringify({status,discrepancy,live,reopened:saved,note:'Not successful AI output or independent Hancom output.'},null,2));console.log(status,mode,discrepancy??'');
  }finally{reopened.free();}
 }finally{x?.free();d.free();}
}
await writeFile(resolve(out,'result.json'),JSON.stringify({results,failures,unresolved,engine:JSON.parse(await readFile(resolve(pkg,'jueony-engine-build.json'),'utf8')),note:'Self-authored whole-table empty-host HWP/HWPX roundtrip invariants, entire page controls/text plus semantic evidence; NOT independent Hancom parity or paid model test.'},null,2));if(failures.length)process.exitCode=1;
