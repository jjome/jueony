import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorkspaceFacade, interruptRuns } from '../src/modules/workspace/public/index.ts';
import type { InterruptedRun, WorkspaceState } from '../src/modules/workspace/public/index.ts';
import { createSerializedWriter } from '../src/adapters/storage/serialized-writer.ts';

function setup() {
  let state: WorkspaceState = { activeWorkspaceId: '', workspaces: [], chats: [] };
  let serial = 0;
  const ids = { next: () => `id-${++serial}` };
  const facade = createWorkspaceFacade({ state: { current: () => state }, ids });
  return { facade, ids, current: () => state, replace: (next: WorkspaceState) => { state = next; } };
}

test('workspace facade creates independent chats and scopes message writes without browser dependencies', () => {
  const { facade, current } = setup();
  const first = facade.addWorkspace(' 업무 A '), second = facade.addWorkspace('업무 B');
  assert.equal(first.name, '업무 A');
  assert.equal(current().activeWorkspaceId, second.id);
  assert.equal(facade.chat(first.id, first.activeChatId).title, '첫 채팅');
  const next = facade.addChat(first.id, '  ');
  facade.appendMessage(first.id, next.id, { id: 'message', role: 'user', text: '기록' });
  assert.equal(next.title, '새 채팅');
  assert.equal(facade.workspace(first.id).activeChatId, next.id);
  assert.deepEqual(facade.chat(second.id, second.activeChatId).messages, []);
  assert.throws(() => facade.appendMessage(second.id, next.id, { id: 'leak', role: 'assistant', text: '안 됨' }), /이 업무의 채팅/);
  assert.equal(next.messages.length, 1);
});

test('facade resolves the current owner state after restore instead of retaining a stale aggregate', () => {
  const { facade, replace } = setup();
  const before = facade.addWorkspace('이전');
  const next: WorkspaceState = { activeWorkspaceId: '', workspaces: [], chats: [] };
  replace(next);
  assert.throws(() => facade.workspace(before.id), /업무를 찾을/);
  const restored = facade.addWorkspace('복원 이후');
  assert.equal(next.workspaces.length, 1);
  assert.equal(next.activeWorkspaceId, restored.id);
});

test('workspace slice mutations retain unrelated owner data and recovery does not duplicate messages', () => {
  const { facade, current, ids } = setup();
  const workspace = facade.addWorkspace('업무');
  const state = Object.assign(current(), {
    runs: [{ id: 'run', workspaceId: workspace.id, chatId: workspace.activeChatId, status: 'applying' }] as InterruptedRun[],
    preferences: { theme: 'dark' },
  });
  interruptRuns(state, ids.next);
  interruptRuns(state, ids.next);
  assert.equal(state.runs[0].status, 'interrupted');
  assert.equal(facade.chat(workspace.id, workspace.activeChatId).messages.length, 1);
  assert.deepEqual(state.preferences, { theme: 'dark' });
});

test('serialized physical-store writer does not overlap state and document commits', async () => {
  const writer = createSerializedWriter(), events: string[] = [];
  let release!: () => void;
  const blocked = new Promise<void>(resolve => { release = resolve; });
  const first = writer.run(async () => { events.push('state:start'); await blocked; events.push('state:end'); return 1; });
  const second = writer.run(async () => { events.push('document'); return 2; });
  await Promise.resolve();
  assert.deepEqual(events, ['state:start']);
  release();
  assert.deepEqual(await Promise.all([first, second]), [1, 2]);
  assert.deepEqual(events, ['state:start', 'state:end', 'document']);
});

test('failed commit is observable and later persistence can still complete', async () => {
  const writer = createSerializedWriter();
  const failed = writer.run(async () => { throw new Error('quota'); });
  const next = writer.run(async () => 'saved');
  await assert.rejects(failed, /quota/);
  assert.equal(await next, 'saved');
  await writer.settled();
});
