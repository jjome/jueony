import assert from 'node:assert/strict';
import {test} from 'node:test';
import type {Table} from '../src/modules/document/public/types.ts';
import {
  planTableFormulaCopy,
  planTableFormulaRecalculation,
  translateTableFormula,
} from '../src/modules/document/domain/table-formula-plan.ts';

function table(rows = 4, columns = 5): Table {
  return {
    id: 's0p0t0', section: 0, paragraph: 0, control: 0,
    rows, columns, editable: true,
    cells: Array.from({length: rows * columns}, (_, index) => ({
      index, row: Math.floor(index / columns), column: index % columns,
      rowSpan: 1, columnSpan: 1, editable: true, text: '',
      properties: {cellProtect: false, width: 1000, height: 1000},
      characters: {bold: index % 2 === 0},
    })),
  };
}

function put(t: Table, row: number, column: number, value: string): void {
  t.cells[row * t.columns + column].text = value;
}

function values(plan: NonNullable<ReturnType<typeof planTableFormulaRecalculation>>) {
  return Object.fromEntries(plan.calculated.map(cell => [`${cell.row},${cell.column}`, cell.value]));
}

test('relative and absolute A1 references shift independently without altering operators or spacing', () => {
  const shape = {rows: 4, columns: 5};
  assert.equal(translateTableFormula('=$A1 + A$2 + $B$2 + C3 + SUM(A1:B2)', 1, 1, shape),
    '=$A2 + B$2 + $B$2 + D4 + SUM(B2:C3)');
  assert.equal(translateTableFormula('=a1+$b$2', 1, 1, shape), '=B2+$B$2');
  assert.equal(translateTableFormula('=SUM(A1:B2,COUNT(C1),MAX($A$1))', 1, 0, shape),
    '=SUM(A2:B3,COUNT(C2),MAX($A$1))');
  assert.equal(translateTableFormula('=12.5 * (2 + 1e-3)', 3, 4, shape),
    '=12.5 * (2 + 1e-3)');
});

test('out-of-table shifted references and invalid reference coordinates reject rather than create #REF!', () => {
  const shape = {rows: 4, columns: 5};
  for (const [formula, deltaRow, deltaColumn] of [
    ['=A1', -1, 0], ['=A1', 0, -1], ['=E4', 0, 1], ['=E4', 1, 0],
    ['=SUM(A1:B2)', 3, 0], ['=C3', 0.25, 0], ['=C3', 0, 999],
    ['=$E1', 4, 0],
  ] as const) {
    assert.throws(() => translateTableFormula(formula, deltaRow, deltaColumn, shape));
  }
  for (const formula of ['=A0', '=F1', '=A5', '=AA1', '=SUM(B2:A1)', '=SUM(A1:B5)']) {
    assert.throws(() => translateTableFormula(formula, 0, 0, shape));
  }
  assert.throws(() => translateTableFormula('=SUM(A1:$B$2)', 2, 0, shape), /범위/);
  assert.equal(translateTableFormula('=$A$1', 3, 4, shape), '=$A$1');
});

test('safe parser rejects executable-looking, external, string and unknown-function input', () => {
  const shape = {rows: 4, columns: 5};
  for (const formula of [
    '=process.exit(1)', '=SUM(A1);evil()', '=SUM(Sheet1!A1)', '=A1#REF!',
    '=IF(A1,1,2)', '=A1^2', '=A1:B2', '=SUM((A1:B2)+1)',
    '=SUM()', '=SUM(A1,)', '=SUM(A1', '=1 +', '=1 // 2',
    '=\"A1\"', '=A1\n+B1', '=SUM(A1) && 1', '=A1foo',
  ]) {
    assert.throws(() => translateTableFormula(formula, 0, 0, shape), formula);
  }
  assert.throws(() => translateTableFormula('=1'.padEnd(4100, ' '), 0, 0, shape));
  assert.throws(() => translateTableFormula('=A1', 0, 0, {rows: 201, columns: 1}));
});

test('copy preview is atomic, deterministic, row-major sorted and retains untouched cell attributes', () => {
  const t = table();
  put(t, 0, 2, '=A1+$B$1+C$1+$A1+SUM(A1:B2)');
  put(t, 1, 3, 'existing value');
  const before = structuredClone(t);
  const preview = planTableFormulaCopy(t, {row: 0, column: 2}, [
    {row: 1, column: 3}, {row: 0, column: 3},
  ]);
  assert.deepEqual(preview, {
    source: {row: 0, column: 2},
    changes: [
      {row: 0, column: 3, index: 3, originalText: '', text: '=B1+$B$1+D$1+$A1+SUM(B1:C2)'},
      {row: 1, column: 3, index: 8, originalText: 'existing value', text: '=B2+$B$1+D$1+$A2+SUM(B2:C3)'},
    ],
  });
  assert.deepEqual(t, before);
  assert.equal(Object.isFrozen(preview!.changes), true);
  assert.equal(Object.isFrozen(preview!.changes[0]), true);
});

test('cancelled copy and recalc return null without inspecting invalid inputs or mutating the source', () => {
  const t = table();
  const before = structuredClone(t);
  assert.equal(planTableFormulaCopy(t, {row: -9, column: 0}, [{row: -5, column: 0}], {cancelled: true}), null);
  assert.equal(planTableFormulaRecalculation(t, [{row: -1, column: -1, originalText: '', text: '=F999'}], {cancelled: true}), null);
  assert.deepEqual(t, before);
});

test('copy rejects duplicate, malformed, protected and readonly destinations with no partial writes', () => {
  const t = table(); put(t, 0, 1, '=A1');
  const before = structuredClone(t);
  for (const targets of [
    [{row: 0, column: 1}],
    [{row: 1, column: 1}, {row: 1, column: 1}],
    [{row: 0, column: 2}, {row: 99, column: 1}],
    [{row: 1.2, column: 0}],
  ]) assert.throws(() => planTableFormulaCopy(t, {row: 0, column: 1}, targets));
  t.cells[7].properties.cellProtect = true;
  assert.throws(() => planTableFormulaCopy(t, {row: 0, column: 1}, [{row: 1, column: 2}]));
  t.cells[7].properties.cellProtect = false;
  t.cells[7].editable = false;
  assert.throws(() => planTableFormulaCopy(t, {row: 0, column: 1}, [{row: 1, column: 2}]));
  t.cells[7].editable = true;
  assert.deepEqual(t, before);
  t.editable = false;
  assert.throws(() => planTableFormulaCopy(t, {row: 0, column: 1}, [{row: 1, column: 1}]));
});

test('recalculation respects precedence, direct dependencies and deterministic row-major results', () => {
  const t = table();
  put(t, 0, 0, '2'); put(t, 0, 1, '3');
  put(t, 0, 2, '=A1+B1*2');
  put(t, 0, 3, '=SUM(A1:B1, 4)');
  put(t, 0, 4, '=AVERAGE(A1:B1,C1)');
  put(t, 1, 2, '=D1-C1');
  put(t, 1, 4, '=MIN(A1:C1)+MAX(A1:C1)');
  put(t, 2, 0, ''); put(t, 2, 1, '5');
  put(t, 1, 1, '=SUM(A3:B3)');
  put(t, 1, 0, '=A3+1');
  put(t, 1, 3, '=COUNT(A3:B3)');
  const before = structuredClone(t);
  const plan = planTableFormulaRecalculation(t)!;
  assert.deepEqual(values(plan), {
    '0,2': 8, '0,3': 9, '0,4': 13 / 3,
    '1,0': 1, '1,1': 5, '1,2': 1, '1,3': 1, '1,4': 10,
  });
  assert.deepEqual(plan.calculated.map(c => c.index), [2, 3, 4, 5, 6, 7, 8, 9]);
  assert.deepEqual(t, before);
  assert.deepEqual(plan.changes, []);
  assert.deepEqual(plan, planTableFormulaRecalculation(t));
});

test('recalculation overlays updated numbers and formulas without touching source data', () => {
  const t = table(2, 4);
  put(t, 0, 0, '2'); put(t, 0, 1, '=A1*2'); put(t, 0, 2, '=B1+1');
  put(t, 1, 3, '=COUNT(A1:C1)+SUM(A1:C1)');
  const before = structuredClone(t);
  const result = planTableFormulaRecalculation(t, [
    {row: 0, column: 2, originalText: '=B1+1', text: '=B1+2'},
    {row: 0, column: 0, originalText: '2', text: '3'},
  ])!;
  assert.deepEqual(result.changes, [
    {row: 0, column: 0, index: 0, originalText: '2', text: '3'},
    {row: 0, column: 2, index: 2, originalText: '=B1+1', text: '=B1+2'},
  ]);
  assert.deepEqual(values(result), {'0,1': 6, '0,2': 8, '1,3': 20});
  assert.deepEqual(t, before);
});

test('math rejects divide by zero, cycles, unsupported text coercion, overflow and empty aggregates', () => {
  const t = table(2, 3);
  const before = structuredClone(t);
  for (const [cell, formula] of [
    [2, '=1/0'], [2, '=1/(2-2)'], [2, '=1e16'], [2, '=A1+1'],
    [2, '=AVERAGE(A1:B1)'], [2, '=MIN(A1:B1)'], [2, '=MAX(A1:B1)'],
  ] as const) {
    const copy = structuredClone(t);
    copy.cells[cell].text = formula;
    if (formula === '=A1+1') copy.cells[0].text = 'not a number';
    assert.throws(() => planTableFormulaRecalculation(copy), formula);
  }
  const cycle = structuredClone(t);
  cycle.cells[0].text = '=B1+1'; cycle.cells[1].text = '=A1+1';
  assert.throws(() => planTableFormulaRecalculation(cycle), /순환/);
  const selfCycle = structuredClone(t); selfCycle.cells[0].text = '=SUM(A1:A1)';
  assert.throws(() => planTableFormulaRecalculation(selfCycle), /순환/);
  assert.deepEqual(t, before);
});

test('stale, duplicate, protected, unknown-field and invalid numeric update rejects atomically', () => {
  const t = table(2, 3);
  const initial = structuredClone(t);
  const update = {row: 0, column: 0, originalText: '', text: '=B1*2'};
  for (const changes of [
    [{...update, originalText: 'stale'}],
    [update, update],
    [update, {...update, row: 99}],
    [{...update, text: '=UNKNOWN(B1)'}],
    [{...update, text: '=SUM(A1:B1)'}], // creates explicit self-cycle
    [{...update, row: '0'}],
    [{...update, extraOption: 'unsafe'}],
  ]) {
    assert.throws(() => planTableFormulaRecalculation(t, changes as Parameters<typeof planTableFormulaRecalculation>[1]));
  }
  t.cells[0].properties.cellProtect = true;
  assert.throws(() => planTableFormulaRecalculation(t, [update]), /보호/);
  t.cells[0].properties.cellProtect = false;
  assert.deepEqual(t, initial);
});

function mergedTable(): Table {
  const t = table(3, 3);
  put(t, 0, 2, '7');
  put(t, 1, 2, '=C1*2');
  t.cells[0].columnSpan = 2;
  t.cells.splice(1, 1);
  t.cells.forEach((cell, index) => {cell.index = index;});
  return t;
}

test('merged references resolve their owner, ranges count it once, and only its start can be a destination', () => {
  const t = mergedTable();
  t.cells[0].text='6';
  const before = structuredClone(t);
  assert.deepEqual(values(planTableFormulaRecalculation(t)!), {'1,2': 14});
  const copy = planTableFormulaCopy(t, {row: 1, column: 2}, [{row: 2, column: 2}])!;
  assert.deepEqual(copy.changes.map(c => c.text), ['=C2*2']);
  assert.throws(() => planTableFormulaCopy(t, {row:1,column:2}, [{row:0,column:1}]), /병합/);
  for(const formula of ['=A1','=B1','=SUM(A1:B1)']){
    const plan=planTableFormulaRecalculation(t,[{row:1,column:1,originalText:'',text:formula}])!;
    assert.equal(values(plan)['1,1'],6);
  }
  assert.throws(()=>planTableFormulaRecalculation(t,[{row:0,column:0,originalText:'6',text:'=B1'}]),/순환/);
  assert.deepEqual(t, before);
});

test('overlapping and missing merged topology rejects, including on an untouched destination', () => {
  const t = mergedTable();
  const badSpan = structuredClone(t);
  badSpan.cells[0].columnSpan = 3;
  assert.throws(() => planTableFormulaRecalculation(badSpan), /겹/);
  const hole = structuredClone(t);
  hole.cells.pop();
  assert.throws(() => planTableFormulaRecalculation(hole), /격자/);
  const wrongIndex = structuredClone(t);
  wrongIndex.cells[1].index = 99;
  assert.throws(() => planTableFormulaRecalculation(wrongIndex), /인덱스/);
});
