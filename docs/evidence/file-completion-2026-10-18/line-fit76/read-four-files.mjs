import{readFile,writeFile}from'node:fs/promises';import{resolve,join}from'node:path';import{loadReviewEngine,hash,snapshot,compareSnapshots}from'../../../apps/editor/scripts/lib/hancom-review.mjs';
const out=resolve('build/Python3-width-own76/review76'),root=resolve('build/Python3-width-own76'),e=await loadReviewEngine(resolve('build/rhwp-engine/source-23d2545926a179a5/pkg'));
const data=[];
for(const name of ['own-gulimche-11pt97-29868-justify-no-ls.hwpx','own-gulimche-11pt97-29868-left-no-ls.hwpx','hancom-width-29868-justify.hwpx','hancom-width-29868-left.hwpx']){
 const bytes=await readFile(join(root,name)),d=new e.HwpDocument(bytes);try{
  const snap=snapshot(d),trace=JSON.parse(d.getFontDecisionTrace(0,'{}')),runs=JSON.parse(d.getPageTextLayout(0)).runs.filter(x=>x.cellIdx===0);
  const proof={name,sha256:hash(bytes),sourceFormat:d.getSourceFormat(),info:JSON.parse(d.getDocumentInfo()),snapshot:snap,fontTrace:trace};
  await writeFile(join(out,name+'.json'),JSON.stringify(proof,null,2));
  const records=trace.records.filter(x=>x.source?.nestedPath?.[1]===0);data.push({name,sha256:hash(bytes),sourceFormat:proof.sourceFormat,info:proof.info,partitions:runs.map(x=>({charStart:x.charStart,textChars:[...x.text].length,x:x.x,y:x.y,w:x.w,charX:x.charX})),cell:snap.semantic.values.cells[0],decisions:records.map(x=>({source:x.source,metric:x.layoutMetric}))});
 }finally{d.free();}
}
const comparisons=[];
for(const alignment of ['justify','left']){const a=JSON.parse(await readFile(join(out,'own-gulimche-11pt97-29868-'+alignment+'-no-ls.hwpx.json'),'utf8')),b=JSON.parse(await readFile(join(out,'hancom-width-29868-'+alignment+'.hwpx.json'),'utf8'));comparisons.push({alignment,...compareSnapshots(a.snapshot,b.snapshot)});}
await writeFile(join(out,'comparison.json'),JSON.stringify({engine:e.metadata,scope:'Independent official76 read-only four-file line/charX/frame evidence. All comparator differences retained; no tolerance or source changes. Actual Hancom LEFT first31 rejects Justify-only fresh-fit explanation.',files:data,comparisons},null,2));
for(const x of data)console.log(x.name,JSON.stringify(x.partitions.map(r=>[r.charStart,r.textChars,r.w])),x.info.hwp5OriginHwpx);
for(const x of comparisons)console.log(x.alignment,'sem',x.semantic.count,'geometry',x.geometry.count);
