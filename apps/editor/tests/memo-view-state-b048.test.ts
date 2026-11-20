import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import init, {HwpDocument} from '../node_modules/@rhwp/core/rhwp.js';
import {
  applyMemoViewChangeB048,
  captureMemoViewChangeB048,
  type MemoViewContextB048,
} from '../src/adapters/rhwp/memo-view-state-b048.ts';

await init({module_or_path: await readFile(new URL('../node_modules/@rhwp/core/rhwp_bg.wasm', import.meta.url))});

const point = (fieldId = 7, text = '확인 메모') => ({
  fieldId,
  memoIndex: fieldId + 1,
  text,
  author: '검토자',
  location: {sectionIndex: 0, paraIndex: 0, path: []},
  startCharIdx: 2,
  endCharIdx: 2,
  pointComment: true,
});

function context(overrides: Partial<{identity: unknown; revision: unknown; story: unknown}> = {}): MemoViewContextB048 {
  return {
    documentIdentity: () => overrides.identity ?? 'document-1',
    revision: () => overrides.revision ?? 'revision-1',
    story: () => overrides.story ?? 'body',
  };
}

test('B048 projects body point memos into visible markers and optional guide-line anchors', () => {
  const host = {getCommentListV1: () => JSON.stringify([point()])};
  const shown = captureMemoViewChangeB048(host, context(), {visible: true, guideLines: true});
  assert.equal(shown.status, 'ready');
  if (shown.status !== 'ready') return;
  const applied = applyMemoViewChangeB048(host, context(), shown.plan);
  assert.equal(applied.status, 'applied');
  if (applied.status !== 'applied') return;
  assert.deepEqual(applied.state.markers, [{
    fieldId: 7, memoIndex: 8, section: 0, paragraph: 0, offset: 2,
    text: '확인 메모', author: '검토자',
  }]);
  assert.deepEqual(applied.state.guideLineAnchors, [{fieldId: 7, section: 0, paragraph: 0, offset: 2}]);
  assert.equal(applied.state.commentCount, 1);

  const hidden = captureMemoViewChangeB048(host, context(), {visible: false, guideLines: true});
  assert.equal(hidden.status, 'ready');
  if (hidden.status !== 'ready') return;
  const hiddenApplied = applyMemoViewChangeB048(host, context(), hidden.plan);
  assert.equal(hiddenApplied.status, 'applied');
  if (hiddenApplied.status !== 'applied') return;
  assert.equal(hiddenApplied.state.commentCount, 1);
  assert.deepEqual(hiddenApplied.state.markers, []);
  assert.deepEqual(hiddenApplied.state.guideLineAnchors, []);
  assert.equal(hiddenApplied.state.guideLines, true, 'preference is retained while its effective output is hidden');
});

test('B048 fails closed for stale document/list, malformed/range memo, and special stories', () => {
  let list: unknown = [point()];
  const host = {getCommentListV1: () => JSON.stringify(list)};
  const captured = captureMemoViewChangeB048(host, context(), {visible: true, guideLines: false});
  assert.equal(captured.status, 'ready');
  if (captured.status !== 'ready') return;
  assert.deepEqual(applyMemoViewChangeB048(host, context({revision: 'revision-2'}), captured.plan),
    {status: 'blocked', reason: 'stale-document'});
  list = [point(), point(9, '추가 메모')];
  assert.deepEqual(applyMemoViewChangeB048(host, context(), captured.plan),
    {status: 'blocked', reason: 'stale-comments'});

  assert.deepEqual(captureMemoViewChangeB048({getCommentListV1: () => '[{"broken":true}]'}, context(), {visible: true, guideLines: true}),
    {status: 'blocked', reason: 'invalid-comment-list'});
  const ranged = {...point(), endCharIdx: 3, pointComment: false};
  assert.deepEqual(captureMemoViewChangeB048({getCommentListV1: () => [ranged]}, context(), {visible: true, guideLines: true}),
    {status: 'blocked', reason: 'unsupported-range-comment'});
  assert.deepEqual(captureMemoViewChangeB048({getCommentListV1: () => [point()]}, context({story: 'header'}), {visible: true, guideLines: true}),
    {status: 'blocked', reason: 'unsupported-story'});
  const nested = {...point(), location: {sectionIndex: 0, paraIndex: 0, path: ['table', 0]}};
  assert.deepEqual(captureMemoViewChangeB048({getCommentListV1: () => [nested]}, context(), {visible: true, guideLines: true}),
    {status: 'blocked', reason: 'unsupported-story'});
  assert.deepEqual(captureMemoViewChangeB048({} as never, context(), {visible: true, guideLines: true}),
    {status: 'blocked', reason: 'api-unavailable'});
});

test('B048 is a view-only projection: HWP/HWPX bytes and edit history calls remain untouched', () => {
  const document = HwpDocument.createEmpty();
  try {
    document.createBlankDocument();
    document.insertText(0, 0, 0, '메모 표시 대상 본문');
    const beforeHwp = document.exportHwp(), beforeHwpx = document.exportHwpx();
    const revision = createHash('sha256').update(beforeHwp).digest('hex');
    let forbiddenCalls = 0;
    const host = new Proxy(document as unknown as Record<string, unknown>, {get(target, key) {
      if (key === 'getCommentListV1') return () => JSON.stringify([point()]);
      if (['saveSnapshot', 'restoreSnapshot', 'discardSnapshot', 'insertCommentAtCursorV1', 'removeCommentV1'].includes(String(key))) {
        return () => { forbiddenCalls++; throw new Error('view state must not touch edit/history APIs'); };
      }
      const value = Reflect.get(target, key, target);
      return typeof value === 'function' ? value.bind(target) : value;
    }});
    const port = context({revision});
    for (const request of [
      {visible: true, guideLines: true},
      {visible: false, guideLines: false},
    ]) {
      const captured = captureMemoViewChangeB048(host, port, request);
      assert.equal(captured.status, 'ready');
      if (captured.status === 'ready') assert.equal(applyMemoViewChangeB048(host, port, captured.plan).status, 'applied');
    }
    assert.equal(forbiddenCalls, 0);
    assert.deepEqual(document.exportHwp(), beforeHwp);
    assert.deepEqual(document.exportHwpx(), beforeHwpx);
  } finally { document.free(); }
});
