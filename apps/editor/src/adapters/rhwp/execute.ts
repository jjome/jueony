import {agentFileKinds} from '../../modules/document/public/index.ts';
import {executeAgentDocumentMetadata} from './agent-document-information.ts';
import {executeCellParagraph} from './cell-paragraph.ts';
import {executeTableSubdivision} from './table-subdivision.ts';
import {executeTableStructure} from './table-structure.ts';
import {executeTableSplit} from './table-split.ts';
import {executeTableMerge} from './table-merge.ts';
import {executeNestedCellEdit} from './nested-cell-edit.ts';
import {updateTableFormulaField} from './update-table-formula-field.ts';
import {agentSeriesRange} from '../../modules/document/public/engine-integration.ts';
import {readAutoFillPlan,executeAutoFill} from './table-auto-fill-native.ts';
import {readStructure} from './structure.ts';
import {executeAgentSectionMerge} from './agent-section-merge.ts';
import {executeAgentEmptySection} from './agent-empty-section.ts';
import type { EditOp, BodyOp, Snapshot } from '../../modules/document/public/index.ts';
import { executeBodyOperations } from './body-operations.ts';
import { controlKinds, executeControlOperation } from './operations.ts';
import type { ControlOp } from '../../modules/document/public/index.ts';
import { nativeDocument } from './structure.ts';

// Called inside the editor's single SnapshotCommand. IDs retain their meaning
// while structural insertions move native paragraph indices within this batch.
export function executeDocumentOperations(wasm: any, base: Snapshot, operations: EditOp[]) {
  if(operations.some(op=>(agentFileKinds as readonly string[]).includes(op.kind)))throw Error('문서 탭 명령은 업무 소유 façade에서만 실행합니다.');
  const snapshot = structuredClone(base), doc = nativeDocument(wasm);
  const field=operations.find(op=>op.kind==='update_table_formula_field');
  if(field){if(operations.length!==1)throw Error('계산식 필드는 단독 요청으로 실행하세요.');return updateTableFormulaField(doc,snapshot,field);}
  if(operations.length===1 && operations[0].kind==='fill_table_series'){
    const {table,block,unit,output}=agentSeriesRange(snapshot,operations[0]);
    const live=readStructure(doc).tables.find(t=>t.id===table.id);
    if(JSON.stringify(table.cells)!==JSON.stringify(live?.cells)) throw Error('표 원문이나 서식이 달라졌습니다. 표를 다시 조회하세요.');
    const plan=readAutoFillPlan(doc,block,unit,output);
    if(plan.storedFill){
      for(const cell of plan.cells){
        const queried=snapshot.tableFormulaFields?.fields.find(f=>f.tableId===table.id&&f.row===cell.row&&f.column===cell.column);
        if(queried?.fieldId!==cell.field?.fieldId||queried?.storedCommand!==cell.field?.storedCommand||queried?.displayedValue!==cell.field?.displayedValue)
          throw Error('조회한 계산식 원문 또는 표시값이 변경되었습니다.');
      }
    }
    let total=0;
    for(const value of plan.values.slice(plan.seedCount)){
      const length=Array.from(value).length;
      total+=length;
      if(length>4000 || total>60000) throw Error('채우기 결과가 셀 4,000자 또는 요청 60,000자 한도를 넘습니다.');
    }
    if(plan.storedFill?!plan.storedFill.changed:plan.cells.slice(plan.seedCount).every((cell,i)=>cell.text===plan.values[i+plan.seedCount])) throw Error('지정한 범위가 이미 같은 값으로 채워져 있습니다.');
    executeAutoFill(doc,plan);
    const first=plan.cells[0];
    return {sectionIndex:table.section,paragraphIndex:0,parentParaIndex:table.paragraph,controlIndex:table.control,
      cellIndex:first.index,cellParaIndex:0,charOffset:0,cellPath:[{controlIndex:table.control,cellIndex:first.index,cellParaIndex:0}]};
  }
  if (operations.some(op=>op.kind==='set_table_cell' && snapshot.structure?.nestedTables?.some(t=>t.id===op.target))) {
    if (operations.length!==1 || operations[0].kind!=='set_table_cell') throw Error('중첩 셀 편집은 단독 요청으로 실행하세요.');
    return executeNestedCellEdit(doc,snapshot,operations[0]);
  }
  if(operations.length===1&&operations[0].kind==='set_document_metadata'){executeAgentDocumentMetadata(doc,snapshot,operations[0]);return;}
  if(operations.length===1&&operations[0].kind==='remove_empty_section')return executeAgentEmptySection(doc,snapshot,operations[0]);
  if(operations.length===1&&operations[0].kind==='merge_sections')return executeAgentSectionMerge(doc,snapshot,operations[0]);
  if(operations.length===1&&operations[0].kind==='merge_table_cells')return executeTableMerge(doc,snapshot,operations[0]);
  if(operations.length===1&&(operations[0].kind==='split_table'||operations[0].kind==='attach_table'))return executeTableStructure(doc,snapshot,operations[0]);
  if(operations.length===1&&operations[0].kind==='replace_cell_paragraph')return executeCellParagraph(doc,snapshot,operations[0]);
  if(operations.length===1&&operations[0].kind==='split_table_cell_into')return executeTableSubdivision(doc,snapshot,operations[0]);
  if(operations.length===1&&operations[0].kind==='split_table_cell')return executeTableSplit(doc,snapshot,operations[0]);
  const tables = new Map((snapshot.structure?.tables ?? []).map(t => [t.id, t]));
  for (const op of operations) {
    let insertion: { section: number; after: number; count: number } | undefined;
    if (controlKinds.includes(op.kind)) insertion = executeControlOperation(doc, snapshot, op as ControlOp, tables);
    else {
      const body = op as BodyOp;
      executeBodyOperations(doc, snapshot, [body]);
      if (body.kind === 'insert_body_paragraphs') {
        const n = snapshot.nodes.find(n => n.id === body.after)!;
        insertion = { section: n.section, after: n.paragraph, count: body.paragraphs.length };
      } else if (body.kind !== 'create_document') {
        const n = snapshot.nodes.find(n => n.id === body.target)!;
        n.text = doc.getTextRange(n.section, n.paragraph, 0, doc.getParagraphLength(n.section, n.paragraph));
      }
    }
    if (insertion) {
      const { section, after, count } = insertion;
      for (const n of snapshot.nodes) if (n.section === section && n.paragraph > after) n.paragraph += count;
      for (const [id, t] of tables) if (!(op.kind === 'create_table' && id === '@' + op.resultId) && t.section === section && t.paragraph > after) t.paragraph += count;
    }
  }
}
