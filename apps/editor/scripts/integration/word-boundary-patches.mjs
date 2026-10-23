import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

function replaceCount(source, before, after, count, label) {
  if (source.split(before).length !== count + 1) throw new Error('Word boundary integration drift: ' + label);
  return source.split(before).join(after);
}

export function patchScalarWordBoundaries(source) {
  source = source.replace(/\r\n/g, '\n');
  const marker = '// ─── 단어 경계 탐색 유틸 (PR #794, Alt+Arrow 단어 이동)';
  const start = source.indexOf(marker);
  if (start < 0 || source.indexOf(marker, start + 1) >= 0 || !source.slice(start).trimEnd().endsWith('return { start, end };\n}')) throw new Error('Word boundary helper boundary drift');
  source = "import { findWordBoundaryForward, findWordBoundaryBackward, findWordAt, findSentenceAt } from '../jueony/shortcuts/word-boundaries.ts';\n" + source.slice(0, start);
  source = replaceCount(source, 'Math.min(remaining, 50)', 'remaining', 3, 'whole body/cell word');
  source = replaceCount(source, 'const start = Math.max(0, pos.charOffset - 50);', 'const start = 0;', 2, 'whole preceding body/cell word');
  source = replaceCount(source, 'Array.from(text).slice(this._hfCharOffset, this._hfCharOffset + 50)', 'Array.from(text).slice(this._hfCharOffset)', 1, 'whole header/footer word');
  source = replaceCount(source, 'const start = Math.max(0, this._hfCharOffset - 50);', 'const start = 0;', 1, 'whole preceding header/footer word');
  return source;
}

export function patchBlockSelectionNavigation(source) {
  source = source.replace(/\r\n/g, '\n');
  source = replaceCount(source, 'function executeNavigationAction(this: any, action: NavigationAction, shiftKey: boolean): void {',
    'function executeNavigationAction(this: any, action: NavigationAction, shiftKey: boolean): void {\n  shiftKey ||= this.cursor.isInBlockSelectionMode();', 1, 'block word/paragraph navigation');
  const start = source.indexOf("    case 'ArrowLeft': {\n");
  // The main switch combines all four arrow cases; assert its exact boundary.
  const arrow = source.indexOf("    case 'ArrowLeft':\n    case 'ArrowRight':\n    case 'ArrowUp':\n    case 'ArrowDown': {");
  const end = source.indexOf("    case 'Tab':", arrow);
  if (start >= 0 || arrow < 0 || end < 0) throw new Error('Block selection movement boundary drift');
  const segment = source.slice(arrow, end);
  if (!segment.includes("case 'Home'") || !segment.includes("case 'End'")) throw new Error('Block selection line edges missing');
  source = source.slice(0, arrow) + segment.replaceAll('e.shiftKey', '(e.shiftKey || this.cursor.isInBlockSelectionMode())') + source.slice(end);
  return source;
}

export function patchEmptySelectionDeletion(source) {
  source = source.replace(/\r\n/g, '\n');
  return replaceCount(source,
    '    const sel = this.cursor.getSelectionOrdered();\n    if (!sel) return;\n    if (!this.canDeleteSelectionInFormMode()) return;',
    '    const sel = this.cursor.getSelectionOrdered();\n    if (!sel) return;\n    // An anchor can equal the cursor at a document/cell edge. There is no edit\n    // to record in that case: retain the clean document and existing history.\n    if (CursorState.comparePositions(sel.start, sel.end) === 0) { this.cursor.clearSelection(); this.updateSelection(); return; }\n    if (!this.canDeleteSelectionInFormMode()) return;',
    1, 'empty selection deletion');
}

export async function applyWordBoundaryPatches({ root }) {
  const cursorPath = join(root, 'src/engine/cursor.ts'), keyboardPath = join(root, 'src/engine/input-handler-keyboard.ts'), inputPath = join(root, 'src/engine/input-handler.ts');
  const cursor = patchScalarWordBoundaries(await readFile(cursorPath, 'utf8'));
  const keyboard = patchBlockSelectionNavigation(await readFile(keyboardPath, 'utf8'));
  const input = patchEmptySelectionDeletion(await readFile(inputPath, 'utf8'));
  await writeFile(cursorPath, cursor); await writeFile(keyboardPath, keyboard); await writeFile(inputPath, input);
}
