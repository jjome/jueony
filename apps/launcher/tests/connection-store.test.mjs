import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,unlink,rmdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createConnectionStore} from '../connection-store.mjs';

test('Windows DPAPI encrypts, restores, replaces and deletes without plaintext fallback',{skip:process.platform!=='win32'},async()=>{
 const directory=await mkdtemp(join(tmpdir(),'jueony-credentials-test-')),file=join(directory,'connections.dpapi');
 const store=createConnectionStore(file),records=[{config:{id:'test',label:'검증'},key:'fake-secret-ONLY-for-test'}];
 try{
  assert.equal(store.available,true);assert.deepEqual(await store.load(),[]);
  await store.save(records);const encrypted=await readFile(file);assert.ok(!encrypted.includes(records[0].key));assert.ok(!encrypted.includes('connections'));
  assert.deepEqual(await createConnectionStore(file).load(),records);
  records[0].key='replacement-fake-secret';await store.save(records);assert.deepEqual(await store.load(),records);
  await writeFile(file,'corrupt encrypted file');await assert.rejects(store.load(),e=>Boolean(e.safeMessage));assert.equal(await readFile(file,'utf8'),'corrupt encrypted file');
  await store.clear();assert.deepEqual(await store.load(),[]);
  await assert.rejects(createConnectionStore(null).save(records));
 }finally{await unlink(file).catch(()=>{});await rmdir(directory);}
});
