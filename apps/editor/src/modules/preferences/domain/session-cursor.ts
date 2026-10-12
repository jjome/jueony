import type { SessionCursor, SessionPoint, CellBlockBookmark } from '../public/contracts.ts';
import {validateBodyCaret} from './body-caret.ts';
const integer = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0 && (value as number) <= 2147483647;
const digest = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
function point(value: any): SessionPoint | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return;
  const caret = validateBodyCaret(value.caret); if (!caret) return;
  if (value.kind === 'body') return {kind:'body',caret};
  if (value.kind !== 'cell' || !integer(value.parentParagraph) || !integer(value.control) || !integer(value.cell) || !digest(value.tableFingerprint)) return;
  return {kind:'cell',caret,parentParagraph:value.parentParagraph,control:value.control,cell:value.cell,tableFingerprint:value.tableFingerprint};
}
export function validateSessionCursor(value: any): SessionCursor | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return;
  const focus = point(value.focus); if (!focus) return;
  if (value.kind === 'text') {
    if (value.blockPhase !== null && (!integer(value.blockPhase) || value.blockPhase > 5)) return;
    if (value.anchor === undefined) return value.blockPhase === null ? {kind:'text',focus,blockPhase:null} : undefined;
    const anchor = point(value.anchor); if (!anchor || anchor.kind !== focus.kind || !digest(value.selectionFingerprint)) return;
    if (anchor.kind === 'cell' && focus.kind === 'cell' && (value.blockPhase !== null || anchor.caret.section !== focus.caret.section || anchor.parentParagraph !== focus.parentParagraph || anchor.control !== focus.control || anchor.cell !== focus.cell || anchor.tableFingerprint !== focus.tableFingerprint)) return;
    return {kind:'text',focus,anchor,blockPhase:value.blockPhase,selectionFingerprint:value.selectionFingerprint};
  }
  if (value.kind !== 'cells' || focus.kind !== 'cell') return;
  const block = value.block;
  if (!block || ![1,2,3].includes(block.phase) || !['manual','protected'].includes(block.reason)
    || !integer(block.anchor?.row) || !integer(block.anchor?.col) || !integer(block.focus?.row) || !integer(block.focus?.col)
    || !Array.isArray(block.excluded) || block.excluded.length > 512
    || !block.excluded.every((key:unknown) => typeof key === 'string' && /^\d{1,10},\d{1,10}$/.test(key) && key.split(',').every(v=>integer(Number(v))))) return;
  const clean: CellBlockBookmark = {anchor:{row:block.anchor.row,col:block.anchor.col},focus:{row:block.focus.row,col:block.focus.col},phase:block.phase,reason:block.reason,excluded:[...new Set<string>(block.excluded)]};
  return {kind:'cells',focus,block:clean};
}
