import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,readFile,writeFile,unlink,rmdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';
import {once} from 'node:events';

test('server restart restores encrypted connections, replaces/deletes keys, and preserves corrupt store',{skip:process.platform!=='win32'},async()=>{
 const directory=await mkdtemp(join(tmpdir(),'jueony-persistence-test-')),file=join(directory,'connections.dpapi');
 const origin='http://127.0.0.1:4198',config={id:'remember-test',adapterId:'hyperclova',label:'가짜 키 검증',modelId:'HCX-005',endpoint:'https://clovastudio.stream.ntruss.com/v3/chat-completions'};
 let server,token,logs='';
 const stop=async()=>{if(server&&server.exitCode===null){const closed=once(server,'exit');server.kill();await closed;}};
 const post=(path,data={})=>fetch(origin+'/api/'+path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','X-Jueony-Token':token},body:JSON.stringify(data)});
 const start=async()=>{
  server=spawn(process.execPath,[resolve('apps/launcher/server.mjs')],{env:{...process.env,JUEONY_PORT:'4198',JUEONY_DIST:resolve('apps/editor/dist'),JUEONY_CONNECTION_STORE:file},windowsHide:true,stdio:['ignore','pipe','pipe']});
  server.stdout.on('data',b=>logs+=b);server.stderr.on('data',b=>logs+=b);
  let ready=false;for(let i=0;i<100;i++){if(server.exitCode!==null)throw new Error('Isolated server failed');ready=await fetch(origin+'/api/health').then(r=>r.ok,()=>false);if(ready)break;await new Promise(r=>setTimeout(r,100));}assert.ok(ready);
  token=(await (await fetch(origin+'/api/session',{headers:{Origin:origin,'X-Jueony-Bootstrap':'1'}})).json()).token;
 };
 try{
  assert.equal(await fetch(origin+'/api/health').then(()=>true,()=>false),false,'Isolated port must be free');await start();
  assert.equal((await post('configure',{config,key:'fake-persist-key',remember:true})).status,200);
  assert.ok(!(await readFile(file)).includes('fake-persist-key'));await stop();await start();
  let info=await (await post('connections')).json();assert.equal(info.secureStorage,true);assert.equal(info.warning,'');assert.deepEqual(info.connections,[{config,remember:true,hasKey:true}]);assert.doesNotMatch(JSON.stringify(info),/fake-persist-key/);
  assert.equal((await post('configure',{config:{...config,label:'Renamed'},remember:true})).status,200);
  assert.equal((await post('configure',{config,key:'fake-new-key',remember:true})).status,200);await stop();await start();
  assert.equal((await post('remove-connection',{configId:config.id})).status,200);await stop();await start();assert.deepEqual((await (await post('connections')).json()).connections,[]);
  assert.equal((await post('configure',{config,key:'fake-persist-key',remember:true})).status,200);
  await stop();await writeFile(file,'corrupt');await start();info=await (await post('connections')).json();assert.ok(info.warning);assert.deepEqual(info.connections,[]);
  assert.equal((await post('configure',{config,key:'fake-new-key',remember:true})).status,400);assert.equal(await readFile(file,'utf8'),'corrupt');
  assert.equal((await post('clear-credentials')).status,200);assert.equal((await post('connections')).status,200);
  assert.doesNotMatch(logs,/fake-persist-key|fake-new-key/);
 }finally{await stop();await unlink(file).catch(()=>{});await rmdir(directory);}
});
