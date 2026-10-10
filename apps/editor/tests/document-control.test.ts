import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import init, { HwpDocument } from '@rhwp/core';
import { readStructure } from '../src/document-control/structure.ts';
import { executeDocumentOperations } from '../src/document-control/execute.ts';
import { executeBodyOperations, validateGeneration } from '../src/mvp/edit-schema.ts';
import type { Snapshot } from '../src/mvp/model.ts';
await init({ module_or_path: await readFile(new URL('../node_modules/@rhwp/core/rhwp_bg.wasm', import.meta.url)) });
const snapshot = (doc: HwpDocument): Snapshot => ({ revision: 'v1', name: 'test.hwpx', limitations: [], structure: readStructure(doc), nodes: Array.from({ length: doc.getSectionCount() }, (_, s) => Array.from({ length: doc.getParagraphCount(s) }, (_, p) => ({ id: `s${s}p${p}`, section: s, paragraph: p, text: doc.getTextRange(s, p, 0, doc.getParagraphLength(s, p)), editable: true }))).flat() });
const fixture = () => { const doc = HwpDocument.createEmpty(); doc.createBlankDocument(); executeBodyOperations(doc, snapshot(doc), [{ kind: 'create_document', paragraphs: ['업무 계획', '추진 일정', '후속 조치'] }]); return doc; };
const rows = [['단계', '기간', '담당'], ['준비', '1월', '총무'], ['실행', '2월', '사업'], ['점검', '3월', '감사']];
const scenario = [
  { kind: 'create_table', after: 's0p1', resultId: 'schedule', rows },
  { kind: 'format_table_cells', target: '@schedule', startRow: 0, rowCount: 1, startColumn: 0, columnCount: 3, properties: { bold: true, background: '#eeeeee' } },
  { kind: 'format_characters', target: 's0p0', properties: { bold: true, fontSizePt: 16 } },
  { kind: 'format_paragraph', target: 's0p2', properties: { alignment: 'center', beforeMm: 2 } },
  { kind: 'set_page_setup', section: 0, properties: { widthMm: 210, heightMm: 297, landscape: true, marginLeftMm: 20, marginRightMm: 20, marginTopMm: 20, marginBottomMm: 20 } },
];
test('실제 WASM: 4x3 일정표·표제 서식·쪽 설정·이동한 대상·두 형식 재열기', () => {
  const doc = fixture(); try {
    const before = snapshot(doc), id = doc.saveSnapshot();
    const g = validateGeneration({ message: '계획 편집', sourceIds: [], operations: scenario }, before, []);
    executeDocumentOperations(doc, before, g.operations);
    for (const bytes of [doc.exportHwp(), doc.exportHwpx()]) {
      const reopened = new HwpDocument(bytes); try {
        const s = readStructure(reopened), table = s.tables[0];
        assert.equal(table.rows, 4); assert.equal(table.columns, 3); assert.deepEqual(table.cells.map(c => c.text), rows.flat());
        assert.ok(table.cells.every(c => c.editable)); assert.equal(table.cells[0].properties.fillColor, '#eeeeee');
        assert.equal(table.cells[0].characters.bold, true); assert.equal(table.cells[3].characters.bold, false);
        assert.equal(s.paragraphs[0].characters.bold, true); assert.equal(s.paragraphs[0].characters.fontSize, 1600);
        assert.equal(JSON.parse(reopened.getParaPropertiesAt(0, 4)).alignment, 'center');
        assert.equal(s.sections[0].page.landscape, true); assert.equal(s.sections[0].page.marginLeft, Math.round(20 * 7200 / 25.4));
        assert.equal(reopened.getTextRange(0, 4, 0, 20), '후속 조치');
      } finally { reopened.free(); }
    }
    doc.restoreSnapshot(id); assert.deepEqual(snapshot(doc), before); doc.discardSnapshot(id);
  } finally { doc.free(); }
});
test('셀 원문 검증과 혼합 서식·범위·미지원 속성 거절', () => {
  const doc = fixture(); try {
    const s = snapshot(doc); executeDocumentOperations(doc, s, validateGeneration({ message: '', sourceIds: [], operations: scenario.slice(0, 1) }, s, []).operations);
    const base = snapshot(doc), target = base.structure!.tables[0].id;
    const apply = (operations: any[]) => validateGeneration({ message: '', sourceIds: [], operations }, base, []);
    assert.throws(() => apply([{ kind: 'set_table_cell', target, row: 0, column: 0, originalText: '틀림', text: '새 값' }]));
    assert.throws(() => apply([{ kind: 'format_table_cells', target, startRow: 0, rowCount: 8, startColumn: 0, columnCount: 1, properties: { bold: true } }]));
    assert.throws(() => apply([{ kind: 'set_page_setup', section: 0, properties: { marginLeftMm: 300 } }]));
    assert.throws(() => apply([{ kind: 'format_characters', target: 's0p0', properties: { script: 'bad' } }]));
    executeDocumentOperations(doc, base, apply([{ kind: 'set_table_cell', target, row: 1, column: 0, originalText: '준비', text: '준비 완료' }]).operations);
    assert.equal(readStructure(doc).tables[0].cells[3].text, '준비 완료');
    doc.applyCharFormatInCell(0, 2, 0, 3, 0, 0, 1, JSON.stringify({ bold: true }));
    assert.equal(readStructure(doc).tables[0].cells[3].editable, false);
  } finally { doc.free(); }
});
test('본문 삽입과 표 생성 뒤에도 원래 대상 ID가 같은 문단을 가리킨다', () => {
  const doc = fixture(); try {
    const base = snapshot(doc), operations = [
      { kind: 'insert_body_paragraphs', after: 's0p0', paragraphs: ['추가'] },
      ...scenario,
      { kind: 'replace_body_text', target: 's0p2', start: 0, count: 5, text: '수정 후속 조치' },
    ];
    executeDocumentOperations(doc, base, validateGeneration({ message: '', sourceIds: [], operations }, base, []).operations);
    assert.equal(doc.getTextRange(0, 5, 0, 30), '수정 후속 조치');
    assert.equal(JSON.parse(doc.getParaPropertiesAt(0, 5)).alignment, 'center');
  } finally { doc.free(); }
});
