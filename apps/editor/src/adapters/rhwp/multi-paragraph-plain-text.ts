const json = (value: any): any => typeof value === 'string' ? JSON.parse(value) : value;
const raw = (value: any): any => value.borrowDocumentHandle?.() ?? value;
const scalarLength = (value: string): number => Array.from(value).length;
const same = (left: unknown, right: unknown): boolean => JSON.stringify(left) === JSON.stringify(right);
const checked = (value: any, message: string): void => { if (json(value)?.ok !== true) throw new Error(message); };

export type BodyTextPoint = { sectionIndex: number; paragraphIndex: number; charOffset: number };
export type MultiParagraphTextRange = { start: BodyTextPoint; end: BodyTextPoint };
type ParagraphProof = { text: string; runs: any[]; paraShape: number; style: number };
type DocumentProof = { paragraphs: ParagraphProof[]; controls: any[] };

export type MultiParagraphPlainTextPlan = {
  revision: string;
  range: MultiParagraphTextRange;
  text: string;
  source: string;
  before: DocumentProof;
  insertion: { charShape: number; paraShape: number; style: number };
};

export type MultiParagraphPlainTextReceipt = {
  caret: BodyTextPoint;
  undo(): boolean;
  discard(): boolean;
};

function point(value: any): value is BodyTextPoint {
  return value && value.parentParaIndex === undefined && !value.isTextBox &&
    [value.sectionIndex, value.paragraphIndex, value.charOffset].every((part: unknown) => Number.isSafeInteger(part) && Number(part) >= 0);
}

function proof(document: any): DocumentProof {
  if (document.getSectionCount() !== 1) throw new Error('여러 구역 문서의 다중 문단 텍스트 치환은 아직 지원하지 않습니다.');
  const count = document.getParagraphCount(0);
  if (!Number.isSafeInteger(count) || count < 1 || count > 512) throw new Error('1~512개 문단의 일반 본문만 지원합니다.');
  const controls = json(document.getControls());
  if (!Array.isArray(controls) || controls.some((control: any) => control.list !== 0 || !['secd', 'cold'].includes(control.ctrlId)))
    throw new Error('표·필드·개체·특수 영역이 있는 문서의 다중 문단 텍스트 치환은 아직 지원하지 않습니다.');
  const fields = json(document.getFieldList()), bookmarks = json(document.getBookmarks());
  if (!Array.isArray(fields) || fields.length || !Array.isArray(bookmarks) || bookmarks.length)
    throw new Error('필드 또는 책갈피가 있는 문서의 다중 문단 텍스트 치환은 아직 지원하지 않습니다.');
  let total = 0;
  const paragraphs = Array.from({ length: count }, (_, paragraph): ParagraphProof => {
    const length = document.getParagraphLength(0, paragraph);
    if (!Number.isSafeInteger(length) || length < 0 || (total += length) > 100_000) throw new Error('본문이 너무 커 안전하게 봉인할 수 없습니다.');
    const text = document.getTextRange(0, paragraph, 0, length), runs = json(document.getCharShapeRuns(0, paragraph, 0, length));
    const paraShape = json(document.getParaPropertiesAt(0, paragraph))?.paraShapeId, style = json(document.getStyleAt(0, paragraph))?.id;
    if (scalarLength(text) !== length || !Array.isArray(runs) || !Number.isSafeInteger(paraShape) || !Number.isSafeInteger(style))
      throw new Error('본문 원문 또는 서식을 완전히 읽지 못했습니다.');
    return { text, runs, paraShape, style };
  });
  return { paragraphs, controls };
}

function normalizedText(value: string): string {
  const text = value.replace(/\r\n?/gu, '\n');
  if (!text || scalarLength(text) > 20_000 || text.split('\n').length > 200 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(text))
    throw new Error('1~20,000자, 200줄 이하 텍스트를 넣으세요. 탭과 줄바꿈 외 제어 문자는 지원하지 않습니다.');
  return text;
}

function selectionSource(paragraphs: ParagraphProof[], range: MultiParagraphTextRange): string {
  const selected = paragraphs.slice(range.start.paragraphIndex, range.end.paragraphIndex + 1).map((paragraph, index, all) => {
    const characters = Array.from(paragraph.text);
    if (index === 0) return characters.slice(range.start.charOffset).join('');
    if (index === all.length - 1) return characters.slice(0, range.end.charOffset).join('');
    return paragraph.text;
  });
  return selected.join('\n');
}

function shapeIds(paragraph: ParagraphProof): number[] {
  const result = new Array<number>(scalarLength(paragraph.text));
  for (const run of paragraph.runs) {
    if (!Number.isSafeInteger(run.startOffset) || !Number.isSafeInteger(run.endOffset) || !Number.isSafeInteger(run.charShapeId) || run.startOffset < 0 || run.endOffset < run.startOffset || run.endOffset > result.length)
      throw new Error('글자 서식 범위를 완전히 봉인하지 못했습니다.');
    for (let index = run.startOffset; index < run.endOffset; index++) result[index] = run.charShapeId;
  }
  if (result.some(value => !Number.isSafeInteger(value))) throw new Error('글자 서식 범위에 빈 구간이 있습니다.');
  return result;
}

export function readMultiParagraphPlainTextPlan(wasm: any, range: MultiParagraphTextRange, value: string, revision: string): MultiParagraphPlainTextPlan {
  const document = raw(wasm), text = normalizedText(value), start = range?.start, end = range?.end;
  if (!revision || !point(start) || !point(end) || start.sectionIndex !== 0 || end.sectionIndex !== 0 || start.paragraphIndex >= end.paragraphIndex)
    throw new Error('단일 구역 일반 본문에서 둘 이상의 문단을 선택하세요.');
  if (end.paragraphIndex - start.paragraphIndex + 1 > 200) throw new Error('한 번에 200개 이하 문단만 치환할 수 있습니다.');
  const before = proof(document);
  if (end.paragraphIndex >= before.paragraphs.length || start.charOffset >= scalarLength(before.paragraphs[start.paragraphIndex].text) || end.charOffset > scalarLength(before.paragraphs[end.paragraphIndex].text))
    throw new Error('선택 위치가 문서 범위를 벗어났습니다.');
  const insertionProperties = json(document.getCharPropertiesAt(0, start.paragraphIndex, start.charOffset));
  const insertion = { charShape: insertionProperties?.charShapeId, paraShape: before.paragraphs[start.paragraphIndex].paraShape, style: before.paragraphs[start.paragraphIndex].style };
  if (!Number.isSafeInteger(insertion.charShape)) throw new Error('삽입 위치의 글자 서식을 읽지 못했습니다.');
  return { revision, range: structuredClone(range), text, source: selectionSource(before.paragraphs, range), before, insertion };
}

function expectedTexts(plan: MultiParagraphPlainTextPlan): string[] {
  const paragraphs = plan.before.paragraphs, lines = plan.text.split('\n'), start = plan.range.start, end = plan.range.end;
  const prefix = Array.from(paragraphs[start.paragraphIndex].text).slice(0, start.charOffset).join('');
  const suffix = Array.from(paragraphs[end.paragraphIndex].text).slice(end.charOffset).join('');
  const replacement = lines.map((line, index) => index === 0 ? prefix + line : index === lines.length - 1 ? line + suffix : line);
  if (lines.length === 1) replacement[0] = prefix + lines[0] + suffix;
  return [...paragraphs.slice(0, start.paragraphIndex).map(value => value.text), ...replacement, ...paragraphs.slice(end.paragraphIndex + 1).map(value => value.text)];
}

function assertResult(document: any, plan: MultiParagraphPlainTextPlan, after: DocumentProof): void {
  const expected = expectedTexts(plan);
  if (!same(after.paragraphs.map(value => value.text), expected)) throw new Error('다중 문단 텍스트 치환 결과가 예상 원문과 다릅니다.');
  const start = plan.range.start, end = plan.range.end, lines = plan.text.split('\n'), before = plan.before.paragraphs;
  for (let index = 0; index < start.paragraphIndex; index++) if (!same(after.paragraphs[index], before[index])) throw new Error('선택 앞 문단이 변경되었습니다.');
  const delta = lines.length - (end.paragraphIndex - start.paragraphIndex + 1);
  for (let index = end.paragraphIndex + 1; index < before.length; index++) if (!same(after.paragraphs[index + delta], before[index])) throw new Error('선택 뒤 문단이 변경되었습니다.');
  const prefixShapes = shapeIds(before[start.paragraphIndex]).slice(0, start.charOffset);
  if (!same(shapeIds(after.paragraphs[start.paragraphIndex]).slice(0, start.charOffset), prefixShapes)) throw new Error('선택 앞 글자 서식이 변경되었습니다.');
  const suffixShapes = shapeIds(before[end.paragraphIndex]).slice(end.charOffset), last = start.paragraphIndex + lines.length - 1;
  const suffixAt = (lines.length === 1 ? start.charOffset : 0) + scalarLength(lines.at(-1)!);
  if (!same(shapeIds(after.paragraphs[last]).slice(suffixAt), suffixShapes)) throw new Error('선택 뒤 글자 서식이 변경되었습니다.');
  for (let index = 0; index < lines.length; index++) {
    const paragraph = after.paragraphs[start.paragraphIndex + index];
    if (paragraph.paraShape !== plan.insertion.paraShape || paragraph.style !== plan.insertion.style) throw new Error('삽입 문단의 문단 서식이 변경되었습니다.');
    const offset = index === 0 ? start.charOffset : 0, inserted = shapeIds(paragraph).slice(offset, offset + scalarLength(lines[index]));
    if (inserted.some(id => id !== plan.insertion.charShape)) throw new Error('삽입 글자의 서식이 선택 시작 위치와 다릅니다.');
  }
  const controls = after.controls.map(({ ctrlId, list, controlIndex }: any) => ({ ctrlId, list, controlIndex }));
  const originalControls = plan.before.controls.map(({ ctrlId, list, controlIndex }: any) => ({ ctrlId, list, controlIndex }));
  if (!same(controls, originalControls)) throw new Error('구역 구조 제어가 변경되었습니다.');
  void document;
}

function insertReplacement(document: any, plan: MultiParagraphPlainTextPlan): BodyTextPoint {
  const start = plan.range.start, end = plan.range.end, lines = plan.text.split('\n');
  const prefix = Array.from(plan.before.paragraphs[start.paragraphIndex].text).slice(0, start.charOffset).join('');
  const suffix = Array.from(plan.before.paragraphs[end.paragraphIndex].text).slice(end.charOffset).join('');
  const mergedLength = document.getParagraphLength(0, start.paragraphIndex);
  if (document.getTextRange(0, start.paragraphIndex, 0, mergedLength) !== prefix + suffix ||
      json(document.getParaPropertiesAt(0, start.paragraphIndex))?.paraShapeId !== plan.insertion.paraShape ||
      json(document.getStyleAt(0, start.paragraphIndex))?.id !== plan.insertion.style)
    throw new Error('선택 삭제 후 남은 원문 또는 문단 서식이 바뀌었습니다.');
  checked(document.replaceText(0, start.paragraphIndex, start.charOffset, 0, lines[0]), '첫 줄 삽입을 문서 엔진이 거절했습니다.');
  let paragraph = start.paragraphIndex, offset = start.charOffset;
  for (let index = 0; index < lines.length; index++) {
    if (index) {
      checked(document.splitParagraph(0, paragraph, offset + scalarLength(lines[index - 1])), '줄바꿈 삽입을 문서 엔진이 거절했습니다.');
      paragraph++; offset = 0;
      if (lines[index]) checked(document.insertText(0, paragraph, 0, lines[index]), '다음 줄 삽입을 문서 엔진이 거절했습니다.');
    }
    if (lines[index]) checked(document.setCharShapeId(0, paragraph, offset, offset + scalarLength(lines[index]), plan.insertion.charShape), '삽입 글자 서식 적용을 문서 엔진이 거절했습니다.');
  }
  return { sectionIndex: 0, paragraphIndex: paragraph, charOffset: offset + scalarLength(lines.at(-1)!) };
}

export function replaceMultiParagraphPlainText(wasm: any, plan: MultiParagraphPlainTextPlan, currentRevision: () => string, currentSelection: () => MultiParagraphTextRange): MultiParagraphPlainTextReceipt {
  const document = raw(wasm);
  if (currentRevision() !== plan.revision || !same(currentSelection(), plan.range) || !same(readMultiParagraphPlainTextPlan(document, plan.range, plan.text, plan.revision), plan))
    throw new Error('문서 원문·선택·서식 또는 revision이 바뀌었습니다. 다시 실행하세요.');
  const snapshot = document.saveSnapshot();
  if (!Number.isSafeInteger(snapshot)) throw new Error('문서 snapshot을 만들지 못했습니다.');
  try {
    checked(document.deleteRange(0, plan.range.start.paragraphIndex, plan.range.start.charOffset, plan.range.end.paragraphIndex, plan.range.end.charOffset), '다중 문단 선택 삭제를 문서 엔진이 거절했습니다.');
    if (currentRevision() !== plan.revision) throw new Error('적용 중 문서 revision이 바뀌었습니다.');
    const caret = insertReplacement(document, plan), after = proof(document);
    if (currentRevision() !== plan.revision) throw new Error('적용 중 문서 revision이 바뀌었습니다.');
    assertResult(document, plan, after);
    let consumed = false;
    return {
      caret,
      undo(): boolean {
        if (consumed || !same(proof(document), after)) return false;
        try {
          checked(document.restoreSnapshot(snapshot), '다중 문단 치환 전 상태를 복원하지 못했습니다.');
          const exact = same(proof(document), plan.before);
          consumed = true; document.discardSnapshot(snapshot); return exact;
        } catch { return false; }
      },
      discard(): boolean {
        if (consumed) return false;
        consumed = true; document.discardSnapshot(snapshot); return true;
      },
    };
  } catch (error) {
    try {
      checked(document.restoreSnapshot(snapshot), '실패한 다중 문단 치환을 되돌리지 못했습니다.');
      if (!same(proof(document), plan.before)) throw new Error('실패 복구 결과가 원문과 다릅니다.');
    } finally { document.discardSnapshot(snapshot); }
    throw error;
  }
}
