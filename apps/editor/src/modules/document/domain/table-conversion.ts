export const tableTextSeparators = ['tab', 'comma', 'semicolon'] as const;
export type TableTextSeparator = typeof tableTextSeparators[number];
export const tableConversionLimits = { rows: 1000, columns: 100, cells: 1000, characters: 100000, cellCharacters: 4000 } as const;

export type CharacterRun = { startOffset: number; endOffset: number; charShapeId: number };

/** Scalar offsets match the engine (not UTF-16 offsets). Require complete coverage. */
export function sliceCharacterRuns(runs: readonly CharacterRun[], start: number, end: number): CharacterRun[] {
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end < start) throw new Error('글자 서식 범위가 올바르지 않습니다.');
  const result: CharacterRun[] = []; let offset = start;
  for (const run of runs) {
    if (![run.startOffset, run.endOffset, run.charShapeId].every(v => Number.isSafeInteger(v) && v >= 0) || run.endOffset <= run.startOffset) throw new Error('원문 글자 서식이 올바르지 않습니다.');
    const first = Math.max(start, run.startOffset), last = Math.min(end, run.endOffset);
    if (last <= first) continue;
    if (first !== offset) throw new Error('원문 글자 서식이 빠지거나 겹칩니다.');
    const previous = result.at(-1);
    if (previous?.charShapeId === run.charShapeId) previous.endOffset = last - start;
    else result.push({ startOffset: first - start, endOffset: last - start, charShapeId: run.charShapeId });
    offset = last;
  }
  if (offset !== end) throw new Error('원문 글자 서식을 모두 확인하지 못했습니다.');
  return result;
}

export function tableTextDelimiter(value: unknown): string {
  if (value === 'tab') return '\t';
  if (value === 'comma') return ',';
  if (value === 'semicolon') return ';';
  throw new Error('탭·쉼표·세미콜론 중 구분자를 선택하세요.');
}

/** Literal delimiters, not CSV: no trimming, quoting or inference. */
export function parseTableText(paragraphs: readonly string[], separator: unknown): string[][] {
  const delimiter = tableTextDelimiter(separator), limits = tableConversionLimits;
  if (!Array.isArray(paragraphs) || paragraphs.length < 1 || paragraphs.length > limits.rows) throw new Error('변환할 본문 문단은 1~1,000개여야 합니다.');
  let characters = 0;
  const rows = paragraphs.map(text => {
    if (typeof text !== 'string' || /[\u0000-\u0008\u000a-\u001f\u007f\ufffc]/u.test(text)
      || (separator !== 'tab' && text.includes('\t'))) throw new Error('개체·제어 문자·문단 안 줄바꿈이 있는 문자열은 변환할 수 없습니다.');
    if ((characters += [...text].length) > limits.characters) throw new Error('변환할 글자가 100,000자를 넘습니다.');
    const cells = text.split(delimiter);
    if (cells.some(cell => [...cell].length > limits.cellCharacters)) throw new Error('한 셀의 글자는 4,000자 이하로 나누어 주세요.');
    return cells;
  });
  const columns = rows[0].length;
  if (columns > limits.columns || rows.length * columns > limits.cells) throw new Error('100열·1,000셀 이하의 표만 변환할 수 있습니다.');
  if (rows.some(row => row.length !== columns)) throw new Error('모든 문단의 구분자 개수가 같아야 합니다. 빈 셀도 구분자를 남겨 주세요.');
  return rows;
}

export function joinTableText(rows: readonly (readonly string[])[], separator: unknown): string[] {
  const delimiter = tableTextDelimiter(separator);
  if (!rows.length || !rows[0]?.length || rows.length > tableConversionLimits.rows
    || rows[0].length > tableConversionLimits.columns || rows.length * rows[0].length > tableConversionLimits.cells
    || rows.some(row => row.length !== rows[0].length)) throw new Error('직사각형의 단순 표만 문자열로 변환할 수 있습니다.');
  const paragraphs = rows.map(row => row.map(cell => {
    if (typeof cell !== 'string' || /[\u0000-\u001f\u007f\ufffc]/u.test(cell) || cell.includes(delimiter)) throw new Error('셀 안에 선택한 구분자·줄바꿈·제어 문자가 있습니다. 다른 구분자를 선택하세요.');
    if ([...cell].length > tableConversionLimits.cellCharacters) throw new Error('한 셀의 글자는 4,000자 이하여야 합니다.');
    return cell;
  }).join(delimiter));
  // The inverse parser proves that no cell boundaries are silently lost.
  parseTableText(paragraphs, separator);
  return paragraphs;
}
