import {validateTextBoxBookmark} from './textbox-bookmark.ts';
import type { SessionCursor, SessionPoint, SessionCellPath, CellBlockBookmark } from '../public/contracts.ts';
import {validateBodyCaret} from './body-caret.ts';
const integer = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0 && (value as number) <= 2147483647;
const digest = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
function point(value: any): SessionPoint | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return;
  const caret = validateBodyCaret(value.caret); if (!caret) return;
  if (value.kind === 'body') return {kind:'body',caret};
  if (value.kind !== 'cell' || !integer(value.parentParagraph) || !integer(value.control) || !integer(value.cell) || !digest(value.tableFingerprint)) return;
  let cellPath: SessionCellPath | undefined;
  if (value.cellPath !== undefined) {
    if (!Array.isArray(value.cellPath) || value.cellPath.length < 2 || value.cellPath.length > 8
      || !value.cellPath.every((entry:any)=>entry && integer(entry.controlIndex) && integer(entry.cellIndex) && integer(entry.cellParaIndex))) return;
    cellPath = value.cellPath.map((entry:any)=>({controlIndex:entry.controlIndex,cellIndex:entry.cellIndex,cellParaIndex:entry.cellParaIndex}));
    if (cellPath![0].controlIndex !== value.control || cellPath![0].cellIndex !== value.cell || cellPath!.at(-1)!.cellParaIndex !== caret.paragraph) return;
  }
  return {kind:'cell',caret,parentParagraph:value.parentParagraph,control:value.control,cell:value.cell,tableFingerprint:value.tableFingerprint,...(cellPath?{cellPath}:{})};
}
function sameCell(a: Extract<SessionPoint,{kind:'cell'}>, b: Extract<SessionPoint,{kind:'cell'}>) {
  const address = (point:typeof a) => point.cellPath?.map((entry,index)=>[entry.controlIndex,entry.cellIndex,index===point.cellPath!.length-1?null:entry.cellParaIndex]) ?? null;
  return a.caret.section===b.caret.section && a.parentParagraph===b.parentParagraph && a.control===b.control && a.cell===b.cell
    && a.tableFingerprint===b.tableFingerprint && JSON.stringify(address(a))===JSON.stringify(address(b));
}
export function validateSessionCursor(value: any): SessionCursor | undefined {
  if(value?.kind==='textbox')return validateTextBoxBookmark(value);
  if (!value || typeof value !== 'object' || Array.isArray(value)) return;
  const focus = point(value.focus); if (!focus) return;
  if (value.kind === 'header-footer' || value.kind === 'footnote') {
    if (focus.kind !== 'body' || !digest(value.storyFingerprint)) return;
    const caret=validateBodyCaret(value.caret),anchor=value.anchor===undefined?undefined:validateBodyCaret(value.anchor);
    if (!caret || (value.anchor!==undefined&&(!anchor||anchor.section!==caret.section))) return;
    const common={focus,caret,...(anchor?{anchor}:{}),storyFingerprint:value.storyFingerprint};
    if(value.kind==='header-footer') {
      if(typeof value.isHeader!=='boolean'||![0,1,2].includes(value.applyTo))return;
      return {kind:'header-footer',...common,isHeader:value.isHeader,applyTo:value.applyTo};
    }
    if(!integer(value.parentParagraph)||!integer(value.control)||!integer(value.page)||!integer(value.index)
      || typeof value.sourceType!=='string'||!/^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/.test(value.sourceType))return;
    return {kind:'footnote',...common,parentParagraph:value.parentParagraph,control:value.control,page:value.page,index:value.index,sourceType:value.sourceType};
  }
  if (value.kind === 'picture-object') {
    if (focus.kind !== 'body' || !integer(value.control) || !digest(value.pictureFingerprint)) return;
    return {kind:'picture-object',focus,control:value.control,pictureFingerprint:value.pictureFingerprint};
  }
  if (value.kind === 'table-object') {
    if (focus.kind !== 'body' || !integer(value.control) || !digest(value.tableFingerprint)) return;
    return {kind:'table-object',focus,control:value.control,tableFingerprint:value.tableFingerprint};
  }
  if (value.kind === 'text') {
    if (value.blockPhase !== null && (!integer(value.blockPhase) || value.blockPhase > 5)) return;
    if (value.anchor === undefined) return value.blockPhase === null ? {kind:'text',focus,blockPhase:null} : undefined;
    const anchor = point(value.anchor); if (!anchor || anchor.kind !== focus.kind || !digest(value.selectionFingerprint)) return;
    if (anchor.kind === 'cell' && focus.kind === 'cell' && (value.blockPhase !== null || !sameCell(anchor,focus))) return;
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
