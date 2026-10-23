/** Search addresses are Unicode scalar offsets, never UTF-16 indexes. A cell path
 * is part of an address: two cells at offset zero are not the same match. */
export type FindPath = { controlIndex: number; cellIndex: number; cellParaIndex: number }[];
export type FindHit = { sec: number; para: number; charOffset: number; length: number;
  cellContext?: { parentPara: number; ctrlIdx: number; cellIdx: number; cellPara: number };
  cellPath?: FindPath; equationControl?: number };
export type FindPosition = { sectionIndex: number; paragraphIndex: number; charOffset: number;
  parentParaIndex?: number; controlIndex?: number; cellIndex?: number; cellParaIndex?: number; cellPath?: FindPath };
export type FindResult = Partial<FindHit> & { found: boolean; totalMatchCount: number; wrapped?: boolean };
const index = (n: unknown): n is number => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0;
const parsed = (v: any): any => typeof v === 'string' ? JSON.parse(v) : v;
export const rawFindDocument = (wasm: any) => wasm.borrowDocumentHandle?.() ?? wasm;

export function findHitPath(hit: FindHit): FindPath | null {
  if (hit.cellPath !== undefined) {
    if (!Array.isArray(hit.cellPath) || hit.cellPath.length === 0 || hit.cellPath.length > 8 || hit.cellPath.some(p => !p || ![p.controlIndex, p.cellIndex, p.cellParaIndex].every(index))) return null;
    // Older bridge results expose the leaf as cellContext; current flat results
    // use the first entry. The full path is authoritative in both versions.
    if (hit.cellContext && (hit.cellContext.parentPara !== hit.para || ![hit.cellPath[0], hit.cellPath.at(-1)!].some(p => hit.cellContext!.ctrlIdx === p.controlIndex && hit.cellContext!.cellIdx === p.cellIndex && hit.cellContext!.cellPara === p.cellParaIndex))) return null;
    return hit.cellPath.map(p => ({ ...p }));
  }
  const cell = hit.cellContext;
  if (!cell) return [];
  if (![cell.parentPara, cell.ctrlIdx, cell.cellIdx, cell.cellPara].every(index) || cell.parentPara !== hit.para) return null;
  return [{ controlIndex: cell.ctrlIdx, cellIndex: cell.cellIdx, cellParaIndex: cell.cellPara }];
}

export function findHitPosition(hit: FindHit): FindPosition | null {
  if (!hit || hit.equationControl !== undefined || ![hit.sec, hit.para, hit.charOffset, hit.length].every(index) || hit.length === 0 || !Number.isSafeInteger(hit.charOffset + hit.length)) return null;
  const path = findHitPath(hit);
  if (!path) return null;
  const base = { sectionIndex: hit.sec, paragraphIndex: hit.para, charOffset: hit.charOffset };
  if (!path.length) return base;
  return { ...base, parentParaIndex: hit.para, controlIndex: path[0].controlIndex,
    cellIndex: path[0].cellIndex, cellParaIndex: path[0].cellParaIndex, cellPath: path };
}

function positionKey(pos: FindPosition): number[] | null {
  if (!pos || ![pos.sectionIndex, pos.paragraphIndex, pos.charOffset].every(index)) return null;
  let path = pos.cellPath;
  if (!path && pos.parentParaIndex !== undefined) path = [{ controlIndex: pos.controlIndex!, cellIndex: pos.cellIndex!, cellParaIndex: pos.cellParaIndex! }];
  if (path && (!path.length || path.length > 8 || path.some(p => ![p.controlIndex, p.cellIndex, p.cellParaIndex].every(index)))) return null;
  return [pos.sectionIndex, pos.parentParaIndex ?? pos.paragraphIndex, ...(path ?? []).flatMap(p => [p.controlIndex, p.cellIndex, p.cellParaIndex]), -1, pos.charOffset];
}
const compare = (a: number[], b: number[]) => { for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) return a[i] - b[i]; return a.length - b.length; };
const samePosition = (a: FindPosition, b: FindPosition) => { const x = positionKey(a), y = positionKey(b); return !!x && !!y && compare(x, y) === 0; };

export function selectFindHit(hits: FindHit[], cursor: FindPosition, selection: { start: FindPosition; end: FindPosition } | null, forward: boolean): FindResult {
  if (!hits.length) return { found: false, totalMatchCount: 0 };
  // An exact selected match advances by document order, including nested cells.
  const selected = selection ? hits.findIndex(hit => { const start = findHitPosition(hit)!; return samePosition(start, selection.start) && samePosition({ ...start, charOffset: start.charOffset + hit.length }, selection.end); }) : -1;
  let next = -1, wrapped = false;
  if (selected >= 0) { next = selected + (forward ? 1 : -1); wrapped = next < 0 || next >= hits.length; next = (next + hits.length) % hits.length; }
  else {
    const anchor = positionKey(selection ? (forward ? selection.end : selection.start) : cursor);
    if (anchor) {
      if (forward) next = hits.findIndex(hit => compare(positionKey(findHitPosition(hit)!)!, anchor) >= 0);
      else for (let i = hits.length - 1; i >= 0; i--) if (compare(positionKey(findHitPosition(hits[i])!)!, anchor) < 0) { next = i; break; }
    }
    if (next < 0) { wrapped = true; next = forward ? 0 : hits.length - 1; }
  }
  return { ...hits[next], found: true, totalMatchCount: hits.length, wrapped };
}

export function readFindText(wasm: any, hit: FindHit, start = hit.charOffset, count = hit.length): string {
  const doc = rawFindDocument(wasm), path = findHitPath(hit);
  if (!findHitPosition(hit) || !path) throw new Error('검색 위치를 확인할 수 없습니다. 다시 검색하세요.');
  return path.length ? doc.getTextInCellByPath(hit.sec, hit.para, JSON.stringify(path), start, count) : doc.getTextRange(hit.sec, hit.para, start, count);
}

/** Equations and text boxes are not ordinary body/table text. Validate every table
 * ancestor, so a nested table inside an unsupported text box cannot slip through. */
export function readFindHits(wasm: any, query: string, caseSensitive: boolean): FindHit[] {
  if (!query) return [];
  const doc = rawFindDocument(wasm), seen = new Set<string>(), result: FindHit[] = [];
  for (const hit of parsed(doc.searchAllText(query, caseSensitive, true)) as FindHit[]) {
    const pos = findHitPosition(hit), path = findHitPath(hit); if (!pos || !path) continue;
    try {
      for (let depth = 1; depth <= path.length; depth++) {
        const prefix = path.slice(0, depth), dimensions = parsed(doc.getTableDimensionsByPath(hit.sec, hit.para, JSON.stringify(prefix)));
        if (!index(dimensions.cellCount) || prefix[depth - 1].cellIndex >= dimensions.cellCount) throw new Error('Invalid table address');
      }
      const text = readFindText(doc, hit);
      // Expanding case folds from the engine must never select/delete an adjacent
      // scalar. Only exact source spans are offered to the editor.
      if ((caseSensitive ? text : text.toLowerCase()) !== (caseSensitive ? query : query.toLowerCase())) continue;
      const key = JSON.stringify(positionKey(pos)); if (seen.has(key)) continue;
      seen.add(key); result.push(hit);
    } catch { /* Unsupported/stale story is not a navigable result. */ }
  }
  return result;
}

export function findFromInput(ih: any, query: string, caseSensitive: boolean, forward: boolean): FindResult {
  requireFindBodyContext(ih);
  ih.flushDeferredPaginationIfNeeded?.('find-text');
  return selectFindHit(readFindHits(ih.wasm, query, caseSensitive), ih.getCursorPosition(), ih.cursor.getSelectionOrdered(), forward);
}

export function navigateFindHit(ih: any, hit: FindResult): void {
  if (!ih || !hit.found) return;
  requireFindBodyContext(ih);
  const start = findHitPosition(hit as FindHit); if (!start) return;
  ih.flushDeferredPaginationIfNeeded?.('find-text');
  ih.cursor.exitCellSelectionMode?.(); ih.cursor.exitTableObjectSelection?.(); ih.cursor.clearSelection();
  ih.cursor.moveTo(start); ih.cursor.setAnchor(); ih.cursor.moveTo({ ...start, charOffset: start.charOffset + hit.length! });
  ih.updateCaret?.();
}

function requireFindBodyContext(ih: any): void {
  if (ih.cursor.isInHeaderFooter?.() || ih.cursor.isInFootnote?.() || ih.cursor.isInTextBox?.()) throw new Error('머리말·주석·글상자 편집을 닫은 뒤 본문·표에서 검색하세요.');
}

/** Execute only inside the existing snapshot router: it owns rollback and one undo. */
export function replaceFindHit(wasm: any, hit: FindHit, query: string, caseSensitive: boolean, newText: string): FindPosition | null {
  const doc = rawFindDocument(wasm), pos = findHitPosition(hit), path = findHitPath(hit);
  if (!pos || !path || !readFindHits(doc, query, caseSensitive).some(candidate => JSON.stringify(positionKey(findHitPosition(candidate)!)) === JSON.stringify(positionKey(pos)) && candidate.length === hit.length)) throw new Error('검색 결과가 변경되었습니다. 다시 검색하세요.');
  return applyFindReplacement(doc, hit, query, caseSensitive, newText);
}

function applyFindReplacement(doc: any, hit: FindHit, query: string, caseSensitive: boolean, newText: string): FindPosition | null {
  const pos = findHitPosition(hit)!, path = findHitPath(hit)!;
  if (Array.from(newText).length > 20_000 || /[\u0000-\u001f\u007f]/u.test(newText)) throw new Error('바꿀 내용은 제어 문자 없는 20,000자 이하의 한 문단으로 입력하세요.');
  const before = readFindText(doc, hit);
  if ((caseSensitive ? before : before.toLowerCase()) !== (caseSensitive ? query : query.toLowerCase())) throw new Error('검색 결과의 원문이 변경되었습니다. 다시 검색하세요.');
  if (before === newText) return null;
  const controls = parsed(doc.getControls());
  if (path.length) {
    for (let depth = 1; depth <= path.length; depth++) {
      const prefix = path.slice(0, depth), cell = prefix.at(-1)!;
      if (parsed(doc.getCellPropertiesByPath(hit.sec, hit.para, JSON.stringify(prefix), cell.cellIndex)).cellProtect) throw new Error('보호된 셀의 검색 결과는 바꿀 수 없습니다.');
    }
    const lists = parsed(doc.getCursorModel()).lists;
    let host = 0, paragraph = hit.para;
    for (const cell of path) {
      const list = lists.find((list: any) => list.isCell && list.hostListId === host && (host !== 0 || list.sectionIndex === hit.sec) && list.hostPara === paragraph && list.controlIndex === cell.controlIndex && list.cellIndex === cell.cellIndex);
      if (!list) throw new Error('셀의 문서 경로를 확인하지 못했습니다.');
      host = list.listId; paragraph = cell.cellParaIndex;
    }
    if (controls.some((control: any) => control.list === host && control.para === paragraph)) throw new Error('필드·개체가 있는 셀 문단의 바꾸기는 지원하지 않습니다.');
  } else {
    let flat = hit.para; for (let sec = 0; sec < hit.sec; sec++) flat += doc.getParagraphCount(sec);
    if (controls.some((control: any) => control.list === 0 && control.para === flat && !['secd', 'cold'].includes(control.ctrlId))) throw new Error('필드·개체가 있는 본문 문단의 바꾸기는 지원하지 않습니다.');
  }
  const textLength = path.length ? doc.getCellParagraphLengthByPath(hit.sec, hit.para, JSON.stringify(path)) : doc.getParagraphLength(hit.sec, hit.para);
  const original = Array.from(readFindText(doc, hit, 0, textLength));
  const check = (value: any) => { if (parsed(value)?.ok === false) throw new Error('문서 엔진이 바꾸기를 거절했습니다.'); };
  if (path.length) {
    check(doc.deleteTextInCellByPath(hit.sec, hit.para, JSON.stringify(path), hit.charOffset, hit.length));
    if (newText) check(doc.insertTextInCellByPath(hit.sec, hit.para, JSON.stringify(path), hit.charOffset, newText));
  } else check(doc.replaceText(hit.sec, hit.para, hit.charOffset, hit.length, newText));
  const expected = original.slice(0, hit.charOffset).join('') + newText + original.slice(hit.charOffset + hit.length).join('');
  if (readFindText(doc, hit, 0, Array.from(expected).length) !== expected) throw new Error('바꾸기 결과가 예상 원문과 다릅니다.');
  return { ...pos, charOffset: pos.charOffset + Array.from(newText).length };
}

export function replaceAllFindHits(wasm: any, query: string, caseSensitive: boolean, newText: string): number {
  const hits = readFindHits(wasm, query, caseSensitive), selected: FindHit[] = [];
  if (hits.length > 1000) throw new Error('모두 바꾸기는 한 번에 1,000개 결과까지 지원합니다. 검색 범위를 줄여 주세요.');
  // Native search reports overlaps. Replacing "ana" in "banana" must not delete
  // the same source scalar twice. Select disjoint matches before reversing edits.
  for (const hit of hits) {
    const previous = selected.at(-1), position = findHitPosition(hit)!;
    if (previous) {
      const end = { ...findHitPosition(previous)!, charOffset: previous.charOffset + previous.length };
      if (compare(positionKey(position)!, positionKey(end)!) < 0) continue;
    }
    selected.push(hit);
  }
  let changed = 0;
  for (const hit of selected.reverse()) if (applyFindReplacement(rawFindDocument(wasm), hit, query, caseSensitive, newText)) changed++;
  return changed;
}
