import assert from 'node:assert/strict';
import test from 'node:test';
import {createReferenceIndexRefresh} from '../src/composition/reference-index-refresh.ts';

test('a refresh requested during cancellation runs once with the current scope when the earlier I/O settles',async()=>{
  const written:string[]=[];
  const observed:string[]=[];
  let workspaceId='previous';
  let release!:()=>void;
  const previousRead=new Promise<void>(resolve=>{release=resolve;});
  const refresh=createReferenceIndexRefresh(()=>{
    const chosen=workspaceId;
    return {scope:{workspaceId:chosen,chatId:'chat'},async readSources(){
      observed.push(chosen);
      if(chosen==='previous')await previousRead;
      return [];
    }};
  },{
    async refreshIndex(scope){written.push(scope.workspaceId);},
    async clearIndex(){throw Error('Cancellation must not clear a different scope');},
  });
  const former=refresh.refresh();
  await Promise.resolve();
  assert.deepEqual(observed,['previous']);
  refresh.cancel();
  workspaceId='current';
  const next=refresh.refresh();
  const repeated=refresh.refresh();
  release();
  await Promise.all([former,next,repeated]);
  assert.deepEqual(observed,['previous','current']);
  assert.deepEqual(written,['current']);
});
