import {readFile, writeFile} from 'node:fs/promises';
import {join} from 'node:path';

const IMPORT = "import {installPageNumberPositionDialogN021} from '../adapters/browser/page-number-position-dialog-n021.ts';\n";
const PENDING_BINDING = "binding('Ctrl+N,P', 'pending:page-number-dialog', '쪽 번호 매기기')";
const LIVE_BINDING = "binding('Ctrl+N,P', 'page:page-number-dialog', '쪽 번호 매기기')";

function replaceExactly(source, before, after, label) {
  if (source.split(before).length !== 2) throw new Error(`N021 page-number Studio seam drift: ${label}`);
  return source.replace(before, after);
}

export function patchPageNumberPositionKeymapN021(source) {
  const next = source.replace(/\r\n/g, '\n');
  if (next.includes(LIVE_BINDING)) throw new Error('N021 page-number keymap patch was already applied');
  return replaceExactly(next, PENDING_BINDING, LIVE_BINDING, 'Ctrl+N,P binding');
}

export function patchPageNumberPositionInstallN021(source) {
  let next = source.replace(/\r\n/g, '\n');
  if (next.includes(IMPORT.trim())) throw new Error('N021 page-number install patch was already applied');
  next = IMPORT + next;
  return replaceExactly(
    next,
    '  const resolver = new HangulKeyResolver();',
    '  const resolver = new HangulKeyResolver();\n  installPageNumberPositionDialogN021({registry, input});',
    'command registration',
  );
}

/** Applies only to the generated pinned Studio copy. Build hook wiring is separate. */
export async function applyPageNumberPositionPatchesN021({root}) {
  const keymapPath = join(root, 'src/jueony/shortcuts/keymap.ts');
  const installPath = join(root, 'src/jueony/shortcuts/install.ts');
  await writeFile(keymapPath, patchPageNumberPositionKeymapN021(await readFile(keymapPath, 'utf8')));
  await writeFile(installPath, patchPageNumberPositionInstallN021(await readFile(installPath, 'utf8')));
}
