/** Exact native ParaShape values: the three fields use 2x HWPUNIT, 200 per pt. */
export const paragraphSpacingOperations = ['left-less', 'left-more', 'right-less', 'right-more', 'indent-less', 'indent-more', 'both-less', 'both-more'] as const;
export type ParagraphSpacingOperation = typeof paragraphSpacingOperations[number];
type Field = 'marginLeft' | 'marginRight' | 'indent';
export function paragraphSpacingChange(current: Partial<Record<Field, number>>, operation: unknown): Partial<Record<Field, number>> {
  if (!paragraphSpacingOperations.includes(operation as ParagraphSpacingOperation)) throw new Error('지원하지 않는 문단 조절 명령입니다.');
  const op = operation as ParagraphSpacingOperation;
  const fields: Field[] = op.startsWith('both') ? ['marginLeft', 'marginRight'] : [op.startsWith('left') ? 'marginLeft' : op.startsWith('right') ? 'marginRight' : 'indent'];
  const change: Partial<Record<Field, number>> = {};
  for (const field of fields) {
    const value = current[field] ?? 0;
    if (!Number.isSafeInteger(value)) throw new Error('문단 여백 값이 올바르지 않습니다.');
    const before = value, delta = op.endsWith('more') ? 200 : -200;
    if (before < (field === 'indent' ? -199800 : 0) || before > 199800) throw new Error('문단 여백이 지원 범위를 벗어났습니다. 문단 모양에서 확인하세요.');
    const after = Math.min(199800, Math.max(field === 'indent' ? -199800 : 0, before + delta));
    if (after !== before) change[field] = after;
  }
  return change;
}
