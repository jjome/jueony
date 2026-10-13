import { planParagraphSort, type SortOptions } from '../../modules/document/public/paragraph-sort.ts';
import { readBodyParagraphs } from './table-conversion-native.ts';
import { preflightDocumentEdit } from './edit-preflight.ts';

type Selection = Parameters<typeof readBodyParagraphs>[1];
export type ParagraphSortPlan = ReturnType<typeof readBodyParagraphs> & { selection: Selection; options: SortOptions; order: number[] };
const parse = (v: any): any => typeof v === 'string' ? JSON.parse(v) : v;
const checked = (v: any) => { if (parse(v)?.ok !== true) throw new Error('문서 엔진이 문단 정렬을 거절했습니다.'); };
export function readParagraphSortPlan(wasm: any, selection: Selection, options: SortOptions): ParagraphSortPlan {
  const body = readBodyParagraphs(wasm, selection);
  return { ...body, selection: structuredClone(selection), options: structuredClone(options), order: planParagraphSort(body.texts, options) };
}
export function executeParagraphSort(value: any, plan: ParagraphSortPlan): void {
  const doc = value.borrowDocumentHandle?.() ?? value;
  if (JSON.stringify(readParagraphSortPlan(doc, plan.selection, plan.options)) !== JSON.stringify(plan)) throw new Error('문단 원문이나 서식이 바뀌었습니다. 정렬 창을 다시 여세요.');
  plan.order.forEach((source, row) => {
    if (source === row) return;
    const paragraph = plan.first + row, text = plan.texts[source], f = plan.formats[source];
    checked(doc.replaceText(plan.section, paragraph, 0, doc.getParagraphLength(plan.section, paragraph), text));
    checked(doc.applyStyle(plan.section, paragraph, f.style)); checked(doc.setParaShapeId(plan.section, paragraph, f.paraShape));
    if (text) checked(doc.setCharShapeRuns(plan.section, paragraph, 0, [...text].length, JSON.stringify(f.runs)));
    else checked(doc.setCharShapeId(plan.section, paragraph, 0, 0, f.charShape));
  });
  const result = readBodyParagraphs(doc, { anchor: { sectionIndex: plan.section, paragraphIndex: plan.first, charOffset: 0 }, focus: { sectionIndex: plan.section, paragraphIndex: plan.last, charOffset: doc.getParagraphLength(plan.section, plan.last) } });
  if (JSON.stringify(result.texts) !== JSON.stringify(plan.order.map(i => plan.texts[i])) || JSON.stringify(result.formats) !== JSON.stringify(plan.order.map(i => plan.formats[i]))) throw new Error('정렬한 문단의 내용 또는 서식이 다릅니다.');
}
export function preflightParagraphSort(wasm: any, plan: ParagraphSortPlan): void {
  preflightDocumentEdit(wasm, scratch => {
    const candidate = readParagraphSortPlan(scratch, plan.selection, plan.options);
    if (JSON.stringify(candidate.texts) !== JSON.stringify(plan.texts)) throw new Error('정렬 사본의 원문이 다릅니다.');
    executeParagraphSort(scratch, candidate);
  });
}
