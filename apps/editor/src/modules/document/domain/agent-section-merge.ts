import type { AgentSectionMergeOp, Snapshot } from '../public/types.ts';

/** Numeric section and paragraph addresses change after a merge. */
export function validateAgentSectionMerge(op: AgentSectionMergeOp, snapshot: Snapshot): void {
  const structure = snapshot.structure;
  if (structure?.sectionMergeAvailable !== true) throw new Error('이 엔진에는 AI 구역 합치기가 없습니다.');
  const rightIndex = op.rightSection;
  if (!Number.isSafeInteger(rightIndex) || rightIndex < 1 || rightIndex >= structure.sections.length || structure.sections.length > 100) {
    throw new Error('합칠 뒤 구역은 현재 두 번째부터 100개 이내 구역이어야 합니다.');
  }
  const affectedTables = structure.tables.filter(table => table.section === rightIndex - 1 || table.section === rightIndex);
  const movedTable = affectedTables[0];
  if (affectedTables.length > 1 || movedTable && (
    movedTable.section !== rightIndex || movedTable.paragraph === 0 || movedTable.editable !== true
    || movedTable.cellZoneCount !== 0 || movedTable.pagination?.mode !== 'none'
    || movedTable.cells.length !== movedTable.rows * movedTable.columns
    || movedTable.cells.some(cell => !cell.editable || cell.rowSpan !== 1 || cell.columnSpan !== 1 || cell.properties.fieldName)
  )) {
    throw new Error('AI 구역 합치기는 뒤 구역의 첫 문단 아래에 있는 보호·병합·필드가 없는 일반 본문 표 한 개까지 지원합니다.');
  }
  const affected = [rightIndex - 1, rightIndex].map(index => ({
    section: structure.sections.find(section => section.index === index),
    nodes: snapshot.nodes.filter(node => node.section === index).sort((a, b) => a.paragraph - b.paragraph),
  }));
  for (const { section, nodes } of affected) {
    if (!section || section.columns?.columnCount !== 1 || section.lineNumbers?.enabled
      || !section.masterPages?.editable || section.masterPages.pages.length
      || !nodes.length || nodes.some((node, index) => node.paragraph !== index)) {
      throw new Error('AI 구역 합치기는 바탕쪽과 줄 번호가 없는 두 한 단 일반 본문 구역을 지원합니다.');
    }
    for (const node of nodes) {
      const paragraph = structure.paragraphs.find(paragraph => paragraph.id === node.id);
      if (!paragraph || paragraph.pageHide?.exists || !Array.isArray(paragraph.controls)) {
        throw new Error('감추기 또는 원본을 확인할 수 없는 문단이 있습니다.');
      }
      if (movedTable && node.section === movedTable.section && node.paragraph === movedTable.paragraph) {
        if (node.text === '' && paragraph.controls.length === 1 && paragraph.controls[0] === 'tbl') continue;
        throw new Error('이동할 표는 본문과 다른 개체가 없는 독립 문단에 있어야 합니다.');
      }
      if (!node.editable || paragraph.controls.some(control => node.paragraph !== 0 || !['secd', 'cold'].includes(control))) {
        throw new Error('일반 본문 구역의 원본에 머리말·꼬리말·필드·특수 개체 또는 혼합 서식이 있어 합칠 수 없습니다.');
      }
    }
  }
  const left = affected[0].nodes.at(-1)!;
  const right = affected[1].nodes[0];
  if (Array.from(left.text).length + Array.from(right.text).length > 4000) {
    throw new Error('합친 경계 문단은 4,000자 이내여야 합니다.');
  }
}
