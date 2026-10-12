export type TextTransform = 'upper' | 'lower' | 'full-width' | 'half-width';
export const textTransformLabels: Record<TextTransform, string> = {
  upper: '대문자로', lower: '소문자로', 'full-width': '전각 영문·숫자·기호로', 'half-width': '반각 영문·숫자·기호로',
};
/** One source scalar may expand (ß → SS); retain its format on every resulting scalar. */
export function transformText(value: string, mode: TextTransform): { text: string; pieces: string[] } {
  if (!Object.hasOwn(textTransformLabels, mode)) throw new Error('지원하지 않는 글자 변환입니다.');
  const pieces = Array.from(value, char => {
    if (mode === 'upper') return char.toUpperCase();
    if (mode === 'lower') return char.toLowerCase();
    const code = char.codePointAt(0)!;
    if (mode === 'full-width') return char === ' ' ? '\u3000' : code >= 0x21 && code <= 0x7e ? String.fromCodePoint(code + 0xfee0) : char;
    return char === '\u3000' ? ' ' : code >= 0xff01 && code <= 0xff5e ? String.fromCodePoint(code - 0xfee0) : char;
  });
  return { text: pieces.join(''), pieces };
}
