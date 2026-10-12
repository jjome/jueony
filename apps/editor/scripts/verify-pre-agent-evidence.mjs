import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

const repo=resolve(dirname(fileURLToPath(import.meta.url)),'../../..');
const evidence=resolve(repo,'docs/evidence/pre-agent-2026-10-13');
const dist=resolve(repo,process.env.JUEONY_TEST_DIST??'apps/editor/evidence/dist-pre-agent');
const json=async path=>JSON.parse(await readFile(path,'utf8'));
const build=await json(resolve(dist,'build-evidence.json'));
const suites=[
 ['parity','browser',66],['session','browser',9],['table','browser',6],
 ['object-properties','browser',16],['page-border','browser',13],['formatting','browser',10],['agent','browser',9],
 ['page-border-engine','native',31],['table-engine','native',5],['style-order-engine','native',6],
 ['style-stories-engine','native',4],['document-insertion-engine','native',12],['bundle-compatibility','browser',4],
];
const results=[];
for(const [name,kind,minimum]of suites){
 const path=resolve(evidence,'checks',name+'.json'),bytes=await readFile(path),report=JSON.parse(bytes);
 assert.ok(Array.isArray(report.results)&&report.results.length>=minimum,`${name}: incomplete suite`);
 for(const field of ['failures','errors','pageErrors','consoleErrors','externalRequests'])if(report[field]!==undefined)assert.deepEqual(report[field],[],`${name}: ${field}`);
 const recorded=report.build?.engineBuild??report.engine;
 assert.equal(recorded?.wasmSha256,build.engineWasmSha256,`${name}: WASM provenance mismatch`);
 if(kind==='browser'){
  assert.equal(report.build?.customSourceSha256,build.customSourceSha256,`${name}: application source mismatch`);
  assert.equal(report.build?.buildScriptSha256,build.buildScriptSha256,`${name}: integration build mismatch`);
 }
 results.push({name,kind,passed:report.results.length,report:'checks/'+name+'.json',sha256:createHash('sha256').update(bytes).digest('hex')});
}
const units=await readFile(resolve(evidence,'checks/editor-unit.txt'),'utf8');
const count=label=>Number(units.match(new RegExp('^# '+label+' (\\d+)$','m'))?.[1]);
assert.ok(count('tests')>=348);assert.equal(count('tests'),count('pass'));for(const field of ['fail','cancelled','skipped','todo'])assert.equal(count(field),0,field);
const boundaries=await json(resolve(evidence,'checks/module-boundaries.json'));assert.equal(boundaries.ok,true);assert.deepEqual(boundaries.diagnostics,[]);
const corpus=await json(resolve(evidence,'corpus/report.json'));assert.equal(corpus.engine.wasmSha256,build.engineWasmSha256);assert.equal(corpus.reports.length,5);
assert.ok(corpus.reports.every(report=>report.open&&report.status!=='FAIL'),'public corpus opening failed');
const summary={verifiedAt:new Date().toISOString(),status:'PASS_SCOPED_AUTOMATED_CHECKS',
 scope:'Implemented editor paths, isolated browser sessions and same-engine serialization. Not full Hancom parity.',
 nativeHancomComparison:'DEFERRED_BY_USER',fullHancomParity:'NOT_COMPLETE',agentReconstruction:'NOT_STARTED_THIS_RUN',
 engine:{baseCommit:build.sourceCommit,wasmSha256:build.engineWasmSha256,optimized:build.engineBuild.optimized,patches:build.engineBuild.patches},
 application:{customSourceSha256:build.customSourceSha256,buildScriptSha256:build.buildScriptSha256},
 units:{passed:count('pass'),failed:0,skipped:0},moduleBoundaries:{ok:true,scannedFiles:boundaries.scannedFiles,moduleCount:boundaries.modules.length},
 browserCases:results.filter(row=>row.kind==='browser').reduce((sum,row)=>sum+row.passed,0),nativeCases:results.filter(row=>row.kind==='native').reduce((sum,row)=>sum+row.passed,0),results,
 publicCorpus:corpus.reports.map(report=>({id:report.id,contentStatus:report.status,exports:report.exports.map(row=>({format:row.format,guardStatus:row.guard?.status,issues:row.guard?.issues??[],unverified:row.guard?.unverified??[]}))})),
 limitations:['Native Hancom layout and complete menu parity are pending.','Cross-format preservation failures remain blocked by the production save guard.','Public corpus derivatives are excluded from the review bundle.','Paid LLM calls were not used in these regressions.']};
await writeFile(resolve(evidence,'verification-summary.json'),JSON.stringify(summary,null,2));
console.log(JSON.stringify({status:summary.status,units:summary.units,browserCases:summary.browserCases,nativeCases:summary.nativeCases,moduleBoundaries:summary.moduleBoundaries,fullHancomParity:summary.fullHancomParity},null,2));
