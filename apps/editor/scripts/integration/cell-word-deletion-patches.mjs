import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export function patchCellWordDeletion(source) {
  source = source.replace(/\r\n/g, '\n');
  const before = `      if (this.cursor.hasSelection()) {
        this.deleteSelection();
      } else {
        // Ctrl+Delete (Win/Linux): 다음 단어 경계까지 삭제
        this.cursor.setAnchor();
        this.cursor.moveToWordBoundary(1);
        if (this.cursor.hasSelection()) this.deleteSelection();
      }`;
  if (source.split(before).length !== 2) throw new Error('Cell word deletion integration drift');
  return "import { deleteForwardWordWithinCellBoundary } from '../jueony/shortcuts/cell-word-deletion.ts';\n"
    + source.replace(before, '      deleteForwardWordWithinCellBoundary(this);');
}

export async function applyCellWordDeletionPatches({ root }) {
  const path = join(root, 'src/engine/input-handler-keyboard.ts');
  await writeFile(path, patchCellWordDeletion(await readFile(path, 'utf8')));
}
