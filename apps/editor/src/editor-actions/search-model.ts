export type TextHit = { sec: number; para: number; charOffset: number; length: number; cellContext?: { parentPara: number; ctrlIdx: number; cellIdx: number; cellPara: number }; cellPath?: { controlIndex: number; cellIndex: number; cellParaIndex: number }[]; equationControl?: number };

/** Convert search locations without losing nested cell paths. Equation source text is
 * intentionally excluded: selecting its character offsets in the body is incorrect. */
export function hitPosition(hit: TextHit) {
  if (hit.equationControl !== undefined || ![hit.sec, hit.para, hit.charOffset, hit.length].every(n => Number.isSafeInteger(n) && n >= 0) || hit.length === 0) return null;
  const cell = hit.cellContext;
  if (!cell) return { sectionIndex: hit.sec, paragraphIndex: hit.para, charOffset: hit.charOffset };
  return { sectionIndex: hit.sec, paragraphIndex: cell.parentPara, charOffset: hit.charOffset, parentParaIndex: cell.parentPara, controlIndex: cell.ctrlIdx, cellIndex: cell.cellIdx, cellParaIndex: cell.cellPara, ...(hit.cellPath?.length ? { cellPath: hit.cellPath.map(p => ({ ...p })) } : {}) };
}
export function nextHitIndex(current: number, length: number, direction: 1 | -1): number {
  if (!length) return -1;
  if (current < 0) return direction === 1 ? 0 : length - 1;
  return (current + direction + length) % length;
}
export function searchExcerpt(wasm: any, hit: TextHit): string {
  const start = Math.max(0, hit.charOffset - 22), count = Math.min(hit.length + 44, 180), cell = hit.cellContext;
  const text = cell ? hit.cellPath?.length
    ? wasm.getTextInCellByPath(hit.sec, cell.parentPara, JSON.stringify(hit.cellPath), start, count)
    : wasm.getTextInCell(hit.sec, cell.parentPara, cell.ctrlIdx, cell.cellIdx, cell.cellPara, start, count)
    : wasm.getTextRange(hit.sec, hit.para, start, count);
  return (start ? '…' : '') + text;
}
