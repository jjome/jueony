import assert from 'node:assert/strict';
import test from 'node:test';
import {initialState} from '../src/adapters/storage/legacy-records.ts';
import {workspaceMacroRepository} from '../src/adapters/storage/workspace-macro-repository.ts';
import type {CommandMacro} from '../src/modules/automation/public/index.ts';

function fixture(){
  const state=initialState();
  state.workspaces=[{id:'first',name:'1번 업무',activeChatId:'chat-first'},
    {id:'second',name:'2번 업무',activeChatId:'chat-second'}];
  const command:CommandMacro={id:'command',workspaceId:'first',createdAt:1,name:'기록',
    template:{version:1,operations:[{kind:'create_document',paragraphs:['본문']}],anchors:{}}};
  const manual={id:'manual',workspaceId:'second',createdAt:2,json:'fixture'};
  return {state,command,manual};
}

test('command and manual macros preserve legacy fields and only allow edits within their workspace',async()=>{
  const {state,command,manual}=fixture();
  state.macros=[command];
  state.alignmentMacros=[manual];
  let writes=0;
  const repo=workspaceMacroRepository(()=>state,async()=>{writes++;});
  assert.deepEqual(repo.commands.list('first'),[command]);
  assert.deepEqual(repo.commands.list('second'),[]);
  assert.deepEqual(repo.manual.list('second'),[manual]);
  await assert.rejects(repo.commands.rename('second','command','다른 업무'),/찾지 못했습니다/u);
  await assert.rejects(repo.manual.remove('first','manual'),/찾지 못했습니다/u);
  await assert.rejects(repo.commands.rename('first','command',' '),/이름을 입력/u);
  assert.equal(writes,0);
  await repo.commands.rename('first','command','새 이름');
  await repo.manual.remove('second','manual');
  assert.deepEqual(state.macros,[{...command,name:'새 이름'}]);
  assert.deepEqual(state.alignmentMacros,[]);
  assert.equal(writes,2);
});

test('a failed macro write restores the previous collection before queued macro and workspace writes read it',async()=>{
  const {state,command,manual}=fixture();
  state.macros=[command];
  const first=Promise.withResolvers<void>();
  const snapshots:unknown[]=[];
  const repo=workspaceMacroRepository(()=>state,async()=>{
    snapshots.push(structuredClone(state.macros));
    if(snapshots.length===1)await first.promise;
  });
  const failed=repo.commands.rename('first','command','저장 실패');
  const rejection=assert.rejects(failed,/fixture failure/u);
  const workspaceSave=repo.persist();
  const queued=repo.manual.append(manual);
  await Promise.resolve();
  assert.equal(snapshots.length,1);
  assert.equal(state.macros[0].name,'저장 실패');
  first.reject(new Error('fixture failure'));
  await rejection;
  await workspaceSave;
  await queued;
  assert.deepEqual(state.macros,[command]);
  assert.deepEqual(state.alignmentMacros,[manual]);
  assert.deepEqual(snapshots,[[{...command,name:'저장 실패'}],[command],[command]]);
});
