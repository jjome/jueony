import type {EditOp,Snapshot} from '../../document/public/index.ts';
import type {Table} from '../../document/public/types.ts';
import type {CommandTemplate,TableTemplateAnchor,TableTargets} from '../public/contracts.ts';

type RecordedTableCommand = Extract<EditOp,{kind:'set_table_cell'|'format_table_cells'|
 'insert_table_row'|'insert_table_column'|'delete_table_row'|'delete_table_column'}>;

const tableCommands = new Set(['set_table_cell','format_table_cells','insert_table_row','insert_table_column','delete_table_row','delete_table_column']);
const id = /^s[0-9]+p[0-9]+t[0-9]+$/u;
const nestedId = /^s[0-9]+p[0-9]+(?:t[0-9]+c[0-9]+p[0-9]+){1,7}t[0-9]+$/u;
const digest=/^[a-f0-9]{64}$/u;
const range = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value>0 && value<=200;

export function isRecordedTableCommand(op: EditOp): op is RecordedTableCommand {
  return tableCommands.has(op.kind);
}

function supportsNestedTemplate(op: EditOp): op is RecordedTableCommand {
  return isRecordedTableCommand(op)&&('index' in op||op.kind==='set_table_cell'&&op.paragraph===undefined);
}

function evidence(table: Table): string {
  return JSON.stringify([table.rows,table.columns,table.editable,table.cellZoneCount,table.headerRows,table.pagination,
    table.cells.map(cell=>[cell.row,cell.column,cell.rowSpan,cell.columnSpan,cell.editable,cell.text,
      cell.properties,cell.characters,cell.paragraphProperties,cell.axisFieldSignature,cell.axisFormula,cell.axisPicture])]);
}

export function captureTableTarget(base: Snapshot,op:RecordedTableCommand): TableTemplateAnchor {
  const target=op.target;
  if(nestedId.test(target)&&supportsNestedTemplate(op)){
    const nested=base.structure?.nestedTables?.find(table=>table.id===target);
    const proof=base.nestedTableTemplateEvidence?.[target];
    if(nested&&(!('index' in op)||nested.axisEditable)&&proof&&digest.test(proof)){
      return {rows:nested.rows,columns:nested.columns,evidence:proof,kind:'nested'};
    }
  }
  const table=base.structure?.tables.find(table=>table.id===target);
  if(!table||table.editable===false||table.cells.length>200||!id.test(target)){
    throw new Error('기존 본문 표 중 구조가 확인된 편집 가능 표를 반복 작업으로 저장할 수 있습니다.');
  }
  const proof=evidence(table);
  if(proof.length>60_000)throw new Error('반복 작업으로 저장하기에 표의 내용 또는 서식 정보가 너무 큽니다.');
  return {rows:table.rows,columns:table.columns,evidence:proof};
}

export function assertTableTargets(template: Extract<CommandTemplate,{version:3}>): void {
  const refs=template.tableRefs;
  const expected=new Set(template.operations.filter(isRecordedTableCommand).map(op=>op.target));
  if(!refs||typeof refs!=='object'||Array.isArray(refs)||Object.keys(refs).length!==expected.size||!expected.size)throw new Error('기록한 표 대상 목록이 올바르지 않습니다.');
  for(const [target,anchor] of Object.entries(refs)){
    const nested=anchor?.kind==='nested';
    const supported=nested?typeof anchor.evidence==='string'&&digest.test(anchor.evidence)&&nestedId.test(target)&&
      template.operations.length===1&&supportsNestedTemplate(template.operations[0]):
      anchor?.kind===undefined&&id.test(target);
    if(!supported||!expected.has(target)||!anchor||!range(anchor.rows)||!range(anchor.columns)||
       typeof anchor.evidence!=='string'||!anchor.evidence.length||anchor.evidence.length>60_000){
      throw new Error('기록한 표의 격자와 원문 증거가 올바르지 않습니다.');
    }
  }
}

export function tableTargetOptions(template: CommandTemplate,current: Snapshot){
  if(template.version!==3)return [];
  const candidates=(current.structure?.tables??[]).filter(table=>table.editable!==false&&table.cells.length<=200);
  return Object.entries(template.tableRefs).map(([source,anchor])=>{
    const nested=anchor.kind==='nested';
    const axis=nested&&'index' in template.operations[0];
    const matches=nested?(current.structure?.nestedTables??[]).filter(table=>
      (!axis||table.axisEditable)&&table.rows===anchor.rows&&table.columns===anchor.columns&&current.nestedTableTemplateEvidence?.[table.id]===anchor.evidence):
      candidates.filter(table=>table.rows===anchor.rows&&table.columns===anchor.columns&&evidence(table)===anchor.evidence);
    return {source,rows:anchor.rows,columns:anchor.columns,nested,candidates:matches.map(table=>({id:table.id,section:table.section,paragraph:table.paragraph,control:table.control,
      parent:'ancestors' in table?table.ancestors[0]:undefined}))};
  });
}

export function bindTableTargets(template:CommandTemplate,current:Snapshot,targets:TableTargets):Map<string,string>{
  const entries=tableTargetOptions(template,current),result=new Map<string,string>();
  if(!targets||typeof targets!=='object'||Array.isArray(targets)||Object.keys(targets).some(key=>!entries.some(entry=>entry.source===key))){
    throw new Error('기록하지 않은 표 대상이 지정되었습니다.');
  }
  for(const entry of entries){
    if(!Object.hasOwn(targets,entry.source))throw new Error('기록한 각 표의 대상 표를 직접 선택해 주세요.');
    const target=targets[entry.source];
    if(!entry.candidates.some(table=>table.id===target))throw new Error('대상 표의 원문, 서식 또는 격자가 기록과 다릅니다.');
    if([...result.values()].includes(target))throw new Error('서로 다른 기록 표에는 각각 다른 대상 표를 선택해 주세요.');
    result.set(entry.source,target);
  }
  return result;
}
