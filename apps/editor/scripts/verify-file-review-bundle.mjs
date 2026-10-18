/** Validate a built bundle without launching its desktop window or reading saved credentials. */
import assert from 'node:assert/strict';
import {readFile,readdir,writeFile,mkdir} from 'node:fs/promises';
import {resolve,join,isAbsolute,relative} from 'node:path';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
for(const key of['JUEONY_BUNDLE','JUEONY_TEST_OUTPUT'])assert.ok(isAbsolute(process.env[key]??''),key+' absolute required');
const bundle=resolve(process.env.JUEONY_BUNDLE),out=resolve(process.env.JUEONY_TEST_OUTPUT),port=Number(process.env.JUEONY_TEST_PORT??4356),origin=`http://127.0.0.1:${port}`;
await mkdir(out,{recursive:true});
assert.equal(await fetch(origin+'/api/health').then(()=>true,()=>false),false,'occupied port; no existing server is terminated');
const checks=[],sha=b=>createHash('sha256').update(b).digest('hex');let child,exited;
try{
 child=spawn(join(bundle,'runtime/node.exe'),[join(bundle,'server.mjs')],{cwd:bundle,windowsHide:true,stdio:'ignore',env:{...process.env,JUEONY_PORT:String(port),JUEONY_DIST:join(bundle,'dist'),JUEONY_CONNECTION_STORE:'memory'}});
 exited=new Promise((ok,no)=>{child.once('exit',ok);child.once('error',no);});
 let healthy=false;for(let i=0;i<100;i++){healthy=await fetch(origin+'/api/health').then(r=>r.ok,()=>false);if(healthy)break;await new Promise(ok=>setTimeout(ok,100));}
 assert.equal(healthy,true);assert.equal((await(await fetch(origin+'/api/health')).json()).application,'jueony');checks.push('isolated owned server health');
 const metadata=JSON.parse(await readFile(join(bundle,'dist/build-evidence.json'),'utf8'));
 assert.deepEqual(await(await fetch(origin+'/build-evidence.json')).json(),metadata);assert.match(metadata.agentBoundSavePatchSha256,/^[a-f0-9]{64}$/);
 const wire=await import(pathToFileURL(join(bundle,'contracts/document-wire-schema.mjs')));assert.ok(wire.controlKinds.includes('save_active_document'));const save=wire.generationSchema().properties.operations.items.anyOf.find(op=>op.properties.kind.enum[0]==='save_active_document');assert.deepEqual(save.required,['kind','contextStamp']);assert.deepEqual(Object.keys(save.properties).sort(),['contextStamp','kind']);checks.push('served exact build and packaged bound-save wire contract');
 for(const path of['/','/editor.html']){const r=await fetch(origin+path);assert.equal(r.ok,true);assert.match(r.headers.get('content-security-policy'),/connect-src 'self'/);assert.equal(sha(Buffer.from(await r.arrayBuffer())),sha(await readFile(join(bundle,'dist',path==='/'?'index.html':path.slice(1)))));checks.push(path+' exact local HTML and CSP');}
 const files=[];async function walk(dir){for(const e of await readdir(dir,{withFileTypes:true})){const p=join(dir,e.name);if(e.isDirectory())await walk(p);else if(/^rhwp_bg.*\.wasm$/.test(e.name))files.push(p);}}await walk(join(bundle,'dist'));assert.equal(files.length,1);
 const served=await fetch(origin+'/'+relative(join(bundle,'dist'),files[0]).replaceAll('\\','/'));assert.equal(sha(Buffer.from(await served.arrayBuffer())),metadata.engineWasmSha256);checks.push('served exact engine WASM');
 const denied=await fetch(origin+'/api/connections',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:'{}'});assert.equal(denied.status,403);checks.push('unauthenticated backend refused');
 const session=await(await fetch(origin+'/api/session',{headers:{Origin:origin,'x-jueony-bootstrap':'1'}})).json();
 const connections=await fetch(origin+'/api/connections',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','x-jueony-token':session.token},body:'{}'});assert.equal(connections.ok,true);const value=await connections.json();assert.ok(Array.isArray(value)?value.length===0:Array.isArray(value.connections)&&value.connections.length===0);checks.push('backend initialized with isolated empty memory store');
 await writeFile(join(out,'result.json'),JSON.stringify({passed:checks.length,failed:0,checks,build:metadata,scope:'Owned temporary HTTP backend only. No GUI/desktop input, real API calls, credential reads or user document access. Child stopped after checks.'},null,2));console.log('PASS '+checks.length+' bundle checks');
}finally{if(child){child.kill();await exited;}}
