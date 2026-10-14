import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {capturePreservationEvidence} from '../src/adapters/rhwp/preservation.ts';
const pkg=resolve(process.env.JUEONY_ENGINE_PACKAGE),out=resolve(process.env.JUEONY_TEST_OUTPUT??'build/overlap-table-tail-native');await mkdir(out,{recursive:true});
const {default:init,HwpDocument}=await import(pathToFileURL(resolve(pkg,'rhwp.js')).href);await init({module_or_path:await readFile(resolve(pkg,'rhwp_bg.wasm'))});
const results=[],failures=[],json=JSON.parse;
const layout=d=>Array.from({length:d.pageCount()},(_,page)=>({controls:json(d.getPageControlLayout(page)).controls,text:json(d.getPageTextLayout(page)).runs}));
function same(a,b,path='layout'){if(typeof a==='number'&&typeof b==='number'){assert.ok(Math.abs(a-b)<=0.2,`${path}: ${a} != ${b}`);return;}if(Array.isArray(a)){assert.equal(a.length,b.length,path);a.forEach((v,i)=>same(v,b[i],path+'/'+i));return;}if(a&&typeof a==='object'){assert.deepEqual(Object.keys(a),Object.keys(b),path);for(const k of Object.keys(a))same(a[k],b[k],path+'/'+k);return;}assert.deepEqual(a,b,path);}
async function scenario(name,run){try{await run();results.push(name);console.log('PASS',name);}catch(e){failures.push({name,error:String(e),stack:e.stack});console.error('FAIL',name,e.message);}}

import {lineOriginFixture} from './verify-overlap-fixture.mjs';
const baseline=process.env.JUEONY_OVERLAP_BASELINE?JSON.parse(await readFile(resolve(process.env.JUEONY_OVERLAP_BASELINE),'utf8')):null;
const observations=[];
for(const format of ['hwp','hwpx'])for(const mode of ['two','three','long','offset','negative','absolute','trailing-text','page-break','positive-gap'])await scenario(`${format} ${mode}: resolved overlap tail and guarded source contracts`,async()=>{
 const supported=['two','three','long','offset'].includes(mode);
 const d=HwpDocument.createEmpty();d.createBlankDocument();d.insertText(0,0,0,'앞 본문');d.splitParagraph(0,0,4);
 for(let p=1;p<=(mode==='three'?3:2);p++){
  if(p>1)d.splitParagraph(0,p-1,d.getParagraphLength(0,p-1));
  const t=json(d.createTable(0,p,0,p===1?3:2,2));
  for(let c=0;c<(p===1?6:4);c++)d.insertTextInCell(0,p,t.controlIdx,c,0,0,(mode==='long'&&p===1?'자료 검토 문장 '.repeat(12):'업무 ')+c);
  if(p===1){d.applyCharFormatInCell(0,p,t.controlIdx,2,0,0,4,'{"bold":true,"fontSize":1200}');d.setCellProperties(0,p,t.controlIdx,3,'{"fillType":"solid","fillColor":"#ffeeaa"}');}
  if(p>=2){const props={allowOverlap:true};if(mode==='offset')props.vertOffset=1000;if(mode==='negative')props.vertOffset=-1000;if(mode==='absolute')props.vertRelTo='Page';if(mode==='page-break')props.pageBreak=1;d.setTableProperties(0,p,t.controlIdx,JSON.stringify(props));}
 }
 if(mode==='trailing-text'){d.splitParagraph(0,2,d.getParagraphLength(0,2));d.insertText(0,3,0,'뒤 본문 간격 보존');}
 const exporter=format==='hwp'?'exportHwp':'exportHwpx';let input=d[exporter]();if(format==='hwp'&&mode==='positive-gap')input=lineOriginFixture(input,2,9000);const x=new HwpDocument(input);d.free();
 try{
  const initial=x[exporter](),unmodified=layout(x),untouched=new HwpDocument(initial);
  const second=json(x.getTableProperties(0,2,0));if(format==='hwp'){assert.equal(second.allowOverlap,true);if(mode==='negative')assert.equal(second.vertOffset,-1000);if(mode==='absolute')assert.equal(second.vertRelTo,'Page');if(mode==='page-break')assert.equal(second.pageBreak,1);}
  try{same(unmodified,layout(untouched));assert.deepEqual(capturePreservationEvidence(x).values,capturePreservationEvidence(untouched).values);}finally{untouched.free();}
  const token=x.saveSnapshot();
  for(const i of [0,1]){assert.equal(json(x.setCellProperties(0,1,0,i,'{"paddingLeft":567,"paddingRight":850,"paddingTop":283,"paddingBottom":1134,"applyInnerMargin":true}')).ok,true);const properties=json(x.getCellProperties(0,1,0,i));assert.equal(properties.paddingBottom,1134);assert.equal(properties.applyInnerMargin,true);}
  const live=layout(x),values=capturePreservationEvidence(x).values,bytes=x[exporter]();same(layout(x),live);assert.deepEqual(capturePreservationEvidence(x).values,values,'export cannot mutate live model');const again=new HwpDocument(bytes);
  try{
   const reopened=layout(again);const observation={format,mode,supported,live,reopened,values};observations.push(observation);
   if(supported&&baseline){same(live,reopened);assert.deepEqual(values,capturePreservationEvidence(again).values);const twice=new HwpDocument(again[exporter]());try{same(reopened,layout(twice));assert.deepEqual(capturePreservationEvidence(twice).values,values);}finally{twice.free();}}
   if(baseline&&!supported&&format==='hwp'){const prior=baseline.observations.find(v=>v.format===format&&v.mode===mode);assert.ok(prior,'baseline guard observation');assert.deepEqual(observation,prior,'excluded HWP source contract remains unchanged');}
   if(baseline&&format==='hwpx'){const prior=baseline.observations.find(v=>v.format===format&&v.mode===mode);assert.deepEqual({live,reopened},{live:prior.live,reopened:prior.reopened},'HWPX geometry remains unchanged');assert.deepEqual(values,capturePreservationEvidence(again).values,'current corrected common-attribute query preserves HWPX model');}
   await writeFile(resolve(out,format+'-'+mode+'.'+format),bytes);await writeFile(resolve(out,format+'-'+mode+'.json'),JSON.stringify(observation,null,2));
  }finally{again.free();}
  x.restoreSnapshot(token);x.discardSnapshot(token);assert.deepEqual(x[exporter](),initial);
  for(const i of [0,1]){assert.equal(json(x.setCellProperties(0,1,0,i,'{"paddingLeft":567,"paddingRight":850,"paddingTop":283,"paddingBottom":1134,"applyInnerMargin":true}')).ok,true);const properties=json(x.getCellProperties(0,1,0,i));assert.equal(properties.paddingBottom,1134);assert.equal(properties.applyInnerMargin,true);}assert.deepEqual(x[exporter](),bytes,'restore/reapply deterministic');
 }finally{x.free();}
});
await writeFile(resolve(out,'result.json'),JSON.stringify({mode:baseline?'candidate-verification':'baseline-observation',results,failures,observations,layoutMismatches:observations.flatMap(o=>{try{same(o.live,o.reopened);return [];}catch(e){return [{format:o.format,mode:o.mode,supported:o.supported,error:e.message}];}}),engine:JSON.parse(await readFile(resolve(pkg,'jueony-engine-build.json'),'utf8')),note:'Native same-engine invariants; restricted edited native-HWP whole-table tail snapshot. NOT Hancom comparison. No HWP AI gate relaxation; excluded cases may retain known mismatch.'},null,2));if(failures.length)process.exitCode=1;
