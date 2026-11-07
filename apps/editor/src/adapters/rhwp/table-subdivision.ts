import {sha256} from '@noble/hashes/sha2.js';
import type {Snapshot,Table,AgentTableSubdivisionOp,AgentTableSubdivisionSource} from '../../modules/document/public/index.ts';
import {tableSubdivisionPlan} from '../../modules/document/public/engine-integration.ts';
import { nativeDocument, parsed, readStructure } from './structure.ts';
import { readTableMergeSources } from './table-merge.ts';
import { readTableSplitSources } from './table-split.ts';
import { assertNativeTableWritable } from './table-write-guard.ts';
import { capturePreservationEvidence } from './preservation.ts';
import { topologySemantics, rootBodyTexts, tableTextTree } from './table-topology-evidence.ts';
import { tableLayoutEvidence, sameTableLayout } from './table-layout-evidence.ts';
import {hwpSubdivisionSource,verifiedSubdivisionHwp} from './hwp-table-subdivision.ts';
const canonical = (v:any):any => Array.isArray(v) ? v.map(canonical) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k, canonical(v[k])])) : v;
const same = (a:any, b:any) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
const hash = (v:any) => Array.from(sha256(new TextEncoder().encode(JSON.stringify(canonical(v)))),n=>n.toString(16).padStart(2,'0')).join('');
function paragraphFormat(d:any, t:Table, cell:number, paragraph:number) {
  const at = [t.section, t.paragraph, t.control, cell, paragraph];
  return hash([parsed(d.getCellParaPropertiesAt(...at)), parsed(d.getCellCharPropertiesAt(...at, 0)), parsed(d.getCellStyleAt(...at))]);
}
export function readTableSubdivisionSources(wasm:any, tables:Table[], name:string):Record<string,AgentTableSubdivisionSource> {
  const d = nativeDocument(wasm), binary=/\.hwp$/iu.test(name);
  const merge = binary ? undefined : readTableMergeSources(d, tables, name);
  const mergedTables = tables.filter(t => t.cells.some(c => c.rowSpan > 1 || c.columnSpan > 1));
  const split = !binary && mergedTables.length ? readTableSplitSources(d, mergedTables, name) : undefined;
  return Object.fromEntries(tables.map(t => { try {
    if (binary && wasm.requiresPasswordForSave===true) throw new Error('protected HWP');
    const p = parsed(d.getTableProperties(t.section, t.paragraph, t.control));
    const primary = t.cells.find(c => c.rowSpan > 1 || c.columnSpan > 1);
    const native = binary ? hwpSubdivisionSource(d,t,tables) : undefined;
    const grid = native && 'widths' in native ? native : split?.[t.id], authority = native ?? (primary ? grid : merge?.[t.id]);
    if (!/\.hwpx?$/iu.test(name) || typeof d.splitTableCellInto !== 'function' || authority?.editable !== true || p.cellZoneCount!==0 || p.repeatHeader || p.pageBreak !== 0 || t.cells.some(c => c.properties.isHeader || c.properties.textDirection !== 0)) throw new Error('unsupported');
    const widths = primary ? grid!.widths! : t.cells.slice(0, t.columns).map(c => Number(c.properties.width));
    const heights = primary ? grid!.heights! : Array.from({ length: t.rows }, (_, r) => Number(t.cells[r * t.columns].properties.height));
    const total = (tracks:number[], start:number, span:number) => tracks.slice(start,start+span).reduce((a,b) => a+b,0);
    if (t.cells.some(c => c.properties.width !== total(widths,c.column,c.columnSpan) || c.properties.height !== total(heights,c.row,c.rowSpan))
        || p.tableWidth !== total(widths,0,t.columns) || p.tableHeight !== total(heights,0,t.rows)) throw new Error('inconsistent source dimensions');

    const pads = t.cells.map(c => ({ left: c.properties.applyInnerMargin ? c.properties.paddingLeft : p.paddingLeft, right: c.properties.applyInnerMargin ? c.properties.paddingRight : p.paddingRight, top: c.properties.applyInnerMargin ? c.properties.paddingTop : p.paddingTop, bottom: c.properties.applyInnerMargin ? c.properties.paddingBottom : p.paddingBottom }));
    if (pads.some(v => Object.values(v).some(n => typeof n!=='number'||!Number.isSafeInteger(n) || n < 0))) throw new Error('invalid padding');
    const frames=tableLayoutEvidence(d,t).filter((v:any)=>Array.isArray(v.cells)) as NonNullable<AgentTableSubdivisionSource['frame']>[];if(frames.length!==1)throw new Error('unsupported frame');const frame=frames[0],page=parsed(d.getPageInfo(frame.page));
    if(![page.width,page.height].every(v=>Number.isFinite(v)&&v>0)||frame.cells.length!==t.cells.length||!sameTableLayout(frame.w,p.tableWidth*96/7200)||!sameTableLayout(frame.h,p.tableHeight*96/7200)||frame.x<0||frame.y<0||frame.x+frame.w>page.width+0.2||frame.y+frame.h>page.height+0.2||frame.cells.some(c=>{const cell=t.cells[c.index];return !cell||cell.row!==c.row||cell.column!==c.column||!sameTableLayout(c.w,Number(cell.properties.width)*96/7200)||!sameTableLayout(c.h,Number(cell.properties.height)*96/7200);}))throw new Error('source actual dimensions differ');
    const cells=t.cells.filter(c=>!primary||c.index===primary.index).map(c=>({row:c.row,column:c.column,minimumWidth:Math.max(200,Number(pads[c.index].left)+Number(pads[c.index].right)+1),minimumHeight:Math.max(200,Number(pads[c.index].top)+Number(pads[c.index].bottom)+1)}));
    const preservation=capturePreservationEvidence(d);if(preservation.issues.length)throw new Error('preservation');
    const count = primary ? d.getCellParagraphCount(t.section,t.paragraph,t.control,primary.index) : 0;
    const paragraphFormats = primary && count > 1 && count <= primary.rowSpan * primary.columnSpan
      && typeof d.splitCellParagraphs === 'function' && primary.text.split('\n').length === count
      ? Array.from({length:count}, (_, i) => paragraphFormat(d,t,primary.index,i)) : undefined;
    return [t.id, { editable: true, fingerprint: hash({ merge: authority, table: t, properties: p, preservation: preservation.values }), cells, frame, ...(binary ? {hwp5Grid:{widths,heights}} : {}), ...(paragraphFormats ? {paragraphFormats} : {}) }];
  } catch { return [t.id, { editable: false, reason: '한 쪽 본문 표에서 확인된 격자를 분할할 수 있습니다. HWP5는 본문 표 한 개와 원본 형식의 저장·재열기 검사를 추가로 요구합니다. 보호·제목·중첩·복합 배치는 제외합니다.' }]; } }));
}
export function assertTableSubdivisionResult(wasm:any, base:Snapshot, op:AgentTableSubdivisionOp):void {
  const d = nativeDocument(wasm), plan = tableSubdivisionPlan(op, base), t = plan.table, actual = readStructure(d).tables.find(v => v.id === t.id);
  const view = (c:any) => ({ index: c.index, row: c.row, column: c.column, rowSpan: c.rowSpan, columnSpan: c.columnSpan, text: c.text, properties: c.properties, characters: c.characters, paragraphProperties: c.paragraphProperties });
  const slots = plan.cells.filter(c => c.originIndex === null || c.originIndex === plan.primary.index);
  function checkCells(doc:any, output:Table|undefined) {
    if (!output || output.rows !== plan.rows || output.columns !== plan.columns || output.cells.length !== plan.cells.length) throw new Error('임의 분할 뒤 표 격자가 계획과 다릅니다.');
    for (const [i,c] of plan.cells.entries()) {
      const actual = view(output.cells[i]), expected = view(c), slot = slots.indexOf(c);
      if (op.distributeParagraphs && slot >= 0) {
        const formats = plan.source.paragraphFormats!;
        if (doc.getCellParagraphCount(t.section,t.paragraph,t.control,i) !== 1 || paragraphFormat(doc,t,i,0) !== (formats[slot] ?? formats[0]))
          throw new Error('분배한 문단의 원래 글자·문단 서식 또는 스타일이 다릅니다.');
        if (!same({...actual, characters:undefined, paragraphProperties:undefined}, {...expected, characters:undefined, paragraphProperties:undefined})) throw new Error('문단 분배 뒤 셀 위치·내용·크기가 다릅니다.');
      } else if (!same(actual,expected)) throw new Error('임의 분할 뒤 셀 위치·내용·크기·서식이 계획과 다릅니다.');
    }
  }
  if (!actual) throw new Error('분할한 표가 없습니다.');
  checkCells(d, actual);
  const after = tableLayoutEvidence(d, actual), oldFrame=plan.source.frame!, newFrame = after.find((v:any) => Array.isArray(v.cells)) as NonNullable<AgentTableSubdivisionSource['frame']>;
  if (!oldFrame || !newFrame || !sameTableLayout({ page: oldFrame.page, x: oldFrame.x, y: oldFrame.y, w: oldFrame.w, h: oldFrame.h }, { page: newFrame.page, x: newFrame.x, y: newFrame.y, w: newFrame.w, h: newFrame.h })) throw new Error('내용의 최소 크기 때문에 기존 표 외형이 달라졌습니다. 원본을 유지합니다.');
  for (const c of plan.cells) if (c.originIndex !== null && c.originIndex !== plan.primary.index) { const a = oldFrame.cells.find(v => v.index === c.originIndex), b = newFrame.cells.find(v => v.index === c.index); if (!a || !b || !sameTableLayout({ x: a.x, y: a.y, w: a.w, h: a.h }, { x: b.x, y: b.y, w: b.w, h: b.h })) throw new Error('임의 분할 뒤 이웃 셀의 실제 위치·크기가 달라졌습니다.'); }
  const original=oldFrame.cells.find(c=>c.index===plan.primary.index);if(!original)throw new Error('분할할 원본 셀의 실제 배치를 확인하지 못했습니다.');
  const divided = plan.cells.filter(c=>c.originIndex===null||c.originIndex===plan.primary.index);
  const columns = [...new Set(divided.map(c=>c.column))], rows = [...new Set(divided.map(c=>c.row))];
  for(const c of divided){const actual=newFrame.cells.find(v=>v.index===c.index),left=plan.widths.slice(0,columns.indexOf(c.column)).reduce((a,b)=>a+b,0),top=plan.heights.slice(0,rows.indexOf(c.row)).reduce((a,b)=>a+b,0),scaleX=original.w/Number(plan.primary.properties.width),scaleY=original.h/Number(plan.primary.properties.height);if(!actual||!sameTableLayout({x:actual.x,y:actual.y,w:actual.w,h:actual.h},{x:original.x+left*scaleX,y:original.y+top*scaleY,w:Number(c.properties.width)*scaleX,h:Number(c.properties.height)*scaleY}))throw new Error('새 셀의 실제 크기·위치가 원본 영역 분배와 다릅니다.');}
  let copy:any; try { const binary=!!plan.source.hwp5Grid;
    copy = new d.constructor(binary ? verifiedSubdivisionHwp(d) : d.exportHwpx());
    if (binary || op.distributeParagraphs) checkCells(copy, readStructure(copy).tables.find(v => v.id === t.id));
    if (!sameTableLayout(after, tableLayoutEvidence(copy, actual))) throw new Error('임의 분할 뒤 저장 재열기의 셀·글줄 배치가 다릅니다.'); } finally { copy?.free(); }
}
export function executeTableSubdivision(wasm:any, base:Snapshot, op:AgentTableSubdivisionOp) {
  const d = nativeDocument(wasm), plan = tableSubdivisionPlan(op, base), t = plan.table, structure = readStructure(d), cap = readTableSubdivisionSources(d, structure.tables, base.name)?.[t.id];
  const comparable=(c:any)=>{const {frame,...model}=c??{};return model;};
  if (!same(structure.tables.find(v => v.id === t.id), t) || cap?.editable !== true || !same(comparable(cap),comparable(base.tableSubdivisionSources?.[t.id]))||!sameTableLayout(cap.frame,base.tableSubdivisionSources?.[t.id]?.frame)) throw new Error('문서·표 내용·서식·배치가 바뀌었습니다. 최신 상태로 다시 요청하세요.');
  assertNativeTableWritable(d, t);
  const evidence = capturePreservationEvidence(d); if (evidence.issues.length) throw new Error('분할 전 전체 문서 보존 정보를 확인하지 못했습니다.');
  const expected = topologySemantics(evidence.values), body = rootBodyTexts(d), target = (c:any) => c.list.hostListId === 0 && c.list.sectionIndex === t.section && c.list.hostPara === t.paragraph && c.list.controlIndex === t.control, originals = expected.cells.filter(target) as any[], primary = originals.find((c:any) => c.list.cellIndex === plan.primary.index);
  if (!primary || originals.length !== t.cells.length) throw new Error('분할할 원본 셀의 보존 정보가 없습니다.');
  const replacements = plan.cells.map(c => { const v = structuredClone(c.originIndex === null ? primary : originals.find((v:any) => v.list.cellIndex === c.originIndex)); Object.assign(v.list, { cellIndex: c.index, cellCount: plan.cells.length, row: c.row, col: c.column, rowSpan: c.rowSpan, colSpan: c.columnSpan }); Object.assign(v.properties, { width: c.properties.width, height: c.properties.height }); if (c.originIndex === null) { v.list.paraCount = 1; v.paragraphs = [{ paragraph: structuredClone(primary.paragraphs[0].paragraph), runs: [] }]; } return v; });
  if (op.distributeParagraphs) {
    const slots = plan.cells.filter(c => c.originIndex === null || c.originIndex === plan.primary.index);
    if (primary.paragraphs.length !== plan.source.paragraphFormats!.length || primary.paragraphs.length > slots.length)
      throw new Error('모든 원본 문단을 수용할 새 셀이 필요합니다.');
    primary.paragraphs.forEach((paragraph:any, index:number) => {
      const cell = replacements[slots[index].index];
      cell.list.paraCount = 1;
      cell.paragraphs = [structuredClone(paragraph)];
    });
  }
  const at = expected.cells.findIndex(target); expected.cells.splice(at, originals.length, ...replacements);
  const expectedText = tableTextTree(structure.tables.map(v => v.id === t.id ? { ...v, rows: plan.rows, columns: plan.columns, cells: plan.cells } : v));
  const result = parsed(op.distributeParagraphs
    ? d.splitCellParagraphs(t.section, t.paragraph, t.control, op.row, op.column, op.rows, op.columns)
    : plan.restoreTracks
    ? d.splitTableCell(t.section, t.paragraph, t.control, op.row, op.column)
    : d.splitTableCellInto(t.section, t.paragraph, t.control, op.row, op.column, op.rows, op.columns, true, false));
  if (result?.ok !== true) throw new Error('셀 임의 분할을 실행하지 못했습니다.');
  const after = capturePreservationEvidence(d);
  if (after.issues.length || !same(topologySemantics(after.values), expected) || !same(rootBodyTexts(d), body) || !same(tableTextTree(readStructure(d).tables), expectedText)) throw new Error('분할 뒤 다른 셀·본문·서식·필드·자원 보존이 계획과 다릅니다.');
  assertTableSubdivisionResult(d, base, op);
  const first = plan.cells.find(c => c.originIndex === plan.primary.index)!;
  return { sectionIndex: t.section, parentParaIndex: t.paragraph, paragraphIndex: 0, charOffset: 0, controlIndex: t.control, cellIndex: first.index, cellParaIndex: 0, cellPath: [{ controlIndex: t.control, cellIndex: first.index, cellParaIndex: 0 }] };
}
