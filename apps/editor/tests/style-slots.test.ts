import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultStyleNames, resolveDefaultStyle } from '../src/shortcuts/style-slots.ts';
import { HangulKeyResolver } from '../src/shortcuts/keymap.ts';

test('Ctrl+1 through Ctrl+0 resolve default styles by name, not accidental document IDs', () => {
  const styles = defaultStyleNames.map((name, index) => ({ name, id: 50 + index }));
  const resolver = new HangulKeyResolver();
  for (let slot = 0; slot < 10; slot++) {
    const digit = String((slot + 1) % 10);
    const result = resolver.resolve({key: digit, code: 'Digit' + digit, ctrlKey: true, altKey: false, shiftKey: false, metaKey: false, repeat: false, isComposing: false}, {table:false,cells:false,object:false});
    assert.equal(result.binding?.command, 'ext:jueony-default-style');
    assert.equal(result.binding?.params?.slot, slot);
    assert.equal(resolveDefaultStyle(styles.toReversed(), slot), 50 + slot);
  }
});

test('missing, ambiguous or malformed style targets never select an unrelated style', () => {
  assert.equal(resolveDefaultStyle([{id:0,name:'사용자 스타일'}], 0), undefined);
  assert.equal(resolveDefaultStyle([{id:1,name:'개요1'}], 2), 1);
  assert.equal(resolveDefaultStyle([{id:0,name:'본문'},{id:1,name:'본 문'}], 1), undefined);
  assert.equal(resolveDefaultStyle([{id:-1,name:'바탕글'}], 0), undefined);
  for (const slot of [undefined, '0', NaN, -1, 10, 0.5]) assert.equal(resolveDefaultStyle([], slot), undefined);
});
