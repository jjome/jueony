import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';

if(process.platform!=='win32')throw new Error('This verifier requires real Windows share/readonly behavior');
if(!process.env.JUEONY_ENGINE_PACKAGE)throw new Error('An explicit, compiled engine package is required');
const repo=fileURLToPath(new URL('../../../',import.meta.url)),pkg=resolve(repo,process.env.JUEONY_ENGINE_PACKAGE);
const out=resolve(repo,process.env.JUEONY_TEST_OUTPUT??'build/native-file-storage'),hash=bytes=>createHash('sha256').update(bytes).digest('hex');
await mkdir(out,{recursive:true});
const engine=JSON.parse(await readFile(resolve(pkg,'jueony-engine-build.json'),'utf8')),wasm=await readFile(resolve(pkg,'rhwp_bg.wasm'));
assert.equal(hash(wasm),engine.wasmSha256);assert.equal(hash(await readFile(resolve(pkg,'rhwp.js'))),engine.jsSha256);
const {default:init,HwpDocument}=await import(pathToFileURL(resolve(pkg,'rhwp.js')).href);await init({module_or_path:wasm});
const doc=HwpDocument.createEmpty(),files=[];
try{
 doc.createBlankDocument();doc.insertText(0,0,0,'문서 저장·복구 원문 😀');
 for(const kind of ['original','edited']){
  if(kind==='edited')doc.insertText(0,0,0,'수정 후: ');
  for(const ext of ['hwp','hwpx']){
   const bytes=doc[ext==='hwp'?'exportHwp':'exportHwpx'](),reopened=new HwpDocument(bytes);
   try{assert.equal(reopened.getSourceFormat(),ext);assert.equal(reopened.getTextRange(0,0,0,reopened.getParagraphLength(0,0)),kind==='edited'?'수정 후: 문서 저장·복구 원문 😀':'문서 저장·복구 원문 😀');}finally{reopened.free();}
   const name=kind+'.'+ext;await writeFile(resolve(out,name),bytes);files.push({name,sha256:hash(bytes)});
  }
 }
}finally{doc.free();}
const env={...process.env,RUSTUP_HOME:resolve(repo,'.tools/rustup'),CARGO_HOME:resolve(repo,'.tools/cargo'),JUEONY_NATIVE_STORAGE_FIXTURES:out};
const result=spawnSync(resolve(repo,'.tools/cargo/bin/cargo.exe'),['test','--offline','--locked','--manifest-path',resolve(repo,'apps/editor/native-storage-tests/Cargo.toml'),'--target-dir',resolve(repo,'build/native-storage-target')],{cwd:repo,env,encoding:'utf8',windowsHide:true,timeout:180000});
const log=(result.stdout??'')+(result.stderr??'');await writeFile(resolve(out,'native-tests.txt'),log);
const match=log.match(/test result: ok\. (\d+) passed; (\d+) failed; (\d+) ignored/);
const sourceSha256=hash(await readFile(resolve(repo,'apps/editor/src-tauri/src/storage.rs')));
await writeFile(resolve(out,'result.json'),JSON.stringify({status:result.status===0&&match?'PASS':'FAIL',exitCode:result.status,spawnError:result.error?String(result.error):null,passed:match?Number(match[1]):0,failed:match?Number(match[2]):null,ignored:match?Number(match[3]):null,hostPlatform:process.platform,sourceSha256,engine,files,scope:'Actual production Rust storage.rs on real Windows files; readonly/exclusive/replacement-denying locks and external-change read guard. Synthetic HWP/HWPX engine fixtures are byte-compared across native writes. No native picker UI, full Tauri GUI, Windows ACL matrix, power-loss or Hancom comparison.'},null,2));
assert.equal(result.status,0,log);assert.ok(match,'Missing native test summary');assert.equal(Number(match[1]),10);assert.equal(Number(match[2]),0);assert.equal(Number(match[3]),0);console.log('PASS 10 native Windows storage checks; actual engine fixtures '+engine.sourceId);
