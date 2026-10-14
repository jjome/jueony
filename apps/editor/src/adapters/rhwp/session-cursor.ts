import {captureTextBoxCursor,restoreTextBoxCursor} from './session-textbox.ts';
import type {TextBoxBookmark} from '../../modules/preferences/public/index.ts';
import {sha256} from '@noble/hashes/sha2.js';
import {validateBodyCaret, validateSessionCursor} from '../../modules/preferences/public/index.ts';
import type {BodyCaret, SessionCursor, SessionPoint, CellBlockBookmark,HeaderFooterBookmark,FootnoteBookmark} from '../../modules/preferences/public/index.ts';

type Position = {sectionIndex:number;paragraphIndex:number;charOffset:number;parentParaIndex?:number;controlIndex?:number;cellIndex?:number;cellParaIndex?:number;cellPath?:{controlIndex:number;cellIndex:number;cellParaIndex:number}[];isTextBox?:boolean};
type Block = CellBlockBookmark & {sec:number;ppi:number;ci:number;cellPath?:Position['cellPath']};
export type SessionCursorInput = {
  getCursorPosition():Position;
  restoreSessionSelection(focus:Position,anchor:Position|undefined,phase:number|null,block:Block|undefined):boolean;
  restoreSessionTableObject?(ref:{sec:number;ppi:number;ci:number}):boolean;
  restoreSessionPictureObject?(ref:{sec:number;ppi:number;ci:number;type:'image'}):boolean;
  restoreSessionHeaderFooter?(saved:HeaderFooterBookmark):boolean;
  restoreSessionFootnote?(saved:FootnoteBookmark):boolean;
  restoreSessionTextBox?(saved:TextBoxBookmark):boolean;
  cursor:{hasSelection():boolean;getSelection():{anchor:Position;focus:Position}|null;blockSelectionPhase():number|null;captureCellSelection():Block|null;
    isInHeaderFooter():boolean;isInFootnote():boolean;isInTextBox():boolean;isInTableObjectSelection():boolean;isInPictureObjectSelection():boolean;
    getSelectedTableRef?():{sec:number;ppi:number;ci:number;cellPath?:unknown[]}|null;
    getSelectedPictureRef?():{sec:number;ppi:number;ci:number;type:string;cellIdx?:number;cellPath?:unknown[];headerFooter?:unknown;noteRef?:unknown;missing?:boolean}|null;
    isMultiPictureSelection?():boolean;
    readonly headerFooterMode?:'none'|'header'|'footer';readonly hfSectionIdx?:number;readonly hfApplyTo?:number;readonly hfParaIdx?:number;readonly hfCharOffset?:number;
    getHeaderFooterSelectionOrdered?():{start:{sectionIdx:number;isHeader:boolean;applyTo:number;paraIdx:number;charOffset:number};end:{sectionIdx:number;isHeader:boolean;applyTo:number;paraIdx:number;charOffset:number}}|null;
    readonly fnSectionIdx?:number;readonly fnParaIdx?:number;readonly fnControlIdx?:number;readonly fnInnerParaIdx?:number;readonly fnCharOffset?:number;readonly fnPageNum?:number;readonly fnFootnoteIndex?:number;
    getFootnoteSelection?():{anchor:{fnParaIdx:number;charOffset:number};focus:{fnParaIdx:number;charOffset:number};pageNum:number;footnoteIndex:number}|null};
  wasm:{borrowDocumentHandle?():any;requiresPasswordForSave?:boolean;getSectionCount():number;getParagraphCount(section:number):number;getParagraphLength(section:number,paragraph:number):number;getTextRange(section:number,paragraph:number,offset:number,count:number):string;
    getTableDimensions(section:number,parent:number,control:number):{rowCount:number;colCount:number;cellCount:number};
    getCellInfo(section:number,parent:number,control:number,cell:number):{row:number;col:number;rowSpan:number;colSpan:number};
    getCellParagraphCount(section:number,parent:number,control:number,cell:number):number;
    getCellParagraphLength(section:number,parent:number,control:number,cell:number,paragraph:number):number;
    getTextInCell(section:number,parent:number,control:number,cell:number,paragraph:number,offset:number,count:number):string;
    getTableDimensionsByPath?(section:number,parent:number,path:string):{rowCount:number;colCount:number;cellCount:number};
    getCellInfoByPath?(section:number,parent:number,path:string):{row:number;col:number;rowSpan:number;colSpan:number};
    getCellParagraphCountByPath?(section:number,parent:number,path:string):number;
    getCellParagraphLengthByPath?(section:number,parent:number,path:string):number;
    getTextInCellByPath?(section:number,parent:number,path:string,offset:number,count:number):string;
    getPictureProperties?(section:number,parent:number,control:number):unknown;
    getControlImageData?(section:number,parent:number,control:number):Uint8Array;
    getControlImageMime?(section:number,parent:number,control:number):string;
    getHeaderFooter?(section:number,isHeader:boolean,applyTo:number):string;
    getHeaderFooterParaInfo?(section:number,isHeader:boolean,applyTo:number,paragraph:number):string;
    getFootnoteInfo?(section:number,parent:number,control:number):{ok:boolean;paraCount:number;totalTextLen:number;number:number;texts:string[]};
    getPageFootnoteInfo?(page:number,index:number):{ok:boolean;sectionIdx:number;paraIdx:number;controlIdx:number;sourceType:string}|null;};
};
const integer=(v:unknown):v is number=>Number.isSafeInteger(v)&&(v as number)>=0&&(v as number)<=2147483647;
const hash=(value:unknown)=>Array.from(sha256(new TextEncoder().encode(JSON.stringify(value))),v=>v.toString(16).padStart(2,'0')).join('');
function unsupported(input:SessionCursorInput){const c=input.cursor;return input.wasm.requiresPasswordForSave||c.isInHeaderFooter()||c.isInFootnote()||c.isInTextBox()||c.isInTableObjectSelection()||c.isInPictureObjectSelection();}
function evidence(input:SessionCursorInput){
 const wasm=input.wasm,cache=new Map<string,{fingerprint:string;rows:number;columns:number}>();
 function bodyAddress(section:number,paragraph:number){return integer(section)&&integer(paragraph)&&section<wasm.getSectionCount()&&paragraph<wasm.getParagraphCount(section);}
 function table(section:number,parent:number,control:number,path?:NonNullable<Position['cellPath']>){
  if(!bodyAddress(section,parent)||!integer(control))return;
  const nested=Boolean(path&&path.length>1);
  if(nested&&(!wasm.getTableDimensionsByPath||!wasm.getCellInfoByPath||!wasm.getCellParagraphCountByPath||!wasm.getCellParagraphLengthByPath||!wasm.getTextInCellByPath))return;
  // The final path paragraph is a caret address, not the table identity.
  const canonical=path?.map((entry,index)=>({...entry,...(index===path.length-1?{cellIndex:0,cellParaIndex:0}:{})}));
  const key=`${section}:${parent}:${control}:${nested?JSON.stringify(canonical):''}`;if(cache.has(key))return cache.get(key);
  const at=(cell:number,paragraph=0)=>JSON.stringify(canonical!.map((entry,index)=>index===canonical!.length-1?{...entry,cellIndex:cell,cellParaIndex:paragraph}:entry));
  const dims=nested?wasm.getTableDimensionsByPath!(section,parent,JSON.stringify(canonical)):wasm.getTableDimensions(section,parent,control);
  if(![dims.rowCount,dims.colCount,dims.cellCount].every(v=>integer(v)&&v>0)||dims.cellCount>512)return;
  const cells:unknown[]=[];let characters=0,paragraphs=0;
  for(let cell=0;cell<dims.cellCount;cell++){
   const info=nested?wasm.getCellInfoByPath!(section,parent,at(cell)):wasm.getCellInfo(section,parent,control,cell);
   const count=nested?wasm.getCellParagraphCountByPath!(section,parent,at(cell)):wasm.getCellParagraphCount(section,parent,control,cell);
   if(!integer(count)||count<1||(paragraphs+=count)>1024)return;
   const text:string[]=[];
   for(let paragraph=0;paragraph<count;paragraph++){
    const length=nested?wasm.getCellParagraphLengthByPath!(section,parent,at(cell,paragraph)):wasm.getCellParagraphLength(section,parent,control,cell,paragraph);
    if(!integer(length)||(characters+=length)>100000)return;
    const content=nested?wasm.getTextInCellByPath!(section,parent,at(cell,paragraph),0,length):wasm.getTextInCell(section,parent,control,cell,paragraph,0,length);if([...content].length!==length)return;
    text.push(content);
   }
   cells.push([info.row,info.col,info.rowSpan,info.colSpan,text]);
  }
  const hostLength=wasm.getParagraphLength(section,parent);
  const result={fingerprint:hash([dims.rowCount,dims.colCount,dims.cellCount,hostLength,wasm.getTextRange(section,parent,0,Math.min(hostLength,64)),cells]),rows:dims.rowCount,columns:dims.colCount};
  cache.set(key,result);return result;
 }
 function cellTable(section:number,parent:number,control:number,path?:NonNullable<Position['cellPath']>){
  if(!path||path.length<=1)return table(section,parent,control);
  // Resolve every ancestor as a table, excluding textbox sentinel paths. Guard
  // ancestor contents as well as all cells of the selected nested table.
  const fingerprints:string[]=[];let last:ReturnType<typeof table>;
  for(let depth=1;depth<=path.length;depth++){
   last=table(section,parent,control,path.slice(0,depth));if(!last)return;
   fingerprints.push(last.fingerprint);
  }
  return {...last!,fingerprint:hash(fingerprints)};
 }
 function point(position:Position):SessionPoint|undefined{
  const section=position.sectionIndex,offset=position.charOffset;
  if(!integer(offset)||position.isTextBox||(position.cellPath?.length??0)>8)return;
  const parent=position.parentParaIndex;
  if(parent===undefined){
   const paragraph=position.paragraphIndex;if(position.cellPath?.length||!bodyAddress(section,paragraph))return;
   const length=wasm.getParagraphLength(section,paragraph);if(offset>length)return;
   const caret=bookmark(section,paragraph,offset,length,(start,count)=>wasm.getTextRange(section,paragraph,start,count));
   return caret?{kind:'body',caret}:undefined;
  }
  const path=position.cellPath,first=path?.[0],last=path?.at(-1),control=first?.controlIndex??position.controlIndex,cell=first?.cellIndex??position.cellIndex,paragraph=last?.cellParaIndex??position.cellParaIndex;
  if(!integer(control)||!integer(cell)||!integer(paragraph))return;
  if(path&&!path.every(entry=>entry&&integer(entry.controlIndex)&&integer(entry.cellIndex)&&integer(entry.cellParaIndex)))return;
  const info=cellTable(section,parent,control,path);if(!info)return;
  const nested=Boolean(path&&path.length>1),json=JSON.stringify(path);
  if(nested){
   const dims=wasm.getTableDimensionsByPath!(section,parent,json);
   if(last!.cellIndex>=dims.cellCount||paragraph>=wasm.getCellParagraphCountByPath!(section,parent,json))return;
  }else if(cell>=wasm.getTableDimensions(section,parent,control).cellCount||paragraph>=wasm.getCellParagraphCount(section,parent,control,cell))return;
  const length=nested?wasm.getCellParagraphLengthByPath!(section,parent,json):wasm.getCellParagraphLength(section,parent,control,cell,paragraph);if(offset>length)return;
  const caret=bookmark(section,paragraph,offset,length,(start,count)=>nested?wasm.getTextInCellByPath!(section,parent,json,start,count):wasm.getTextInCell(section,parent,control,cell,paragraph,start,count));
  return caret?{kind:'cell',caret,parentParagraph:parent,control,cell,tableFingerprint:info.fingerprint,...(nested?{cellPath:path!.map(entry=>({...entry}))}:{})}:undefined;
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
 function picture(section:number,parent:number,control:number){
  if(!bodyAddress(section,parent)||!integer(control)||!wasm.getPictureProperties||!wasm.getControlImageData||!wasm.getControlImageMime)return;
  const props=wasm.getPictureProperties(section,parent,control);
  const bytes=wasm.getControlImageData(section,parent,control),mime=wasm.getControlImageMime(section,parent,control);
  // Missing/link pictures and unbounded data are deliberately not persisted.
  if(!(bytes instanceof Uint8Array)||bytes.length===0||bytes.length>8*1024*1024||!mime.startsWith('image/'))return;
  const serialized=JSON.stringify(props);if(!serialized||serialized.length>16384||!props||typeof props!=='object'||Array.isArray(props))return;
  return hash([props,mime,Array.from(sha256(bytes),value=>value.toString(16).padStart(2,'0')).join('')]);
 }
 function storyCaret(section:number,texts:string[],paragraph:number,offset:number){
  if(!integer(paragraph)||!integer(offset)||paragraph>=texts.length)return;
  const characters=[...texts[paragraph]];if(offset>characters.length)return;
  return bookmark(section,paragraph,offset,characters.length,(start,count)=>characters.slice(start,start+count).join(''));
 }
 function headerFooter(section:number,isHeader:boolean,applyTo:number){
  if(!integer(section)||section>=wasm.getSectionCount()||![0,1,2].includes(applyTo)||!wasm.getHeaderFooter||!wasm.getHeaderFooterParaInfo)return;
  const definition=JSON.parse(wasm.getHeaderFooter(section,isHeader,applyTo));
  if(!definition.ok||!definition.exists||definition.applyTo!==applyTo||!integer(definition.paraCount)||definition.paraCount<1||definition.paraCount>1024)return;
  const texts:string[]=[];let characters=0;
  for(let p=0;p<definition.paraCount;p++){
   const info=JSON.parse(wasm.getHeaderFooterParaInfo(section,isHeader,applyTo,p));
   if(!info.ok||info.paraCount!==definition.paraCount||typeof info.text!=='string'||info.charCount!==[...info.text].length||(characters+=info.charCount)>100000)return;
   texts.push(info.text);
  }
  return {fingerprint:hash([definition,texts]),caret:(p:number,o:number)=>storyCaret(section,texts,p,o)};
 }
 function footnote(section:number,parent:number,control:number,page:number,index:number){
  if(!bodyAddress(section,parent)||!integer(control)||!integer(page)||!integer(index)||!wasm.getFootnoteInfo||!wasm.getPageFootnoteInfo)return;
  const location=wasm.getPageFootnoteInfo(page,index),info=wasm.getFootnoteInfo(section,parent,control);
  if(!location?.ok||location.sectionIdx!==section||location.paraIdx!==parent||location.controlIdx!==control||!info.ok||!Array.isArray(info.texts)
    ||!integer(info.paraCount)||info.paraCount<1||info.paraCount>1024||info.texts.length!==info.paraCount||!info.texts.every(text=>typeof text==='string')
    ||info.texts.reduce((sum,text)=>sum+[...text].length,0)>100000)return;
  return {sourceType:location.sourceType,fingerprint:hash([location.sourceType,info]),caret:(p:number,o:number)=>storyCaret(section,info.texts,p,o)};
 }
 return {point,table,cellTable,selection,picture,headerFooter,footnote};
}
function bookmark(section:number,paragraph:number,offset:number,paragraphLength:number,read:(start:number,count:number)=>string):BodyCaret|undefined{
 return validateBodyCaret({section,paragraph,offset,paragraphLength,before:read(Math.max(0,offset-32),Math.min(offset,32)),after:read(offset,Math.min(paragraphLength-offset,32))});
}
function position(point:SessionPoint):Position{
 const c=point.caret;
 return point.kind==='body'?{sectionIndex:c.section,paragraphIndex:c.paragraph,charOffset:c.offset}
  :{sectionIndex:c.section,paragraphIndex:c.paragraph,charOffset:c.offset,parentParaIndex:point.parentParagraph,controlIndex:point.control,cellIndex:point.cell,cellParaIndex:c.paragraph,cellPath:point.cellPath?.map(entry=>({...entry}))??[{controlIndex:point.control,cellIndex:point.cell,cellParaIndex:c.paragraph}]};
}
export function captureSessionCursor(input:SessionCursorInput|undefined):SessionCursor|undefined{
 if(input?.cursor.isInTextBox())return captureTextBoxCursor(input);
 if(input&&!input.wasm.requiresPasswordForSave&&!input.cursor.isInTextBox()&&!input.cursor.isInTableObjectSelection()&&!input.cursor.isInPictureObjectSelection()
   &&(input.cursor.isInHeaderFooter()||input.cursor.isInFootnote())){
  try{
   const c=input.cursor,read=evidence(input),focus=read.point(input.getCursorPosition());if(focus?.kind!=='body')return;
   if(c.isInHeaderFooter()&&input.restoreSessionHeaderFooter){
    if(!integer(c.hfSectionIdx)||!integer(c.hfApplyTo)||!integer(c.hfParaIdx)||!integer(c.hfCharOffset)||!['header','footer'].includes(c.headerFooterMode??''))return;
    const isHeader=c.headerFooterMode==='header',story=read.headerFooter(c.hfSectionIdx,isHeader,c.hfApplyTo);if(!story)return;
    const caret=story.caret(c.hfParaIdx,c.hfCharOffset);if(!caret)return;
    const range=c.getHeaderFooterSelectionOrdered?.();let anchor:BodyCaret|undefined;
    if(range){
     if(![range.start,range.end].every(p=>p.sectionIdx===c.hfSectionIdx&&p.isHeader===isHeader&&p.applyTo===c.hfApplyTo))return;
     const endpoint=range.start.paraIdx===c.hfParaIdx&&range.start.charOffset===c.hfCharOffset?range.end:range.start;
     if(!(range.start.paraIdx===c.hfParaIdx&&range.start.charOffset===c.hfCharOffset)&&!(range.end.paraIdx===c.hfParaIdx&&range.end.charOffset===c.hfCharOffset))return;
     anchor=story.caret(endpoint.paraIdx,endpoint.charOffset);if(!anchor)return;
    }else if(c.hasSelection())return;
    return validateSessionCursor({kind:'header-footer',focus,caret,...(anchor?{anchor}:{}),isHeader,applyTo:c.hfApplyTo,storyFingerprint:story.fingerprint});
   }
   if(c.isInFootnote()&&input.restoreSessionFootnote){
    if(![c.fnSectionIdx,c.fnParaIdx,c.fnControlIdx,c.fnInnerParaIdx,c.fnCharOffset,c.fnPageNum,c.fnFootnoteIndex].every(integer))return;
    const story=read.footnote(c.fnSectionIdx!,c.fnParaIdx!,c.fnControlIdx!,c.fnPageNum!,c.fnFootnoteIndex!);if(!story)return;
    const caret=story.caret(c.fnInnerParaIdx!,c.fnCharOffset!);if(!caret)return;
    const range=c.getFootnoteSelection?.();let anchor:BodyCaret|undefined;
    if(range){
     if(range.pageNum!==c.fnPageNum||range.footnoteIndex!==c.fnFootnoteIndex||range.focus.fnParaIdx!==c.fnInnerParaIdx||range.focus.charOffset!==c.fnCharOffset)return;
     anchor=story.caret(range.anchor.fnParaIdx,range.anchor.charOffset);if(!anchor)return;
    }else if(c.hasSelection())return;
    return validateSessionCursor({kind:'footnote',focus,caret,...(anchor?{anchor}:{}),parentParagraph:c.fnParaIdx,control:c.fnControlIdx,page:c.fnPageNum,index:c.fnFootnoteIndex,sourceType:story.sourceType,storyFingerprint:story.fingerprint});
   }
  }catch{return;}
  return;
 }
 if(input?.cursor.isInPictureObjectSelection()&&input.restoreSessionPictureObject&&!input.wasm.requiresPasswordForSave
   &&!input.cursor.isInHeaderFooter()&&!input.cursor.isInFootnote()&&!input.cursor.isInTextBox()&&!input.cursor.isMultiPictureSelection?.()){
  try{
   const ref=input.cursor.getSelectedPictureRef?.();if(!ref||ref.type!=='image'||ref.cellIdx!==undefined||ref.cellPath?.length||ref.headerFooter||ref.noteRef||ref.missing)return;
   const read=evidence(input),focus=read.point({sectionIndex:ref.sec,paragraphIndex:ref.ppi,charOffset:0}),pictureFingerprint=read.picture(ref.sec,ref.ppi,ref.ci);
   return focus?.kind==='body'&&pictureFingerprint?validateSessionCursor({kind:'picture-object',focus,control:ref.ci,pictureFingerprint}):undefined;
  }catch{return;}
 }
 if(input?.cursor.isInTableObjectSelection()&&input.restoreSessionTableObject&&!input.wasm.requiresPasswordForSave
   &&!input.cursor.isInHeaderFooter()&&!input.cursor.isInFootnote()&&!input.cursor.isInTextBox()){
  try{
   const ref=input.cursor.getSelectedTableRef?.();if(!ref||ref.cellPath?.length)return;
   const read=evidence(input),focus=read.point({sectionIndex:ref.sec,paragraphIndex:ref.ppi,charOffset:0}),table=read.table(ref.sec,ref.ppi,ref.ci);
   return focus?.kind==='body'&&table?validateSessionCursor({kind:'table-object',focus,control:ref.ci,tableFingerprint:table.fingerprint}):undefined;
  }catch{return;}
 }
 if(!input||unsupported(input))return;
 try{
  const read=evidence(input),focus=read.point(input.getCursorPosition());if(!focus)return;
  const block=input.cursor.captureCellSelection();
  if(block){
   if(focus.kind!=='cell'||block.sec!==focus.caret.section||block.ppi!==focus.parentParagraph||block.ci!==focus.control)return;
   if(focus.cellPath){
    const tableAddress=(path:Position['cellPath'])=>path?.map((entry,index)=>index===path.length-1?{...entry,cellIndex:0,cellParaIndex:0}:entry);
    if(JSON.stringify(tableAddress(block.cellPath))!==JSON.stringify(tableAddress(focus.cellPath)))return;
   }else if((block.cellPath?.length??0)>1)return;
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
 const saved=validateSessionCursor(value);if(!input||!saved)return false;
 if(saved.kind==='textbox')return restoreTextBoxCursor(input,saved);
 if(saved.kind==='header-footer'||saved.kind==='footnote'){
  if(input.wasm.requiresPasswordForSave||input.cursor.isInTextBox()||input.cursor.isInTableObjectSelection()||input.cursor.isInPictureObjectSelection())return false;
  try{
   const read=evidence(input),focus=read.point(position(saved.focus));if(JSON.stringify(focus)!==JSON.stringify(saved.focus))return false;
   const story=saved.kind==='header-footer'?read.headerFooter(saved.caret.section,saved.isHeader,saved.applyTo):read.footnote(saved.caret.section,saved.parentParagraph,saved.control,saved.page,saved.index);
   if(!story||story.fingerprint!==saved.storyFingerprint||JSON.stringify(story.caret(saved.caret.paragraph,saved.caret.offset))!==JSON.stringify(saved.caret)
     ||(saved.anchor&&JSON.stringify(story.caret(saved.anchor.paragraph,saved.anchor.offset))!==JSON.stringify(saved.anchor)))return false;
   if(saved.kind==='header-footer')return input.restoreSessionHeaderFooter?.(saved)??false;
   if(!('sourceType' in story)||story.sourceType!==saved.sourceType)return false;
   return input.restoreSessionFootnote?.(saved)??false;
  }catch{return false;}
 }
 if(saved.kind==='picture-object'){
  if(!input.restoreSessionPictureObject||input.wasm.requiresPasswordForSave||input.cursor.isInHeaderFooter()||input.cursor.isInFootnote()||input.cursor.isInTextBox()||input.cursor.isInTableObjectSelection())return false;
  try{
   const read=evidence(input),focus=read.point(position(saved.focus));
   if(JSON.stringify(focus)!==JSON.stringify(saved.focus)||read.picture(saved.focus.caret.section,saved.focus.caret.paragraph,saved.control)!==saved.pictureFingerprint)return false;
   return input.restoreSessionPictureObject({sec:saved.focus.caret.section,ppi:saved.focus.caret.paragraph,ci:saved.control,type:'image'});
  }catch{return false;}
 }
 if(saved.kind==='table-object'){
  if(!input.restoreSessionTableObject||input.wasm.requiresPasswordForSave||input.cursor.isInHeaderFooter()||input.cursor.isInFootnote()||input.cursor.isInTextBox()||input.cursor.isInPictureObjectSelection())return false;
  try{
   const read=evidence(input),focus=read.point(position(saved.focus)),table=read.table(saved.focus.caret.section,saved.focus.caret.paragraph,saved.control);
   if(JSON.stringify(focus)!==JSON.stringify(saved.focus)||table?.fingerprint!==saved.tableFingerprint)return false;
   return input.restoreSessionTableObject({sec:saved.focus.caret.section,ppi:saved.focus.caret.paragraph,ci:saved.control});
  }catch{return false;}
 }
 if(unsupported(input))return false;
 try{
  const read=evidence(input),focus=read.point(position(saved.focus));
  if(JSON.stringify(focus)!==JSON.stringify(saved.focus))return false;
  if(saved.kind==='text'){
   const anchor=saved.anchor?read.point(position(saved.anchor)):undefined;
   if(saved.anchor&&(JSON.stringify(anchor)!==JSON.stringify(saved.anchor)||!anchor||read.selection(anchor,focus!)!==saved.selectionFingerprint))return false;
   return input.restoreSessionSelection(position(saved.focus),saved.anchor?position(saved.anchor):undefined,saved.blockPhase,undefined);
  }
  const info=read.cellTable(saved.focus.caret.section,saved.focus.parentParagraph,saved.focus.control,saved.focus.cellPath);if(!info)return false;
  if(![saved.block.anchor,saved.block.focus,...saved.block.excluded.map(key=>{const [row,col]=key.split(',').map(Number);return {row,col};})].every(p=>p.row<info.rows&&p.col<info.columns))return false;
  return input.restoreSessionSelection(position(saved.focus),undefined,null,{...saved.block,sec:saved.focus.caret.section,ppi:saved.focus.parentParagraph,ci:saved.focus.control,...(saved.focus.cellPath?{cellPath:saved.focus.cellPath.map(entry=>({...entry}))}:{})});
 }catch{return false;}
}
