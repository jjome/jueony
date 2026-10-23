/** Format an already evaluated finite number; never evaluate formula text here. */
export function formatTableFormulaResult(value: unknown, format: string, comma: boolean): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error('계산 결과가 유효한 숫자가 아닙니다.');
  let text: string;
  switch (format) {
    case 'default': text = String(value); break;
    case 'integer': text = String(Math.round(value)); break;
    case 'decimal1': text = value.toFixed(1); break;
    case 'decimal2': text = value.toFixed(2); break;
    default: throw new Error('지원하지 않는 계산 결과 형식입니다.');
  }
  if (comma && !/[eE]/.test(text)) {
    const parts = text.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    text = parts.join('.');
  }
  return text;
}
