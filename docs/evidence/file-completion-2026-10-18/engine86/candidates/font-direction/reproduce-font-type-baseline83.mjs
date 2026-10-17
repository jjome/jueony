import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {loadReviewEngine,hash} from '../../apps/editor/scripts/lib/hancom-review.mjs';
import {verifyPreservedExport} from '../../apps/editor/src/adapters/rhwp/preservation.ts';
const root=resolve('build/text-direction-closure83/font-type-inputs83-v2');
const engine=await loadReviewEngine(resolve('build/rhwp-engine/source-ad6186043c15532f/pkg'));
const inputs=JSON.parse(await readFile(resolve(root,'manifest.json'),'utf8'));
const rows=[];
for(const item of inputs.fixtures){
 const raw=await readFile(item.path),doc=new engine.HwpDocument(raw);
 try{
  const exp=doc.exportHwpxWithReport();let bytes,report;
  try{report=JSON.parse(exp.contentLoss());bytes=exp.takeBytes();}finally{exp.free();}
  const output=resolve(root,`baseline83-${item.firstFontType}.hwpx`);
  await writeFile(output,bytes,{flag:'wx'});
  let preservation;
  try{verifyPreservedExport(doc,bytes,'hwpx',report,b=>new engine.HwpDocument(b));preservation={status:'allowed'};}
  catch(error){preservation={status:'blocked',name:error.name,message:error.message};}
  rows.push({token:item.firstFontType,inputSha256:hash(raw),output,outputSha256:hash(bytes),report,preservation});
 }finally{doc.free();if(hash(await readFile(item.path))!==hash(raw))throw Error('Source fixture changed.');}
}
await writeFile(resolve(root,'baseline83-result.json'),JSON.stringify({engine:engine.metadata,rows},null,2),{flag:'wx'});
console.log(JSON.stringify(rows.map(({token,report,preservation})=>({token,report,preservation}))));
