/** Paragraph shape integers use 200 units/pt; layout coordinates use 96px/in. */
export function planHangingIndent(current: { marginLeft: number; indent: number }, prefixWidthPx: number) {
  if (!Number.isSafeInteger(current.marginLeft) || !Number.isSafeInteger(current.indent)
    || !Number.isFinite(prefixWidthPx) || prefixWidthPx < 0) throw new Error('빠른 내어쓰기 위치를 확인할 수 없습니다.');
  const prefix = Math.round(prefixWidthPx * 150);
  const marginLeft = current.marginLeft + current.indent + prefix, indent = prefix === 0 ? 0 : -prefix;
  if (![prefix, marginLeft, indent].every(Number.isSafeInteger) || marginLeft < 0 || marginLeft > 199800 || indent < -199800) {
    throw new Error('빠른 내어쓰기의 문단 여백이 지원 범위를 벗어났습니다.');
  }
  // Preserve the first line's original start. Repeating at the same cursor is a no-op.
  return marginLeft === current.marginLeft && indent === current.indent ? undefined : { marginLeft, indent };
}
