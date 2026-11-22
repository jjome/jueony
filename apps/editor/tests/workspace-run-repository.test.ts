import assert from 'node:assert/strict';
import test from 'node:test';
import {initialState, type Run} from '../src/adapters/storage/legacy-records.ts';
import {workspaceRunRepository} from '../src/adapters/storage/workspace-run-repository.ts';

test('run history shares the current state and validates the requested workspace and chat',()=>{
  const old:Run={id:'old',workspaceId:'one',chatId:'chat-one',documentId:'first',status:'completed',sources:[],createdAt:1};
  const foreign:Run={...old,id:'foreign',workspaceId:'two',chatId:'chat-two'};
  let state=initialState();
  const history=workspaceRunRepository(()=>state);
  state={...state,activeWorkspaceId:'one',workspaces:[
    {id:'one',name:'업무 하나',activeChatId:'chat-one'},
    {id:'two',name:'업무 둘',activeChatId:'chat-two'},
  ],chats:[
    {id:'chat-one',workspaceId:'one',title:'채팅 하나',messages:[]},
    {id:'chat-two',workspaceId:'two',title:'채팅 둘',messages:[]},
  ],runs:[old,foreign]};

  assert.deepEqual(history.list(old),[old]);
  assert.throws(()=>history.list({workspaceId:'one',chatId:'chat-two'}));
  assert.throws(()=>history.append({...foreign,id:'bad',workspaceId:'one'}));
  assert.throws(()=>history.append({...old}),/이미 있습니다/u);

  const next:Run={...old,id:'new',status:'preparing_context',createdAt:2};
  history.append(next);
  next.status='completed';
  assert.deepEqual(history.list(old),[old,next]);
  assert.deepEqual(state.runs,[old,foreign,next]);
  assert.equal(structuredClone(state).runs[2].status,'completed');
});
