import { planIntegerSeries } from './table-auto-fill.ts';

export type TableSeries = { kind: 'integer' | 'date' | 'numbered-text'; step: number; values: string[]; description: string };
const dayMs = 86_400_000;
const datePattern = /^(\d{4})([-./])(\d{2})\2(\d{2})$/u;

function dateSeed(value: string): { day: number; separator: string } | undefined {
  const match = datePattern.exec(value);
  if (!match) return;
  const [, y, separator, m, d] = match, year = Number(y), month = Number(m), date = Number(d);
  if (year < 1000 || year > 9999) throw new Error('날짜의 연도는 1000~9999여야 합니다.');
  const time = Date.UTC(year, month - 1, date), parsed = new Date(time);
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() + 1 !== month || parsed.getUTCDate() !== date) throw new Error('첫 두 셀에 실제로 존재하는 날짜를 입력하세요.');
  return { day: time / dayMs, separator };
}

/** Two explicit seeds only; never interpret formulas or infer arbitrary natural language. */
export function planTableSeries(first: string, second: string, count: number): TableSeries {
  if (!Number.isSafeInteger(count) || count < 3 || count > 1000) throw new Error('한 행 또는 한 열의 셀을 3~1,000개 선택하세요.');
  if (/^-?\d{1,12}$/u.test(first) && /^-?\d{1,12}$/u.test(second)) {
    return { kind: 'integer', ...planIntegerSeries(first, second, count), description: '정수 간격' };
  }
  const a = dateSeed(first), b = dateSeed(second);
  if (a || b) {
    if (!a || !b || a.separator !== b.separator) throw new Error('두 날짜는 YYYY-MM-DD, YYYY.MM.DD 또는 YYYY/MM/DD 중 같은 형식으로 입력하세요.');
    const step = b.day - a.day;
    const values = Array.from({ length: count }, (_, i) => {
      const date = new Date((a.day + step * i) * dayMs), year = date.getUTCFullYear();
      if (year < 1000 || year > 9999) throw new Error('생성할 날짜가 지원 연도 범위를 넘습니다.');
      return [year, String(date.getUTCMonth() + 1).padStart(2, '0'), String(date.getUTCDate()).padStart(2, '0')].join(a.separator);
    });
    return { kind: 'date', step, values, description: '날짜 간격 (일)' };
  }
  // Require exactly one unsigned digit group with matching literal prefix/suffix.
  const pattern = /^([^\d\r\n=]*)(\d{1,12})([^\d\r\n]*)$/u, x = pattern.exec(first), y = pattern.exec(second);
  if (!x || !y || x[1] !== y[1] || x[3] !== y[3] || (!x[1] && !x[3]) || /[\u0000-\u001f]/u.test(first + second)) throw new Error('정수, 같은 형식의 날짜 또는 같은 접두어·접미어와 숫자 하나로 된 첫 두 셀을 입력하세요. 수식은 추론하지 않습니다.');
  const series = planIntegerSeries(x[2], y[2], count);
  if (series.values.some(value => value.startsWith('-'))) throw new Error('번호가 음수가 되는 문자열 패턴은 지원하지 않습니다.');
  return { kind: 'numbered-text', step: series.step, values: series.values.map(value => x[1] + value + x[3]), description: '문자열 번호 간격' };
}
