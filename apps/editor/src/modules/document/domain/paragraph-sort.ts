export type SortOptions = { mode: 'text' | 'number'; descending: boolean; keepFirst: boolean; column: number };
function decimal(text: string) {
  const value = text.trim();
  if (!/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/u.test(value)) throw new Error('숫자 형식이 아닙니다.');
  const [whole, fraction = ''] = value.replace(/^[+-]/u, '').split('.');
  const integer = whole.replace(/^0+/u, '') || '0', tail = fraction.replace(/0+$/u, '');
  return { negative: value.startsWith('-') && (integer !== '0' || tail !== ''), integer, tail };
}
function compareDecimal(a: ReturnType<typeof decimal>, b: ReturnType<typeof decimal>): number {
  if (a.negative !== b.negative) return a.negative ? -1 : 1;
  const size = Math.max(a.tail.length, b.tail.length), x = a.tail.padEnd(size, '0'), y = b.tail.padEnd(size, '0');
  const order = a.integer.length - b.integer.length || (a.integer < b.integer ? -1 : a.integer > b.integer ? 1 : 0) || (x < y ? -1 : x > y ? 1 : 0);
  return a.negative ? -order : order;
}
/** Stable, explicit ordering. Tied keys keep their original order in either direction. */
export function planParagraphSort(texts: readonly string[], options: SortOptions): number[] {
  if (!options || !['text', 'number'].includes(options.mode) || typeof options.descending !== 'boolean' || typeof options.keepFirst !== 'boolean' || !Number.isSafeInteger(options.column) || options.column < 0 || options.column > 100) throw new Error('정렬 설정이 올바르지 않습니다.');
  if (!Array.isArray(texts) || texts.length < 2 || texts.length > 1000 || texts.some(t => typeof t !== 'string' || /[\u0000-\u0008\u000a-\u001f\u007f\ufffc]/u.test(t))) throw new Error('개체·제어 문자 없는 본문 전체 문단을 2~1,000개 선택하세요.');
  const collator = new Intl.Collator('ko-KR', { usage: 'sort', numeric: true, sensitivity: 'variant' });
  const rows = texts.map((text, index) => ({ text, index })).slice(options.keepFirst ? 1 : 0).map(row => {
    const key = options.column ? row.text.split('\t')[options.column - 1] : row.text;
    if (key === undefined) throw new Error(`${row.index + 1}번째 문단에 지정한 탭 열이 없습니다.`);
    let value: ReturnType<typeof decimal> | undefined;
    if (options.mode === 'number') { try { value = decimal(key); } catch { throw new Error(`${row.index + 1}번째 문단의 정렬 기준이 숫자가 아닙니다.`); } }
    return { ...row, key, value };
  });
  rows.sort((a, b) => { const compare = options.mode === 'number' ? compareDecimal(a.value!, b.value!) : collator.compare(a.key, b.key); return (options.descending ? -compare : compare) || a.index - b.index; });
  return [...(options.keepFirst ? [0] : []), ...rows.map(row => row.index)];
}
