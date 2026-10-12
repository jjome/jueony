import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNavigationHistory } from '../src/modules/preferences/public/index.ts';
import { HangulKeyResolver } from '../src/shortcuts/keymap.ts';

test('back/forward leaves the current point and duplicate observations preserve forward history', () => {
  const history = createNavigationHistory<string>(value => value);
  for (const value of ['A', 'B', 'C']) history.record(value);
  assert.equal(history.peek(-1), 'B'); assert.equal(history.accept(-1), true);
  assert.equal(history.record('B'), false); assert.equal(history.peek(1), 'C');
  assert.equal(history.accept(1), true); assert.equal(history.accept(1), false);
});
test('a manual move after back discards the former forward branch', () => {
  const history = createNavigationHistory<string>(value => value);
  for (const value of ['A', 'B', 'C']) history.record(value);
  history.accept(-1); history.record('D');
  assert.equal(history.peek(1), undefined); assert.equal(history.peek(-1), 'B');
  assert.equal(history.state().size, 3);
});
test('invalid candidates can be removed in both directions without losing the current point', () => {
  const history = createNavigationHistory<string>(value => value);
  for (const value of ['A', 'stale', 'C']) history.record(value);
  history.discard(-1); assert.equal(history.peek(-1), 'A');
  history.accept(-1); assert.equal(history.peek(1), 'C');
  history.discard(1); assert.equal(history.state().index, 0); assert.equal(history.state().size, 1);
});
test('bounded history and document clear do not retain previous document positions', () => {
  const history = createNavigationHistory<string>(value => value, 3);
  for (const value of ['A', 'B', 'C', 'D']) history.record(value);
  history.accept(-1); history.accept(-1); assert.equal(history.peek(-1), undefined);
  assert.equal(history.state().size, 3); history.clear(); assert.equal(history.state().size, 0);
  assert.equal(history.accept(1), false); assert.throws(() => createNavigationHistory(String, 1));
});
test('physical Equal maps the two native cursor history keys even when shifted key is plus', () => {
  const resolver = new HangulKeyResolver(), ctx = {table:false,cells:false,object:false};
  const event = {key:'=',code:'Equal',ctrlKey:true,altKey:false,shiftKey:false,metaKey:false,repeat:false,isComposing:false};
  assert.equal(resolver.resolve(event,ctx).binding?.command,'ext:jueony-previous-cursor');
  assert.equal(resolver.resolve({...event,key:'+',shiftKey:true},ctx).binding?.command,'ext:jueony-next-cursor');
});
