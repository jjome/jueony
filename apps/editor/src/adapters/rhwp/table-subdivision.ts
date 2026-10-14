import {sha256} from '@noble/hashes/sha2.js';
import type {Snapshot,Table,AgentTableSubdivisionOp,AgentTableSubdivisionSource} from '../../modules/document/public/index.ts';
import {tableSubdivisionPlan} from '../../modules/document/public/engine-integration.ts';
import { nativeDocument, parsed, readStructure } from './structure.ts';
import { readTableMergeSources } from './table-merge.ts';
import { assertNativeTableWritable } from './table-write-guard.ts';
import { capturePreservationEvidence } from './preservation.ts';
import { topologySemantics, rootBodyTexts, tableTextTree } from './table-topology-evidence.ts';
import { tableLayoutEvidence, sameTableLayout } from './table-layout-evidence.ts';
const canonical = (v:any):any => Array.isArray(v) ? v.map(canonical) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k, canonical(v[k])])) : v;
const same = (a:any, b:any) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
const hash = (v:any) => Array.from(sha256(new TextEncoder().encode(JSON.stringify(canonical(v)))),n=>n.toString(16).padStart(2,'0')).join('');
export function readTableSubdivisionSources(wasm:any, tables:Table[], name:string):Record<string,AgentTableSubdivisionSource> {
  const d = nativeDocument(wasm), merge = readTableMergeSources(d, tables, name);
  return Object.fromEntries(tables.map(t => { try {
    const p = parsed(d.getTableProperties(t.section, t.paragraph, t.control));
    if (!/\.hwpx$/iu.test(name) || typeof d.splitTableCellInto !== 'function' || merge?.[t.id]?.editable !== true || p.cellZoneCount!==0 || p.repeatHeader || p.pageBreak !== 0 || t.cells.some(c => c.properties.isHeader || c.properties.textDirection !== 0)) throw new Error('unsupported');
    const widths = t.cells.slice(0, t.columns).map(c => Number(c.properties.width)), heights = Array.from({ length: t.rows }, (_, r) => Number(t.cells[r * t.columns].properties.height));
    if (t.cells.some(c => c.properties.width !== widths[c.column] || c.properties.height !== heights[c.row]) || p.tableWidth !== widths.reduce((a, b) => a + b, 0) || p.tableHeight !== heights.reduce((a, b) => a + b, 0)) throw new Error('inconsistent source dimensions');

    const pads = t.cells.map(c => ({ left: c.properties.applyInnerMargin ? c.properties.paddingLeft : p.paddingLeft, right: c.properties.applyInnerMargin ? c.properties.paddingRight : p.paddingRight, top: c.properties.applyInnerMargin ? c.properties.paddingTop : p.paddingTop, bottom: c.properties.applyInnerMargin ? c.properties.paddingBottom : p.paddingBottom }));
    if (pads.some(v => Object.values(v).some(n => typeof n!=='number'||!Number.isSafeInteger(n) || n < 0))) throw new Error('invalid padding');
    const frames=tableLayoutEvidence(d,t).filter((v:any)=>Array.isArray(v.cells)) as NonNullable<AgentTableSubdivisionSource['frame']>[];if(frames.length!==1)throw new Error('unsupported frame');const frame=frames[0],page=parsed(d.getPageInfo(frame.page));
    if(![page.width,page.height].every(v=>Number.isFinite(v)&&v>0)||frame.cells.length!==t.cells.length||!sameTableLayout(frame.w,p.tableWidth*96/7200)||!sameTableLayout(frame.h,p.tableHeight*96/7200)||frame.x<0||frame.y<0||frame.x+frame.w>page.width+0.2||frame.y+frame.h>page.height+0.2||frame.cells.some(c=>{const cell=t.cells[c.index];return !cell||cell.row!==c.row||cell.column!==c.column||!sameTableLayout(c.w,Number(cell.properties.width)*96/7200)||!sameTableLayout(c.h,Number(cell.properties.height)*96/7200);}))throw new Error('source actual dimensions differ');
    const cells=t.cells.map((c,i)=>({row:c.row,column:c.column,minimumWidth:Math.max(200,Number(pads[i].left)+Number(pads[i].right)+1),minimumHeight:Math.max(200,Number(pads[i].top)+Number(pads[i].bottom)+1)}));
    const preservation=capturePreservationEvidence(d);if(preservation.issues.length)throw new Error('preservation');
    return [t.id, { editable: true, fingerprint: hash({ merge: merge[t.id], table: t, properties: p, preservation: preservation.values }), cells, frame }];
  } catch { return [t.id, { editable: false, reason: 'AI 임의 분할은 한 쪽 HWPX 비병합·비보호 평면 본문 표와 정확한 크기·0개 영역 서식 조회가 필요합니다. 긴 내용의 최소 높이·제목 셀·필드·책갈피·중첩·복합 배치는 제외합니다.' }]; } }));
}
export function assertTableSubdivisionResult(wasm:any, base:Snapshot, op:AgentTableSubdivisionOp):void {
  const d = nativeDocument(wasm), plan = tableSubdivisionPlan(op, base), t = plan.table, actual = readStructure(d).tables.find(v => v.id === t.id);
  const view = (c:any) => ({ index: c.index, row: c.row, column: c.column, rowSpan: c.rowSpan, columnSpan: c.columnSpan, text: c.text, properties: c.properties, characters: c.characters, paragraphProperties: c.paragraphProperties });
  if (!actual || actual.rows !== plan.rows || actual.columns !== plan.columns || !same(actual.cells.map(view), plan.cells.map(view))) throw new Error('임의 분할 뒤 셀 위치·내용·크기·서식이 계획과 다릅니다.');
  const after = tableLayoutEvidence(d, actual), oldFrame=plan.source.frame!, newFrame = after.find((v:any) => Array.isArray(v.cells)) as NonNullable<AgentTableSubdivisionSource['frame']>;
  if (!oldFrame || !newFrame || !sameTableLayout({ page: oldFrame.page, x: oldFrame.x, y: oldFrame.y, w: oldFrame.w, h: oldFrame.h }, { page: newFrame.page, x: newFrame.x, y: newFrame.y, w: newFrame.w, h: newFrame.h })) throw new Error('내용의 최소 크기 때문에 기존 표 외형이 달라졌습니다. 원본을 유지합니다.');
  for (const c of plan.cells) if (c.originIndex !== null && c.originIndex !== plan.primary.index) { const a = oldFrame.cells.find(v => v.index === c.originIndex), b = newFrame.cells.find(v => v.index === c.index); if (!a || !b || !sameTableLayout({ x: a.x, y: a.y, w: a.w, h: a.h }, { x: b.x, y: b.y, w: b.w, h: b.h })) throw new Error('임의 분할 뒤 이웃 셀의 실제 위치·크기가 달라졌습니다.'); }
  const original=oldFrame.cells.find(c=>c.index===plan.primary.index);if(!original)throw new Error('분할할 원본 셀의 실제 배치를 확인하지 못했습니다.');
  for(const c of plan.cells.filter(c=>c.row>=op.row&&c.row<op.row+op.rows&&c.column>=op.column&&c.column<op.column+op.columns)){const actual=newFrame.cells.find(v=>v.index===c.index),left=plan.widths.slice(0,c.column-op.column).reduce((a,b)=>a+b,0),top=plan.heights.slice(0,c.row-op.row).reduce((a,b)=>a+b,0),scaleX=original.w/Number(plan.primary.properties.width),scaleY=original.h/Number(plan.primary.properties.height);if(!actual||!sameTableLayout({x:actual.x,y:actual.y,w:actual.w,h:actual.h},{x:original.x+left*scaleX,y:original.y+top*scaleY,w:Number(c.properties.width)*scaleX,h:Number(c.properties.height)*scaleY}))throw new Error('새 셀의 실제 크기·위치가 원본 영역 분배와 다릅니다.');}
  let copy:any; try { copy = new d.constructor(d.exportHwpx()); if (!sameTableLayout(after, tableLayoutEvidence(copy, actual))) throw new Error('임의 분할 뒤 저장 재열기의 셀·글줄 배치가 다릅니다.'); } finally { copy?.free(); }
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
  const at = expected.cells.findIndex(target); expected.cells.splice(at, originals.length, ...replacements);
  const expectedText = tableTextTree(structure.tables.map(v => v.id === t.id ? { ...v, rows: plan.rows, columns: plan.columns, cells: plan.cells } : v));
  const result = parsed(d.splitTableCellInto(t.section, t.paragraph, t.control, op.row, op.column, op.rows, op.columns, true, false));
  if (result?.ok !== true) throw new Error('셀 임의 분할을 실행하지 못했습니다.');
  const after = capturePreservationEvidence(d);
  if (after.issues.length || !same(topologySemantics(after.values), expected) || !same(rootBodyTexts(d), body) || !same(tableTextTree(readStructure(d).tables), expectedText)) throw new Error('분할 뒤 다른 셀·본문·서식·필드·자원 보존이 계획과 다릅니다.');
  assertTableSubdivisionResult(d, base, op);
  const first = plan.cells.find(c => c.originIndex === plan.primary.index)!;
  return { sectionIndex: t.section, parentParaIndex: t.paragraph, paragraphIndex: 0, charOffset: 0, controlIndex: t.control, cellIndex: first.index, cellParaIndex: 0, cellPath: [{ controlIndex: t.control, cellIndex: first.index, cellParaIndex: 0 }] };
}
