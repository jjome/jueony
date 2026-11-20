import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const IMPORT = "import {createInsertPlaceholderStudioCommandN019} from '../../jueony/shortcuts/insert-placeholder-capability-n019.ts';\n";

function replaceExactly(source, before, after, label) {
  if (source.split(before).length !== 2) {
    throw new Error(`N019 Studio command seam drift: ${label}`);
  }
  return source.replace(before, after);
}

/** Pure transform used by the isolated browser proof and the Studio build seam. */
export function patchInsertPlaceholderCommandsN019(source) {
  let next = source.replace(/\r\n/g, '\n');
  if (!next.includes(IMPORT.trim())) next = IMPORT + next;
  next = replaceExactly(
    next,
    "  stub('insert:para-band', t('command.insert.paraBand.label')),",
    "  createInsertPlaceholderStudioCommandN019('insert:para-band', t('command.insert.paraBand.label')),",
    'paragraph band command',
  );
  return replaceExactly(
    next,
    "  stub('insert:comment', t('command.insert.comment.label'), 'icon-comment'),",
    "  createInsertPlaceholderStudioCommandN019('insert:comment', t('command.insert.comment.label'), 'icon-comment'),",
    'comment command',
  );
}

export async function applyInsertPlaceholderCommandPatchesN019({ root }) {
  const path = join(root, 'src/command/commands/insert.ts');
  await writeFile(path, patchInsertPlaceholderCommandsN019(await readFile(path, 'utf8')));
}
