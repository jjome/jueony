/** A cursor can navigate across cell edges; automatic word deletion cannot.
 * Paragraph changes inside the same (possibly nested) cell remain supported.
 */
export function sameDeletionCell(start: any, end: any): boolean {
  if (start.parentParaIndex === undefined || end.parentParaIndex === undefined
    || start.sectionIndex !== end.sectionIndex || start.parentParaIndex !== end.parentParaIndex) return false;
  const path = (position: any): unknown => {
    const entries = position.cellPath?.length ? position.cellPath : [{ controlIndex: position.controlIndex, cellIndex: position.cellIndex }];
    if (!Array.isArray(entries) || entries.some((entry: any, depth: number) => !entry
      || !Number.isInteger(entry.controlIndex) || entry.controlIndex < 0
      || !Number.isInteger(entry.cellIndex) || entry.cellIndex < 0
      || (depth < entries.length - 1 && (!Number.isInteger(entry.cellParaIndex) || entry.cellParaIndex < 0)))) return null;
    // An ancestor paragraph identifies which nested table contains the leaf.
    // Only the leaf paragraph may change when joining paragraphs in one cell.
    return entries.map((entry: any, depth: number) => depth < entries.length - 1
      ? [entry.controlIndex, entry.cellIndex, entry.cellParaIndex]
      : [entry.controlIndex, entry.cellIndex]);
  };
  const left = path(start), right = path(end);
  return left !== null && right !== null && JSON.stringify(left) === JSON.stringify(right);
}

export function deleteForwardWordWithinCellBoundary(input: any): void {
  const cursor = input.cursor;
  // An explicit selection retains the existing deletion/form protection path.
  if (cursor.hasSelection()) { input.deleteSelection(); return; }
  const start = cursor.getPosition();
  const inTableCell = cursor.isInCell() && !cursor.isInTextBox();
  cursor.setAnchor(); cursor.moveToWordBoundary(1);
  if (inTableCell && !sameDeletionCell(start, cursor.getPosition())) {
    cursor.clearSelection(); cursor.moveTo(start); input.updateCaret(); return;
  }
  if (cursor.hasSelection()) input.deleteSelection();
}
