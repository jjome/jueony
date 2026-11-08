import type {NestedTable,Structure} from '../../modules/document/public/types.ts';
import {capturePreservationEvidence} from './preservation.ts';
import {resourceFingerprint} from './cell-paragraph.ts';
import {readNestedAxisCaptions} from './nested-axis-captions.ts';
import {parsed} from './structure.ts';

type PathStep={controlIndex:number;cellIndex:number;cellParaIndex:number};
type EditableSource={editable:true;target:string;revision:string;section:number;paragraph:number;path:PathStep[];
  originalText:string;caption:Record<string,unknown>;stored:Array<{id:string;value:unknown}>};
export type NestedCaptionTextSource=EditableSource|{editable:false;target:string;reason:string};
export type NestedCaptionTextEdit={target:string;revision:string;path:PathStep[];originalText:string;text:string};

const fail=()=>Error('중첩 표 캡션의 경로·원문·revision 또는 단일 글자 서식을 확인하지 못했습니다.');
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
const validText=(text:unknown):text is string=>typeof text==='string'&&Array.from(text).length>0&&
  Array.from(text).length<=4000&&!Array.from(text).some(c=>{const n=c.codePointAt(0)!;return n<32||n===127;});
const captionPath=(table:NestedTable):PathStep[]=>[...table.ancestors,
  {controlIndex:table.control,cellIndex:65534,cellParaIndex:0}];

function source(doc:any,structure:Structure,table:NestedTable,revision:string):EditableSource{
  if(!revision||table.ancestors.length<1)throw fail();
  const captions=readNestedAxisCaptions(doc,structure,table),entry=captions.stored.find(c=>c.id===table.id),value:any=entry?.value;
  if(value?.kind!=='plain'||!validText(value.text)||!Array.isArray(value.runs)||value.runs.length!==1||
      value.runs[0]?.start_pos!==0||!captions.drawing||!captions.portableDrawing)throw fail();
  const path=captionPath(table),encoded=JSON.stringify(path),length=doc.getCellParagraphLengthByPath(table.section,table.paragraph,encoded);
  if(length!==Array.from(value.text).length||doc.getTextInCellByPath(table.section,table.paragraph,encoded,0,length)!==value.text)throw fail();
  return {editable:true,target:table.id,revision,section:table.section,paragraph:table.paragraph,path,
    originalText:value.text,caption:structuredClone(value),stored:structuredClone(captions.stored)};
}

export function readNestedCaptionTextSources(doc:any,structure:Structure,revision:string):Record<string,NestedCaptionTextSource>{
  return Object.fromEntries((structure.nestedTables??[]).map(table=>{try{return [table.id,source(doc,structure,table,revision)];}
    catch{return [table.id,{editable:false,target:table.id,reason:'비어 있지 않은 한 문단·단일 글자 서식의 위/아래 중첩 표 캡션만 직접 바꿀 수 있습니다.'}];}}));
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
  return stored.map(entry=>{if(entry.id!==target)return entry;const value:any=structuredClone(entry.value);
    delete value.text;delete value.lines;return {...entry,value};});
}

/** Runs inside the caller's one undoable snapshot. This local token only makes
 * direct adapter use fail-closed when any postcondition cannot be proven. */
export function replaceNestedCaptionText(doc:any,structure:Structure,expected:NestedCaptionTextSource,edit:NestedCaptionTextEdit){
  if(!expected.editable||Object.keys(edit).some(k=>!['target','revision','path','originalText','text'].includes(k))||
      edit.target!==expected.target||edit.revision!==expected.revision||edit.originalText!==expected.originalText||
      !same(edit.path,expected.path)||!validText(edit.text))throw fail();
  const current=readNestedCaptionTextSources(doc,structure,edit.revision)[edit.target];
  if(!current?.editable||!same(current,expected))throw fail();
  const cursor={sectionIndex:current.section,parentParaIndex:current.paragraph,paragraphIndex:current.paragraph,
    controlIndex:current.path[0].controlIndex,cellIndex:current.path[0].cellIndex,
    cellParaIndex:current.path[0].cellParaIndex,cellPath:structuredClone(current.path),charOffset:Array.from(edit.text).length};
  if(edit.text===edit.originalText)return cursor;
  const before=preservation(doc),token=doc.saveSnapshot(),encoded=JSON.stringify(current.path);
  try{
    const length=Array.from(edit.originalText).length;
    checked(doc.deleteTextInCellByPath(current.section,current.paragraph,encoded,0,length));
    checked(doc.insertTextInCellByPath(current.section,current.paragraph,encoded,0,edit.text));
    const afterSource=readNestedCaptionTextSources(doc,structure,edit.revision)[edit.target],after=preservation(doc);
    const checks={source:Boolean(afterSource?.editable),text:afterSource?.editable&&afterSource.originalText===edit.text,
      path:afterSource?.editable&&same(afterSource.path,current.path),stored:afterSource?.editable&&
        same(normalizedStored(current.stored,current.target),normalizedStored(afterSource.stored,current.target)),
      documentText:before.text===after.text||singleReplacement(before.text,after.text,edit.originalText,edit.text),rest:same(before.rest,after.rest),
      resources:before.resources===after.resources};
    const failed=Object.entries(checks).find(([,ok])=>!ok)?.[0];if(failed)throw Error(fail().message+' ('+failed+')');
    return cursor;
  }catch(error){checked(doc.restoreSnapshot(token));throw error;}
  finally{doc.discardSnapshot(token);}
}
