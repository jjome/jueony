import { wholeCellBand, selectWholeCellBand } from '../src/shortcuts/cell-band.ts';
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

test('셀 블록 F7/F8은 칸/줄 선택이며 본문 F7 편집 용지를 가로채지 않는다', () => {
  const r = new HangulKeyResolver();
  assert.equal(r.resolve(key('F7'), { ...ctx, table: true, cells: true }).binding?.command, 'ext:jueony-select-cell-columns');
  assert.equal(r.resolve(key('F8'), { ...ctx, table: true, cells: true }).binding?.command, 'ext:jueony-select-cell-rows');
  assert.equal(r.resolve(key('F7'), ctx).binding?.command, 'file:page-setup');
  assert.equal(r.resolve(key('F7', { shiftKey: true }), { ...ctx, cells: true }).handled, false);
});

test('Ctrl+F 탐색과 Ctrl+Q,F 찾기를 다른 명령으로 유지한다', () => {
  const r = new HangulKeyResolver();
  assert.equal(r.resolve(key('KeyF', { ctrlKey: true }), ctx).binding?.command, 'ext:jueony-navigation-pane');
  r.resolve(key('KeyQ', { ctrlKey: true }), ctx);
  assert.equal(r.resolve(key('KeyF'), ctx).binding?.command, 'edit:find');
});

test('기존 기본 도구 상자 Ctrl+F1 연결을 한글 매핑에서도 유지한다', () => {
  assert.equal(new HangulKeyResolver().resolve(key('F1', { ctrlKey: true }), ctx).binding?.command, 'view:toolbox-basic');
});

test('F6 is style in both body and table; F6 never becomes an agent focus key', () => {
  const r = new HangulKeyResolver();
  for (const scope of [ctx, { ...ctx, table: true }, { ...ctx, table: true, cells: true }]) {
    assert.equal(r.resolve(key('F6'), scope).binding?.command, 'format:style-dialog');
  }
  assert.equal(r.resolve(key('F6', { isComposing: true }), ctx).handled, false);
});

test('cell border/background keys choose individual or combined dialog and correct tab', () => {
  const r = new HangulKeyResolver();
  for (const [code, command, tab] of [['KeyL', 'table:border-each', 'border'], ['KeyC', 'table:border-each', 'background'], ['KeyB', 'table:border-one', 'border'], ['KeyF', 'table:border-one', 'background']]) {
    assert.equal(r.resolve(key(code), ctx).handled, false);
    const result = r.resolve(key(code), { ...ctx, table: true, cells: true });
    assert.equal(result.binding?.command, command); assert.equal(result.binding?.params?.tab, tab);
  }
});

test('Ctrl+N,F formula and Ctrl+N,C table caption retain table scope and header/footer is connected', () => {
  const r = new HangulKeyResolver(), table = { ...ctx, table: true };
  r.resolve(key('KeyN', { ctrlKey: true }), table);
  assert.equal(r.resolve(key('KeyF'), table).binding?.command, 'table:formula');
  r.resolve(key('KeyN', { ctrlKey: true }), table);
  assert.equal(r.resolve(key('KeyC'), table).binding?.command, 'table:caption-toggle');
  r.resolve(key('KeyN', { ctrlKey: true }), ctx);
  assert.equal(r.resolve(key('KeyC'), ctx).binding?.command, 'insert:caption-toggle');
  r.resolve(key('KeyN', { ctrlKey: true }), ctx);
  assert.equal(r.resolve(key('KeyH'), ctx).binding?.command, 'page:header-footer-dialog');
});
test('전체 칸/줄 선택은 방향과 문서·중첩 표 식별을 보존하고 원본 상태를 변경하지 않는다', () => {
  const state = { sec: 2, ppi: 3, ci: 4, cellPath: [{ controlIndex: 1, cellIndex: 2 }], anchor: { row: 2, col: 3 }, focus: { row: 1, col: 1 }, phase: 1, reason: 'manual', excluded: ['1:2'] };
  const columns = wholeCellBand(state, { rowCount: 5, colCount: 6 }, 'columns')!;
  assert.deepEqual(columns.anchor, { row: 0, col: 3 });
  assert.deepEqual(columns.focus, { row: 4, col: 1 });
  assert.deepEqual(columns.cellPath, state.cellPath);
  assert.equal(columns.sec, 2); assert.equal(columns.phase, 2); assert.deepEqual(columns.excluded, []);
  const rows = wholeCellBand(state, { rowCount: 5, colCount: 6 }, 'rows')!;
  assert.deepEqual(rows.anchor, { row: 2, col: 0 });
  assert.deepEqual(rows.focus, { row: 1, col: 5 });
  assert.deepEqual(state.anchor, { row: 2, col: 3 }); assert.deepEqual(state.excluded, ['1:2']);
});

test('삭제·크기 변경으로 선택이 무효해졌으면 새 범위를 만들지 않는다', () => {
  const state = { sec: 0, ppi: 0, ci: 0, anchor: { row: 1, col: 1 }, focus: { row: 1, col: 1 }, phase: 1, reason: 'manual', excluded: [] };
  for (const dims of [{ rowCount: 0, colCount: 2 }, { rowCount: 1, colCount: 2 }, { rowCount: 2, colCount: NaN }]) {
    assert.equal(wholeCellBand(state, dims, 'rows'), null);
  }
});

test('셀 선택 실행은 중첩 표 크기를 읽고 선택만 갱신하며 문서 편집 API를 호출하지 않는다', () => {
  const state = { sec: 1, ppi: 2, ci: 3, cellPath: [{ ctrlIdx: 3, cellIdx: 0 }], anchor: { row: 1, col: 1 }, focus: { row: 1, col: 1 }, phase: 1, reason: 'manual', excluded: [] };
  const trace: string[] = [];
  let restored: unknown;
  const input = {
    cursor: { captureCellSelection: () => state, restoreCellSelection: (next: unknown) => { restored = next; return true; } },
    wasm: { getTableDimensions: () => { throw new Error('중첩 표 경로 손실'); }, getTableDimensionsByPath: (sec: number, ppi: number, path: string) => { assert.equal(sec, 1); assert.equal(ppi, 2); assert.deepEqual(JSON.parse(path), state.cellPath); return { rowCount: 3, colCount: 4 }; } },
    flushDeferredPaginationIfNeeded: () => { trace.push('flush'); }, caret: { hide: () => { trace.push('hide'); } }, updateCellSelection: () => { trace.push('selection'); }, focus: () => { trace.push('focus'); },
  };
  assert.equal(selectWholeCellBand(input, 'columns'), true);
  assert.deepEqual((restored as typeof state).focus, { row: 2, col: 1 });
  assert.deepEqual(trace, ['flush', 'hide', 'selection', 'focus']);
  input.cursor.restoreCellSelection = () => false;
  trace.length = 0;
  assert.equal(selectWholeCellBand(input, 'rows'), false);
  assert.deepEqual(trace, ['flush']);
});
