import { planTableSeries, planTableFormulaCopy, planTableFormulaRecalculation, rectangleFillLines, fillLineOwners, type FillAxis, type TableSeries, type DateFillUnit, type FormulaFillOutput } from '../../modules/document/public/table-auto-fill.ts';
import type { Table, TableCellPathStep } from '../../modules/document/public/types.ts';
import {inspectNestedTables} from './nested-tables.ts';
import {formulaInputTarget,refreshFormulaInput} from './table-formula-input.ts';
import { verifyPreservedExport } from './preservation.ts';
import {readTableFormulaFields} from './table-formula-fields.ts';
import {planStoredFormulaFill,executeStoredFormulaFill,type FillCell,type StoredFill} from './stored-formula-fill.ts';
type Point = { row: number; col: number };
export type AutoFillBlock = { sec: number; ppi: number; ci: number; cellPath?: TableCellPathStep[]; anchor: Point; focus: Point; excluded?: unknown[];axis?:FillAxis };
type SeriesCell = FillCell;
type FormulaSeries = { kind: 'formula'; step: number; values: string[]; description: string };
export type AutoFillPlan = { section: number; paragraph: number; control: number; block: AutoFillBlock; cells: SeriesCell[]; dateUnit: DateFillUnit; seedCount: number; output: FormulaFillOutput; storedFill?:StoredFill;changedCells?:number[];relatedCells?:number[];lines?:AutoFillPlan[] } & (TableSeries | FormulaSeries);
const parsed = (v: any): any => typeof v === 'string' ? JSON.parse(v) : v;
const native = (wasm: any) => wasm.borrowDocumentHandle?.() ?? wasm;
const integer = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) >= 0;
const checked = (v: any) => { if (!parsed(v)?.ok) throw new Error('문서 엔진이 자동 채우기를 거절했습니다.'); };

function formulaSeries(doc: any, block: AutoFillBlock, rows: number, columns: number, cellCount:number, selection: SeriesCell[], lists: any[], controls: any[], output: FormulaFillOutput): FormulaSeries {
  if (rows * columns > 200) throw new Error('수식 참조 채우기는 200셀 이하 표에서 지원합니다.');
  if (output !== 'formula' && output !== 'value') throw new Error('수식 또는 계산값을 선택하세요.');
  const { sec: section, ppi: paragraph, ci: control } = block;
  const selected = new Map(selection.map(cell => [cell.index, cell]));
  const table: Table = { id: `s${section}p${paragraph}t${control}`, section, paragraph, control, rows, columns, cells: [] };
  for (let index = 0; index < cellCount; index++) {
    const info = parsed(doc.getCellInfo(section, paragraph, control, index)), cell = selected.get(index);
    let text = cell?.text ?? '';
    if (!cell && output === 'value') {
      const list = lists.find(l => l.isCell && l.hostListId === 0 && l.sectionIndex === section && l.hostPara === paragraph && l.controlIndex === control && l.cellIndex === index);
      const length = doc.getCellParagraphLength(section, paragraph, control, index, 0);
      if (!list || doc.getCellParagraphCount(section, paragraph, control, index) !== 1 || !integer(length) || length > 4000 || controls.some(c => c.list === list.listId)) {
        throw new Error('계산값 채우기는 각 셀이 4,000자 이하의 한 문단이고 개체·필드가 없는 표에서 지원합니다.');
      }
      text = doc.getTextInCell(section, paragraph, control, index, 0, 0, length);
    }
    table.cells.push({ index, row: info.row, column: info.col, rowSpan: info.rowSpan, columnSpan: info.colSpan, text, editable: Boolean(cell), properties: {cellProtect: !cell} });
  }
  return formulaValues(table,selection,output);
}

function formulaValues(table:Table, selection:SeriesCell[], output:FormulaFillOutput):FormulaSeries {
  const [seed, ...targets] = selection;
  const copy = planTableFormulaCopy(table, seed, targets)!;
  const changes = copy.changes.map(({ row, column, originalText, text }) => ({ row, column, originalText, text }));
  const results = output === 'value'
    ? new Map(planTableFormulaRecalculation(table, changes)!.calculated.map(cell => [cell.index, String(cell.value)]))
    : new Map(copy.changes.map(cell => [cell.index, cell.text]));
  const values = [seed.text, ...targets.map(cell => {
    const text = results.get(cell.index);
    if (text === undefined || Array.from(text).length > 4000) throw new Error('수식 채우기 결과가 셀의 글자 범위를 벗어났습니다.');
    return text;
  })];
  return { kind: 'formula', description: output === 'value' ? '계산값' : '수식 문자열', step: 0, values };
}

export function readAutoFillPlan(value: any, block: AutoFillBlock, dateUnit: DateFillUnit = 'days', output: FormulaFillOutput = 'formula',bounds=block): AutoFillPlan {
  const doc = native(value);
  if (!block || block.excluded?.length) throw new Error('제외된 셀이 없는 연속 범위를 선택하세요.');
  const { sec: section, ppi: paragraph, ci: control } = block;
  if (![section, paragraph, control].every(integer) || section >= doc.getSectionCount() || paragraph >= doc.getParagraphCount(section)) throw new Error('표의 위치가 유효하지 않습니다.');
  const nested=(block.cellPath?.length??0)>1;
  const dims = parsed(nested ? doc.getTableDimensionsByPath(section,paragraph,JSON.stringify(block.cellPath)) : doc.getTableDimensions(section, paragraph, control));
  if (![dims.rowCount, dims.colCount, dims.cellCount].every(v => integer(v) && v > 0) || dims.rowCount*dims.colCount>1000 || dims.cellCount > dims.rowCount*dims.colCount) throw new Error('자동 채우기는 격자 1,000칸 이하 표에서 지원합니다.');
  const lines=rectangleFillLines(block.anchor,block.focus,block.axis,dims.rowCount,dims.colCount);
  if(lines.length>1)return rectanglePlan(doc,block,lines,dateUnit,output);
  const r0 = Math.min(block.anchor.row, block.focus.row), r1 = Math.max(block.anchor.row, block.focus.row), c0 = Math.min(block.anchor.col, block.focus.col), c1 = Math.max(block.anchor.col, block.focus.col);
  if (![r0, r1, c0, c1].every(integer) || r1 >= dims.rowCount || c1 >= dims.colCount || ((r0 !== r1) === (c0 !== c1))) throw new Error('한 행 또는 한 열에서 연속된 셀을 선택하세요.');
  const controls = parsed(doc.getControls()), lists = parsed(doc.getCursorModel()).lists, cells: SeriesCell[] = [];
  if(nested)return nestedLinePlan(doc,block,dateUnit,output,controls,lists,bounds);
  let rootParagraph = paragraph;
  for (let sec = 0; sec < section; sec++) rootParagraph += doc.getParagraphCount(sec);
  const owner = controls.find((c: any) => c.list === 0 && c.para === rootParagraph && c.controlIndex === control && c.ctrlId === 'tbl');
  if (owner?.props?.Lock !== 0) throw new Error('보호된 표 또는 보호 상태를 확인할 수 없는 표입니다.');
  let storedFields:ReturnType<typeof readTableFormulaFields>,queried=false;
  const geometry=Array.from({length:Number(dims.cellCount)},(_,index)=>{
    const info=parsed(doc.getCellInfo(section,paragraph,control,index));
    return {index,row:info.row,column:info.col,rowSpan:info.rowSpan,columnSpan:info.colSpan};
  });
  for (const info of fillLineOwners(geometry,block.anchor,block.focus,bounds)) {
    const index=info.index;
    const props = parsed(doc.getCellProperties(section, paragraph, control, index));
    const list = lists.find((l: any) => l.isCell && l.hostListId === 0 && l.sectionIndex === section && l.hostPara === paragraph && l.controlIndex === control && l.cellIndex === index);
    if (props.cellProtect !== false || doc.getCellParagraphCount(section, paragraph, control, index) !== 1 || !list) throw new Error('보호·중첩 표·여러 문단 셀은 자동 채우기를 지원하지 않습니다.');
    let field:FillCell['field'];
    if(controls.some((c:any)=>c.list===list.listId)){
      if(!queried){storedFields=readTableFormulaFields(doc,true);queried=true;}
      const matches=storedFields?.fields.filter(f=>f.section===section&&f.paragraph===paragraph&&f.path.length===1&&f.path[0].controlIndex===control&&f.path[0].cellIndex===index);
      if(matches?.length!==1 || !matches[0].editable || !storedFields?.canFill)throw Error('개체·보호된 필드·중첩 표는 자동 채우기를 지원하지 않습니다.');
      field=matches[0];
    }
    const count = doc.getCellParagraphLength(section, paragraph, control, index, 0);
    if (!integer(count) || count > 4000) throw new Error('한 셀의 기존 글자는 4,000자 이하여야 합니다.');
    const runs = parsed(doc.getCharShapeRunsInCellByPath(section, paragraph, JSON.stringify([{ controlIndex: control, cellIndex: index, cellParaIndex: 0 }]), 0, count));
    if (new Set(runs.map((r: any) => r.charShapeId)).size > 1) throw new Error('혼합 글자 서식 셀은 자동 채우기를 지원하지 않습니다.');
    const charShape = parsed(doc.getCellCharPropertiesAt(section, paragraph, control, index, 0, 0)).charShapeId, para = parsed(doc.getCellParaPropertiesAt(section, paragraph, control, index, 0)), style = parsed(doc.getCellStyleAt(section, paragraph, control, index, 0)).id;
    if (![charShape, para.paraShapeId, style].every(integer) || para.headType !== 'None') throw new Error('셀의 원문 서식을 확인하지 못하거나 자동 번호가 있습니다.');
    cells.push({ index, row: info.row, column: info.column, text: doc.getTextInCell(section, paragraph, control, index, 0, 0, count), charShape, paraShape: para.paraShapeId, style,...(field?{field}:{}) });
  }
  const anchor = cells[0];
  if(!anchor?.field && cells.some(c=>c.field))throw Error('일반 셀 자동 채우기로 기존 계산식 필드를 덮어쓸 수 없습니다.');
  const formula = Boolean(anchor?.field)||anchor?.text.startsWith('=') === true;
  if (!formula && (block.anchor.row>block.focus.row || block.anchor.col>block.focus.col)) cells.reverse();
  if(anchor?.field)return storedLinePlan(doc,block,cells,control,dims.rowCount,dims.colCount,dateUnit,output);
  const series = formula
    ? formulaSeries(doc, block, dims.rowCount, dims.colCount, dims.cellCount, cells, lists, controls, output)
    : planTableSeries(cells[0]?.text ?? '', cells[1]?.text ?? '', cells.length, dateUnit);
  return { section, paragraph, control, block: structuredClone(block), cells, ...series, dateUnit, output, seedCount: formula ? 1 : 2 };
}

function storedLinePlan(doc:any,block:AutoFillBlock,cells:SeriesCell[],control:number,rows:number,columns:number,dateUnit:DateFillUnit,output:FormulaFillOutput):AutoFillPlan {
    const {sec:section,ppi:paragraph}=block,anchor=cells[0];
    const storedFill=planStoredFormulaFill(doc,[section,paragraph,control],cells,rows,columns,output);
    const final=new Map(storedFill.finalFields.map(([id,command,value])=>[id,{command,value}]));
    const values=[anchor.field!.expression!,...storedFill.steps.map(s=>output==='formula'?s.expression+' → '+final.get(s.fieldId)!.value:s.value)];
    const changedCells=storedFill.steps.flatMap((s,i)=>output==='formula'?s.originalField===final.get(s.fieldId)?.command?[]:[i+1]:cells[i+1].text===s.value?[]:[i+1]);
    const selected=new Set(cells.map(c=>c.index));
    const relatedCells=[...new Set(storedFill.steps.flatMap(step=>step.dependents.filter(f=>!selected.has(f.cellIndex)).map(f=>f.cellIndex)))];
    return {section,paragraph,control,block:structuredClone(block),cells,kind:'formula',description:output==='formula'?'저장된 계산식':'현재 계산값',step:0,
      values,storedFill,changedCells,relatedCells,dateUnit,output,seedCount:1};
}

function nestedLinePlan(doc:any,block:AutoFillBlock,dateUnit:DateFillUnit,output:FormulaFillOutput,controls:any[],lists:any[],bounds:AutoFillBlock):AutoFillPlan {
  const path=block.cellPath!,ancestors=path.slice(0,-1);
  const inspected=inspectNestedTables(doc,controls,lists);
  const table=inspected.tables.find(t=>t.section===block.sec && t.paragraph===block.ppi &&
    t.control===path.at(-1)!.controlIndex && JSON.stringify(t.ancestors)===JSON.stringify(ancestors));
  if(!table)throw Error('중첩 표의 소유 경로를 확인할 수 없습니다.');
  const ids=inspected.listIds.get(table.id)!;
  const fields=controls.some(c=>ids.includes(c.list))?readTableFormulaFields(doc,true):undefined;
  const cells:SeriesCell[]=fillLineOwners(table.cells,block.anchor,block.focus,bounds).map(cell=>{
    const encoded=JSON.stringify([...ancestors,{controlIndex:table.control,cellIndex:cell.index,cellParaIndex:0}]);
    const matches=fields?.fields.filter(f=>f.tableId===table.id&&JSON.stringify(f.path)===encoded);
    const field=matches?.length===1&&matches[0].editable&&fields?.canFill?matches[0]:undefined;
    if(!cell.editable&&!field)throw Error('보호되었거나 복합 내용인 중첩 셀은 채울 수 없습니다.');
    if(field && (field.start!==0 || field.displayedValue!==cell.text ||
      field.end!==Array.from(cell.text).length || doc.getCellParagraphCountByPath(block.sec,block.ppi,encoded)!==1))
      throw Error('중첩 셀의 전체 문단을 차지하는 계산식 필드만 채울 수 있습니다.');
    const shape=parsed(doc.getCellCharPropertiesAtByPath(block.sec,block.ppi,encoded,0)).charShapeId;
    const listId=ids[cell.index],paragraph=parsed(doc.getParaShapeSet(listId,0));
    if(!integer(shape)||!paragraph||paragraph.ok===false)throw Error('중첩 셀 서식을 확인하지 못했습니다.');
    return {index:cell.index,row:cell.row,column:cell.column,text:cell.text,charShape:shape,field,
      nested:{path:encoded,listId,paragraph:JSON.stringify(paragraph)}};
  });
  if(cells[0].field)return storedLinePlan(doc,block,cells,table.control,table.rows,table.columns,dateUnit,output);
  if(cells.some(c=>c.field))throw Error('수열로 기존 중첩 계산식 필드를 덮어쓸 수 없습니다.');
  const formula=cells[0].text.startsWith('=');
  if(!formula&&(block.anchor.row>block.focus.row||block.anchor.col>block.focus.col))cells.reverse();
  // Fixed results must use readable leaf text, including any referenced cells outside the selection.
  if(formula&&output==='value'&&table.cells.some(c=>!c.editable))throw Error('중첩 표의 계산값 채우기는 모든 셀이 읽을 수 있는 단일 문단이어야 합니다.');
  const series=formula?formulaValues({...table,cells:table.cells.map(c=>({...c,properties:{cellProtect:!c.editable}}))},cells,output):
    planTableSeries(cells[0].text,cells[1]?.text??'',cells.length,dateUnit);
  return {...series,section:block.sec,paragraph:block.ppi,control:table.control,block:structuredClone(block),cells,dateUnit,output,seedCount:formula?1:2};
}

function rectanglePlan(doc:any,block:AutoFillBlock,ranges:Array<{anchor:Point;focus:Point}>,dateUnit:DateFillUnit,output:FormulaFillOutput):AutoFillPlan {
  const format=doc.getSourceFormat();
  if(format!=='hwp'&&format!=='hwpx')throw Error('HWP 또는 HWPX 문서에서 직사각형 채우기를 사용할 수 있습니다.');
  const artifact=doc[format==='hwp'?'exportHwpWithReport':'exportHwpxWithReport']();
  let scratch:any;
  try{
    const bytes=artifact.takeBytes(),open=(b:Uint8Array)=>new doc.constructor(b);
    verifyPreservedExport(doc,bytes,format,artifact.contentLoss(),open);scratch=open(bytes);
    const lines:AutoFillPlan[]=[],cells:SeriesCell[]=[],values:string[]=[],changedCells:number[]=[],related=new Set<number>();
    const ownerValues=new Map<number,string>();
    for(const range of ranges){
      const line=readAutoFillPlan(scratch,{...block,...range},dateUnit,output,block);
      if(lines.length && (line.kind!==lines[0].kind || Boolean(line.storedFill)!==Boolean(lines[0].storedFill)))
        throw Error('각 행 또는 열의 시작 셀에는 같은 종류의 수열·수식이 필요합니다.');
      if(line.kind!=='formula' && (range.anchor.row>range.focus.row || range.anchor.col>range.focus.col))throw Error('수열은 왼쪽 또는 위쪽 두 셀에서 시작하세요.');
      if(line.cells.some(c=>ownerValues.has(c.index))){
        // A shared seed may already have been written by a preceding lane.
        const original=readAutoFillPlan(doc,{...block,...range},dateUnit,output,block);
        if(line.kind==='formula' || line.values.some((v,j)=>v!==original.values[j]))
          throw Error('같은 병합 셀에 여러 채우기 결과나 계산식이 지정됩니다.');
      }
      for(const [i,cell] of line.cells.entries()){
        if(ownerValues.has(cell.index)&&ownerValues.get(cell.index)!==line.values[i])
          throw Error('같은 병합 셀에 서로 다른 채우기 결과가 지정됩니다.');
        ownerValues.set(cell.index,line.values[i]);
        if(i>=line.seedCount && (line.changedCells?line.changedCells.includes(i):line.values[i]!==cell.text))changedCells.push(cells.length+i);
      }
      cells.push(...line.cells);values.push(...line.values);lines.push(line);
      for(const i of line.relatedCells??[])related.add(i);
      applyFill(scratch,line);
    }
    const first=lines[0];
    if(first.storedFill){
      const fields=parsed(scratch.getFieldList()) as Array<{fieldId:number;command:string;value:string}>;
      let offset=0;
      for(const line of lines){
        if(output==='formula')for(const [j,step] of line.storedFill!.steps.entries()){
          const final=fields.find(f=>f.fieldId===step.fieldId);
          if(!final)throw Error('직사각형 채우기에서 저장할 계산식이 누락되었습니다.');
          values[offset+j+1]=step.expression+' → '+final.value;
        }
        offset+=line.cells.length;
      }
    }
    return {kind:first.kind,step:first.step,description:first.description,section:block.sec,paragraph:block.ppi,control:block.ci,block:structuredClone(block),
      dateUnit,output,seedCount:0,cells,values,lines,changedCells,relatedCells:[...related].filter(i=>!cells.some(c=>c.index===i))};
  }finally{scratch?.free();artifact.free();}
}

export function changesAutoFill(plan:AutoFillPlan):boolean {
  if(plan.lines)return plan.lines.some(changesAutoFill);
  return plan.storedFill?plan.storedFill.changed:plan.cells.slice(plan.seedCount).some((c,i)=>c.text!==plan.values[i+plan.seedCount]);
}

/** Must run inside the caller's snapshot router, which owns rollback and one undo. */
export function executeAutoFill(value: any, plan: AutoFillPlan): void {
  const doc = native(value), current = readAutoFillPlan(doc, plan.block, plan.dateUnit, plan.output);
  if (JSON.stringify(current) !== JSON.stringify(plan)) throw new Error('셀 원문·서식 또는 표 범위가 바뀌었습니다. 자동 채우기를 다시 여세요.');
  const original=doc.saveSnapshot();
  try{
    if(!plan.lines){applyFill(doc,plan);return;}
    for(const line of plan.lines){
      const now=readAutoFillPlan(doc,line.block,line.dateUnit,line.output,plan.block);
      if(JSON.stringify(now)!==JSON.stringify(line))throw Error('셀 범위나 계산 결과가 미리보기와 달라졌습니다.');
      applyFill(doc,line);
    }
  }catch(error){
    if(!parsed(doc.restoreSnapshot(original)).ok)throw Error('자동 채우기 전 상태를 복구하지 못했습니다.');
    throw error;
  }finally{doc.discardSnapshot(original);}
}
function applyFill(doc:any,plan:AutoFillPlan):void {
  if(plan.storedFill){executeStoredFormulaFill(doc,[plan.section,plan.paragraph,plan.control],plan.cells,plan.storedFill,plan.output);return;}
  plan.cells.slice(plan.seedCount).forEach((cell, index) => {
    const text = plan.values[index + plan.seedCount]; if (text === cell.text) return;
    if(cell.nested){
      const args=[plan.section,plan.paragraph,cell.nested.path],length=doc.getCellParagraphLengthByPath(...args);
      const dependent=formulaInputTarget(doc,{sectionIndex:plan.section,parentParaIndex:plan.paragraph,cellPath:JSON.parse(cell.nested.path)});
      if(length)checked(doc.deleteTextInCellByPath(...args,0,length));
      checked(doc.insertTextInCellByPath(...args,0,text));
      const size=Array.from(text).length;
      checked(doc.setCharShapeIdInCellByPath(...args,0,size,cell.charShape));
      if(dependent)refreshFormulaInput(doc,dependent);
      const runs=parsed(doc.getCharShapeRunsInCellByPath(...args,0,size));
      if(doc.getCellParagraphLengthByPath(...args)!==size || doc.getTextInCellByPath(...args,0,size)!==text ||
          runs.length!==1||runs[0].charShapeId!==cell.charShape||runs[0].startOffset!==0||runs[0].endOffset!==size||
          JSON.stringify(parsed(doc.getParaShapeSet(cell.nested.listId,0)))!==cell.nested.paragraph)
        throw Error('중첩 셀의 값 또는 서식이 채우기 미리보기와 다릅니다.');
      return;
    }
    const args = [plan.section, plan.paragraph, plan.control, cell.index, 0], count = doc.getCellParagraphLength(...args);
    const dependency=formulaInputTarget(doc,{sectionIndex:plan.section,parentParaIndex:plan.paragraph,controlIndex:plan.control,cellIndex:cell.index});
    if (count) checked(doc.deleteTextInCell(...args, 0, count)); checked(doc.insertTextInCell(...args, 0, text)); checked(doc.setCharShapeIdInCell(...args, 0, Array.from(text).length, cell.charShape));
    if(dependency)refreshFormulaInput(doc,dependency);
    if (doc.getTextInCell(...args, 0, doc.getCellParagraphLength(...args)) !== text
      || parsed(doc.getCellParaPropertiesAt(...args)).paraShapeId !== cell.paraShape || parsed(doc.getCellStyleAt(...args)).id !== cell.style) throw new Error('자동 채우기 결과나 셀 서식이 다릅니다.');
  });
}

/** A router refusal must not be reported as a completed fill or close its dialog. */
export function executeAutoFillSnapshot(ih: any, plan: AutoFillPlan): void {
  let applied = false;
  ih.executeOperation({ kind: 'snapshot', operationType: 'jueonyTableAutoFill', operation: (wasm: any) => {
    executeAutoFill(wasm, plan);
    applied = true;
    return ih.getCursorPosition();
  } });
  if (!applied) throw new Error('자동 채우기를 적용하지 못했습니다. 문서의 편집 상태와 셀 선택을 확인하세요.');
}

export function preflightAutoFill(wasm: any, plan: AutoFillPlan): void {
  const { HwpDocument } = wasm.getWasmModuleExports(), open = (bytes: Uint8Array) => new HwpDocument(bytes), format = /\.hwpx$/iu.test(wasm.fileName) ? 'hwpx' : 'hwp';
  const save = (doc: any) => {
    const artifact = doc[format === 'hwpx' ? 'exportHwpxWithReport' : 'exportHwpWithReport']();
    try { const loss = artifact.contentLoss(), bytes = artifact.takeBytes(); verifyPreservedExport(doc, bytes, format, loss, open); return bytes; }
    finally { artifact.free(); }
  };
  let scratch: any;
  try {
    scratch = open(save(native(wasm)));
    const scratchPlan = readAutoFillPlan(scratch, plan.block, plan.dateUnit, plan.output);
    if (JSON.stringify(scratchPlan.cells.map(c => c.text)) !== JSON.stringify(plan.cells.map(c => c.text)) || JSON.stringify(scratchPlan.values) !== JSON.stringify(plan.values)) throw new Error('사전 검사 사본의 셀 원문 또는 채우기 결과가 다릅니다.');
    executeAutoFill(scratch, scratchPlan);
    save(scratch);
  }
  finally { scratch?.free(); }
}
