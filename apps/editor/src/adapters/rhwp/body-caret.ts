import { validateBodyCaret } from '../../modules/preferences/public/index.ts';
import type { BodyCaret } from '../../modules/preferences/public/index.ts';

type Position = { sectionIndex: number; paragraphIndex: number; charOffset: number; parentParaIndex?: number; cellPath?: {controlIndex:number;cellIndex:number;cellParaIndex:number}[] };
type CaretInput = {
  getCursorPosition(): Position; restoreSessionCaret(position: Position): void;
  cursor: { hasSelection(): boolean; isInHeaderFooter(): boolean; isInFootnote(): boolean; isInTextBox(): boolean; isInCellSelectionMode(): boolean; isInTableObjectSelection(): boolean; isInPictureObjectSelection(): boolean; moveTo(position: Position): void };
  wasm: { getSectionCount(): number; getParagraphCount(section: number): number; getParagraphLength(section: number, paragraph: number): number; getTextRange(section: number, paragraph: number, offset: number, count: number): string };
};
function isBody(input: CaretInput): boolean {
  const position = input.getCursorPosition(), cursor = input.cursor;
  return position.parentParaIndex === undefined && !position.cellPath?.length && !cursor.hasSelection()
    && !cursor.isInHeaderFooter() && !cursor.isInFootnote() && !cursor.isInTextBox() && !cursor.isInCellSelectionMode()
    && !cursor.isInTableObjectSelection() && !cursor.isInPictureObjectSelection();
}
export function captureBodyCaret(input: CaretInput | undefined): BodyCaret | undefined {
  if (!input || !isBody(input)) return;
  const { sectionIndex: section, paragraphIndex: paragraph, charOffset: offset } = input.getCursorPosition();
  // During a document swap the engine can already hold the new bytes while
  // the input handler still holds the previous cursor until layout completes.
  if (![section, paragraph, offset].every(v => Number.isSafeInteger(v) && v >= 0)
    || section >= input.wasm.getSectionCount() || paragraph >= input.wasm.getParagraphCount(section)) return;
  const paragraphLength = input.wasm.getParagraphLength(section, paragraph);
  if (offset > paragraphLength) return;
  return validateBodyCaret({ section, paragraph, offset, paragraphLength,
    before: input.wasm.getTextRange(section, paragraph, Math.max(0, offset - 32), Math.min(offset, 32)),
    after: input.wasm.getTextRange(section, paragraph, offset, Math.min(paragraphLength - offset, 32)) });
}
export function restoreBodyCaret(input: CaretInput | undefined, value: unknown): boolean {
  const caret = validateBodyCaret(value);
  if (!input || !caret || !isBody(input)) return false;
  const { section, paragraph, offset, paragraphLength, before, after } = caret, wasm = input.wasm;
  if (section >= wasm.getSectionCount() || paragraph >= wasm.getParagraphCount(section)
    || paragraphLength !== wasm.getParagraphLength(section, paragraph)
    || before !== wasm.getTextRange(section, paragraph, Math.max(0, offset - 32), Math.min(offset, 32))
    || after !== wasm.getTextRange(section, paragraph, offset, Math.min(paragraphLength - offset, 32))) return false;
  input.restoreSessionCaret({ sectionIndex: section, paragraphIndex: paragraph, charOffset: offset });
  return true;
}
