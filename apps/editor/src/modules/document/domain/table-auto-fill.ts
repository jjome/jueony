export type IntegerSeries = { step: number; values: string[] };
/** Explicit two-seed integer series only. Dates, formulas and text inference stay unsupported. */
export function planIntegerSeries(first: string, second: string, count: number): IntegerSeries {
  if (!Number.isSafeInteger(count) || count < 3 || count > 1000) throw new Error('한 행 또는 한 열의 셀을 3~1,000개 선택하세요.');
  const pattern = /^-?\d{1,12}$/u;
  if (!pattern.test(first) || !pattern.test(second)) throw new Error('첫 두 셀에 공백 없는 정수만 넣으세요. 날짜·수식·접두어 추론은 지원하지 않습니다.');
  const a = Number(first), b = Number(second), step = b - a;
  if (!Number.isSafeInteger(step)) throw new Error('수열의 간격이 정수 범위를 넘습니다.');
  const firstDigits = first.replace(/^-/, ''), secondDigits = second.replace(/^-/, '');
  const padded = /^0\d/u.test(firstDigits) || /^0\d/u.test(secondDigits);
  if (padded && firstDigits.length !== secondDigits.length) throw new Error('앞에 0을 붙인 정수는 첫 두 셀의 자릿수를 맞추세요.');
  const width = padded ? firstDigits.length : 0;
  const values = Array.from({ length: count }, (_, index) => {
    if (index === 0) return first; if (index === 1) return second;
    const value = a + step * index;
    if (!Number.isSafeInteger(value) || Math.abs(value) > 999999999999) throw new Error('생성할 정수가 12자리 범위를 넘습니다.');
    return (value < 0 ? '-' : '') + String(Math.abs(value)).padStart(width, '0');
  });
  return { step, values };
}
