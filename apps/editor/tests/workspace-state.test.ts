import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateAppState, WorkspaceStateError } from '../src/mvp/validate-state.ts';
import { initialState, interruptRuns } from '../src/mvp/model.ts';

function fixture(): any {
  return {
    version: 1, activeWorkspaceId: 'a', split: 42,
    workspaces: [{ id: 'a', name: '업무 A', activeChatId: 'ca' }, { id: 'b', name: '업무 B', activeChatId: 'cb' }],
    chats: [{ id: 'ca', workspaceId: 'a', title: '대화 A', messages: [{ id: 'm', role: 'user', text: '초안 작성', runId: 'ra' }] }, { id: 'cb', workspaceId: 'b', title: '대화 B', messages: [] }],
    folders: [],
    runs: [{ id: 'ra', workspaceId: 'a', chatId: 'ca', documentId: 'document', status: 'generating', sources: [], createdAt: 1 }],
    models: [{ id: 'model', adapterId: 'anthropic', label: '연결', endpoint: 'https://api.anthropic.com/v1', modelId: 'claude', maxOutputTokens: 8192 }],
  };
}
function rejected(state: unknown, field?: RegExp) {
  assert.throws(() => validateAppState(state), (error: unknown) => {
    assert.ok(error instanceof WorkspaceStateError);
    assert.match(error.message, /보존|초기화하지/);
    if (field) assert.match(error.field, field);
    return true;
  });
}
test('legacy v1 and fresh empty states validate without adding optional new fields', () => {
  const blank = initialState(); assert.strictEqual(validateAppState(blank), blank);
  const state = fixture(), before = JSON.stringify(state);
  assert.strictEqual(validateAppState(state), state); assert.equal(JSON.stringify(state), before);
  assert.equal(state.agentWidth, undefined); assert.equal(state.workspaces[0].documentOrder, undefined);
});
test('unknown additive fields and live file handles are preserved without invoking permissions', () => {
  const state = fixture(); const handle = { kind: 'directory', name: '자료', entries() {}, queryPermission() { throw new Error('must not call'); } };
  state.folders.push({ id: 'folder', workspaceId: 'a', name: '자료', handle });
  state.futureExtension = { retain: true }; state.workspaces[0].documentOrder = ['document', 'closed-doc'];
  state.workspaces[0].activeDocumentId = 'closed-doc'; state.agentWidth = 500; state.sidebarHidden = false;
  const result = validateAppState(state);
  assert.strictEqual(result.folders[0].handle, handle); assert.equal((result as any).futureExtension.retain, true);
});
test('missing active workspace and inactive/deleted model references retain shell fallback', () => {
  const state = fixture(); state.activeWorkspaceId = 'removed'; state.chats[0].modelId = 'removed';
  assert.strictEqual(validateAppState(state), state);
});
for (const input of [null, false, [], 'raw', 5]) {
  test('invalid root cannot become a new blank workspace: ' + String(input), () => rejected(input, /state/));
}
test('future and absent versions do not mutate the stored payload', () => {
  for (const version of [2, 99, undefined, '1']) {
    const state = fixture(); state.version = version; const before = JSON.stringify(state);
    rejected(state, /version/); assert.equal(JSON.stringify(state), before);
  }
});
test('each required collection is validated before any interrupted run is rewritten', () => {
  for (const key of ['workspaces', 'chats', 'folders', 'runs', 'models']) {
    const state = fixture(); state[key] = null; const before = JSON.stringify(state);
    rejected(state, new RegExp(key)); assert.equal(JSON.stringify(state), before);
  }
});
test('duplicate identity cannot shadow a workspace, chat, folder, model or run', () => {
  for (const key of ['workspaces', 'chats', 'models', 'runs']) {
    const state = fixture(); state[key].push({ ...state[key][0] }); rejected(state, new RegExp(key));
  }
});
test('workspace active chat must exist and belong to that workspace', () => {
  const cross = fixture(); cross.workspaces[0].activeChatId = 'cb'; rejected(cross, /activeChatId/);
  const missing = fixture(); missing.workspaces[0].activeChatId = 'missing'; rejected(missing, /activeChatId/);
});
test('chats and folders cannot reference a missing workspace', () => {
  const chat = fixture(); chat.chats[0].workspaceId = 'missing'; rejected(chat);
  const folder = fixture(); folder.folders.push({ id: 'folder', workspaceId: 'missing', name: '자료', handle: { kind: 'directory', name: '자료', entries() {} } }); rejected(folder, /workspaceId/);
});
test('revoked permission does not prevent restore but a non-directory handle is reported', () => {
  const state = fixture();
  state.folders.push({ id: 'folder', workspaceId: 'a', name: '자료', handle: { kind: 'directory', name: '자료', entries() {}, queryPermission: async () => 'denied' } });
  validateAppState(state); state.folders[0].handle.kind = 'file'; rejected(state, /handle/);
  state.folders[0].handle = {}; rejected(state, /handle/);
});
test('run and message histories cannot cross workspace or chat boundaries', () => {
  const run = fixture(); run.runs[0].chatId = 'cb'; rejected(run, /messages.runId|chatId/);
  const message = fixture(); message.chats[1].messages.push({ id: 'mb', role: 'assistant', text: '누출', runId: 'ra' }); rejected(message, /messages.runId/);
  const missing = fixture(); missing.runs[0].workspaceId = 'deleted'; rejected(missing);
});
test('missing legacy run log is allowed while existing linked runs are scoped', () => {
  const state = fixture(); state.runs = []; validateAppState(state);
  assert.equal(state.chats[0].messages[0].text, '초안 작성');
});
test('malformed messages, source metadata and run status are rejected', () => {
  for (const mutate of [
    (s: any) => { s.chats[0].messages = {}; },
    (s: any) => { s.chats[0].messages[0].role = 'system'; },
    (s: any) => { s.chats[0].messages[0].text = null; },
    (s: any) => { s.runs[0].sources = null; },
    (s: any) => { s.runs[0].sources = [{ id: 's', name: 'source', characters: NaN, sha256: 'hash' }]; },
    (s: any) => { s.runs[0].status = 'invented'; },
  ]) { const state = fixture(); mutate(state); rejected(state); }
});
test('invalid connection tokens, layout numbers and duplicated document order are rejected', () => {
  for (const mutate of [
    (s: any) => { s.models[0].maxOutputTokens = NaN; },
    (s: any) => { s.models[0].adapterId = 'unknown'; },
    (s: any) => { s.split = Infinity; },
    (s: any) => { s.agentWidth = -20; },
    (s: any) => { s.sidebarHidden = 'true'; },
    (s: any) => { s.workspaces[0].documentOrder = ['d', 'd']; },
  ]) { const state = fixture(); mutate(state); rejected(state); }
});
test('valid interrupted run may be rewritten only after validation, once', () => {
  const state = validateAppState(fixture()); interruptRuns(state); interruptRuns(state);
  assert.equal(state.runs[0].status, 'interrupted');
  assert.equal(state.chats[0].messages.filter(m => m.role === 'assistant').length, 1);
});
test('receipt summary validates without requiring optional old structural snapshots', () => {
  const state = fixture(); state.runs[0].receipt = { runId: 'ra', beforeRevision: 'before', afterRevision: 'after', before: '', after: '내용', operationCount: 1 };
  validateAppState(state); state.runs[0].receipt.runId = 'rb'; rejected(state, /receipt.runId/);
});
test('structural receipt malformed arrays are blocked before diff UI reads them', () => {
  const state = fixture(); state.runs[0].receipt = { runId: 'ra', beforeRevision: 'before', afterRevision: 'after', before: '', after: '내용', operationCount: 1, beforeStructure: { sections: [], paragraphs: [], tables: [], unsupportedControls: [] } };
  validateAppState(state);
  state.runs[0].receipt.beforeStructure.sections = null; rejected(state, /sections/);
});
test('corrupt optional retrieval and progress records are rejected before rendering',()=>{
 const state=fixture();state.runs[0].retrieval={mode:'lexical',hits:null};rejected(state,/retrieval/);
 delete state.runs[0].retrieval;state.runs[0].events={map:'not an array'};rejected(state,/events/);
 state.runs[0].events=[{phase:'reviewing',call:2,maxCalls:3,elapsedMs:100}];assert.strictEqual(validateAppState(state),state);
});
