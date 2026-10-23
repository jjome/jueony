import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { formatTableFormulaResult as format } from '../src/editor-actions/table-formula-format.ts';
import { patchFormulaFormat } from '../scripts/integration/formula-format-patches.mjs';

test('number format applies independently of the thousands separator option', () => {
  assert.equal(format(1234.56, 'integer', false), '1235');
  assert.equal(format(1234.56, 'decimal1', false), '1234.6');
  assert.equal(format(1234.5, 'decimal2', false), '1234.50');
  assert.equal(format(1234.5, 'decimal2', true), '1,234.50');
});
test('fixed decimal places, zero and negative values retain their displayed precision', () => {
  assert.equal(format(0, 'decimal2', true), '0.00');
  assert.equal(format(-1200, 'decimal1', true), '-1,200.0');
  assert.equal(format(1.2, 'decimal2', false), '1.20');
  assert.equal(format(1e25, 'default', true), '1e+25');
});
test('non-finite results and unknown formats fail before committing', () => {
  for (const value of [NaN, Infinity, -Infinity, '123', null]) assert.throws(() => format(value, 'default', false));
  assert.throws(() => format(1, 'money', false));
});
test('dialog patch preserves dry run and atomic transaction, rejecting a missing seam', () => {
  const source = readFileSync(new URL('../../../upstream/rhwp-source/rhwp-studio/src/ui/formula-dialog.ts', import.meta.url), 'utf8');
  const patched = patchFormulaFormat(source);
  assert.match(patched, /formatTableFormulaResult\(validated.result, this.formatSelect.value, this.commaCheck.checked\)/);
  assert.match(patched, /operationType: 'tableFormula'/);
  assert.match(patched, /const row = cell.row, col = cell.col/);
  assert.doesNotMatch(patched, /props.colCount/);
  assert.match(patched, /if \(!applied\) throw/);
  assert.match(patched, /if \(!committed.ok\) throw/);
  assert.doesNotMatch(patched, /catch \{ \/\* 쉼표 포맷 기록 실패/);
  assert.throws(() => patchFormulaFormat(source.replace('let displayValue = validated.result;', 'let displayValue = 0;')), /drift/);
});
