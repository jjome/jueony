/** Use the editor's snapshot command for the combined character/paragraph edit.
 * The existing snapshot owns rollback, redo and bounded history resources. */
export function createFormatCopyCommand(commands: any, input: {
  start: any; end: any; cursor: any; selection: any; targets: any[];
  charProps: Record<string, unknown>; paraProps: Record<string, unknown>;
}) {
  const data = structuredClone(input);
  if (data.start.sectionIndex !== data.end.sectionIndex || data.start.parentParaIndex !== undefined
    || data.end.parentParaIndex !== undefined || data.start.isTextBox || data.end.isTextBox
    || data.start.cellPath?.length || data.end.cellPath?.length || !data.targets.length
    || data.targets.some((target: any) => target.kind !== 'body' || target.sec !== data.start.sectionIndex)) {
    throw new Error('모양 복사의 본문 범위를 확인할 수 없습니다.');
  }
  let applied = false;
  const command = new commands.SnapshotCommand('formatCopy', data.cursor, data.cursor, (wasm: any) => {
    if (Object.keys(data.charProps).length) new commands.ApplyCharFormatCommand(data.start, data.end, data.charProps).execute(wasm);
    if (Object.keys(data.paraProps).length) new commands.ApplyParaFormatCommand(data.targets, data.paraProps, data.cursor).execute(wasm);
    applied = true;
    return data.cursor;
  }, data.selection);
  command.selectionAfter = () => structuredClone(data.selection);
  command.wasApplied = () => applied;
  return command;
}
