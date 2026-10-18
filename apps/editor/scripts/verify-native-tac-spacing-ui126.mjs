// N001: reuse the real app save/history driver on three fixed Native TAC inputs.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join,isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadReviewEngine,hash} from './lib/hancom-review.mjs';
for(const key of ['JUEONY_ENGINE_PACKAGE','JUEONY_TEST_DIST','JUEONY_TEST_OUTPUT'])assert.ok(isAbsolute(process.env[key]??''),key);
const out=process.env.JUEONY_TEST_OUTPUT,driver=fileURLToPath(new URL('verify-general-native-layout-ui125.mjs',import.meta.url)),engine=await loadReviewEngine(process.env.JUEONY_ENGINE_PACKAGE),build=JSON.parse(await readFile(join(process.env.JUEONY_TEST_DIST,'build-evidence.json')));assert.equal(engine.metadata.wasmSha256,build.engineWasmSha256);await mkdir(out,{recursive:true});
const results=[],failures=[],children=[],pageErrors=[],consoleErrors=[],externalRequests=[];
for(const[index,fixture]of ['one-tac','three-tac','four-multipage'].entries()){
 const target=join(out,fixture),env={...process.env,JUEONY_TEST_OUTPUT:target,JUEONY_GENERAL_UI_CORPUS:fixture,JUEONY_GENERAL_UI_CASES:'two-table-reference',JUEONY_TEST_PORT:String(4404+index)},log=[];
 const code=await new Promise((resolve,reject)=>{const p=spawn(process.execPath,['--experimental-strip-types',driver],{env,windowsHide:true,stdio:['ignore','pipe','pipe']});p.stdout.on('data',b=>log.push(b));p.stderr.on('data',b=>log.push(b));p.on('error',reject);p.on('exit',resolve);});await writeFile(join(out,fixture+'.log'),Buffer.concat(log));
 const raw=await readFile(join(target,'result.json')),child=JSON.parse(raw);assert.equal(child.engine.wasmSha256,engine.metadata.wasmSha256);assert.equal(child.build.customSourceSha256,build.customSourceSha256);assert.equal(child.results.length,3);assert.deepEqual(child.selectedCases,['two-table-reference']);assert.equal(child.fixtureName,fixture+'.hwp');children.push({fixture,resultSha256:hash(raw),driverSha256:child.verifierSha256,exitCode:code});
 for(const r of child.results){const item={name:fixture+': '+r.name,status:r.status};results.push(item);if(r.status!=='PASS')failures.push(item);}if(code!==0&&child.failures.length===0)failures.push({name:fixture,error:'Driver exited '+code});pageErrors.push(...child.pageErrors);consoleErrors.push(...child.consoleErrors);externalRequests.push(...child.externalRequests);console.log(fixture,child.results.filter(r=>r.status==='PASS').length+'/3');
}
assert.equal(results.length,9);await writeFile(join(out,'result.json'),JSON.stringify({engine:engine.metadata,build,results,failures,children,pageErrors,consoleErrors,externalRequests,verifierSha256:hash(await readFile(fileURLToPath(import.meta.url))),scope:'N001 own Native TAC1/3 and four-table multipage actual app: prefix edit, ordinary SaveAs/Save, exact history, OPFS and independent disk readback, reopened follow-up, full live portable layout0.2 and unchanged production semantic guard. Child9 includes3 no-browser-error cases. No OS/Hancom/user documents/LLM. Original layout overflows, if any, are not claimed corrected by preservation equality.'},null,2));if(failures.length||pageErrors.length||consoleErrors.length||externalRequests.length)process.exitCode=1;
