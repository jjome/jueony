import type { AgentSectionMergeOp, Snapshot, Structure, Table } from '../../modules/document/public/index.ts';
import { validateAgentSectionMerge } from '../../modules/document/public/engine-integration.ts';
import { nativeDocument, parsed, readStructure } from './structure.ts';
import { mergeSectionBoundaryWithPortableMetrics } from './section-boundary.ts';

function readMovedTableProperties(doc: any, table: Table) {
  const { section, paragraph, control } = table;
  const properties = parsed(doc.getTableProperties(section, paragraph, control));
  const page = parsed(doc.getPageOfPosition(section, paragraph)).page;
  const frames = parsed(doc.getPageControlLayout(page)).controls.filter((frame: any) =>
    frame.type === 'table' && frame.secIdx === section && frame.paraIdx === paragraph && frame.controlIdx === control);
  if (frames.length !== 1 || frames[0].cells?.length !== table.cells.length
    || properties.hasCaption !== false || properties.treatAsChar !== false || properties.textWrap !== 'TopAndBottom'
    || properties.vertRelTo !== 'Para' || properties.vertAlign !== 'Top' || properties.vertOffset !== 0
    || properties.cellSpacing !== 0) {
    throw new Error('이동할 표는 캡션과 세로 오프셋이 없는 한 쪽 본문 표여야 합니다.');
  }
  return properties;
}

function storedSectionSettings({ index, emptySectionRemoval, lineNumbers, ...value }: Structure['sections'][number]) {
  if (!lineNumbers) return value;
  // Table ownership changes line-number editability without changing stored settings.
  const { editable, ...storedLineNumbers } = lineNumbers;
  return { ...value, lineNumbers: storedLineNumbers };
}

/** The native staged merger and shared current-format preflight remain authoritative. */
export function executeAgentSectionMerge(wasm: any, base: Snapshot, op: AgentSectionMergeOp) {
  validateAgentSectionMerge(op, base);
  const doc = nativeDocument(wasm);
  if (typeof doc.mergeSectionBoundary !== 'function') throw new Error('이 엔진에는 AI 구역 합치기가 없습니다.');
  const readBody = () => Array.from({ length: doc.getSectionCount() }, (_, section) =>
    Array.from({ length: doc.getParagraphCount(section) }, (_, paragraph) =>
      doc.getTextRange(section, paragraph, 0, doc.getParagraphLength(section, paragraph)) as string));
  const before = readBody();
  const original = base.structure!.sections.map(({ index }) => base.nodes.filter(node => node.section === index)
    .sort((a, b) => a.paragraph - b.paragraph).map(node => node.text));
  if (JSON.stringify(before) !== JSON.stringify(original)) {
    throw new Error('구역 합치기의 본문 원문이나 구역 수가 바뀌었습니다. 최신 문서로 다시 요청하세요.');
  }
  const current = readStructure(doc);
  validateAgentSectionMerge(op, { ...base, structure: current });
  const right = op.rightSection, left = right - 1;
  const boundaryParagraph = before[left].length - 1;
  const offset = Array.from(before[left][boundaryParagraph]).length;
  const moved = current.tables.find(table => table.section === right);
  let movedProperties;
  if (moved) {
    const originalTable = base.structure!.tables.find(table => table.id === moved.id);
    if (JSON.stringify(moved) !== JSON.stringify(originalTable)) {
      throw new Error('이동할 표의 내용이나 서식이 바뀌었습니다. 최신 문서로 다시 요청하세요.');
    }
    movedProperties = readMovedTableProperties(doc, moved);
  }
  const expected = [...before];
  expected.splice(left, 2, [
    ...before[left].slice(0, boundaryParagraph), before[left][boundaryParagraph] + before[right][0], ...before[right].slice(1),
  ]);
  const retained = current.sections.filter(section => section.index !== right).map(storedSectionSettings);
  const survivingTabSpacing = moved ? parsed(doc.getSectionDef(left)).defaultTabSpacing : undefined;
  const result = parsed(moved ? mergeSectionBoundaryWithPortableMetrics(wasm, right) : doc.mergeSectionBoundary(right));
  const after = readStructure(doc);
  if (result?.ok !== true || result.sectionIdx !== left || result.paraIdx !== boundaryParagraph
    || result.charOffset !== offset || after.sections.length !== before.length - 1
    || JSON.stringify(readBody()) !== JSON.stringify(expected)
    || JSON.stringify(after.sections.map(storedSectionSettings)) !== JSON.stringify(retained)) {
    throw new Error('구역 합치기 결과의 위치·본문·앞 구역 설정이 명령과 다릅니다.');
  }
  if (moved) {
    const paragraph = boundaryParagraph + moved.paragraph;
    const cells = moved.cells.map(cell => ({
      ...cell, paragraphProperties: { ...cell.paragraphProperties, defaultTabSpacing: survivingTabSpacing },
    }));
    const target = { ...moved, section: left, paragraph, id: `s${left}p${paragraph}t${moved.control}`, cells };
    const actual = after.tables.find(table => table.id === target.id);
    if (!actual || JSON.stringify(actual) !== JSON.stringify(target)
      || JSON.stringify(readMovedTableProperties(doc, actual)) !== JSON.stringify(movedProperties)) {
      throw new Error('합친 구역의 표 속성, 셀 내용 또는 이동 위치를 확인하지 못했습니다.');
    }
  }
  return { sectionIndex: left, paragraphIndex: boundaryParagraph, charOffset: offset };
}
