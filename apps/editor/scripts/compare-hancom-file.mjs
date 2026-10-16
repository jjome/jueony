import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {absolutePath,loadReviewEngine,hash,snapshot,compareSnapshots,writeJSON,ensureNewOutputDirectory} from './lib/hancom-review.mjs';

const args=Object.fromEntries(process.argv.slice(2).reduce((pairs,item,index,all)=>index%2?pairs:[...pairs,[item,all[index+1]]],[]));
for(const required of ['--engine','--input','--output','--report'])absolutePath(args[required],required);
if(Object.keys(args).some(key=>!['--engine','--input','--output','--report'].includes(key)))throw Error('Unknown comparison argument');
const engine=await loadReviewEngine(args['--engine']),input=absolutePath(args['--input'],'input'),output=absolutePath(args['--output'],'output'),reportDir=await ensureNewOutputDirectory(args['--report']);
if(input===output)throw Error('Input and independently saved output must be different files');
const beforeBytes=await readFile(input),afterBytes=await readFile(output);let before,after;
try{
 before=new engine.HwpDocument(beforeBytes);after=new engine.HwpDocument(afterBytes);const left=snapshot(before),right=snapshot(after),comparison=compareSnapshots(left,right);
 await writeJSON(join(reportDir,'before-snapshot.json'),left);await writeJSON(join(reportDir,'after-snapshot.json'),right);
 const report={createdAt:new Date().toISOString(),input,inputSha256:hash(beforeBytes),output,outputSha256:hash(afterBytes),enginePackage:engine.pkg,engine:engine.metadata,verifierSha256:hash(await readFile(new URL(import.meta.url))),helperSha256:hash(await readFile(new URL('./lib/hancom-review.mjs',import.meta.url))),...comparison,redistribution:'Ignored local snapshots and diffs may contain public source document text; do not add them or public derivatives to Git or product distribution.'};
 await writeJSON(join(reportDir,'result.json'),report);console.log(JSON.stringify({status:report.status,pages:report.pages,semanticDifferences:report.semantic.count,geometryDifferences:report.geometry.count,geometryTolerance:0.2,readIssues:report.semantic.readIssues.before.length+report.semantic.readIssues.after.length}));
 if(report.status!=='SAME_WITHIN_PUBLISHED_CONTRACT')process.exitCode=1;
}finally{before?.free();after?.free();}
