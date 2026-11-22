import assert from 'node:assert/strict';
import test from 'node:test';
import type {Reference} from '../src/adapters/files/references.ts';
import type {Folder} from '../src/adapters/storage/legacy-records.ts';
import {readWorkspaceReferences} from '../src/composition/workspace-reference-reader.ts';

function fixture() {
  const scope={workspaceId:'work',chatId:'chat'};
  const file=new File(['디스크에 저장한 자료'],'reference.txt');
  let fileReads=0;
  const handle={kind:'file',name:file.name,queryPermission:async()=> 'granted',
    async getFile(){fileReads++;return file;},async isSameEntry(other:FileSystemFileHandle){return other===handle;},
  } as FileSystemFileHandle;
  const input={scope,selected:[{workspaceId:scope.workspaceId,id:'selected',rootId:'root',path:'folder/reference.txt',handle}] as Reference[],
    folders:[{id:'root',workspaceId:scope.workspaceId,handle:{queryPermission:async()=> 'granted'}}] as Folder[],
    reader:{async readReference(){throw new Error('TXT is decoded without the document engine');}},
  };
  const api={fileHandle:()=>handle,readOpenReference:()=>({revision:'live',text:'저장하지 않은 최신 내용'}),
    snapshot:()=>{throw new Error('A live extraction should take precedence over the older fallback');},
  };
  return {input,handle,api,fileReads:()=>fileReads};
}

test('a user request prefers an open reference in its own workspace, while background indexing reads disk',async()=>{
  const f=fixture(),signal=new AbortController().signal;
  const openDocuments=()=>[
    {workspaceId:'other-work',closed:false,api:{...f.api,readOpenReference:()=>{throw new Error('Foreign workspace was read');}}},
    {workspaceId:f.input.scope.workspaceId,closed:true,api:{...f.api,readOpenReference:()=>{throw new Error('Closed tab was read');}}},
    {workspaceId:f.input.scope.workspaceId,closed:false,api:f.api},
  ];
  const [live]=await readWorkspaceReferences({...f.input,openDocuments},signal);
  assert.equal(live.text,'저장하지 않은 최신 내용');
  assert.deepEqual(live.sourceVersion,{kind:'open-document',revision:'live'});
  assert.equal(f.fileReads(),0);
  const [disk]=await readWorkspaceReferences(f.input,signal);
  assert.equal(disk.text,'디스크에 저장한 자료');
  assert.equal(disk.sourceVersion,undefined);
  assert.equal(f.fileReads(),1);
});

test('revoking the request during a live tab identity check discards the result before reading the tab or file',async()=>{
  const f=fixture(),controller=new AbortController();
  f.handle.isSameEntry=async()=>{controller.abort();return true;};
  const openDocuments=()=>[{workspaceId:f.input.scope.workspaceId,closed:false,api:{...f.api,readOpenReference:()=>{throw new Error('Revoked tab was read');}}}];
  await assert.rejects(readWorkspaceReferences({...f.input,openDocuments},controller.signal),{name:'AbortError'});
  assert.equal(f.fileReads(),0);
});

test('a tab bound to a different file during identity comparison cannot provide the selected source',async()=>{
  const f=fixture();
  let currentHandle=f.handle;
  f.handle.isSameEntry=async()=>{currentHandle={} as FileSystemFileHandle;return true;};
  const api={...f.api,fileHandle:()=>currentHandle,readOpenReference:()=>{throw new Error('Unrelated open document was read');}};
  const openDocuments=()=>[{workspaceId:f.input.scope.workspaceId,closed:false,api}];
  const [source]=await readWorkspaceReferences({...f.input,openDocuments},new AbortController().signal);
  assert.equal(source.text,'디스크에 저장한 자료');
  assert.equal(f.fileReads(),1);
});

test('background refresh keeps valid siblings while excluding missing or revoked references',async()=>{
  const f=fixture(),signal=new AbortController().signal;
  const revokedRoot={id:'revoked',workspaceId:f.input.scope.workspaceId,handle:{queryPermission:async()=> 'denied'}} as Folder;
  const expiredFile={...f.handle,async getFile(){throw new DOMException('Missing','NotFoundError');}};
  const missing={...f.input.selected[0],id:'missing',path:'folder/missing.txt',handle:expiredFile};
  const revoked={...f.input.selected[0],id:'revoked-child',rootId:revokedRoot.id};
  const selected=[missing,revoked,...f.input.selected],folders=[...f.input.folders,revokedRoot];
  const valid=await readWorkspaceReferences({...f.input,selected,folders,skipUnavailable:true},signal);
  assert.deepEqual(valid.map(source=>source.id),['root/folder/reference.txt']);
  assert.equal(f.fileReads(),1);
  await assert.rejects(readWorkspaceReferences({...f.input,selected,folders},signal),{name:'NotFoundError'});
  await assert.rejects(readWorkspaceReferences({...f.input,selected:[revoked],folders},signal),/권한/);
  await assert.rejects(readWorkspaceReferences({...f.input,selected:[{...revoked,workspaceId:'other'}],folders,skipUnavailable:true},signal),/다른 업무/);
  assert.equal(f.fileReads(),1);
});
