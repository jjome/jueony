import {sha256} from '@noble/hashes/sha2.js';
import type {Snapshot,Table,AgentTableSubdivisionOp,AgentTableSubdivisionSource} from '../../modules/document/public/index.ts';
import {tableSubdivisionPlan} from '../../modules/document/public/engine-integration.ts';
import { nativeDocument, parsed, readStructure } from './structure.ts';
import { readTableMergeSources } from './table-merge.ts';
import { readMergedSplitGrid } from './table-split.ts';
import { assertNativeTableWritable } from './table-write-guard.ts';
import { capturePreservationEvidence, verifyPreservedExport } from './preservation.ts';
import { topologySemantics, rootBodyTexts, tableTextTree } from './table-topology-evidence.ts';
import { tableLayoutEvidence, sameTableLayout } from './table-layout-evidence.ts';
import {subdivisionFrames,compareSubdivisionFrames,compareDividedPieces} from './subdivision-frames.ts';
import {hwpSubdivisionSource,verifiedSubdivisionHwp} from './hwp-table-subdivision.ts';
import type {SubdivisionCopyMetrics} from './subdivision-canvas-metrics.ts';
import {subdivisionFieldOwners,projectSubdivisionFields,subdivisionFieldLines} from './subdivision-neighbor-fields.ts';
const canonical = (v:any):any => Array.isArray(v) ? v.map(canonical) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k, canonical(v[k])])) : v;
const same = (a:any, b:any) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
const hash = (v:any) => Array.from(sha256(new TextEncoder().encode(JSON.stringify(canonical(v)))),n=>n.toString(16).padStart(2,'0')).join('');
function paragraphFormat(d:any, t:Table, cell:number, paragraph:number) {
  const at = [t.section, t.paragraph, t.control, cell, paragraph];
  return hash([parsed(d.getCellParaPropertiesAt(...at)), parsed(d.getCellCharPropertiesAt(...at, 0)), parsed(d.getCellStyleAt(...at))]);
}
function verifiedSubdivisionHwpx(d:any):Uint8Array {
  const artifact=d.exportHwpxWithReport();
  try {
    const bytes=artifact.takeBytes();
    verifyPreservedExport(d,bytes,'hwpx',artifact.contentLoss(),data=>new d.constructor(data));
    return bytes;
  } finally {artifact.free();}
}
export function readTableSubdivisionSources(wasm:any, tables:Table[], name:string):Record<string,AgentTableSubdivisionSource> {
  const d = nativeDocument(wasm), binary=/\.hwp$/iu.test(name);
  const merge = binary ? undefined : readTableMergeSources(d, tables, name);
  const hasGridSplit = typeof d.splitCellOnGrid === 'function';
  return Object.fromEntries(tables.map(t => { try {
    if (binary && wasm.requiresPasswordForSave===true) throw new Error('protected HWP');
    const p = parsed(d.getTableProperties(t.section, t.paragraph, t.control));
    const primary = t.cells.find(c => c.rowSpan > 1 || c.columnSpan > 1);
    const exactGrid = hasGridSplit && (!!primary || p.pageBreak===1 && d.pageCount()>1);
    const owners=exactGrid && primary ? subdivisionFieldOwners(d,t) : undefined;
    const native = binary ? hwpSubdivisionSource(d,t,tables,exactGrid,owners) : undefined;
    const grid = binary ? native && 'widths' in native ? native : undefined : primary || exactGrid ? readMergedSplitGrid(d,t,exactGrid,owners) : undefined;
    const authority = native ?? grid ?? merge?.[t.id];
    if (exactGrid && t.cells.some(c => c.properties.fieldName !== '' && !owners?.size)) throw new Error('unsupported field cell');
    const paginationAllowed = p.pageBreak === 0 || exactGrid && (p.pageBreak === 1 || p.pageBreak === 2);
    if (!/\.hwpx?$/iu.test(name) || typeof d.splitTableCellInto !== 'function' || authority?.editable !== true || p.cellZoneCount!==0 || p.repeatHeader || !paginationAllowed || t.cells.some(c => c.properties.isHeader || c.properties.textDirection !== 0)) throw new Error('unsupported');
    const widths = grid?.widths ?? t.cells.slice(0, t.columns).map(c => Number(c.properties.width));
    const heights = grid?.heights ?? Array.from({ length: t.rows }, (_, r) => Number(t.cells[r * t.columns].properties.height));
    const total = (tracks:number[], start:number, span:number) => tracks.slice(start,start+span).reduce((a,b) => a+b,0);
    if (t.cells.some(c => c.properties.width !== total(widths,c.column,c.columnSpan) || c.properties.height !== total(heights,c.row,c.rowSpan))
        || p.tableWidth !== total(widths,0,t.columns) || p.tableHeight !== total(heights,0,t.rows)) throw new Error('inconsistent source dimensions');

    const pads = t.cells.map(c => ({ left: c.properties.applyInnerMargin ? c.properties.paddingLeft : p.paddingLeft, right: c.properties.applyInnerMargin ? c.properties.paddingRight : p.paddingRight, top: c.properties.applyInnerMargin ? c.properties.paddingTop : p.paddingTop, bottom: c.properties.applyInnerMargin ? c.properties.paddingBottom : p.paddingBottom }));
    if (pads.some(v => Object.values(v).some(n => typeof n!=='number'||!Number.isSafeInteger(n) || n < 0))) throw new Error('invalid padding');
    const frames=subdivisionFrames(d,t,p), frame=frames[0];
    if (frames.length>1 && !exactGrid) throw Error('unsupported split table layout');
    const multipleMerged = t.cells.filter(c => c.rowSpan > 1 || c.columnSpan > 1).length > 1;
    const formats = (cell:Table['cells'][number]) => {
      const count = d.getCellParagraphCount(t.section,t.paragraph,t.control,cell.index);
      if (count < 2 || count > (exactGrid ? 64 : cell.rowSpan * cell.columnSpan)
          || (!exactGrid && typeof d.splitCellParagraphs !== 'function') || cell.text.split('\n').length !== count) return;
      return Array.from({length:count}, (_,i) => paragraphFormat(d,t,cell.index,i));
    };
    const cells=t.cells.filter(c=>owners?.size ? !c.axisFieldSignature && (c.rowSpan>1 || c.columnSpan>1)
      : !primary || exactGrid || c.index===primary.index).map(c=>({
      row:c.row, column:c.column,
      minimumWidth:Math.max(200,Number(pads[c.index].left)+Number(pads[c.index].right)+1),
      minimumHeight:Math.max(200,Number(pads[c.index].top)+Number(pads[c.index].bottom)+1),
      ...(exactGrid && (multipleMerged || c !== primary) ? {paragraphFormats:formats(c)} : {}),
    }));
    if(!cells.length)throw Error('분할할 일반 병합 셀이 없습니다.');
    if(owners?.size && !binary)verifiedSubdivisionHwpx(d);
    const preservation=capturePreservationEvidence(d);if(preservation.issues.length)throw new Error('preservation');
    const paragraphFormats = primary && !multipleMerged ? formats(primary) : undefined;
    return [t.id, { editable: true, fingerprint: hash({ merge: authority, table: t, properties: p, preservation: preservation.values }), cells, frame, ...(frames.length>1 ? {frames} : {}), ...(exactGrid ? {exactGrid:true} : {}), ...(binary ? {hwp5Grid:{widths,heights}} : {}), ...(paragraphFormats ? {paragraphFormats} : {}) }];
  } catch { return [t.id, { editable: false, reason: '원본 격자와 쪽별 셀·글줄을 확인한 본문 표를 분할할 수 있습니다. HWP5는 본문 표 한 개와 원본 형식의 저장·재열기 검사를 추가로 요구합니다. 보호·제목·중첩·복합 배치는 제외합니다.' }]; } }));
}
export function assertTableSubdivisionResult(wasm:any, base:Snapshot, op:AgentTableSubdivisionOp,copyMetrics?:SubdivisionCopyMetrics):void {
  const d = nativeDocument(wasm), plan = tableSubdivisionPlan(op, base), t = plan.table, actual = readStructure(d).tables.find(v => v.id === t.id);
  const view = (c:any) => ({ index: c.index, row: c.row, column: c.column, rowSpan: c.rowSpan, columnSpan: c.columnSpan, text: c.text, properties: c.properties, characters: c.characters, paragraphProperties: c.paragraphProperties,axisFieldSignature:c.axisFieldSignature });
  const slots = plan.cells.filter(c => c.originIndex === null || c.originIndex === plan.primary.index);
  const hasNeighborFields=t.cells.some(c=>c.axisFieldSignature);
  function checkCells(doc:any, output:Table|undefined) {
    if (!output || output.rows !== plan.rows || output.columns !== plan.columns || output.cells.length !== plan.cells.length) throw new Error('임의 분할 뒤 표 격자가 계획과 다릅니다.');
    if(hasNeighborFields)subdivisionFieldOwners(doc,output);
    for (const [i,c] of plan.cells.entries()) {
      const actual = view(output.cells[i]), expected = view(c), slot = slots.indexOf(c);
      if (op.distributeParagraphs && slot >= 0) {
        const formats = ('paragraphFormats' in plan ? plan.paragraphFormats : plan.source.paragraphFormats)!;
        if (doc.getCellParagraphCount(t.section,t.paragraph,t.control,i) !== 1 || paragraphFormat(doc,t,i,0) !== (formats[slot] ?? formats[0]))
          throw new Error('분배한 문단의 원래 글자·문단 서식 또는 스타일이 다릅니다.');
        if (!same({...actual, characters:undefined, paragraphProperties:undefined}, {...expected, characters:undefined, paragraphProperties:undefined})) throw new Error('문단 분배 뒤 셀 위치·내용·크기가 다릅니다.');
      } else if (!same(actual,expected)) throw new Error('임의 분할 뒤 셀 위치·내용·크기·서식이 계획과 다릅니다.');
    }
  }
  if (!actual) throw new Error('분할한 표가 없습니다.');
  checkCells(d, actual);
  const after = tableLayoutEvidence(d, actual);
  const fragmented=plan.source.frames?.some(f=>f.cells.some(c=>c.lineSignature))===true;
  const originalFrames=plan.source.frames ?? [plan.source.frame!];
  const divided = slots;
  const primarySpansPages=originalFrames.filter(f=>f.cells.some(c=>c.index===plan.primary.index)).length>1;
  const fromFragmentedOwner=primarySpansPages ? new Set(divided.map(c=>c.index)) : undefined;
  const frames=subdivisionFrames(d,actual,parsed(d.getTableProperties(t.section,t.paragraph,t.control)),fragmented,fromFragmentedOwner);
  const {original,current}=compareSubdivisionFrames(originalFrames,frames,plan.cells,plan.primary.index);
  if(primarySpansPages && !op.distributeParagraphs) {
    const retained=divided.find(c=>c.originIndex===plan.primary.index)!, empty=hash([]);
    const lines=(pieces:typeof original)=>pieces.filter(p=>p.lineSignature!==empty).map(p=>[p.page,p.lineSignature]);
    if(!same(lines(original),lines(current.get(retained.index)??[])))
      throw Error('분할 뒤 원래 셀의 쪽별 글줄 위치가 달라졌습니다.');
  }
  const columns = [...new Set(divided.map(c=>c.column))], rows = [...new Set(divided.map(c=>c.row))];
  for(const c of divided) compareDividedPieces(original,current.get(c.index),plan.widths,plan.heights,columns.indexOf(c.column),rows.indexOf(c.row));
  let copy:any; try { const binary=!!plan.source.hwp5Grid;
    let bytes:Uint8Array;
    if (binary) bytes=verifiedSubdivisionHwp(d);
    else if (fragmented || hasNeighborFields || 'useExactGrid' in plan && plan.useExactGrid) bytes=verifiedSubdivisionHwpx(d);
    else bytes=d.exportHwpx();
    copy = new d.constructor(bytes);
    copyMetrics?.(copy);
    if (binary || op.distributeParagraphs || plan.source.exactGrid) checkCells(copy, readStructure(copy).tables.find(v => v.id === t.id));
    if (fragmented && !sameTableLayout(frames,subdivisionFrames(copy,actual,parsed(copy.getTableProperties(t.section,t.paragraph,t.control)),true,fromFragmentedOwner)))
      throw Error('저장한 셀의 쪽별 원본 범위나 글줄이 달라졌습니다.');
    if (!sameTableLayout(after, tableLayoutEvidence(copy, actual))) throw new Error('임의 분할 뒤 저장 재열기의 셀·글줄 배치가 다릅니다.'); } finally { copy?.free(); }
}
export function executeTableSubdivision(wasm:any, base:Snapshot, op:AgentTableSubdivisionOp,copyMetrics?:SubdivisionCopyMetrics) {
  const source=base.tableSubdivisionSources?.[op.target];
  if (!source?.frames?.some(f=>f.cells.some(c=>c.lineSignature)) &&
      !base.structure?.tables.find(t=>t.id===op.target)?.cells.some(c=>c.axisFieldSignature)) return applySubdivision(wasm,base,op);
  const d=nativeDocument(wasm), token=d.saveSnapshot();
  try { return applySubdivision(wasm,base,op,copyMetrics); }
  catch (error) {d.restoreSnapshot(token);throw error;}
  finally {d.discardSnapshot(token);}
}

function applySubdivision(wasm:any, base:Snapshot, op:AgentTableSubdivisionOp,copyMetrics?:SubdivisionCopyMetrics) {
  const d = nativeDocument(wasm), plan = tableSubdivisionPlan(op, base), t = plan.table, structure = readStructure(d), cap = readTableSubdivisionSources(d, structure.tables, base.name)?.[t.id];
  const comparable=(c:any)=>{const {frame,...model}=c??{};return model;};
  if (!same(structure.tables.find(v => v.id === t.id), t) || cap?.editable !== true || !same(comparable(cap),comparable(base.tableSubdivisionSources?.[t.id]))||!sameTableLayout(cap.frame,base.tableSubdivisionSources?.[t.id]?.frame)) throw new Error('문서·표 내용·서식·배치가 바뀌었습니다. 최신 상태로 다시 요청하세요.');
  assertNativeTableWritable(d, t);
  const fieldOwners=t.cells.some(c=>c.axisFieldSignature) ? subdivisionFieldOwners(d,t) : undefined;
  const originalFieldLines=fieldOwners?.size ? subdivisionFieldLines(d,t,fieldOwners,plan.cells) : undefined;
  const evidence = capturePreservationEvidence(d); if (evidence.issues.length) throw new Error('분할 전 전체 문서 보존 정보를 확인하지 못했습니다.');
  const expected = topologySemantics(evidence.values), body = rootBodyTexts(d), target = (c:any) => c.list.hostListId === 0 && c.list.sectionIndex === t.section && c.list.hostPara === t.paragraph && c.list.controlIndex === t.control, originals = expected.cells.filter(target) as any[], primary = originals.find((c:any) => c.list.cellIndex === plan.primary.index);
  if (!primary || originals.length !== t.cells.length) throw new Error('분할할 원본 셀의 보존 정보가 없습니다.');
  const replacements = plan.cells.map(c => { const v = structuredClone(c.originIndex === null ? primary : originals.find((v:any) => v.list.cellIndex === c.originIndex)); Object.assign(v.list, { cellIndex: c.index, cellCount: plan.cells.length, row: c.row, col: c.column, rowSpan: c.rowSpan, colSpan: c.columnSpan }); Object.assign(v.properties, { width: c.properties.width, height: c.properties.height }); if (c.originIndex === null) { v.list.paraCount = 1; v.paragraphs = [{ paragraph: structuredClone(primary.paragraphs[0].paragraph), runs: [] }]; } return v; });
  if (op.distributeParagraphs) {
    const slots = plan.cells.filter(c => c.originIndex === null || c.originIndex === plan.primary.index);
    const formats = ('paragraphFormats' in plan ? plan.paragraphFormats : plan.source.paragraphFormats)!;
    if (primary.paragraphs.length !== formats.length || primary.paragraphs.length > slots.length)
      throw new Error('모든 원본 문단을 수용할 새 셀이 필요합니다.');
    primary.paragraphs.forEach((paragraph:any, index:number) => {
      const cell = replacements[slots[index].index];
      cell.list.paraCount = 1;
      cell.paragraphs = [structuredClone(paragraph)];
    });
  }
  const at = expected.cells.findIndex(target); expected.cells.splice(at, originals.length, ...replacements);
  const expectedText = tableTextTree(structure.tables.map(v => v.id === t.id ? { ...v, rows: plan.rows, columns: plan.columns, cells: plan.cells } : v));
  const result = parsed('useExactGrid' in plan && plan.useExactGrid
    ? d.splitCellOnGrid(t.section,t.paragraph,t.control,op.row,op.column,op.rows,op.columns,op.distributeParagraphs === true)
    : op.distributeParagraphs
    ? d.splitCellParagraphs(t.section, t.paragraph, t.control, op.row, op.column, op.rows, op.columns)
    : 'restoreTracks' in plan && plan.restoreTracks
    ? d.splitTableCell(t.section, t.paragraph, t.control, op.row, op.column)
    : d.splitTableCellInto(t.section, t.paragraph, t.control, op.row, op.column, op.rows, op.columns, true, false));
  if (result?.ok !== true) throw new Error('셀 임의 분할을 실행하지 못했습니다.');
  const after = capturePreservationEvidence(d);
  if(fieldOwners?.size)projectSubdivisionFields(expected,t,fieldOwners,plan.cells,parsed(d.getCursorModel()).lists);
  if(originalFieldLines){
    const indices=new Set(plan.cells.filter(c=>c.axisFieldSignature).map(c=>c.index));
    const actualFieldLines=tableLayoutEvidence(d,t).filter((v:any)=>indices.has(v.cell));
    if(!sameTableLayout(originalFieldLines,actualFieldLines))throw Error('분할 뒤 이웃 필드 셀의 실제 쪽이나 글줄 위치가 달라졌습니다.');
  }
  if (after.issues.length || !same(topologySemantics(after.values), expected) || !same(rootBodyTexts(d), body) || !same(tableTextTree(readStructure(d).tables), expectedText)) throw new Error('분할 뒤 다른 셀·본문·서식·필드·자원 보존이 계획과 다릅니다.');
  assertTableSubdivisionResult(d, base, op,copyMetrics);
  const first = plan.cells.find(c => c.originIndex === plan.primary.index)!;
  return { sectionIndex: t.section, parentParaIndex: t.paragraph, paragraphIndex: 0, charOffset: 0, controlIndex: t.control, cellIndex: first.index, cellParaIndex: 0, cellPath: [{ controlIndex: t.control, cellIndex: first.index, cellParaIndex: 0 }] };
}
