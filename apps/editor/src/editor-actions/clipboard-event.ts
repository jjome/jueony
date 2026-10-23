export type ClipboardTextPosition = { sectionIndex: number; paragraphIndex: number; charOffset: number; parentParaIndex?: number; controlIndex?: number; cellIndex?: number; cellParaIndex?: number; cellPath?: { controlIndex: number; cellIndex: number; cellParaIndex: number }[] };
type ClipboardDataPort = { setData(format: string, value: string): void; getData(format: string): string };
const validIndex = (n: unknown): n is number => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0;
function pathOf(position: ClipboardTextPosition) {
  if (position.cellPath !== undefined) {
    if (!Array.isArray(position.cellPath) || !position.cellPath.length || position.cellPath.length > 8 || position.cellPath.some(p => !p || ![p.controlIndex, p.cellIndex, p.cellParaIndex].every(validIndex))) throw new Error('선택한 셀 경로가 올바르지 않습니다.');
    return position.cellPath;
  }
  if (position.parentParaIndex === undefined) return [];
  if (![position.controlIndex, position.cellIndex, position.cellParaIndex].every(validIndex)) throw new Error('선택한 셀 위치가 올바르지 않습니다.');
  return [{ controlIndex: position.controlIndex!, cellIndex: position.cellIndex!, cellParaIndex: position.cellParaIndex! }];
}
/** Rust selection clipboard APIs address one section and one leaf container. */
export function validateClipboardSelection(start: ClipboardTextPosition, end: ClipboardTextPosition): void {
  if (![start?.sectionIndex, start?.paragraphIndex, start?.charOffset, end?.sectionIndex, end?.paragraphIndex, end?.charOffset].every(validIndex)) throw new Error('선택 범위를 확인하지 못했습니다.');
  if (start.sectionIndex !== end.sectionIndex) throw new Error('구역을 넘는 선택의 서식 보존 잘라내기는 지원하지 않습니다. 구역 안에서 선택하세요.');
  const left = pathOf(start), right = pathOf(end);
  if (left.length !== right.length || (left.length && (!validIndex(start.parentParaIndex) || start.parentParaIndex !== end.parentParaIndex)) || left.some((entry, depth) => entry.controlIndex !== right[depth].controlIndex || entry.cellIndex !== right[depth].cellIndex || (depth < left.length - 1 && entry.cellParaIndex !== right[depth].cellParaIndex))) throw new Error('서로 다른 셀·본문을 넘는 선택은 한 번에 잘라낼 수 없습니다.');
  const first = left.length ? left.at(-1)!.cellParaIndex : start.paragraphIndex, last = right.length ? right.at(-1)!.cellParaIndex : end.paragraphIndex;
  if (first > last || (first === last && start.charOffset >= end.charOffset)) throw new Error('비어 있거나 역순인 선택은 잘라낼 수 없습니다.');
}
/** Confirms the browser event data store accepted both payloads. It cannot
 * certify a later OS clipboard commit, which occurs after the event returns. */
export function writeCutClipboardEvent(data: ClipboardDataPort | null, text: string, richHtml: string): void {
  if (!data || typeof data.setData !== 'function' || typeof data.getData !== 'function') throw new Error('클립보드 기록 권한이 없어 원본을 유지했습니다.');
  if (!richHtml.trim()) throw new Error('선택한 내용의 서식을 내보내지 못해 원본을 유지했습니다.');
  data.setData('text/plain', text); data.setData('text/html', richHtml);
  if (data.getData('text/plain') !== text || data.getData('text/html') !== richHtml) throw new Error('클립보드에 원문과 서식이 모두 기록되지 않아 원본을 유지했습니다.');
}
