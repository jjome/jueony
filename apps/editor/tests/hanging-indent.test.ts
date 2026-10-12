import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planHangingIndent } from '../src/modules/document/public/index.ts';
test('hanging indent preserves first-line origin and repeating does not create an edit', () => {
  const after = planHangingIndent({ marginLeft: 3000, indent: 600 }, 24)!;
  assert.deepEqual(after, { marginLeft: 7200, indent: -3600 });
  assert.equal(after.marginLeft + after.indent, 3600);
  assert.equal(planHangingIndent(after, 24), undefined);
  assert.deepEqual(planHangingIndent(after, 0), { marginLeft: 3600, indent: 0 });
});
test('native integer fractions are preserved and invalid geometry is rejected', () => {
  assert.deepEqual(planHangingIndent({ marginLeft: 3001, indent: 0 }, 1.337), { marginLeft: 3202, indent: -201 });
  for (const px of [-1, NaN, Infinity, 10000]) assert.throws(() => planHangingIndent({ marginLeft: 0, indent: 0 }, px));
  assert.throws(() => planHangingIndent({ marginLeft: 0, indent: -200 }, 0));
});
