import {sha256} from '@noble/hashes/sha2.js';

type EquationRefN015 = Readonly<{section: number; paragraph: number; control: number; type: 'equation'}>;

export type SingleEquationSelectionBookmarkN015 = Readonly<{
  version: 1;
  kind: 'single-root-equation-selection';
  target: EquationRefN015;
  documentFingerprint: string;
  objectFingerprint: string;
  integrity: string;
}>;

export type SingleEquationSelectionTransitionN015 = Readonly<{
  undo(): void;
  redo(): void;
}>;

type RawRefN015 = {
  sec?: unknown;
  ppi?: unknown;
  ci?: unknown;
  type?: unknown;
  cellIdx?: unknown;
  cellParaIdx?: unknown;
  outerTableControlIdx?: unknown;
  cellPath?: unknown;
  noteRef?: unknown;
  headerFooter?: unknown;
  missing?: unknown;
  pageIndex?: unknown;
};

type DocumentN015 = {
  exportHwp(): Uint8Array;
  exportHwpx(): Uint8Array;
  getSectionCount(): unknown;
  getParagraphCount(section: number): unknown;
  getParagraphLength(section: number, paragraph: number): unknown;
  getTextRange(section: number, paragraph: number, start: number, end: number): unknown;
  getObjects(): unknown;
  getControls(): unknown;
  getCursorModel(): unknown;
  getEquationProperties(section: number, paragraph: number, control: number, cellIndex: number, cellParagraph: number): unknown;
};

export type SingleEquationSelectionSessionN015 = {
  wasm: {requiresPasswordForSave?: boolean; borrowDocumentHandle?(): unknown} | DocumentN015;
  cursor: {
    isInPictureObjectSelection(): boolean;
    isInTableObjectSelection(): boolean;
    isInHeaderFooter(): boolean;
    isInFootnote(): boolean;
    isInTextBox(): boolean;
    getSelectedPictureRefs(): RawRefN015[];
    getSelectedPictureRef(): RawRefN015 | null;
    exitPictureObjectSelection(): void;
  };
  selectPictureObject(section: number, paragraph: number, control: number, type: 'equation'): void;
};

type ArtifactN015 = Readonly<{hwp: string; hwpx: string}>;
const HEX = /^[0-9a-f]{64}$/u;
const BOOKMARK_KEYS = ['version', 'kind', 'target', 'documentFingerprint', 'objectFingerprint', 'integrity'] as const;
const TARGET_KEYS = ['section', 'paragraph', 'control', 'type'] as const;

function parsed(value: unknown): unknown { return typeof value === 'string' ? JSON.parse(value) : value; }
function object(value: unknown): Record<string, unknown> | undefined {
  const result = parsed(value);
  return result && typeof result === 'object' && !Array.isArray(result) ? result as Record<string, unknown> : undefined;
}
function array(value: unknown): unknown[] | undefined { const result = parsed(value); return Array.isArray(result) ? result : undefined; }
function integer(value: unknown): value is number { return Number.isSafeInteger(value) && (value as number) >= 0 && (value as number) <= 2147483647; }
function instance(value: unknown): value is number { return Number.isSafeInteger(value) && (value as number) > 0 && (value as number) <= 4294967295; }
function exact(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort(), expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical((value as Record<string, unknown>)[key])]));
  return value;
}
function digest(value: Uint8Array | unknown): string {
  const bytes = value instanceof Uint8Array ? value : new TextEncoder().encode(JSON.stringify(canonical(value)));
  return Array.from(sha256(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
}

function documentOf(session: SingleEquationSelectionSessionN015): DocumentN015 {
  const wrapper = session.wasm as {borrowDocumentHandle?: () => unknown};
  const value = typeof wrapper.borrowDocumentHandle === 'function' ? wrapper.borrowDocumentHandle() : session.wasm;
  if (!value || typeof value !== 'object') throw new Error('문서 엔진을 사용할 수 없습니다.');
  for (const name of ['exportHwp', 'exportHwpx', 'getSectionCount', 'getParagraphCount', 'getParagraphLength',
    'getTextRange', 'getObjects', 'getControls', 'getCursorModel', 'getEquationProperties'] as const) {
    if (typeof (value as Record<string, unknown>)[name] !== 'function') throw new Error(`필수 문서 엔진 기능이 없습니다: ${name}`);
  }
  return value as DocumentN015;
}

function artifact(document: DocumentN015): ArtifactN015 {
  const hwp = document.exportHwp(), hwpx = document.exportHwpx();
  if (!(hwp instanceof Uint8Array) || hwp.length === 0 || !(hwpx instanceof Uint8Array) || hwpx.length === 0) {
    throw new Error('HWP/HWPX 저장 상태를 확인하지 못했습니다.');
  }
  return Object.freeze({hwp: digest(hwp), hwpx: digest(hwpx)});
}

function rootEquationRef(value: RawRefN015 | null | undefined): EquationRefN015 | undefined {
  if (!value || value.type !== 'equation' || !integer(value.sec) || !integer(value.ppi) || !integer(value.ci)
    || value.cellIdx !== undefined || value.cellParaIdx !== undefined || value.outerTableControlIdx !== undefined
    || value.cellPath !== undefined || value.noteRef !== undefined || value.headerFooter !== undefined
    || value.missing !== undefined || value.pageIndex !== undefined) return;
  return Object.freeze({section: value.sec, paragraph: value.ppi, control: value.ci, type: 'equation'});
}

function sameRef(left: EquationRefN015, right: EquationRefN015): boolean {
  return left.section === right.section && left.paragraph === right.paragraph && left.control === right.control;
}

function current(session: SingleEquationSelectionSessionN015): EquationRefN015 | null | undefined {
  if (!session.cursor.isInPictureObjectSelection()) return null;
  const refs = session.cursor.getSelectedPictureRefs(), active = session.cursor.getSelectedPictureRef();
  if (!Array.isArray(refs) || refs.length !== 1 || !active) return;
  const selected = rootEquationRef(refs[0]), focused = rootEquationRef(active);
  if (!selected || !focused || !sameRef(selected, focused)) return;
  return selected;
}

function blocked(session: SingleEquationSelectionSessionN015): boolean {
  return Boolean((session.wasm as {requiresPasswordForSave?: boolean}).requiresPasswordForSave)
    || session.cursor.isInTableObjectSelection() || session.cursor.isInHeaderFooter()
    || session.cursor.isInFootnote() || session.cursor.isInTextBox();
}

function documentFingerprint(document: DocumentN015): string {
  const sectionCount = document.getSectionCount();
  if (!integer(sectionCount) || sectionCount < 1 || sectionCount > 1024) throw new Error('문서 구역을 확인하지 못했습니다.');
  const sections: {length: number; text: string}[][] = []; let paragraphs = 0, characters = 0;
  for (let section = 0; section < sectionCount; section += 1) {
    const count = document.getParagraphCount(section);
    if (!integer(count) || (paragraphs += count) > 100000) throw new Error('문단 목록을 확인하지 못했습니다.');
    const values: {length: number; text: string}[] = [];
    for (let paragraph = 0; paragraph < count; paragraph += 1) {
      const length = document.getParagraphLength(section, paragraph);
      if (!integer(length) || (characters += length) > 16 * 1024 * 1024) throw new Error('문단 길이를 확인하지 못했습니다.');
      const text = document.getTextRange(section, paragraph, 0, length);
      if (typeof text !== 'string' || Array.from(text).length !== length) throw new Error('문단 원문을 확인하지 못했습니다.');
      values.push({length, text});
    }
    sections.push(values);
  }
  const controls = array(document.getControls()), objects = array(document.getObjects());
  if (!controls || !objects || controls.length > 100000 || objects.length > 100000
    || JSON.stringify([controls, objects]).length > 16 * 1024 * 1024) throw new Error('개체 소유 정보를 확인하지 못했습니다.');
  return digest({version: 1, sections, controls, objects});
}

function equationFingerprint(document: DocumentN015, ref: EquationRefN015): string {
  const sectionCount = document.getSectionCount();
  if (!integer(sectionCount) || ref.section >= sectionCount) throw new Error('수식 구역이 없습니다.');
  const paragraphCount = document.getParagraphCount(ref.section);
  if (!integer(paragraphCount) || ref.paragraph >= paragraphCount) throw new Error('수식 문단이 없습니다.');
  let flat = ref.paragraph;
  for (let section = 0; section < ref.section; section += 1) {
    const count = document.getParagraphCount(section); if (!integer(count)) throw new Error('수식 소유 문단을 확인하지 못했습니다.'); flat += count;
  }
  const objects = array(document.getObjects()), controls = array(document.getControls()), model = object(document.getCursorModel());
  if (!objects || !controls || !model || !Array.isArray(model.lists)) throw new Error('수식 소유 정보를 확인하지 못했습니다.');
  const owner = objects.find(item => { const value = object(item); return value?.para === flat && value.controlIndex === ref.control; });
  const control = controls.find(item => { const value = object(item); return value?.list === 0 && value.para === flat && value.controlIndex === ref.control; });
  const ownerValue = object(owner), controlValue = object(control), controlProps = object(controlValue?.props);
  if (!ownerValue || ownerValue.kind !== 'equation' || ownerValue.anchored !== true || ownerValue.listId !== null
    || !controlValue || controlValue.ctrlId !== 'eqed' || (controlProps?.Lock !== undefined && controlProps.Lock !== 0)) {
    throw new Error('top-level root 수식 소유자를 확인하지 못했습니다.');
  }
  if (model.lists.some(item => { const value = object(item); return value?.hostListId === 0 && value.sectionIndex === ref.section
    && value.hostPara === ref.paragraph && value.controlIndex === ref.control; })) throw new Error('중첩 수식은 지원하지 않습니다.');
  const properties = object(document.getEquationProperties(ref.section, ref.paragraph, ref.control, -1, -1));
  if (!properties || properties.hasCaption !== false || properties.sizeProtect !== false
    || !integer(properties.width) || properties.width === 0 || !integer(properties.height) || properties.height === 0
    || !instance(properties.instanceId) || typeof properties.script !== 'string' || properties.script.length === 0
    || properties.script.length > 32768 || !integer(properties.fontSize) || properties.fontSize === 0
    || !integer(properties.color) || !integer(properties.baseline) || typeof properties.fontName !== 'string'
    || properties.fontName.length === 0 || JSON.stringify(properties).length > 65536) {
    throw new Error('수식 속성을 완전히 확인하지 못했습니다.');
  }
  const length = document.getParagraphLength(ref.section, ref.paragraph), text = integer(length)
    ? document.getTextRange(ref.section, ref.paragraph, 0, length) : undefined;
  if (!integer(length) || typeof text !== 'string' || Array.from(text).length !== length) throw new Error('수식 host 문단을 확인하지 못했습니다.');
  return digest({ref, owner: ownerValue, control: {ctrlId: controlValue.ctrlId, lock: controlProps?.Lock ?? null}, properties, text});
}

function unsigned(value: Omit<SingleEquationSelectionBookmarkN015, 'integrity'>): Omit<SingleEquationSelectionBookmarkN015, 'integrity'> {
  return {version: 1, kind: 'single-root-equation-selection', target: value.target,
    documentFingerprint: value.documentFingerprint, objectFingerprint: value.objectFingerprint};
}

export function validateSingleEquationSelectionBookmarkN015(value: unknown): SingleEquationSelectionBookmarkN015 | undefined {
  const raw = object(value); if (!raw || !exact(raw, BOOKMARK_KEYS) || raw.version !== 1
    || raw.kind !== 'single-root-equation-selection' || typeof raw.documentFingerprint !== 'string'
    || !HEX.test(raw.documentFingerprint) || typeof raw.objectFingerprint !== 'string'
    || !HEX.test(raw.objectFingerprint) || typeof raw.integrity !== 'string' || !HEX.test(raw.integrity)) return;
  const targetRaw = object(raw.target); if (!targetRaw || !exact(targetRaw, TARGET_KEYS)) return;
  const target = rootEquationRef({sec: targetRaw.section, ppi: targetRaw.paragraph, ci: targetRaw.control, type: targetRaw.type});
  if (!target) return;
  const checked = unsigned({version: 1, kind: 'single-root-equation-selection', target,
    documentFingerprint: raw.documentFingerprint, objectFingerprint: raw.objectFingerprint});
  if (digest(checked) !== raw.integrity) return;
  return Object.freeze({...checked, integrity: raw.integrity});
}

export function captureSingleEquationSelectionN015(session: SingleEquationSelectionSessionN015 | undefined): SingleEquationSelectionBookmarkN015 | undefined {
  if (!session || blocked(session)) return;
  try {
    const target = current(session); if (!target) return;
    const document = documentOf(session), checked = unsigned({version: 1, kind: 'single-root-equation-selection', target,
      documentFingerprint: documentFingerprint(document), objectFingerprint: equationFingerprint(document, target)});
    return Object.freeze({...checked, integrity: digest(checked)});
  } catch { return; }
}

function select(session: SingleEquationSelectionSessionN015, target: EquationRefN015 | null): void {
  if (target) session.selectPictureObject(target.section, target.paragraph, target.control, 'equation');
  else session.cursor.exitPictureObjectSelection();
  const observed = current(session);
  if (target ? !observed || !sameRef(target, observed) : observed !== null) throw new Error('Studio 수식 선택 포트가 요청 상태를 확인하지 못했습니다.');
}

class TransitionN015 implements SingleEquationSelectionTransitionN015 {
  readonly #session: SingleEquationSelectionSessionN015;
  readonly #document: DocumentN015;
  readonly #before: EquationRefN015 | null;
  readonly #after: EquationRefN015;
  readonly #artifact: ArtifactN015;
  #state: 'before' | 'after' = 'after';

  constructor(session: SingleEquationSelectionSessionN015, document: DocumentN015,
    before: EquationRefN015 | null, after: EquationRefN015, artifactValue: ArtifactN015) {
    this.#session = session; this.#document = document; this.#before = before; this.#after = after; this.#artifact = artifactValue;
  }

  undo(): void {
    const observed = current(this.#session);
    if (this.#state !== 'after' || !observed || !sameRef(observed, this.#after) || !sameArtifact(artifact(this.#document), this.#artifact)) {
      throw new Error('적용 후 선택 또는 문서 상태가 아니어서 되돌릴 수 없습니다.');
    }
    select(this.#session, this.#before); this.#assertBytes(); this.#state = 'before';
  }

  redo(): void {
    const observed = current(this.#session);
    if (this.#state !== 'before' || (this.#before ? !observed || !sameRef(observed, this.#before) : observed !== null)
      || !sameArtifact(artifact(this.#document), this.#artifact)) throw new Error('되돌린 선택 또는 문서 상태가 아니어서 다시 실행할 수 없습니다.');
    select(this.#session, this.#after); this.#assertBytes(); this.#state = 'after';
  }

  #assertBytes(): void {
    if (!sameArtifact(artifact(this.#document), this.#artifact)) throw new Error('선택 전환이 HWP/HWPX 문서를 변경했습니다.');
  }
}

function sameArtifact(left: ArtifactN015, right: ArtifactN015): boolean { return left.hwp === right.hwp && left.hwpx === right.hwpx; }

export function restoreSingleEquationSelectionN015(session: SingleEquationSelectionSessionN015 | undefined,
  bookmarkInput: unknown): SingleEquationSelectionTransitionN015 {
  const bookmark = validateSingleEquationSelectionBookmarkN015(bookmarkInput);
  if (!session || !bookmark || blocked(session)) throw new Error('단일 root 수식 선택 복원 요청이 올바르지 않습니다.');
  const document = documentOf(session), before = current(session);
  if (before === undefined) throw new Error('현재 mixed·nested·OLE 선택은 안전하게 되돌릴 수 없습니다.');
  if (documentFingerprint(document) !== bookmark.documentFingerprint
    || equationFingerprint(document, bookmark.target) !== bookmark.objectFingerprint) {
    throw new Error('문서 또는 수식이 저장된 선택 이후 바뀌었습니다.');
  }
  const beforeArtifact = artifact(document);
  try {
    select(session, bookmark.target);
    if (!sameArtifact(artifact(document), beforeArtifact)) throw new Error('선택 복원이 HWP/HWPX 문서를 변경했습니다.');
    return Object.freeze(new TransitionN015(session, document, before, bookmark.target, beforeArtifact));
  } catch (error) {
    try { select(session, before); } catch { /* Never claim a restored selection after rollback failure. */ }
    if (!sameArtifact(artifact(document), beforeArtifact)) throw new Error('실패한 선택 복원 뒤 HWP/HWPX 문서가 바뀌었습니다.');
    throw error;
  }
}
