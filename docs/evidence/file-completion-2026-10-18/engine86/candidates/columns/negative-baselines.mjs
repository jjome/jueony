import {readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {loadReviewEngine,hash,snapshot} from '../../apps/editor/scripts/lib/hancom-review.mjs';
const root=resolve('.'),out=join(root,'build/column3-closure83');
const engine=await loadReviewEngine(join(root,'build/rhwp-engine/source-ad6186043c15532f/pkg'));
const observations=[];
for(const name of ['single_column','three_columns','rtl','distribute','unequal_columns','asymmetric_margin']){
 const path=join(root,'build/file-closure69-public/column2-candidate74/valid-negative-disk',`baseline-${name}.hwp`),bytes=await readFile(path),d=new engine.HwpDocument(bytes);
 try{const record={name,inputSHA:hash(bytes),before:snapshot(d).layout,exports:[]};
  for(const format of ['hwp','hwpx']){const a=d[format==='hwp'?'exportHwpWithReport':'exportHwpxWithReport']();try{const loss=JSON.parse(a.contentLoss()),saved=a.takeBytes(),r=new engine.HwpDocument(saved);try{record.exports.push({format,loss,layout:snapshot(r).layout});}finally{r.free();}}finally{a.free();}}
  observations.push(record);
 }finally{d.free();}
}
await writeFile(join(out,'six-negative-formal83.json'),JSON.stringify({engine:engine.metadata,observations},null,2));
console.log('Captured six exact formal83 self-authored negative baselines and both-codec readback; no input changed.');
