import {validateTextBoxBookmark} from '../../modules/preferences/public/index.ts';
import type {TextBoxBookmark} from '../../modules/preferences/public/index.ts';
import {auditTextBoxOwnerCapabilityN014} from './session-textbox-owner-capability-n014.ts';

type Position={sectionIndex:number;paragraphIndex:number;charOffset:number;parentParaIndex?:number;controlIndex?:number;cellIndex?:number;cellParaIndex?:number;cellPath?:{controlIndex:number;cellIndex:number;cellParaIndex:number}[];isTextBox?:boolean};

export type StudioTextBoxCursorPortN014={
 getPosition():Position;
 moveTo(position:Position):void;
 setAnchor():void;
 clearSelection():void;
 getSelection():{anchor:Position;focus:Position}|null;
 hasSelection():boolean;
 exitHeaderFooterMode():void;
 exitFootnoteMode():void;
 exitCellSelectionMode():void;
 exitBlockSelectionMode():void;
 exitTableObjectSelection():void;
 exitPictureObjectSelection():void;
 resetPreferredX():void;
};

export type StudioTextBoxRestoreInputN014={
 cursor:StudioTextBoxCursorPortN014;
 wasm:{borrowDocumentHandle?():unknown};
};

const callback={restoreSessionTextBox:()=>true};
function point(saved:TextBoxBookmark,caret:TextBoxBookmark['caret']):Position{
 return {sectionIndex:caret.section,paragraphIndex:caret.paragraph,charOffset:caret.offset,parentParaIndex:saved.focus.caret.paragraph,
  controlIndex:saved.control,cellIndex:0,cellParaIndex:caret.paragraph,
  cellPath:[{controlIndex:saved.control,cellIndex:0,cellParaIndex:caret.paragraph}],isTextBox:true};
}
function same(left:Position|undefined,right:Position):boolean{
 if(!left||left.sectionIndex!==right.sectionIndex||left.paragraphIndex!==right.paragraphIndex||left.charOffset!==right.charOffset
  ||left.parentParaIndex!==right.parentParaIndex||left.controlIndex!==right.controlIndex||left.cellIndex!==right.cellIndex
  ||left.cellParaIndex!==right.cellParaIndex||left.isTextBox!==true)return false;
 const a=left.cellPath,b=right.cellPath;
 return Array.isArray(a)&&Array.isArray(b)&&a.length===1&&b.length===1&&a[0].controlIndex===b[0].controlIndex
  &&a[0].cellIndex===b[0].cellIndex&&a[0].cellParaIndex===b[0].cellParaIndex;
}
function capability(input:StudioTextBoxRestoreInputN014,target:Position){
 const document=(input.wasm.borrowDocumentHandle?.()??input.wasm) as any;
 const result=auditTextBoxOwnerCapabilityN014(document,callback,target);
 return result.complete&&result.capability.scope==='root-textbox'&&result.capability.restorationAddressable
  ?result.capability:undefined;
}
function resetModes(cursor:StudioTextBoxCursorPortN014){
 cursor.exitHeaderFooterMode();cursor.exitFootnoteMode();cursor.clearSelection();cursor.exitCellSelectionMode();cursor.exitBlockSelectionMode();
 cursor.exitTableObjectSelection();cursor.exitPictureObjectSelection();
}
function rollback(cursor:StudioTextBoxCursorPortN014,position:Position,selection:{anchor:Position;focus:Position}|null){
 try{
  resetModes(cursor);
  if(selection){cursor.moveTo(selection.anchor);cursor.setAnchor();cursor.moveTo(selection.focus);}
  else cursor.moveTo(position);
  cursor.resetPreferredX();
 }catch{/* Restoration failed closed; never report a successful text-box restore. */}
}

/**
 * Studio-side cursor mutation for a previously validated TextBoxBookmark.
 *
 * The public callback is deliberately root-only.  Both endpoints must resolve
 * to the same exact owner/story and addressable geometry before any cursor
 * state is changed.  The live selection and owner evidence are read back after
 * the move; ambiguity never becomes a successful restore.
 */
export function restoreStudioTextBoxCursorN014(input:StudioTextBoxRestoreInputN014|undefined,value:unknown):boolean{
 const saved=validateTextBoxBookmark(value);
 if(!input||!saved)return false;
 const focus=point(saved,saved.caret),anchor=saved.anchor?point(saved,saved.anchor):undefined;
 let focusCapability:ReturnType<typeof capability>,anchorCapability:ReturnType<typeof capability>;
 try{
  focusCapability=capability(input,focus);anchorCapability=anchor?capability(input,anchor):focusCapability;
  if(!focusCapability||!anchorCapability)return false;
  if(focusCapability.address.section!==anchorCapability.address.section||focusCapability.address.parentParagraph!==anchorCapability.address.parentParagraph
   ||focusCapability.address.path[0]?.controlIndex!==anchorCapability.address.path[0]?.controlIndex)return false;
 }catch{return false;}
 const cursor=input.cursor,original=cursor.getPosition(),originalSelection=cursor.getSelection();
 try{
  resetModes(cursor);
  if(anchor){cursor.moveTo(anchor);cursor.setAnchor();}
  cursor.moveTo(focus);cursor.resetPreferredX();
  if(!same(cursor.getPosition(),focus))throw new Error('focus-readback');
  const selection=cursor.getSelection();
  if(anchor){if(!selection||!same(selection.anchor,anchor)||!same(selection.focus,focus))throw new Error('selection-readback');}
  else if(selection||cursor.hasSelection())throw new Error('unexpected-selection');
  const currentFocus=capability(input,focus),currentAnchor=anchor?capability(input,anchor):currentFocus;
  if(!currentFocus||!currentAnchor||currentFocus.evidenceFingerprint!==focusCapability.evidenceFingerprint
   ||currentAnchor.evidenceFingerprint!==anchorCapability.evidenceFingerprint)throw new Error('owner-readback');
  return true;
 }catch{
  rollback(cursor,original,originalSelection);return false;
 }
}
