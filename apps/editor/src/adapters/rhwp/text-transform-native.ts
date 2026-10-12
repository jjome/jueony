import { transformText, type TextTransform } from '../../modules/document/public/text-transform.ts';
import { characterStyleSpans } from './style-flow.ts';
import { verifyPreservedExport } from './preservation.ts';

const parsed = (value: any): any => typeof value === 'string' ? JSON.parse(value) : value;
const raw = (wasm: any) => wasm.borrowDocumentHandle?.() ?? wasm;
const checked = (result: any) => { if (parsed(result)?.ok === false) throw new Error('글자 변경을 문서 엔진이 거절했습니다.'); };
type Range = { start: any; end: any };
type Span = { section: number; paragraph: number; start: number; end: number; parent?: number; path?: any[] };
type Segment = { span: Span; before: string; after: string; paragraphText: string; runs: { startOffset: number; endOffset: number; charShapeId: number }[]; paraShape: number; style: number };
export type TextTransformPlan = { mode: TextTransform; range: Range; segments: Segment[] };

function access(doc: any, span: Span) {
  if (span.path) {
    if (span.path.length !== 1) throw new Error('중첩 셀의 글자 변환은 아직 지원하지 않습니다.');
    const { controlIndex, cellIndex } = span.path[0], args = [span.section, span.parent, controlIndex, cellIndex, span.paragraph];
    const list = parsed(doc.getCursorModel()).lists.find((item: any) => item.isCell && item.hostListId === 0 && item.sectionIndex === span.section && item.hostPara === span.parent && item.controlIndex === controlIndex && item.cellIndex === cellIndex);
    if (!list || parsed(doc.getCellProperties(...args.slice(0, 4))).cellProtect || parsed(doc.getControls()).some((item: any) => item.list === list.listId)) throw new Error('보호·필드·개체가 있는 셀은 글자 변환을 지원하지 않습니다.');
    const path = JSON.stringify(span.path);
    return {
      length: () => doc.getCellParagraphLengthByPath(span.section, span.parent, path),
      text: (start: number, count: number) => doc.getTextInCellByPath(span.section, span.parent, path, start, count),
      runs: () => parsed(doc.getCharShapeRunsInCellByPath(span.section, span.parent, path, span.start, span.end)),
      para: () => parsed(doc.getCellParaPropertiesAt(...args)).paraShapeId,
      style: () => parsed(doc.getCellStyleAt(...args)).id,
      replace: (text: string) => { checked(doc.deleteTextInCellByPath(span.section, span.parent, path, span.start, span.end - span.start)); if (text) checked(doc.insertTextInCellByPath(span.section, span.parent, path, span.start, text)); },
      setRuns: (end: number, runs: any[]) => checked(doc.setCharShapeRunsInCellByPath(span.section, span.parent, path, span.start, end, JSON.stringify(runs))),
    };
  }
  let flat = span.paragraph; for (let section = 0; section < span.section; section++) flat += doc.getParagraphCount(section);
  if (parsed(doc.getControls()).some((item: any) => item.list === 0 && item.para === flat && !['secd', 'cold'].includes(item.ctrlId))) throw new Error('필드·개체가 있는 본문 문단은 글자 변환을 지원하지 않습니다.');
  return {
    length: () => doc.getParagraphLength(span.section, span.paragraph),
    text: (start: number, count: number) => doc.getTextRange(span.section, span.paragraph, start, count),
    runs: () => parsed(doc.getCharShapeRuns(span.section, span.paragraph, span.start, span.end)),
    para: () => parsed(doc.getParaPropertiesAt(span.section, span.paragraph)).paraShapeId,
    style: () => parsed(doc.getStyleAt(span.section, span.paragraph)).id,
    replace: (text: string) => checked(doc.replaceText(span.section, span.paragraph, span.start, span.end - span.start, text)),
    setRuns: (end: number, runs: any[]) => checked(doc.setCharShapeRuns(span.section, span.paragraph, span.start, end, JSON.stringify(runs))),
  };
}

export function readTextTransformPlan(wasm: any, range: Range, mode: TextTransform): TextTransformPlan {
  if (!range?.start || !range?.end) throw new Error('변환할 글자를 선택하세요.');
  const doc = raw(wasm), spans = characterStyleSpans(doc, range.start, range.end);
  if (!spans.length || spans.reduce((n, span) => n + span.end - span.start, 0) > 20_000) throw new Error('변환할 글자를 1~20,000자 선택하세요.');
  const segments = spans.map(span => {
    const source = access(doc, span), before = source.text(span.start, span.end - span.start), { text: after, pieces } = transformText(before, mode), originalRuns = source.runs();
    let offset = span.start;
    const runs: Segment['runs'] = [];
    pieces.forEach((piece, index) => {
      const original = originalRuns.find((run: any) => run.startOffset <= span.start + index && run.endOffset > span.start + index);
      if (!original || !Number.isSafeInteger(original.charShapeId) || original.charShapeId < 0) throw new Error('선택 글자의 원래 서식을 확인하지 못했습니다.');
      const end = offset + Array.from(piece).length, previous = runs.at(-1);
      if (previous && previous.charShapeId === original.charShapeId) previous.endOffset = end;
      else runs.push({ startOffset: offset, endOffset: end, charShapeId: original.charShapeId });
      offset = end;
    });
    return { span, before, after, runs, paragraphText: source.text(0, source.length()), paraShape: source.para(), style: source.style() };
  });
  return { mode, range: structuredClone(range), segments };
}

/** The caller's snapshot operation owns atomic rollback, dirty state and one undo. */
export function executeTextTransform(wasm: any, plan: TextTransformPlan): void {
  const doc = raw(wasm);
  if (JSON.stringify(readTextTransformPlan(doc, plan.range, plan.mode)) !== JSON.stringify(plan)) throw new Error('선택 원문이나 서식이 바뀌었습니다. 글자 변환 창을 다시 여세요.');
  for (const segment of [...plan.segments].reverse()) {
    if (segment.before === segment.after) continue;
    const source = access(doc, segment.span), { span } = segment;
    source.replace(segment.after); source.setRuns(span.start + Array.from(segment.after).length, segment.runs);
    const chars = Array.from(segment.paragraphText), expected = chars.slice(0, span.start).join('') + segment.after + chars.slice(span.end).join('');
    if (source.text(0, source.length()) !== expected || source.para() !== segment.paraShape || source.style() !== segment.style) throw new Error('글자 변환 결과나 문단 서식이 원문과 다릅니다.');
  }
}

export function preflightTextTransform(wasm: any, plan: TextTransformPlan): void {
  const { HwpDocument } = wasm.getWasmModuleExports(), format = /\.hwpx$/iu.test(wasm.fileName) ? 'hwpx' : 'hwp', open = (bytes: Uint8Array) => new HwpDocument(bytes);
  const save = (doc: any) => {
    const artifact = doc[format === 'hwpx' ? 'exportHwpxWithReport' : 'exportHwpWithReport']();
    try { const loss = artifact.contentLoss(), bytes = artifact.takeBytes(); verifyPreservedExport(doc, bytes, format, loss, open); return bytes; } finally { artifact.free(); }
  };
  let scratch: any;
  try { scratch = open(save(raw(wasm))); const candidate = readTextTransformPlan(scratch, plan.range, plan.mode); if (JSON.stringify(candidate.segments.map(segment => segment.before)) !== JSON.stringify(plan.segments.map(segment => segment.before))) throw new Error('변환 사본의 원문이 다릅니다.'); executeTextTransform(scratch, candidate); save(scratch); }
  finally { scratch?.free(); }
}
