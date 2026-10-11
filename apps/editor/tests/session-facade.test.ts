import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSessionFacade, createSessionGuard } from '../src/modules/session/public/index.ts';
import type { SessionTab, SessionWorkspace } from '../src/modules/session/public/index.ts';

function setup() {
  let activeWorkspaceId = 'a';
  const workspaces: SessionWorkspace[] = [{ id: 'a' }, { id: 'b' }];
  const tabs: SessionTab[] = [];
  const facade = createSessionFacade({
    state: { activeWorkspaceId: () => activeWorkspaceId, workspaces: () => workspaces, tabs: () => tabs },
    lifecycle: {
      setOrder: (id, order) => { workspaces.find(workspace => workspace.id === id)!.documentOrder = order; },
      setActiveDocument: (id, documentId) => { workspaces.find(workspace => workspace.id === id)!.activeDocumentId = documentId; },
    },
  });
  const open = (id: string, workspaceId = activeWorkspaceId) => {
    const tab = { id, workspaceId, closed: false };
    tabs.push(tab);
    facade.opened(tab);
    return tab;
  };
  return { facade, tabs, workspaces, open, switchTo: (id: string) => { activeWorkspaceId = id; } };
}

test('session registration owns order while selection rejects another workspace or missing tab', () => {
  const { facade, open, workspaces } = setup();
  open('a1'); open('a2'); open('b1', 'b');
  assert.deepEqual(workspaces[0].documentOrder, ['a1', 'a2']);
  assert.deepEqual(workspaces[1].documentOrder, ['b1']);
  assert.equal(facade.select('a2'), true);
  assert.equal(facade.select('b1'), false);
  assert.equal(facade.select('missing'), false);
  assert.equal(workspaces[0].activeDocumentId, 'a2');
  assert.equal(workspaces[1].activeDocumentId, undefined);
});

test('closed selected tab chooses the first surviving document and last-tab close requests a blank', () => {
  const { facade, open, tabs, workspaces } = setup();
  const first = open('first'), second = open('second');
  facade.select('second');
  second.closed = true; tabs.splice(tabs.indexOf(second), 1);
  assert.equal(facade.closed(second), 'first');
  assert.equal(workspaces[0].activeDocumentId, 'first');
  assert.deepEqual(workspaces[0].documentOrder, ['first']);
  assert.equal(facade.select('second'), false);
  first.closed = true; tabs.splice(tabs.indexOf(first), 1);
  assert.equal(facade.closed(first), undefined);
  assert.equal(workspaces[0].activeDocumentId, undefined);
  assert.deepEqual(workspaces[0].documentOrder, []);
});

test('an unsuccessful close keeps tab order and active selection intact', () => {
  const { facade, open, workspaces } = setup();
  const tab = open('dirty'); facade.select(tab.id);
  assert.throws(() => facade.closed(tab), /닫기를 완료/);
  assert.deepEqual(workspaces[0].documentOrder, ['dirty']);
  assert.equal(workspaces[0].activeDocumentId, 'dirty');
});

test('closing a background-workspace record never selects it into the current workspace', () => {
  const { facade, open, workspaces } = setup();
  open('a1'); facade.select('a1');
  const background = open('b1', 'b'); workspaces[1].activeDocumentId = 'b1';
  background.closed = true;
  assert.equal(facade.closed(background), 'a1');
  assert.equal(workspaces[0].activeDocumentId, 'a1');
  assert.equal(workspaces[1].activeDocumentId, undefined);
});

test('restore preserves saved order and orphan recovery records without mutating the input', () => {
  const { facade, workspaces } = setup();
  workspaces[0].documentOrder = ['third', 'removed', 'second', 'third', 'first'];
  const records = ['first', 'second', 'third', 'orphan'].map(id => ({ id, workspaceId: 'a', bytes: new Uint8Array([1]) }));
  const before = records.map(record => record.id);
  const ordered = facade.restore('a', records);
  assert.deepEqual(ordered.map(record => record.id), ['third', 'second', 'first', 'orphan']);
  assert.deepEqual(records.map(record => record.id), before);
  assert.strictEqual(ordered[0], records[2]);
  assert.throws(() => facade.restore('b', records), /다른 업무/);
  assert.throws(() => facade.restore('a', [records[0], records[0]]), /중복/);
});

test('workspace return chooses its prior live tab and falls back from a closed or foreign selection', () => {
  const { facade, open, workspaces, switchTo } = setup();
  open('a1'); const second = open('a2'); open('b1', 'b');
  facade.select('a2'); switchTo('b'); facade.select('b1'); switchTo('a');
  assert.equal(facade.preferred('a'), 'a2');
  assert.equal(facade.preferred('a', 'b1'), 'a1');
  second.closed = true;
  assert.equal(facade.preferred('a'), 'a1');
  assert.equal(workspaces[1].activeDocumentId, 'b1');
});

test('an explicit absent persisted selection falls back to the first tab after restore opened others', () => {
  const { facade, open, workspaces } = setup();
  const previousDocumentId = workspaces[0].activeDocumentId;
  open('first'); facade.select('first');
  open('last'); facade.select('last');
  assert.equal(facade.preferred('a', previousDocumentId), 'first');
  assert.equal(facade.preferred('a'), 'last');
});

test('selection eligibility does not alter the saved selection before a viewport is suspended', () => {
  const { facade, open, workspaces } = setup();
  open('first'); open('next'); facade.select('first');
  assert.equal(facade.canSelect('next'), true);
  assert.equal(workspaces[0].activeDocumentId, 'first');
  assert.equal(facade.canSelect('missing'), false);
});

test('duplicate registration fails before changing order or resolving ambiguous IDs', () => {
  const { facade, open, tabs, workspaces } = setup();
  open('a1');
  const duplicate = { id: 'a1', workspaceId: 'b', closed: false };
  tabs.push(duplicate);
  assert.throws(() => facade.opened(duplicate), /중복/);
  assert.deepEqual(workspaces[0].documentOrder, ['a1']);
  assert.equal(workspaces[1].documentOrder, undefined);
  assert.equal(facade.select('a1'), false);
});

test('navigation guard blocks applying, close and restore before cancelling generation', () => {
  let state: { closing: boolean; restoring: boolean; runStatus?: string } = { closing: false, restoring: false };
  let cancellations = 0;
  const notices: string[] = [];
  const guard = createSessionGuard(() => state, () => { cancellations++; }, message => notices.push(message));
  for (const blocked of [{ closing: true, restoring: false }, { closing: false, restoring: true }, { closing: false, restoring: false, runStatus: 'applying' }]) {
    state = blocked;
    assert.equal(guard.canNavigate(), false);
  }
  assert.equal(cancellations, 0); assert.equal(notices.length, 3);
  state = { closing: false, restoring: false, runStatus: 'generating' };
  assert.equal(guard.canNavigate(), true); assert.equal(cancellations, 1);
});
