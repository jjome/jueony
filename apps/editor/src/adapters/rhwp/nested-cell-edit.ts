import type {ControlOp,Snapshot} from '../../modules/document/public/types.ts';
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

function evidence(doc:any,listId:number) {
  const captured=capturePreservationEvidence(doc);
  if (captured.issues.length) throw Error('중첩 셀 편집 전후 보존 상태를 읽지 못했습니다.');
  const {text,...rest}=captured.values;
  const cells=rest.cells as Array<{list:{listId:number};paragraphs:Array<{runs:unknown[]}>}>;
  const target=cells.filter(c=>c.list.listId===listId);
  if (typeof text!=='string' || target.length!==1 || target[0].paragraphs.length!==1) throw Error('중첩 셀의 서식 검증 위치가 다릅니다.');
  // Its run length changes; the full character properties are compared separately.
  target[0].paragraphs[0].runs=[];
  return {text,rest,resources:resourceFingerprint(doc.exportHwpx())};
}

/** Runs inside the regular scratch preflight and the editor's one undoable transaction. */
export function executeNestedCellEdit(doc:any,base:Snapshot,op:CellEdit) {
  const inspect=()=>inspectNestedTables(doc,parsed(doc.getControls()),parsed(doc.getCursorModel()).lists);
  const before=inspect(),table=before.tables.find(t=>t.id===op.target);
  const source=base.structure?.nestedTables?.find(t=>t.id===op.target);
  const cell=table?.cells.find(c=>c.row===op.row && c.column===op.column);
  if (!table || !source || !same(source,table) || !cell?.editable || cell.text!==op.originalText) throw Error('중첩 표의 부모 경로·원문·보호 상태가 달라졌습니다. 문서를 다시 조회하세요.');
  const cellPath=[...table.ancestors,{controlIndex:table.control,cellIndex:cell.index,cellParaIndex:0}];
  const root=cellPath[0],cursor={sectionIndex:table.section,paragraphIndex:table.paragraph,parentParaIndex:table.paragraph,
    controlIndex:root.controlIndex,cellIndex:root.cellIndex,cellParaIndex:root.cellParaIndex,cellPath,charOffset:Array.from(op.text).length};
  if (op.text===op.originalText) return cursor;
  const args=[table.section,table.paragraph,JSON.stringify(cellPath)] as const;
  const shape=parsed(doc.getCellCharPropertiesAtByPath(...args,0)),length=Array.from(op.originalText).length,newLength=Array.from(op.text).length;
  if (!Number.isSafeInteger(shape.charShapeId) || shape.charShapeId<0) throw Error('중첩 셀의 글자 서식이 불명확합니다.');
  const listId=before.listIds.get(table.id)![cell.index];
  const original=evidence(doc,listId);
  if (length) checked(doc.deleteTextInCellByPath(...args,0,length));
  if (newLength) {
    checked(doc.insertTextInCellByPath(...args,0,op.text));
    checked(doc.setCharShapeIdInCellByPath(...args,0,newLength,shape.charShapeId));
  }
  const result=inspect(),updated=evidence(doc,listId);
  cell.text=op.text;
  if (!same(before.tables,result.tables) || !same(shape,parsed(doc.getCellCharPropertiesAtByPath(...args,0))) ||
    !singleReplacement(original.text,updated.text,op.originalText,op.text) || !same(original.rest,updated.rest) || original.resources!==updated.resources)
    throw Error('중첩 셀 편집 후 원문·경로·서식 또는 문서 자원의 보존을 확인하지 못했습니다.');
  return cursor;
}
