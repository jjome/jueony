import {sha256} from '@noble/hashes/sha2.js';
import {validateBodyCaret} from '../../modules/preferences/public/index.ts';
import type {BodyCaret} from '../../modules/preferences/public/index.ts';
import {validateTextBoxBookmark} from '../../modules/preferences/public/index.ts';
import type {TextBoxBookmark} from '../../modules/preferences/public/index.ts';
type Position={sectionIndex:number;paragraphIndex:number;charOffset:number;parentParaIndex?:number;controlIndex?:number;cellIndex?:number;cellParaIndex?:number;cellPath?:{controlIndex:number;cellIndex:number;cellParaIndex:number}[];isTextBox?:boolean};
export type TextBoxSessionInput={getCursorPosition():Position;restoreSessionTextBox?(saved:TextBoxBookmark):boolean;cursor:{isInTextBox():boolean;isInHeaderFooter():boolean;isInFootnote():boolean;isInTableObjectSelection():boolean;isInPictureObjectSelection():boolean;hasSelection():boolean;getSelection():{anchor:Position;focus:Position}|null;};wasm:{requiresPasswordForSave?:boolean;borrowDocumentHandle?():any;}};
const integer=(v:unknown):v is number=>Number.isSafeInteger(v)&&(v as number)>=0&&(v as number)<=2147483647;
const instanceId=(v:unknown):v is number=>Number.isSafeInteger(v)&&(v as number)>0&&(v as number)<=4294967295;
const json=(v:any):any=>typeof v==='string'?JSON.parse(v):v;
function normalized(v:any):any{if(Array.isArray(v))return v.map(normalized);if(v&&typeof v==='object')return Object.fromEntries(Object.keys(v).sort().filter(k=>!['charShapeId','paraShapeId','borderFillId'].includes(k)&&!(v.fillType==='none'&&['fillColor','patternColor','patternType'].includes(k))).map(k=>[k,normalized(v[k])]));return v;}
const hash=(v:any)=>Array.from(sha256(new TextEncoder().encode(JSON.stringify(normalized(v)))),n=>n.toString(16).padStart(2,'0')).join('');
const same=(a:any,b:any)=>JSON.stringify(normalized(a))===JSON.stringify(normalized(b));
function bookmark(section:number,paragraph:number,offset:number,text:string):BodyCaret|undefined{const chars=[...text];return validateBodyCaret({section,paragraph,offset,paragraphLength:chars.length,before:chars.slice(Math.max(0,offset-32),offset).join(''),after:chars.slice(offset,offset+32).join('')});}
function story(input:TextBoxSessionInput,section:number,parent:number,control:number){
 if(input.wasm.requiresPasswordForSave||![section,parent,control].every(integer))return;
 const d=input.wasm.borrowDocumentHandle?.()??input.wasm;
 if(section>=d.getSectionCount()||parent>=d.getParagraphCount(section))return;
 const flat=parent+Array.from({length:section},(_,s)=>d.getParagraphCount(s)).reduce((a:number,b:number)=>a+b,0),controls=json(d.getControls()),lists=json(d.getCursorModel()).lists;
 const hostControl=controls.find((c:any)=>c.list===0&&c.para===flat&&c.controlIndex===control),p=json(d.getShapeProperties(section,parent,control)),owned=lists.filter((l:any)=>l.hostListId===0&&l.sectionIndex===section&&l.hostPara===parent&&l.controlIndex===control);
 // roundRate is emitted only for a Rectangle, never a grouped child. A caption
 // opens a second non-cell list; a nested object is visible in this story list.
 if(hostControl?.ctrlId!=='gso'||hostControl.props?.Lock!==0||!Object.hasOwn(p,'roundRate')||!Number.isFinite(p.roundRate)||p.sizeProtect!==false||p.tbVerticalAlignKnown!==true||p.hasCaption!==false||p.rotationAngle!==0||p.horzFlip!==false||p.vertFlip!==false||!['none','solid'].includes(p.fillType)||!['tbMarginLeft','tbMarginRight','tbMarginTop','tbMarginBottom'].every(k=>integer(p[k]))||!instanceId(p.instanceId)||!instanceId(p.scInstId)||!['Top','Center','Bottom'].includes(p.tbVerticalAlign)||owned.length!==1||owned[0].isCell!==false||owned[0].cellIndex!==0||!integer(owned[0].paraCount)||owned[0].paraCount<1||owned[0].paraCount>1024||controls.some((c:any)=>c.list===owned[0].listId)||lists.some((l:any)=>l.hostListId===owned[0].listId))return;
 const texts:string[]=[],paragraphs:any[]=[];let size=0,runsCount=0;
 if(d.getCellParagraphCount(section,parent,control,0)!==owned[0].paraCount)return;
 for(let paragraph=0;paragraph<owned[0].paraCount;paragraph++){
  const path=JSON.stringify([{controlIndex:control,cellIndex:0,cellParaIndex:paragraph}]),length=d.getCellParagraphLengthByPath(section,parent,path);if(!integer(length)||(size+=length)>100000)return;
  const text=d.getTextInCellByPath(section,parent,path,0,length);if(typeof text!=='string'||[...text].length!==length)return;
  const runs=json(d.getCharShapeRunsInCellByPath(section,parent,path,0,length));if(!Array.isArray(runs)||(runsCount+=runs.length)>4096||runs.some((r:any)=>!integer(r.startOffset)||!integer(r.endOffset)||r.startOffset>r.endOffset||r.endOffset>length))return;
  texts.push(text);paragraphs.push({paragraph:json(d.getCellParaPropertiesAt(section,parent,control,0,paragraph)),runs:runs.map((r:any)=>({start:r.startOffset,end:r.endOffset,characters:json(d.getCellCharPropertiesAtByPath(section,parent,path,r.startOffset))})),...(length===0?{emptyCharacters:json(d.getCellCharPropertiesAtByPath(section,parent,path,0))}:{})});
 }
 const hostLength=d.getParagraphLength(section,parent),hostText=d.getTextRange(section,parent,0,hostLength);if(!integer(hostLength)||hostLength>100000||typeof hostText!=='string'||[...hostText].length!==hostLength)return;
 function point(paragraph:number,offset:number){if(!integer(paragraph)||paragraph>=texts.length||!integer(offset)||offset>[...texts[paragraph]].length)return;const path=JSON.stringify([{controlIndex:control,cellIndex:0,cellParaIndex:paragraph}]),rect=json(d.getCursorRectByPath(section,parent,path,offset));if(!rect||!integer(rect.pageIndex)||!['x','y','height'].every(k=>Number.isFinite(rect[k]))||rect.height<=0)return;return bookmark(section,paragraph,offset,texts[paragraph]);}
 return {focus:{kind:'body' as const,caret:bookmark(section,parent,0,hostText)!},fingerprint:hash({section,parent,control,shape:p,hostControl:{ctrlId:hostControl.ctrlId,Lock:hostControl.props.Lock},hostText,texts,paragraphs}),point};
}
function address(p:Position):{section:number;parent:number;control:number;paragraph:number;offset:number}|undefined{
 const path=p.cellPath;if(p.isTextBox!==true||!integer(p.sectionIndex)||!integer(p.parentParaIndex)||!integer(p.controlIndex)||p.cellIndex!==0||!integer(p.cellParaIndex)||p.paragraphIndex!==p.cellParaIndex||!integer(p.charOffset)||path&&(path.length!==1||path[0].controlIndex!==p.controlIndex||path[0].cellIndex!==0||path[0].cellParaIndex!==p.cellParaIndex))return;
 return {section:p.sectionIndex,parent:p.parentParaIndex,control:p.controlIndex,paragraph:p.cellParaIndex,offset:p.charOffset};
}
export function captureTextBoxCursor(input:TextBoxSessionInput|undefined):TextBoxBookmark|undefined{
 if(!input||!input.restoreSessionTextBox||!input.cursor.isInTextBox()||input.cursor.isInHeaderFooter()||input.cursor.isInFootnote()||input.cursor.isInTableObjectSelection()||input.cursor.isInPictureObjectSelection())return;
 try{const at=address(input.getCursorPosition());if(!at)return;const s=story(input,at.section,at.parent,at.control),caret=s?.point(at.paragraph,at.offset);if(!s||!caret)return;
  const range=input.cursor.getSelection();let anchor:BodyCaret|undefined;
  if(range){const start=address(range.anchor),end=address(range.focus);if(!start||!end||!same(end,at)||!['section','parent','control'].every(k=>(start as any)[k]===(at as any)[k]))return;anchor=s.point(start.paragraph,start.offset);if(!anchor)return;}else if(input.cursor.hasSelection())return;
  return validateTextBoxBookmark({kind:'textbox',focus:s.focus,control:at.control,caret,...(anchor?{anchor}:{}),storyFingerprint:s.fingerprint});
 }catch{return;}
}
export function restoreTextBoxCursor(input:TextBoxSessionInput|undefined,value:unknown):boolean{
 const saved=validateTextBoxBookmark(value);if(!input||!saved||!input.restoreSessionTextBox||input.cursor.isInHeaderFooter()||input.cursor.isInFootnote()||input.cursor.isInTableObjectSelection()||input.cursor.isInPictureObjectSelection())return false;
 try{const s=story(input,saved.caret.section,saved.focus.caret.paragraph,saved.control);if(!s||s.fingerprint!==saved.storyFingerprint||!same(s.focus,saved.focus)||!same(s.point(saved.caret.paragraph,saved.caret.offset),saved.caret)||saved.anchor&&!same(s.point(saved.anchor.paragraph,saved.anchor.offset),saved.anchor))return false;return input.restoreSessionTextBox(saved);}catch{return false;}
}
