import type {ControlOp,Snapshot} from '../../modules/document/public/types.ts';
import {paragraphEdits,validateControlOperations} from '../../modules/document/public/engine-integration.ts';
import {capturePreservationEvidence} from './preservation.ts';
import {resourceFingerprint} from './cell-paragraph.ts';
import {inspectNestedTables} from './nested-tables.ts';
import {parsed} from './structure.ts';

type CellEdit=Extract<ControlOp,{kind:'set_table_cell'}>;
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
function checked(result:unknown) {
  if (parsed(result)?.ok!==true) throw Error('문서 엔진이 중첩 셀 편집을 거절했습니다.');
}

// The engine's linear text stream includes captions and other stories. Its only
// allowed difference is one replacement, in addition to the exact cell-address check.
function singleReplacement(before:string,after:string,original:string,replacement:string) {
  if (after.length!==before.length-original.length+replacement.length) return false;
  let prefix=0,suffix=0;
  while (prefix<Math.min(before.length,after.length) && before[prefix]===after[prefix]) prefix++;
  while (suffix<Math.min(before.length,after.length) && before[before.length-1-suffix]===after[after.length-1-suffix]) suffix++;
  const min=Math.max(0,before.length-original.length-suffix),max=Math.min(prefix,before.length-original.length);
  for (let i=min;i<=max;i++) if (before.startsWith(original,i) && after.startsWith(replacement,i)) return true;
  return false;
}

function evidence(doc:any,listId:number,paragraph:number) {
  const captured=capturePreservationEvidence(doc);
  if (captured.issues.length) throw Error('중첩 셀 편집 전후 보존 상태를 읽지 못했습니다.');
  const {text,...rest}=captured.values;
  const cells=rest.cells as Array<{list:{listId:number};paragraphs:Array<{runs:unknown[]}>}>;
  const target=cells.filter(c=>c.list.listId===listId);
  if (typeof text!=='string' || target.length!==1 || !target[0].paragraphs[paragraph]) throw Error('중첩 셀의 서식 검증 위치가 다릅니다.');
  // Only this paragraph's runs are compared separately, including their raw
  // shape bindings and original resolved properties.
  target[0].paragraphs[paragraph].runs=[];
  return {text,rest,paragraphCount:target[0].paragraphs.length,resources:resourceFingerprint(doc.exportHwpx())};
}

/** Runs inside the regular scratch preflight and the editor's one undoable transaction. */
export function executeNestedCellEdit(doc:any,base:Snapshot,op:CellEdit) {
  validateControlOperations([op],base);
  const inspect=()=>inspectNestedTables(doc,parsed(doc.getControls()),parsed(doc.getCursorModel()).lists);
  const before=inspect(),table=before.tables.find(t=>t.id===op.target);
  const source=base.structure?.nestedTables?.find(t=>t.id===op.target);
  const cell=table?.cells.find(c=>c.row===op.row && c.column===op.column);
  const index=op.paragraph??0,paragraph=cell?.paragraphs?.find(p=>p.index===index);
  if (!table || !source || !same(source,table) || !cell || !paragraph || paragraph.text!==op.originalText ||
      (op.paragraph===undefined&&!cell.editable)) throw Error('중첩 표의 부모 경로·원문·보호 상태가 달라졌습니다. 문서를 다시 조회하세요.');
  const cellPath=[...table.ancestors,{controlIndex:table.control,cellIndex:cell.index,cellParaIndex:index}];
  const root=cellPath[0],cursor={sectionIndex:table.section,paragraphIndex:table.paragraph,parentParaIndex:table.paragraph,
    controlIndex:root.controlIndex,cellIndex:root.cellIndex,cellParaIndex:root.cellParaIndex,cellPath,charOffset:Array.from(op.text).length};
  if (op.text===op.originalText) return cursor;
  const args=[table.section,table.paragraph,JSON.stringify(cellPath)] as const;
  const readShape=(offset:number)=>parsed(doc.getCellCharPropertiesAtByPath(...args,offset));
  const readRuns=(text:string)=>parsed(doc.getCharShapeRunsInCellByPath(...args,0,Array.from(text).length));
  const defaultShape=readShape(0);
  if (!Number.isSafeInteger(defaultShape.charShapeId) || defaultShape.charShapeId<0) throw Error('중첩 셀의 글자 서식이 불명확합니다.');
  const edits=paragraphEdits(op,paragraph);
  const runs:Array<{startOffset:number;endOffset:number;charShapeId:number}>=readRuns(op.originalText);
  if(!runs.length)runs.push({startOffset:0,endOffset:0,charShapeId:defaultShape.charShapeId});
  const expected:Array<{startOffset:number;endOffset:number;charShapeId:number;shape:unknown}>=[];
  for(const [i,run] of runs.entries()){
    const edit=edits.find(e=>e.run===i);
    const count=run.endOffset-run.startOffset+(edit?Array.from(edit.insert).length-edit.remove:0);
    if(!count)continue;
    const previous=expected.at(-1),startOffset=previous?.endOffset??0;
    if(previous&&previous.charShapeId===run.charShapeId)previous.endOffset+=count;
    else expected.push({startOffset,endOffset:startOffset+count,charShapeId:run.charShapeId,shape:readShape(run.startOffset)});
  }
  const listId=before.listIds.get(table.id)![cell.index];
  const original=evidence(doc,listId,index);
  const texts=Array.from({length:original.paragraphCount},(_,p)=>{
    if(p===index)return op.text;
    const path=JSON.stringify([...table.ancestors,{controlIndex:table.control,cellIndex:cell.index,cellParaIndex:p}]);
    const length=doc.getCellParagraphLengthByPath(table.section,table.paragraph,path);
    return doc.getTextInCellByPath(table.section,table.paragraph,path,0,length);
  });
  for(const edit of edits.slice().reverse()){
    if(edit.remove)checked(doc.deleteTextInCellByPath(...args,edit.start,edit.remove));
    if(edit.insert){
      checked(doc.insertTextInCellByPath(...args,edit.start,edit.insert));
      checked(doc.setCharShapeIdInCellByPath(...args,edit.start,edit.start+Array.from(edit.insert).length,runs[edit.run].charShapeId));
    }
  }
  const result=inspect(),updated=evidence(doc,listId,index);
  cell.text=texts.join('\n');paragraph.text=op.text;
  cell.editable=texts.length===1&&expected.length<=1;
  if(expected.length>1)paragraph.formatSpans=expected.map(r=>({start:r.startOffset,end:r.endOffset}));
  else delete paragraph.formatSpans;
  const actualRuns=readRuns(op.text);
  if (!same(before.tables,result.tables) || actualRuns.length!==expected.length ||
    expected.some(({shape,...run},i)=>!same(run,actualRuns[i])||!same(shape,readShape(run.startOffset))) ||
    (!expected.length&&!same(defaultShape,readShape(0))) ||
    !singleReplacement(original.text,updated.text,op.originalText,op.text) || !same(original.rest,updated.rest) || original.resources!==updated.resources)
    throw Error('중첩 셀 편집 후 원문·경로·서식 또는 문서 자원의 보존을 확인하지 못했습니다.');
  return cursor;
}
