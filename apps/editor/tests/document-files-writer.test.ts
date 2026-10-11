import test from 'node:test';
import assert from 'node:assert/strict';
import {createSnapshotWriter} from '../src/modules/document-files/application/write-snapshot.ts';
import type {SnapshotSinkPort} from '../src/modules/document-files/ports/snapshot-write.ts';
const bytes=(value:string)=>new TextEncoder().encode(value);
const value=(data:Uint8Array)=>new TextDecoder().decode(data);
function fixture(){
 let revision='1:1',disk='old',remembered='old',locks=0;const calls:string[]=[];
 const writer=createSnapshotWriter({revision:()=>revision,fingerprint:async data=>value(data),beginSaving(){locks++;return {finish(){locks--;}};}});
 const sink:SnapshotSinkPort={readBytes:async()=>bytes(disk),readRememberedFingerprint:()=>remembered,rememberFingerprint:v=>remembered=v,async open(){calls.push('open');let pending='';return {async write(data){calls.push('write');pending=value(data);},async close(){calls.push('close');disk=pending;},async abort(){calls.push('abort');}};}};
 return {writer,sink,calls,setRevision:(v:string)=>revision=v,setDisk:(v:string)=>disk=v,disk:()=>disk,locks:()=>locks,remembered:()=>remembered};
}
test('DocumentFiles writer needs no DOM and detects disk changes before commit',async()=>{
 const f=fixture(),open=f.sink.open;f.sink.open=async()=>{const transaction=await open();return {...transaction,async write(data){await transaction.write(data);f.setDisk('external');}};};
 await assert.rejects(f.writer.write(f.sink,{expectedRevision:'1:1',bytes:bytes('new')}),/원본 파일/);
 assert.deepEqual(f.calls,['open','write','abort']);assert.equal(f.disk(),'external');assert.equal(f.locks(),0);assert.equal(f.remembered(),'old');
});
test('DocumentFiles writer aborts revision conflict and releases its lock for a subsequent save',async()=>{
 const f=fixture(),open=f.sink.open;f.sink.open=async()=>{const transaction=await open();return {...transaction,async write(data){await transaction.write(data);f.setRevision('1:2');}};};
 await assert.rejects(f.writer.write(f.sink,{expectedRevision:'1:1',bytes:bytes('new')}),/문서가 바뀌/);
 assert.deepEqual(f.calls,['open','write','abort']);assert.equal(f.locks(),0);
 f.sink.open=open;f.calls.length=0;await f.writer.write(f.sink,{expectedRevision:'1:2',bytes:bytes('new')});
 assert.deepEqual(f.calls,['open','write','close']);assert.equal(f.disk(),'new');assert.equal(f.remembered(),'new');
});
test('DocumentFiles serializes concurrent writes and does not abort after an acknowledged close',async()=>{
 const f=fixture();let release!:()=>void;const blocked=new Promise<void>(resolve=>release=resolve),open=f.sink.open;
 f.sink.open=async()=>{const transaction=await open();return {...transaction,async write(data){await blocked;await transaction.write(data);},async close(){await transaction.close();f.setRevision('1:2');}};};
 const first=f.writer.write(f.sink,{expectedRevision:'1:1',bytes:bytes('new')});
 await assert.rejects(f.writer.write(f.sink,{expectedRevision:'1:1',bytes:bytes('other')}),/이미 저장/);
 release();await assert.rejects(first,/문서가 바뀌/);
 assert.deepEqual(f.calls,['open','write','close']);assert.equal(f.disk(),'new');assert.equal(f.remembered(),'new');assert.equal(f.locks(),0);
});
