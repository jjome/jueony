import { planIntegerSeries } from './table-auto-fill.ts';

export type TableSeries = { kind: 'integer' | 'date' | 'numbered-text'; step: number; values: string[]; description: string };
export type DateFillUnit = 'days' | 'months' | 'years';
const dayMs = 86_400_000;
const datePattern = /^(\d{4})([-./])(\d{2})\2(\d{2})$/u;

function dateSeed(value: string): { day: number; separator: string; year: number; month: number; date: number } | undefined {
  const match = datePattern.exec(value);
  if (!match) return;
  const [, y, separator, m, d] = match, year = Number(y), month = Number(m), date = Number(d);
  if (year < 1000 || year > 9999) throw new Error('날짜의 연도는 1000~9999여야 합니다.');
  const time = Date.UTC(year, month - 1, date), parsed = new Date(time);
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() + 1 !== month || parsed.getUTCDate() !== date) throw new Error('첫 두 셀에 실제로 존재하는 날짜를 입력하세요.');
  return { day: time / dayMs, separator, year, month, date };
}

/** Two explicit seeds only; never interpret formulas or infer arbitrary natural language. */
export function planTableSeries(first: string, second: string, count: number, unit: DateFillUnit = 'days'): TableSeries {
  if (!['days', 'months', 'years'].includes(unit)) throw new Error('날짜 간격은 일·월·년 중 선택하세요.');
  if (!Number.isSafeInteger(count) || count < 3 || count > 1000) throw new Error('한 행 또는 한 열의 셀을 3~1,000개 선택하세요.');
  if (/^-?\d{1,12}$/u.test(first) && /^-?\d{1,12}$/u.test(second)) {
    if (unit !== 'days') throw new Error('월·년 간격은 날짜 셀에서만 사용할 수 있습니다.');
    return { kind: 'integer', ...planIntegerSeries(first, second, count), description: '정수 간격' };
  }
  const a = dateSeed(first), b = dateSeed(second);
  if (a || b) {
    if (!a || !b || a.separator !== b.separator) throw new Error('두 날짜는 YYYY-MM-DD, YYYY.MM.DD 또는 YYYY/MM/DD 중 같은 형식으로 입력하세요.');
    const step = unit === 'days' ? b.day - a.day : unit === 'months' ? (b.year - a.year) * 12 + b.month - a.month : b.year - a.year;
    const values = Array.from({ length: count }, (_, i) => {
      let date: Date;
      if (unit === 'days') date = new Date((a.day + step * i) * dayMs);
      else {
        const index = (a.year + (unit === 'years' ? step * i : 0)) * 12 + a.month - 1 + (unit === 'months' ? step * i : 0), targetYear = Math.floor(index / 12), targetMonth = index - targetYear * 12;
        if (targetYear < 1000 || targetYear > 9999) throw new Error('생성할 날짜가 지원 연도 범위를 넘습니다.');
        const firstDay = new Date(Date.UTC(targetYear, targetMonth, 1));
        const lastDay = new Date(Date.UTC(firstDay.getUTCFullYear(), firstDay.getUTCMonth() + 1, 0)).getUTCDate();
        date = new Date(Date.UTC(firstDay.getUTCFullYear(), firstDay.getUTCMonth(), Math.min(a.date, lastDay)));
      }
      const year = date.getUTCFullYear();
      if (!Number.isSafeInteger(year) || year < 1000 || year > 9999) throw new Error('생성할 날짜가 지원 연도 범위를 넘습니다.');
      return [year, String(date.getUTCMonth() + 1).padStart(2, '0'), String(date.getUTCDate()).padStart(2, '0')].join(a.separator);
    });
    if (values[1] !== second) throw new Error('두 번째 날짜가 선택한 월·년 간격과 맞지 않습니다. 첫 날짜의 일을 기준으로 없는 날만 그달 마지막 날로 바꿉니다.');
    return { kind: 'date', step, values, description: `날짜 간격 (${unit === 'days' ? '일' : unit === 'months' ? '월' : '년'})` };
  }
  // Require exactly one unsigned digit group with matching literal prefix/suffix.
  const pattern = /^([^\d\r\n=]*)(\d{1,12})([^\d\r\n]*)$/u, x = pattern.exec(first), y = pattern.exec(second);
  if (unit !== 'days') throw new Error('월·년 간격은 날짜 셀에서만 사용할 수 있습니다.');
  if (!x || !y || x[1] !== y[1] || x[3] !== y[3] || (!x[1] && !x[3]) || /[\u0000-\u001f]/u.test(first + second)) throw new Error('정수, 같은 형식의 날짜 또는 같은 접두어·접미어와 숫자 하나로 된 첫 두 셀을 입력하세요. 수식은 추론하지 않습니다.');
  const series = planIntegerSeries(x[2], y[2], count);
  if (series.values.some(value => value.startsWith('-'))) throw new Error('번호가 음수가 되는 문자열 패턴은 지원하지 않습니다.');
  return { kind: 'numbered-text', step: series.step, values: series.values.map(value => x[1] + value + x[3]), description: '문자열 번호 간격' };
}
