import type {Cell, Table} from '../public/types.ts';

/** Detached, zero-based table coordinates; formula references use one-based A1 notation. */
export type FormulaCoordinate = Readonly<{row: number; column: number}>;
export type FormulaCellChange = Readonly<FormulaCoordinate & {originalText: string; text: string}>;
export type FormulaCopyPlan = Readonly<{
  source: FormulaCoordinate;
  changes: readonly (FormulaCellChange & {index: number})[];
}>;
export type FormulaCalculation = Readonly<FormulaCoordinate & {
  index: number;
  formula: string;
  value: number;
}>;
export type FormulaRecalculationPlan = Readonly<{
  changes: readonly (FormulaCellChange & {index: number})[];
  calculated: readonly FormulaCalculation[];
}>;
export type FormulaPlanOptions = Readonly<{cancelled?: boolean}>;

type Shape = Pick<Table, 'rows' | 'columns'>;
type Reference = Readonly<{
  row: number; column: number; fixedRow: boolean; fixedColumn: boolean;
  start: number; end: number;
}>;
type Expression =
  | {kind: 'number'; value: number}
  | {kind: 'reference'; reference: Reference}
  | {kind: 'range'; first: Reference; last: Reference}
  | {kind: 'unary'; operator: '+' | '-'; operand: Expression}
  | {kind: 'binary'; operator: '+' | '-' | '*' | '/'; left: Expression; right: Expression}
  | {kind: 'call'; name: 'SUM' | 'AVERAGE' | 'MIN' | 'MAX' | 'COUNT'; arguments: Expression[]};
type Token = {kind: 'number' | 'reference' | 'name' | 'symbol' | 'eof'; raw: string;
  start: number; end: number; reference?: Reference};

const MAX_SLOTS = 200;
const MAX_FORMULA_LENGTH = 4096;
const MAX_TOKENS = 1024;
const MAX_DEPTH = 32;
const numberPattern = /^-?(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+)?$/u;
const functionNames = new Set(['SUM', 'AVERAGE', 'MIN', 'MAX', 'COUNT']);

function whole(value: unknown, label: string, min: number, max: number): number {
  if (!Number.isSafeInteger(value) || (value as number) < min || (value as number) > max) {
    throw new Error(`${label}: 정수 좌표 또는 범위가 올바르지 않습니다.`);
  }
  return value as number;
}

function shapeOf(table: Shape): Shape {
  if (!table) throw new Error('표의 행·열 크기를 지정하세요.');
  const rows = whole(table.rows, '행 수', 1, MAX_SLOTS);
  const columns = whole(table.columns, '열 수', 1, MAX_SLOTS);
  if (rows * columns > MAX_SLOTS) throw new Error(`표 격자는 ${MAX_SLOTS}개 이하만 지원합니다.`);
  return {rows, columns};
}

function coordinate(value: FormulaCoordinate, shape: Shape): FormulaCoordinate {
  if (!value) throw new Error('표 셀 좌표가 필요합니다.');
  return Object.freeze({
    row: whole(value.row, '행', 0, shape.rows - 1),
    column: whole(value.column, '열', 0, shape.columns - 1),
  });
}

function columnNumber(letters: string): number {
  let number = 0;
  for (const letter of letters.toUpperCase()) {
    number = number * 26 + letter.charCodeAt(0) - 64;
    if (number > MAX_SLOTS) throw new Error('A1 참조 열이 지원 범위를 벗어납니다.');
  }
  return number - 1;
}

function columnLetters(column: number): string {
  let ordinal = column + 1;
  let result = '';
  while (ordinal > 0) {
    ordinal--;
    result = String.fromCharCode(65 + ordinal % 26) + result;
    ordinal = Math.floor(ordinal / 26);
  }
  return result;
}

function referenceFrom(raw: string, start: number, end: number, shape: Shape): Reference {
  const match = /^(\$?)([A-Za-z]+)(\$?)([1-9]\d*)$/u.exec(raw);
  if (!match) throw new Error('지원하지 않는 A1 셀 참조입니다.');
  const column = columnNumber(match[2]);
  const row = Number(match[4]) - 1;
  whole(row, 'A1 참조 행', 0, shape.rows - 1);
  whole(column, 'A1 참조 열', 0, shape.columns - 1);
  return {row, column, fixedColumn: match[1] === '$', fixedRow: match[3] === '$', start, end};
}

function tokenize(formula: string, shape: Shape): Token[] {
  if (typeof formula !== 'string' || formula.length < 2 || formula.length > MAX_FORMULA_LENGTH ||
    !formula.startsWith('=')) throw new Error('=로 시작하는 길이 4,096자 이하의 수식이 필요합니다.');
  const tokens: Token[] = [];
  for (let at = 1; at < formula.length;) {
    const char = formula[at];
    if (char === ' ' || char === '\t') {at++; continue;}
    const tail = formula.slice(at);
    const reference = /^[A-Za-z_][A-Za-z_0-9]*\s*\(/u.test(tail) ? undefined : /^\$?[A-Za-z]+\$?[1-9]\d*/u.exec(tail)?.[0];
    const number = /^(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+)?/u.exec(tail)?.[0];
    const name = /^[A-Za-z_][A-Za-z_0-9]*/u.exec(tail)?.[0];
    let token: Token;
    if (reference) token = {kind: 'reference', raw: reference, start: at,
      end: at + reference.length, reference: referenceFrom(reference, at, at + reference.length, shape)};
    else if (number) token = {kind: 'number', raw: number, start: at, end: at + number.length};
    else if (name) token = {kind: 'name', raw: name, start: at, end: at + name.length};
    else if ('+-*/(),:'.includes(char)) token = {kind: 'symbol', raw: char, start: at, end: at + 1};
    else throw new Error(`지원하지 않는 수식 문자 또는 외부 참조입니다: 위치 ${at}`);
    at = token.end;
    tokens.push(token);
    if (tokens.length > MAX_TOKENS) throw new Error('수식의 항목이 너무 많습니다.');
  }
  tokens.push({kind: 'eof', raw: '', start: formula.length, end: formula.length});
  return tokens;
}

class Parser {
  private position = 0;
  private readonly tokens: readonly Token[];
  constructor(tokens: readonly Token[]) {this.tokens = tokens;}

  private peek(): Token {return this.tokens[this.position];}
  private take(): Token {return this.tokens[this.position++];}
  private consume(symbol: string): boolean {
    if (this.peek().raw !== symbol) return false;
    this.take();
    return true;
  }

  parse(): Expression {
    const expression = this.expression(0);
    if (this.peek().kind !== 'eof') throw new Error('수식 끝에 허용되지 않은 문법이 있습니다.');
    this.validateRanges(expression, false);
    return expression;
  }

  private expression(depth: number): Expression {
    let left = this.term(depth);
    while (this.peek().raw === '+' || this.peek().raw === '-') {
      const operator = this.take().raw as '+' | '-';
      left = {kind: 'binary', operator, left, right: this.term(depth)};
    }
    return left;
  }

  private term(depth: number): Expression {
    let left = this.unary(depth);
    while (this.peek().raw === '*' || this.peek().raw === '/') {
      const operator = this.take().raw as '*' | '/';
      left = {kind: 'binary', operator, left, right: this.unary(depth)};
    }
    return left;
  }

  private unary(depth: number): Expression {
    if (depth > MAX_DEPTH) throw new Error('수식의 괄호·부호 중첩이 너무 깊습니다.');
    if (this.peek().raw === '+' || this.peek().raw === '-') {
      const operator = this.take().raw as '+' | '-';
      return {kind: 'unary', operator, operand: this.unary(depth + 1)};
    }
    return this.atom(depth);
  }

  private atom(depth: number): Expression {
    const token = this.take();
    if (token.kind === 'number') {
      const value = Number(token.raw);
      return {kind: 'number', value: finite(value)};
    }
    if (token.kind === 'reference') {
      if (this.consume(':')) {
        const last = this.take();
        if (last.kind !== 'reference') throw new Error('범위 끝은 A1 셀 주소여야 합니다.');
        const firstRef = token.reference!, lastRef = last.reference!;
        if (firstRef.row > lastRef.row || firstRef.column > lastRef.column) {
          throw new Error('셀 범위는 좌상단에서 우하단 순서여야 합니다.');
        }
        return {kind: 'range', first: firstRef, last: lastRef};
      }
      return {kind: 'reference', reference: token.reference!};
    }
    if (token.raw === '(') {
      const inside = this.expression(depth + 1);
      if (!this.consume(')')) throw new Error('닫히지 않은 수식 괄호입니다.');
      return inside;
    }
    if (token.kind === 'name') {
      const name = token.raw.toUpperCase();
      if (!functionNames.has(name) || !this.consume('(')) {
        throw new Error('SUM, AVERAGE, MIN, MAX, COUNT 외 함수·이름은 지원하지 않습니다.');
      }
      const args: Expression[] = [];
      if (this.peek().raw === ')') throw new Error('함수 인자는 최소 하나가 필요합니다.');
      for (;;) {
        if (args.length >= MAX_SLOTS) throw new Error('함수 인자 수가 한도를 초과합니다.');
        args.push(this.expression(depth + 1));
        if (!this.consume(',')) break;
      }
      if (!this.consume(')')) throw new Error('함수 괄호 또는 구분자가 올바르지 않습니다.');
      return {kind: 'call', name: name as 'SUM' | 'AVERAGE' | 'MIN' | 'MAX' | 'COUNT', arguments: args};
    }
    throw new Error('지원하지 않는 수식 또는 누락된 계산 항목입니다.');
  }

  private validateRanges(expression: Expression, mayBeRange: boolean): void {
    switch (expression.kind) {
      case 'range':
        if (!mayBeRange) throw new Error('A1:B2 범위는 집계 함수의 직접 인자만 가능합니다.');
        break;
      case 'binary':
        this.validateRanges(expression.left, false);
        this.validateRanges(expression.right, false);
        break;
      case 'unary':
        this.validateRanges(expression.operand, false);
        break;
      case 'call':
        for (const arg of expression.arguments) this.validateRanges(arg, true);
        break;
    }
  }
}

function parse(formula: string, shape: Shape): {expression: Expression; references: readonly Reference[]} {
  const tokens = tokenize(formula, shape);
  const expression = new Parser(tokens).parse();
  return {expression, references: tokens.filter(t => t.kind === 'reference').map(t => t.reference!)};
}

function finite(value: number): number {
  if (!Number.isFinite(value) || Math.abs(value) > Number.MAX_SAFE_INTEGER) {
    throw new Error('계산 결과가 유한하고 안전한 숫자 범위를 벗어났습니다.');
  }
  return value;
}

/**
 * Shift every relative axis of A1/$A1/A$1/$A$1; preserve the exact remaining
 * formula text. Parse grammar first: strings, unsafe code and external sheets
 * never enter a regexp-only substitution or executable expression.
 */
export function translateTableFormula(formula: string, rowDelta: number, columnDelta: number,
  dimensions: Shape): string {
  const shape = shapeOf(dimensions);
  const result = shiftReferences(formula, parse(formula, shape).references, rowDelta, columnDelta, shape);
  parse(result, shape);
  return result;
}

/** Stored HWP formulas are parsed by the native engine. Keep direction names
 * such as ABOVE intact and shift only range-checked A1 token coordinates. */
export function translateStoredTableFormula(formula:string, rowDelta:number, columnDelta:number, dimensions:Shape):string {
  const shape=shapeOf(dimensions);
  const references=tokenize(formula, shape).flatMap(t=>t.reference?[t.reference]:[]);
  return shiftReferences(formula,references,rowDelta,columnDelta,shape);
}

function shiftReferences(formula:string,references:readonly Reference[],rowDelta:number,columnDelta:number,shape:Shape):string {
  whole(rowDelta, '행 이동량', -MAX_SLOTS, MAX_SLOTS);
  whole(columnDelta, '열 이동량', -MAX_SLOTS, MAX_SLOTS);
  let result = '', end = 0;
  for (const ref of references) {
    const row = ref.row + (ref.fixedRow ? 0 : rowDelta);
    const column = ref.column + (ref.fixedColumn ? 0 : columnDelta);
    whole(row, '이동 후 참조 행', 0, shape.rows - 1);
    whole(column, '이동 후 참조 열', 0, shape.columns - 1);
    result += formula.slice(end, ref.start) +
      (ref.fixedColumn ? '$' : '') + columnLetters(column) +
      (ref.fixedRow ? '$' : '') + (row + 1);
    end = ref.end;
  }
  return result + formula.slice(end);
}

type GridCell = Pick<Cell,'index'|'row'|'column'|'rowSpan'|'columnSpan'>;
type Grid<C extends GridCell = Cell> = Readonly<{shape: Shape; owners: readonly (readonly number[])[]; cells: readonly C[]}>;

/** Complete detached occupancy check; source cell indexes must be stable. */
export function formulaGrid<C extends GridCell>(table: Shape & {cells: readonly C[]}): Grid<C> {
  const shape = shapeOf(table);
  if (!Array.isArray(table.cells) || !table.cells.length || table.cells.length > shape.rows * shape.columns) {
    throw new Error('원본 표의 주 셀 개수가 유효하지 않습니다.');
  }
  const owners = Array.from({length: shape.rows}, () => Array(shape.columns).fill(-1) as number[]);
  let previous = -1;
  for (const [index, cell] of table.cells.entries()) {
    if (!cell || cell.index !== index) throw new Error('원본 주 셀의 연속 인덱스가 유효하지 않습니다.');
    const row = whole(cell.row, '주 셀 행', 0, shape.rows - 1);
    const column = whole(cell.column, '주 셀 열', 0, shape.columns - 1);
    const rowSpan = whole(cell.rowSpan, '주 셀 행 span', 1, shape.rows - row);
    const columnSpan = whole(cell.columnSpan, '주 셀 열 span', 1, shape.columns - column);
    if (row * shape.columns + column <= previous) throw new Error('주 셀 인덱스의 행 우선 순서가 올바르지 않습니다.');
    previous = row * shape.columns + column;
    for (let r = row; r < row + rowSpan; r++) {
      for (let c = column; c < column + columnSpan; c++) {
        if (owners[r][c] !== -1) throw new Error('병합 셀의 격자 범위가 겹칩니다.');
        owners[r][c] = index;
      }
    }
  }
  if (owners.some(row => row.includes(-1))) throw new Error('표 격자에 소유 주 셀이 없는 좌표가 있습니다.');
  return {shape, owners, cells: table.cells};
}

function cellAt(grid: Grid, point: FormulaCoordinate, operation: 'read' | 'write'): {index: number; cell: Cell} {
  const {row, column} = coordinate(point, grid.shape);
  const index = grid.owners[row][column];
  const cell = grid.cells[index];
  if (operation === 'write' && (cell.row !== row || cell.column !== column)) {
    throw new Error('병합 셀에 쓰려면 주 셀의 시작 좌표를 지정하세요.');
  }
  if (operation === 'write' && (cell.editable !== true || cell.properties?.cellProtect !== false)) {
    throw new Error('보호되었거나 편집할 수 없는 셀을 변경할 수 없습니다.');
  }
  return {index, cell};
}

/** Build a detached atomic copy preview; cancellation returns null immediately. */
export function planTableFormulaCopy(table: Table, source: FormulaCoordinate,
  targets: readonly FormulaCoordinate[], options: FormulaPlanOptions = {}): FormulaCopyPlan | null {
  if (options.cancelled === true) return null;
  const grid = formulaGrid(table);
  if (table.editable === false) throw new Error('읽기 전용 표에는 수식 자동 채우기를 적용할 수 없습니다.');
  const origin = coordinate(source, grid.shape);
  const {cell: seed} = cellAt(grid, origin, 'read');
  if (seed.row!==origin.row || seed.column!==origin.column)throw Error('병합 수식 원본은 주 셀의 시작 좌표를 지정하세요.');
  if (typeof seed.text !== 'string' || !seed.text.startsWith('=')) {
    throw new Error('원본 셀에는 =로 시작하는 수식이 필요합니다.');
  }
  // Reads through covered coordinates resolve to the physical owner.
  for (const ref of parse(seed.text, grid.shape).references) cellAt(grid, ref, 'read');
  if (!Array.isArray(targets) || targets.length < 1 || targets.length > MAX_SLOTS) {
    throw new Error('수식 복사 대상은 1~200개 셀입니다.');
  }
  const seen = new Set<number>();
  const changes = targets.map(target => {
    const point = coordinate(target, grid.shape);
    const {index, cell} = cellAt(grid, point, 'write');
    if ((point.row === origin.row && point.column === origin.column) || seen.has(index)) {
      throw new Error('수식 원본 또는 중복 대상에는 복사할 수 없습니다.');
    }
    seen.add(index);
    const text = translateTableFormula(seed.text, point.row - origin.row,
      point.column - origin.column, grid.shape);
    for (const ref of parse(text, grid.shape).references) cellAt(grid, ref, 'read');
    return Object.freeze({...point, index, originalText: cell.text, text});
  });
  changes.sort((a, b) => a.row - b.row || a.column - b.column);
  return Object.freeze({source: origin, changes: Object.freeze(changes)});
}

/**
 * Evaluate formula dependencies against a proposed detached overlay.
 * SUM/AVERAGE/MIN/MAX/COUNT, numbers, basic arithmetic, parentheses, and in-table A1
 * references are supported. Blank referenced cells contribute zero to scalar
 * arithmetic but are skipped by aggregate counting. Circular dependencies,
 * text-as-number coercion and non-finite results fail.
 * The caller owns document snapshot, commit/undo, number formatting and save.
 */
export function planTableFormulaRecalculation(table: Table,
  proposed: readonly FormulaCellChange[] = [], options: FormulaPlanOptions = {}): FormulaRecalculationPlan | null {
  if (options.cancelled === true) return null;
  const grid = formulaGrid(table);
  if (!Array.isArray(proposed) || proposed.length > MAX_SLOTS) {
    throw new Error('수식 갱신은 최대 200개 셀을 지원합니다.');
  }
  if (proposed.length && table.editable === false) throw new Error('읽기 전용 표를 변경할 수 없습니다.');
  const overlay = new Map<number, string>();
  const changes = proposed.map(change => {
    if (!change || Object.keys(change).some(k => !['row', 'column', 'originalText', 'text'].includes(k)) ||
      typeof change.text !== 'string' || typeof change.originalText !== 'string' ||
      change.text.length > MAX_FORMULA_LENGTH) throw new Error('수식 변경 입력이 올바르지 않습니다.');
    const point = coordinate(change, grid.shape);
    const {index, cell} = cellAt(grid, point, 'write');
    if (overlay.has(index)) throw new Error('동일한 셀의 중복 변경은 허용하지 않습니다.');
    if (cell.text !== change.originalText) throw new Error('수식 원본이 변경되었습니다. 다시 조회하세요.');
    overlay.set(index, change.text);
    return Object.freeze({...point, index, originalText: change.originalText, text: change.text});
  });
  changes.sort((a, b) => a.row - b.row || a.column - b.column);

  const textAt = (index: number) => overlay.get(index) ?? grid.cells[index].text;
  const computed = new Map<number, number | null>();
  const visiting = new Set<number>();
  const getValue = (ref: Pick<Reference, 'row' | 'column'>): number | null => {
    const {index} = cellAt(grid, ref, 'read');
    if (computed.has(index)) return computed.get(index)!;
    if (visiting.has(index)) throw new Error('표 수식에 순환 참조가 있습니다.');
    visiting.add(index);
    try {
      const text = textAt(index);
      if (typeof text !== 'string') throw new Error('계산 셀의 원본 문자열이 올바르지 않습니다.');
      let value: number | null;
      if (text.startsWith('=')) value = finite(evaluate(parse(text, grid.shape).expression));
      else if (text.trim() === '') value = null;
      else if (numberPattern.test(text.trim())) value = finite(Number(text.trim()));
      else throw new Error('참조된 셀이 숫자 또는 지원 수식이 아닙니다.');
      computed.set(index, value);
      return value;
    } finally {visiting.delete(index);}
  };

  const evaluate = (expression: Expression): number => {
    switch (expression.kind) {
      case 'number': return expression.value;
      case 'reference': return getValue(expression.reference) ?? 0;
      case 'range': throw new Error('범위 참조는 집계 함수 안에서만 사용할 수 있습니다.');
      case 'unary': return finite(expression.operator === '-' ? -evaluate(expression.operand) : evaluate(expression.operand));
      case 'binary': {
        const left = evaluate(expression.left), right = evaluate(expression.right);
        if (expression.operator === '/' && right === 0) throw new Error('표 수식에서 0으로 나눌 수 없습니다.');
        return finite(expression.operator === '+' ? left + right :
          expression.operator === '-' ? left - right :
            expression.operator === '*' ? left * right : left / right);
      }
      case 'call': {
        const values: number[] = [];
        for (const arg of expression.arguments) {
          if (arg.kind === 'range') {
            const seen=new Set<number>();
            for (let row = arg.first.row; row <= arg.last.row; row++) {
              for (let column = arg.first.column; column <= arg.last.column; column++) {
                const owner=grid.owners[row][column];
                if(seen.has(owner))continue;
                seen.add(owner);
                const value = getValue({row, column});
                if (value !== null) values.push(value);
              }
            }
          } else if (arg.kind === 'reference') {
            const value = getValue(arg.reference);
            if (value !== null) values.push(value);
          } else values.push(evaluate(arg));
        }
        if (expression.name === 'COUNT') return values.length;
        if (expression.name === 'SUM') return finite(values.reduce((sum, value) => finite(sum + value), 0));
        if (!values.length) throw new Error('평균·최솟값·최댓값을 계산할 숫자가 없습니다.');
        if (expression.name === 'AVERAGE') return finite(values.reduce((sum, value) => finite(sum + value), 0) / values.length);
        if (expression.name === 'MIN') return Math.min(...values);
        return Math.max(...values);
      }
    }
  };

  const calculated: FormulaCalculation[] = [];
  for (const cell of grid.cells) {
    const value = textAt(cell.index);
    if (typeof value === 'string' && value.startsWith('=')) {
      const result = getValue({row: cell.row, column: cell.column});
      calculated.push(Object.freeze({index: cell.index, row: cell.row,
        column: cell.column, formula: value, value: result!}));
    }
  }
  return Object.freeze({changes: Object.freeze(changes), calculated: Object.freeze(calculated)});
}
