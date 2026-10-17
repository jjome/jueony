import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {loadReviewEngine,differences,hash} from '../../apps/editor/scripts/lib/hancom-review.mjs';
const out=resolve('build/session-font-provenance-closure84');await mkdir(out,{recursive:false});
const engine=await loadReviewEngine(resolve('build/rhwp-engine/source-aa660128b2c13b40/pkg'));const results=[];
for(const kind of ['header','footer','footnote']){
 const doc=engine.HwpDocument.createEmpty();
 try{
  doc.createBlankDocument();doc.insertText(0,0,0,'본문');let request;
  if(kind==='footnote'){const ref=JSON.parse(doc.insertFootnote(0,0,1));assert.equal(ref.ok,true);doc.insertTextInFootnote(0,ref.paraIdx,ref.controlIdx,0,2,'각😀주');request={kind,section:0,parent:ref.paraIdx,control:ref.controlIdx};}
  else{doc.createHeaderFooter(0,kind==='header',2);doc.insertTextInHeaderFooter(0,kind==='header',2,0,0,'머😀리말');request={kind,section:0,applyTo:2};}
  const before=JSON.parse(doc.getSessionStoryEvidence(JSON.stringify(request)));assert.equal(before.complete,true);
  for(const format of ['hwp','hwpx']){const bytes=doc[format==='hwp'?'exportHwp':'exportHwpx'](),reopened=new engine.HwpDocument(bytes);try{const after=JSON.parse(reopened.getSessionStoryEvidence(JSON.stringify(request)));assert.equal(after.complete,true);const diff=differences(before,after,0);results.push({kind,format,byteSha256:hash(bytes),beforeComplete:before.complete,afterComplete:after.complete,differences:diff});}finally{reopened.free();}}
 }finally{doc.free();}
}
await writeFile(join(out,'baseline-result.json'),JSON.stringify({engine:engine.metadata,results,scope:'Own synthetic story semantic evidence only. No runtime change, ignored fields, or guard bypass.'},null,2),{flag:'wx'});
console.log(JSON.stringify(results.map(x=>({kind:x.kind,format:x.format,count:x.differences.length,paths:[...new Set(x.differences.map(d=>d.path.split('[').slice(-1)[0]))]}))));
