import {sha256} from '@noble/hashes/sha2.js';
import {validateBodyCaret, validateSessionCursor} from '../../modules/preferences/public/index.ts';
import type {BodyCaret, SessionCursor, SessionPoint, CellBlockBookmark} from '../../modules/preferences/public/index.ts';

type Position = {sectionIndex:number;paragraphIndex:number;charOffset:number;parentParaIndex?:number;controlIndex?:number;cellIndex?:number;cellParaIndex?:number;cellPath?:{controlIndex:number;cellIndex:number;cellParaIndex:number}[];isTextBox?:boolean};
type Block = CellBlockBookmark & {sec:number;ppi:number;ci:number;cellPath?:Position['cellPath']};
export type SessionCursorInput = {
  getCursorPosition():Position;
  restoreSessionSelection(focus:Position,anchor:Position|undefined,phase:number|null,block:Block|undefined):boolean;
  cursor:{hasSelection():boolean;getSelection():{anchor:Position;focus:Position}|null;blockSelectionPhase():number|null;captureCellSelection():Block|null;
    isInHeaderFooter():boolean;isInFootnote():boolean;isInTextBox():boolean;isInTableObjectSelection():boolean;isInPictureObjectSelection():boolean};
  wasm:{requiresPasswordForSave?:boolean;getSectionCount():number;getParagraphCount(section:number):number;getParagraphLength(section:number,paragraph:number):number;getTextRange(section:number,paragraph:number,offset:number,count:number):string;
    getTableDimensions(section:number,parent:number,control:number):{rowCount:number;colCount:number;cellCount:number};
    getCellInfo(section:number,parent:number,control:number,cell:number):{row:number;col:number;rowSpan:number;colSpan:number};
    getCellParagraphCount(section:number,parent:number,control:number,cell:number):number;
    getCellParagraphLength(section:number,parent:number,control:number,cell:number,paragraph:number):number;
    getTextInCell(section:number,parent:number,control:number,cell:number,paragraph:number,offset:number,count:number):string;};
};
const integer=(v:unknown):v is number=>Number.isSafeInteger(v)&&(v as number)>=0&&(v as number)<=2147483647;
const hash=(value:unknown)=>Array.from(sha256(new TextEncoder().encode(JSON.stringify(value))),v=>v.toString(16).padStart(2,'0')).join('');
function unsupported(input:SessionCursorInput){const c=input.cursor;return input.wasm.requiresPasswordForSave||c.isInHeaderFooter()||c.isInFootnote()||c.isInTextBox()||c.isInTableObjectSelection()||c.isInPictureObjectSelection();}
function evidence(input:SessionCursorInput){
 const wasm=input.wasm,cache=new Map<string,{fingerprint:string;rows:number;columns:number}>();
 function bodyAddress(section:number,paragraph:number){return integer(section)&&integer(paragraph)&&section<wasm.getSectionCount()&&paragraph<wasm.getParagraphCount(section);}
 function table(section:number,parent:number,control:number){
  if(!bodyAddress(section,parent)||!integer(control))return;
  const key=`${section}:${parent}:${control}`;if(cache.has(key))return cache.get(key);
  const dims=wasm.getTableDimensions(section,parent,control);
  if(![dims.rowCount,dims.colCount,dims.cellCount].every(v=>integer(v)&&v>0)||dims.cellCount>512)return;
  const cells:unknown[]=[];let characters=0,paragraphs=0;
  for(let cell=0;cell<dims.cellCount;cell++){
   const info=wasm.getCellInfo(section,parent,control,cell),count=wasm.getCellParagraphCount(section,parent,control,cell);
   if(!integer(count)||count<1||(paragraphs+=count)>1024)return;
   const text:string[]=[];
   for(let paragraph=0;paragraph<count;paragraph++){
    const length=wasm.getCellParagraphLength(section,parent,control,cell,paragraph);
    if(!integer(length)||(characters+=length)>100000)return;
    const content=wasm.getTextInCell(section,parent,control,cell,paragraph,0,length);if([...content].length!==length)return;
    text.push(content);
   }
   cells.push([info.row,info.col,info.rowSpan,info.colSpan,text]);
  }
  const hostLength=wasm.getParagraphLength(section,parent);
  const result={fingerprint:hash([dims.rowCount,dims.colCount,dims.cellCount,hostLength,wasm.getTextRange(section,parent,0,Math.min(hostLength,64)),cells]),rows:dims.rowCount,columns:dims.colCount};
  cache.set(key,result);return result;
 }
 function point(position:Position):SessionPoint|undefined{
  const section=position.sectionIndex,offset=position.charOffset;
  if(!integer(offset)||position.isTextBox||(position.cellPath?.length??0)>1)return;
  const parent=position.parentParaIndex;
  if(parent===undefined){
   const paragraph=position.paragraphIndex;if(position.cellPath?.length||!bodyAddress(section,paragraph))return;
   const length=wasm.getParagraphLength(section,paragraph);if(offset>length)return;
   const caret=bookmark(section,paragraph,offset,length,(start,count)=>wasm.getTextRange(section,paragraph,start,count));
   return caret?{kind:'body',caret}:undefined;
  }
  const path=position.cellPath?.[0],control=path?.controlIndex??position.controlIndex,cell=path?.cellIndex??position.cellIndex,paragraph=path?.cellParaIndex??position.cellParaIndex;
  if(!integer(control)||!integer(cell)||!integer(paragraph))return;
  const info=table(section,parent,control);if(!info)return;
  if(cell>=wasm.getTableDimensions(section,parent,control).cellCount||paragraph>=wasm.getCellParagraphCount(section,parent,control,cell))return;
  const length=wasm.getCellParagraphLength(section,parent,control,cell,paragraph);if(offset>length)return;
  const caret=bookmark(section,paragraph,offset,length,(start,count)=>wasm.getTextInCell(section,parent,control,cell,paragraph,start,count));
  return caret?{kind:'cell',caret,parentParagraph:parent,control,cell,tableFingerprint:info.fingerprint}:undefined;
 }
 function selection(anchor:SessionPoint,focus:SessionPoint):string|undefined{
  if(anchor.kind==='cell'&&focus.kind==='cell'){
   if(anchor.caret.section!==focus.caret.section||anchor.parentParagraph!==focus.parentParagraph||anchor.control!==focus.control||anchor.cell!==focus.cell)return;
   return anchor.tableFingerprint===focus.tableFingerprint?anchor.tableFingerprint:undefined;
  }
  if(anchor.kind!=='body'||focus.kind!=='body')return;
  let start=anchor.caret,end=focus.caret;
  if(start.section>end.section||(start.section===end.section&&start.paragraph>end.paragraph))[start,end]=[end,start];
  const values:string[]=[];let count=0,characters=0;
  for(let section=start.section;section<=end.section;section++){
   const last=section===end.section?end.paragraph:wasm.getParagraphCount(section)-1;
   for(let paragraph=section===start.section?start.paragraph:0;paragraph<=last;paragraph++){
    const length=wasm.getParagraphLength(section,paragraph);
    if(++count>1000||(characters+=length)>100000)return;
    const content=wasm.getTextRange(section,paragraph,0,length);if([...content].length!==length)return;
    values.push(content);
   }
  }
  return hash(values);
 }
 return {point,table,selection};
}
function bookmark(section:number,paragraph:number,offset:number,paragraphLength:number,read:(start:number,count:number)=>string):BodyCaret|undefined{
 return validateBodyCaret({section,paragraph,offset,paragraphLength,before:read(Math.max(0,offset-32),Math.min(offset,32)),after:read(offset,Math.min(paragraphLength-offset,32))});
}
function position(point:SessionPoint):Position{
 const c=point.caret;
 return point.kind==='body'?{sectionIndex:c.section,paragraphIndex:c.paragraph,charOffset:c.offset}
  :{sectionIndex:c.section,paragraphIndex:c.paragraph,charOffset:c.offset,parentParaIndex:point.parentParagraph,controlIndex:point.control,cellIndex:point.cell,cellParaIndex:c.paragraph,cellPath:[{controlIndex:point.control,cellIndex:point.cell,cellParaIndex:c.paragraph}]};
}
export function captureSessionCursor(input:SessionCursorInput|undefined):SessionCursor|undefined{
 if(!input||unsupported(input))return;
 try{
  const read=evidence(input),focus=read.point(input.getCursorPosition());if(!focus)return;
  const block=input.cursor.captureCellSelection();
  if(block){
   if(focus.kind!=='cell'||(block.cellPath?.length??0)>1||block.sec!==focus.caret.section||block.ppi!==focus.parentParagraph||block.ci!==focus.control)return;
   return validateSessionCursor({kind:'cells',focus,block});
  }
  const range=input.cursor.getSelection();
  if(!range)return input.cursor.hasSelection()?undefined:validateSessionCursor({kind:'text',focus,blockPhase:null});
  const anchor=read.point(range.anchor),end=read.point(range.focus);if(!anchor||!end)return;
  const selectionFingerprint=read.selection(anchor,end);if(!selectionFingerprint)return;
  return validateSessionCursor({kind:'text',focus:end,anchor,blockPhase:anchor.kind==='body'?input.cursor.blockSelectionPhase():null,selectionFingerprint});
 }catch{return;}
}
export function restoreSessionCursor(input:SessionCursorInput|undefined,value:unknown):boolean{
 const saved=validateSessionCursor(value);if(!input||!saved||unsupported(input))return false;
 try{
  const read=evidence(input),focus=read.point(position(saved.focus));
  if(JSON.stringify(focus)!==JSON.stringify(saved.focus))return false;
  if(saved.kind==='text'){
   const anchor=saved.anchor?read.point(position(saved.anchor)):undefined;
   if(saved.anchor&&(JSON.stringify(anchor)!==JSON.stringify(saved.anchor)||!anchor||read.selection(anchor,focus!)!==saved.selectionFingerprint))return false;
   return input.restoreSessionSelection(position(saved.focus),saved.anchor?position(saved.anchor):undefined,saved.blockPhase,undefined);
  }
  const info=read.table(saved.focus.caret.section,saved.focus.parentParagraph,saved.focus.control);if(!info)return false;
  if(![saved.block.anchor,saved.block.focus,...saved.block.excluded.map(key=>{const [row,col]=key.split(',').map(Number);return {row,col};})].every(p=>p.row<info.rows&&p.col<info.columns))return false;
  return input.restoreSessionSelection(position(saved.focus),undefined,null,{...saved.block,sec:saved.focus.caret.section,ppi:saved.focus.parentParagraph,ci:saved.focus.control});
 }catch{return false;}
}
