import type {NestedTable,Structure} from '../../modules/document/public/types.ts';
import {capturePreservationEvidence} from './preservation.ts';
import {resourceFingerprint} from './cell-paragraph.ts';
import {readNestedAxisCaptions} from './nested-axis-captions.ts';
import {parsed} from './structure.ts';

type PathStep={controlIndex:number;cellIndex:number;cellParaIndex:number};
type CharacterRun={startOffset:number;endOffset:number;charShapeId:number};
type ParagraphSource={paragraph:number;path:PathStep[];originalText:string;paragraphShape:number;style:number;charShape:number;runs:CharacterRun[]};
type EditableSource={editable:true;target:string;revision:string;section:number;paragraph:number;path:PathStep[];
  paragraphs:ParagraphSource[];caption:Record<string,unknown>;stored:Array<{id:string;value:unknown}>;placement:unknown};
export type NestedCaptionTextSource=EditableSource|{editable:false;target:string;reason:string};
export type NestedCaptionTextEdit={target:string;revision:string;paragraph:number;path:PathStep[];originalText:string;text:string};

const fail=()=>Error('중첩 표 캡션의 경로·원문·revision 또는 단일 글자 서식을 확인하지 못했습니다.');
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
const safeText=(text:unknown):text is string=>typeof text==='string'&&Array.from(text).length<=4000&&
  !Array.from(text).some(c=>{const n=c.codePointAt(0)!;return n<32||n===127;});
const validText=(text:unknown):text is string=>safeText(text)&&Array.from(text).length>0;
const captionPath=(table:NestedTable,paragraph:number):PathStep[]=>[...table.ancestors,
  {controlIndex:table.control,cellIndex:65534,cellParaIndex:paragraph}];
function placementEvidence(captions:ReturnType<typeof readNestedAxisCaptions>){
  const select=(drawing:any)=>{
    if(!Number.isSafeInteger(drawing?.page)||!Array.isArray(drawing.positions)||drawing.positions.length<2||
        drawing.positions.slice(0,2).some((value:any)=>!Number.isFinite(value))||!Array.isArray(drawing.siblings))throw fail();
    return {page:drawing.page,anchor:drawing.positions.slice(0,2),siblings:structuredClone(drawing.siblings)};
  };
  return {live:select(captions.drawing),portable:select(captions.portableDrawing)};
}

function source(doc:any,structure:Structure,table:NestedTable,revision:string):EditableSource{
  if(!revision||table.ancestors.length<1)throw fail();
  const captions=readNestedAxisCaptions(doc,structure,table),entry=captions.stored.find(c=>c.id===table.id),value:any=entry?.value;
  const values=value?.kind==='plain'?[value]:value?.kind==='paragraphs'?value.paragraphs:undefined;
  if(!['Top','Bottom'].includes(value?.direction)||!Array.isArray(values)||!values.length||values.length>32||
      !captions.drawing||!captions.portableDrawing)throw fail();
  const paragraphs:ParagraphSource[]=values.map((paragraph:any,index:number)=>{
    const existingSingleBlank=values.length===1&&paragraph?.text==='';
    if((!validText(paragraph?.text)&&!existingSingleBlank)||!safeText(paragraph?.text)||
        !Array.isArray(paragraph.runs)||!paragraph.runs.length||paragraph.runs.length>128||
        paragraph.runs[0]?.start_pos!==0||!Number.isSafeInteger(paragraph.paragraphShape)||
        !Number.isSafeInteger(paragraph.style)||paragraph.runs.some((run:any,i:number)=>
          !Number.isSafeInteger(run?.start_pos)||run.start_pos<0||!Number.isSafeInteger(run?.char_shape_id)||run.char_shape_id<0||
          (i>0&&paragraph.runs[i-1].start_pos>=run.start_pos))||
        (paragraph.runs.length>1&&(paragraph.text===''||paragraph.text.length!==Array.from(paragraph.text).length)))throw fail();
    const path=captionPath(table,index),encoded=JSON.stringify(path),length=doc.getCellParagraphLengthByPath(table.section,table.paragraph,encoded);
    if(length!==Array.from(paragraph.text).length||doc.getTextInCellByPath(table.section,table.paragraph,encoded,0,length)!==paragraph.text)throw fail();
    const runs:CharacterRun[]=paragraph.runs.map((run:any,i:number)=>({startOffset:run.start_pos,
      endOffset:i+1<paragraph.runs.length?paragraph.runs[i+1].start_pos:length,charShapeId:run.char_shape_id}));
    if((length===0?(runs.length!==1||runs[0].startOffset!==0||runs[0].endOffset!==0):
        runs.some(run=>run.startOffset>=run.endOffset)||
        !same(parsed(doc.getCharShapeRunsInCellByPath(table.section,table.paragraph,encoded,0,length)),runs)))throw fail();
    return {paragraph:index,path,originalText:paragraph.text,paragraphShape:paragraph.paragraphShape,
      style:paragraph.style,charShape:paragraph.runs[0].char_shape_id,runs};
  });
  return {editable:true,target:table.id,revision,section:table.section,paragraph:table.paragraph,
    path:paragraphs[0].path.slice(0,-1),paragraphs,caption:structuredClone(value),stored:structuredClone(captions.stored),
    placement:placementEvidence(captions)};
}

export function readNestedCaptionTextSources(doc:any,structure:Structure,revision:string):Record<string,NestedCaptionTextSource>{
  return Object.fromEntries((structure.nestedTables??[]).map(table=>{try{return [table.id,source(doc,structure,table,revision)];}
    catch{return [table.id,{editable:false,target:table.id,reason:'검증된 위/아래 중첩 표 캡션만 직접 바꿀 수 있습니다. 빈 캡션은 기존 단일 빈 문단만 채울 수 있습니다.'}];}}));
}

function checked(value:unknown){if(parsed(value)?.ok!==true)throw fail();}
function preservation(doc:any){
  const captured=capturePreservationEvidence(doc);if(captured.issues.length)throw fail();
  const {text,...rest}=captured.values;
  if(typeof text!=='string')throw fail();
  return {text,rest,resources:resourceFingerprint(doc.exportHwpx())};
}
function singleReplacement(before:string,after:string,original:string,replacement:string){
  if(after.length!==before.length-original.length+replacement.length)return false;
  for(let i=0;i<=before.length-original.length;i++)if(before.startsWith(original,i)&&
      after===before.slice(0,i)+replacement+before.slice(i+original.length))return true;
  return false;
}
function normalizedStored(stored:EditableSource['stored'],target:string){
  return stored.map(entry=>{if(entry.id!==target)return entry;return {...entry,value:structuredClone(entry.value)};});
}
function withoutEditedParagraph(stored:EditableSource['stored'],target:string,paragraph:number){
  const normalized=normalizedStored(stored,target),entry:any=normalized.find(v=>v.id===target),value=entry?.value;
  const item=value?.kind==='plain'?value:value?.kind==='paragraphs'?value.paragraphs?.[paragraph]:undefined;
  if(!item)throw fail();delete item.text;delete item.lines;return normalized;
}

/** Runs inside the caller's one undoable snapshot. This local token only makes
 * direct adapter use fail-closed when any postcondition cannot be proven. */
export function replaceNestedCaptionText(doc:any,structure:Structure,expected:NestedCaptionTextSource,edit:NestedCaptionTextEdit){
  if(!expected.editable||Object.keys(edit).some(k=>!['target','revision','paragraph','path','originalText','text'].includes(k))||
      edit.target!==expected.target||edit.revision!==expected.revision||!Number.isSafeInteger(edit.paragraph)||
      !validText(edit.text))throw fail();
  const selected=expected.paragraphs[edit.paragraph];
  if(!selected||edit.originalText!==selected.originalText||!same(edit.path,selected.path))throw fail();
  const current=readNestedCaptionTextSources(doc,structure,edit.revision)[edit.target];
  if(!current?.editable||!same(current,expected))throw fail();
  const currentParagraph=current.paragraphs[edit.paragraph];if(!currentParagraph)throw fail();
  const cursor={sectionIndex:current.section,parentParaIndex:current.paragraph,paragraphIndex:current.paragraph,
    controlIndex:currentParagraph.path[0].controlIndex,cellIndex:currentParagraph.path[0].cellIndex,
    cellParaIndex:currentParagraph.path[0].cellParaIndex,cellPath:structuredClone(currentParagraph.path),charOffset:Array.from(edit.text).length};
  if(edit.text===edit.originalText)return cursor;
  if(currentParagraph.runs.length>1&&(edit.text.length!==Array.from(edit.text).length||
      Array.from(edit.text).length!==Array.from(edit.originalText).length))throw fail();
  const before=preservation(doc),token=doc.saveSnapshot(),encoded=JSON.stringify(currentParagraph.path);
  try{
    const length=Array.from(edit.originalText).length;
    if(length>0)checked(doc.deleteTextInCellByPath(current.section,current.paragraph,encoded,0,length));
    checked(doc.insertTextInCellByPath(current.section,current.paragraph,encoded,0,edit.text));
    if(currentParagraph.runs.length>1)checked(doc.setCharShapeRunsInCellByPath(current.section,current.paragraph,encoded,
      0,Array.from(edit.text).length,JSON.stringify(currentParagraph.runs)));
    const afterSource=readNestedCaptionTextSources(doc,structure,edit.revision)[edit.target],after=preservation(doc);
    const afterParagraph=afterSource?.editable?afterSource.paragraphs[edit.paragraph]:undefined;
    const checks={source:Boolean(afterSource?.editable),text:afterParagraph?.originalText===edit.text,
      path:Boolean(afterParagraph)&&same(afterParagraph!.path,currentParagraph.path),stored:afterSource?.editable&&
        same(withoutEditedParagraph(current.stored,current.target,edit.paragraph),withoutEditedParagraph(afterSource.stored,current.target,edit.paragraph)),
      placement:afterSource?.editable&&same(current.placement,afterSource.placement),
      documentText:before.text===after.text||singleReplacement(before.text,after.text,edit.originalText,edit.text),rest:same(before.rest,after.rest),
      resources:before.resources===after.resources};
    const failed=Object.entries(checks).find(([,ok])=>!ok)?.[0];if(failed)throw Error(fail().message+' ('+failed+')');
    return cursor;
  }catch(error){checked(doc.restoreSnapshot(token));throw error;}
  finally{doc.discardSnapshot(token);}
}
