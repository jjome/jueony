import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import type { HwpDocument as NativeDocument } from '@rhwp/core';
import { resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
const enginePackage = process.env.JUEONY_ENGINE_PACKAGE ? resolve(process.env.JUEONY_ENGINE_PACKAGE) : fileURLToPath(new URL('../node_modules/@rhwp/core/', import.meta.url));
const { default: init, HwpDocument } = await import(pathToFileURL(resolve(enginePackage, 'rhwp.js')).href);
type HwpDocument = NativeDocument;
import { readStructure } from '../src/document-control/structure.ts';
import { executeDocumentOperations } from '../src/document-control/execute.ts';
import { executeBodyOperations, validateGeneration } from '../src/mvp/edit-schema.ts';
import type { Snapshot } from '../src/mvp/model.ts';
await init({ module_or_path: await readFile(resolve(enginePackage, 'rhwp_bg.wasm')) });
const probe = HwpDocument.createEmpty(); probe.createBlankDocument(); probe.createTable(0, 0, 0, 1, 1);
const hasCellZoneObservation = JSON.parse(probe.getTableProperties(0, 0, readStructure(probe).tables[0].control)).cellZoneCount === 0; probe.free();
// Topology must refuse unknown region ownership. The upstream npm engine lacks
// this observation; run the patched engine via JUEONY_ENGINE_PACKAGE for these cases.
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
test('빈 본문 입력 뒤 같은 요청의 글자 서식은 새 내용을 기준으로 검사한다',()=>{
 const doc=HwpDocument.createEmpty();doc.createBlankDocument();
 try{
  const before=snapshot(doc),operations=[{kind:'replace_body_text',target:'s0p0',start:0,count:0,text:'새 제목'},{kind:'format_characters',target:'s0p0',properties:{bold:true,fontSizePt:16}}];
  const g=validateGeneration({message:'입력과 서식',sourceIds:[],operations},before,[]);executeDocumentOperations(doc,before,g.operations);
  for(const bytes of [doc.exportHwp(),doc.exportHwpx()]){const reopened=new HwpDocument(bytes);try{const s=snapshot(reopened);assert.equal(s.nodes[0].text,'새 제목');assert.equal(s.structure!.paragraphs[0].characters.bold,true);}finally{reopened.free();}}
  const filled=snapshot(doc);
  assert.throws(()=>validateGeneration({message:'비우기 뒤 서식',sourceIds:[],operations:[{kind:'delete_body_text',target:'s0p0',start:0,count:4},{kind:'format_characters',target:'s0p0',properties:{bold:true}}]},filled,[]),/빈 문단/);
  assert.deepEqual(snapshot(doc),filled);
 }finally{doc.free();}
});
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

test('표 행·열 앞/중간/뒤 삽입·삭제와 후속 셀 편집을 두 형식 저장과 undo로 검증',{skip: !hasCellZoneObservation},()=>{
 for(const axis of ['row','column'])for(const index of [0,1,2]){
  const doc=fixture();try{
   let base=snapshot(doc);executeDocumentOperations(doc,base,validateGeneration({message:'',sourceIds:[],operations:[{kind:'create_table',after:'s0p0',resultId:'t',rows:[['A','B'],['C','D']]}]},base,[]).operations);
   base=snapshot(doc);const saved=doc.saveSnapshot(),target=base.structure!.tables[0].id;
   const ops=[{kind:'insert_table_'+axis,target,index,values:['X','Y']},{kind:'set_table_cell',target,row:axis==='row'?index:0,column:axis==='row'?0:index,originalText:'X',text:'Z'}];
   executeDocumentOperations(doc,base,validateGeneration({message:'',sourceIds:[],operations:ops},base,[]).operations);
   const expected=axis==='row'?[['A','B'],['C','D']]:[['A','B'],['C','D']];
   if(axis==='row')expected.splice(index,0,['Z','Y']);else expected.forEach((r,i)=>r.splice(index,0,i===0?'Z':'Y'));
   const matrix=(d:HwpDocument)=>{const t=readStructure(d).tables[0];return Array.from({length:t.rows},(_,r)=>Array.from({length:t.columns},(_,c)=>t.cells.find(cell=>cell.row===r&&cell.column===c)!.text));};
   assert.deepEqual(matrix(doc),expected);
   for(const bytes of [doc.exportHwp(),doc.exportHwpx()]){const reopened=new HwpDocument(bytes);try{assert.deepEqual(matrix(reopened),expected);}finally{reopened.free();}}
   base=snapshot(doc);executeDocumentOperations(doc,base,validateGeneration({message:'',sourceIds:[],operations:[{kind:'delete_table_'+axis,target,index}]},base,[]).operations);assert.deepEqual(matrix(doc),[['A','B'],['C','D']]);
   doc.restoreSnapshot(saved);assert.deepEqual(matrix(doc),[['A','B'],['C','D']]);
  }finally{doc.free();}
 }
});

test('요청 내 새 표 참조와 연속 행열 편집, 복잡한 셀과 마지막 행열 삭제 거절',{skip: !hasCellZoneObservation},()=>{
 const doc=fixture();try{
  const base=snapshot(doc),ops=[{kind:'create_table',after:'s0p0',resultId:'t',rows:[['A','B'],['C','D']]},{kind:'insert_table_row',target:'@t',index:2,values:['E','F']},{kind:'insert_table_column',target:'@t',index:0,values:['1','2','3']},{kind:'delete_table_row',target:'@t',index:0},{kind:'delete_table_column',target:'@t',index:2},{kind:'set_table_cell',target:'@t',row:0,column:1,originalText:'C',text:'변경'}];
  executeDocumentOperations(doc,base,validateGeneration({message:'',sourceIds:[],operations:ops},base,[]).operations);
  const current=snapshot(doc),table=current.structure!.tables[0];assert.equal(table.rows,2);assert.equal(table.columns,2);assert.deepEqual(table.cells.map(c=>c.text),['2','변경','3','E']);
  const validate=(operations:any[],s=current)=>validateGeneration({message:'',sourceIds:[],operations},s,[]);
  assert.throws(()=>validate([{kind:'insert_table_row',target:table.id,index:0,values:['wrong size']}]),/셀 수/);
  assert.throws(()=>validate([{kind:'delete_table_row',target:table.id,index:0},{kind:'delete_table_row',target:table.id,index:0}]),/마지막/);
  assert.throws(()=>validate([{kind:'insert_table_column',target:table.id,index:3,values:['a','b']}]),/범위/);
  const merged=structuredClone(current);merged.structure!.tables[0].cells[0].rowSpan=2;
  assert.throws(()=>validate([{kind:'delete_table_row',target:table.id,index:0}],merged),/단순 표/);
 }finally{doc.free();}
});

test('셀 긴 본문 교체·비우기·빈 셀 채우기는 글자/문단 서식을 보존한다',()=>{
 const doc=fixture();try{
  let base=snapshot(doc);executeDocumentOperations(doc,base,validateGeneration({message:'',sourceIds:[],operations:[{kind:'create_table',after:'s0p0',resultId:'t',rows:[['원문','']]},{kind:'format_table_cells',target:'@t',startRow:0,rowCount:1,startColumn:0,columnCount:1,properties:{bold:true,alignment:'center'}}]},base,[]).operations);
  const original=readStructure(doc).tables[0].cells[0];
  for(const value of ['아주 긴 셀 내용으로 8자를 넘게 수정합니다 😀','','빈 셀을 다시 채웁니다']){
   base=snapshot(doc);const table=base.structure!.tables[0];executeDocumentOperations(doc,base,validateGeneration({message:'',sourceIds:[],operations:[{kind:'set_table_cell',target:table.id,row:0,column:0,originalText:table.cells[0].text,text:value}]},base,[]).operations);
   const cell=readStructure(doc).tables[0].cells[0];assert.equal(cell.text,value);assert.equal(cell.characters.bold,original.characters.bold);assert.equal(cell.paragraphProperties.alignment,'center');
   for(const bytes of [doc.exportHwp(),doc.exportHwpx()]){const reopened=new HwpDocument(bytes);try{assert.equal(readStructure(reopened).tables[0].cells[0].text,value);}finally{reopened.free();}}
  }
 }finally{doc.free();}
});

test('본문과 셀 글꼴·장평·자간·위아래첨자 설정을 두 형식으로 보존',()=>{
 const doc=fixture();try{
  const base=snapshot(doc),saved=doc.saveSnapshot(),props={fontFamily:'맑은 고딕',ratioPercent:90,spacingPercent:-3,superscript:true};
  const operations=[{kind:'format_characters',target:'s0p0',properties:props},{kind:'create_table',after:'s0p1',resultId:'t',rows:[['제목','본문']]},{kind:'format_table_cells',target:'@t',startRow:0,rowCount:1,startColumn:0,columnCount:2,properties:{...props,superscript:false,subscript:true}}];
  executeDocumentOperations(doc,base,validateGeneration({message:'',sourceIds:[],operations},base,[]).operations);
  const verify=(d:HwpDocument)=>{const structure=readStructure(d),body=structure.paragraphs[0].characters,cell=structure.tables[0].cells[0].characters;assert.equal(body.fontFamily,'맑은 고딕');assert.deepEqual(body.ratios,Array(7).fill(90));assert.deepEqual(body.spacings,Array(7).fill(-3));assert.equal(body.superscript,true);assert.equal(body.subscript,false);assert.equal(cell.fontFamily,'맑은 고딕');assert.equal(cell.subscript,true);assert.equal(cell.superscript,false);};
  verify(doc);for(const bytes of [doc.exportHwp(),doc.exportHwpx()]){const reopened=new HwpDocument(bytes);try{verify(reopened);}finally{reopened.free();}}
  doc.restoreSnapshot(saved);assert.deepEqual(readStructure(doc),base.structure);
  assert.throws(()=>validateGeneration({message:'',sourceIds:[],operations:[{kind:'format_characters',target:'s0p0',properties:{superscript:true,subscript:true}}]},base,[]),/동시에/);
 }finally{doc.free();}
});
