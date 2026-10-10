import test from 'node:test';
import assert from 'node:assert/strict';
import { HangulKeyResolver, keyStroke, hangulBindings } from '../src/shortcuts/keymap.ts';
const ctx = { table: false, cells: false, object: false };
const key = (code: string, mods: Partial<KeyboardEvent> = {}) => ({ code, key: code.startsWith('Key') ? code.slice(3).toLowerCase() : code, ctrlKey: false, altKey: false, shiftKey: false, metaKey: false, repeat: false, isComposing: false, ...mods });
test('한글의 원래 의미를 유지하며 이전 잘못된 매핑을 제거한다', () => {
  const r = new HangulKeyResolver();
  assert.equal(r.resolve(key('KeyY', { ctrlKey: true }), ctx).binding?.command, 'ext:jueony-delete-line');
  assert.equal(r.resolve(key('KeyC', { altKey: true, shiftKey: true }), ctx).binding?.command, 'ext:jueony-normal');
  assert.equal(r.resolve(key('KeyO', { ctrlKey: true }), ctx).binding?.command, 'pending:insert-document');
  assert.equal(r.resolve(key('KeyR', { ctrlKey: true, shiftKey: true }), ctx).binding?.command, 'format:align-right');
});
test('한영 상태의 물리 키와 modifier 조합을 구분한다', () => {
  assert.equal(keyStroke(key('KeyS', { key: 'ㄴ', altKey: true })), 'Alt+S');
  const r = new HangulKeyResolver();
  assert.equal(r.resolve(key('KeyS', { key: 'ㄴ', altKey: true }), ctx).binding?.command, 'file:save');
  assert.equal(r.resolve(key('KeyS', { ctrlKey: true, altKey: true }), ctx).handled, false);
  assert.equal(r.resolve(key('KeyS', { metaKey: true }), ctx).handled, false);
});
test('연속키 색상과 표가 분리되고 modifier를 놓아도 두 번째 키가 동작한다', () => {
  const r = new HangulKeyResolver();
  r.resolve(key('KeyN', { ctrlKey: true }), ctx, 0); r.resolve(key('ControlLeft', { key: 'Control' }), ctx, 1);
  assert.equal(r.resolve(key('KeyT', { key: 'ㅅ' }), ctx, 2).binding?.command, 'table:create');
  r.resolve(key('KeyM', { ctrlKey: true }), ctx, 3);
  assert.equal(r.resolve(key('KeyR'), ctx, 4).binding?.params?.textColor, '#ff0000');
});
test('연속키 만료 취소 반복과 잘못된 후속 키가 문서를 바꾸지 않는다', () => {
  const r = new HangulKeyResolver();
  r.resolve(key('KeyN', { ctrlKey: true }), ctx, 0);
  assert.equal(r.resolve(key('KeyT'), ctx, 4000).handled, false);
  r.resolve(key('KeyN', { ctrlKey: true }), ctx, 5000); r.resolve(key('Escape'), ctx, 5001);
  assert.equal(r.resolve(key('KeyT'), ctx, 5002).handled, false);
  r.resolve(key('KeyN', { ctrlKey: true }), ctx, 6000);
  assert.equal(r.resolve(key('KeyN', { ctrlKey: true, repeat: true }), ctx, 6001).binding, undefined);
  assert.equal(r.resolve(key('KeyT'), ctx, 6002).binding?.command, 'table:create');
  r.resolve(key('KeyN', { ctrlKey: true }), ctx, 7000);
  assert.equal(r.resolve(key('KeyQ'), ctx, 7001).binding, undefined);
});
test('셀 명령은 셀 문맥에서만 실행되고 같은 Ctrl+Enter는 본문 쪽 나누기가 된다', () => {
  const r = new HangulKeyResolver();
  assert.equal(r.resolve(key('KeyS'), ctx).handled, false);
  assert.equal(r.resolve(key('KeyS'), { ...ctx, cells: true }).binding?.command, 'table:cell-split');
  assert.equal(r.resolve(key('Enter', { ctrlKey: true }), ctx).binding?.command, 'page:break');
  assert.equal(r.resolve(key('Enter', { ctrlKey: true }), { ...ctx, table: true }).binding?.command, 'table:insert-row-below');
  assert.equal(r.resolve(key('KeyS', { ctrlKey: true, shiftKey: true }), { ...ctx, cells: true }).binding?.command, 'table:block-sum');
});
test('조합 입력은 도중에 가로채지 않고 동일 scope의 키는 하나의 명령만 갖는다', () => {
  const r = new HangulKeyResolver(); r.resolve(key('KeyN', { ctrlKey: true }), ctx);
  assert.equal(r.resolve(key('KeyT', { isComposing: true }), ctx).handled, false);
  assert.equal(r.resolve(key('KeyT'), ctx).handled, false);
  const pairs = hangulBindings.map(b => b.scope + ':' + b.keys); assert.equal(new Set(pairs).size, pairs.length);
});
