import {parseMixedRootSelectionBookmarkN015} from '../../modules/preferences/public/index.ts';
import type {MixedRootObjectRefN015,MixedRootSelectionBookmarkN015} from '../../modules/preferences/public/index.ts';
import {rootObjectSelectionDigest as digest,hasRootObjectSelectionIntegrity} from './root-object-selection-digest.ts';

export function validateMixedRootSelectionBookmarkN015(value:unknown):MixedRootSelectionBookmarkN015|undefined{
  const bookmark=parseMixedRootSelectionBookmarkN015(value);
  return bookmark&&hasRootObjectSelectionIntegrity(bookmark)?bookmark:undefined;
}
export type MixedRootSelectionTransitionN015 = Readonly<{undo(): void; redo(): void}>;

type RawRef = {
  sec?: unknown; ppi?: unknown; ci?: unknown; type?: unknown; cellIdx?: unknown; cellParaIdx?: unknown;
  outerTableControlIdx?: unknown; cellPath?: unknown; noteRef?: unknown; headerFooter?: unknown;
  missing?: unknown; pageIndex?: unknown;
};
type DocumentPort = {
  exportHwp(): Uint8Array; exportHwpx(): Uint8Array; getSectionCount(): unknown;
  getParagraphCount(section: number): unknown; getParagraphLength(section: number, paragraph: number): unknown;
  getTextRange(section: number, paragraph: number, start: number, end: number): unknown;
  getObjects(): unknown; getControls(): unknown; getCursorModel(): unknown;
  getEquationProperties(section: number, paragraph: number, control: number, cell: number, cellParagraph: number): unknown;
  getPictureProperties(section: number, paragraph: number, control: number): unknown;
  getControlImageData(section: number, paragraph: number, path: string, control: number): unknown;
  getControlImageMime(section: number, paragraph: number, path: string, control: number): unknown;
};
export type MixedRootSelectionSessionN015 = {
  wasm: {requiresPasswordForSave?: boolean; borrowDocumentHandle?(): unknown} | DocumentPort;
  cursor: {
    isInPictureObjectSelection(): boolean; isInTableObjectSelection(): boolean; isInHeaderFooter(): boolean;
    isInFootnote(): boolean; isInTextBox(): boolean; getSelectedPictureRefs(): RawRef[];
    getSelectedPictureRef(): RawRef | null; exitPictureObjectSelection(): void;
  };
  restoreSessionObjectSelection(refs: MixedRootObjectRefN015[]): boolean;
};

type Artifact = Readonly<{hwp: string; hwpx: string}>;
const UINT31_MAX = 2147483647;

function parsed(value: unknown): unknown { return typeof value === 'string' ? JSON.parse(value) : value; }
function object(value: unknown): Record<string, unknown> | undefined {
  const result = parsed(value); return result && typeof result === 'object' && !Array.isArray(result) ? result as Record<string, unknown> : undefined;
}
function array(value: unknown): unknown[] | undefined { const result = parsed(value); return Array.isArray(result) ? result : undefined; }
function integer(value: unknown): value is number { return Number.isSafeInteger(value) && (value as number) >= 0 && (value as number) <= UINT31_MAX; }
function instance(value: unknown): value is number { return Number.isSafeInteger(value) && (value as number) > 0 && (value as number) <= 4294967295; }
function key(ref: MixedRootObjectRefN015): string { return `${ref.section}:${ref.paragraph}:${ref.control}:${ref.type}`; }
function sameRefs(left: readonly MixedRootObjectRefN015[], right: readonly MixedRootObjectRefN015[]): boolean {
  return left.length === right.length && left.every((value, index) => key(value) === key(right[index]));
}

function documentOf(session: MixedRootSelectionSessionN015): DocumentPort {
  const wrapper = session.wasm as {borrowDocumentHandle?: () => unknown};
  const value = typeof wrapper.borrowDocumentHandle === 'function' ? wrapper.borrowDocumentHandle() : session.wasm;
  if (!value || typeof value !== 'object') throw new Error('문서 엔진을 사용할 수 없습니다.');
  for (const name of ['exportHwp', 'exportHwpx', 'getSectionCount', 'getParagraphCount', 'getParagraphLength', 'getTextRange',
    'getObjects', 'getControls', 'getCursorModel', 'getEquationProperties', 'getPictureProperties',
    'getControlImageData', 'getControlImageMime'] as const) {
    if (typeof (value as Record<string, unknown>)[name] !== 'function') throw new Error(`필수 문서 엔진 기능이 없습니다: ${name}`);
  }
  return value as DocumentPort;
}
function artifact(document: DocumentPort): Artifact {
  const hwp = document.exportHwp(), hwpx = document.exportHwpx();
  if (!(hwp instanceof Uint8Array) || !hwp.length || !(hwpx instanceof Uint8Array) || !hwpx.length) throw new Error('HWP/HWPX 저장 상태를 확인하지 못했습니다.');
  return Object.freeze({hwp: digest(hwp), hwpx: digest(hwpx)});
}
function sameArtifact(left: Artifact, right: Artifact): boolean { return left.hwp === right.hwp && left.hwpx === right.hwpx; }

function rootRef(value: RawRef | null | undefined): MixedRootObjectRefN015 | undefined {
  if (!value || (value.type!=='equation'&&value.type!=='image') || !integer(value.sec) || !integer(value.ppi) || !integer(value.ci)
    || value.cellIdx !== undefined || value.cellParaIdx !== undefined || value.outerTableControlIdx !== undefined
    || value.cellPath !== undefined || value.noteRef !== undefined || value.headerFooter !== undefined
    || value.missing !== undefined || value.pageIndex !== undefined) return;
  return Object.freeze({section: value.sec, paragraph: value.ppi, control: value.ci, type: value.type});
}
function liveSelection(session: MixedRootSelectionSessionN015): MixedRootObjectRefN015[] | null | undefined {
  if (!session.cursor.isInPictureObjectSelection()) return null;
  const raw = session.cursor.getSelectedPictureRefs(), active = rootRef(session.cursor.getSelectedPictureRef());
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > 32 || !active) return;
  const refs = raw.map(rootRef); if (refs.some(value => !value)) return;
  const values = refs as MixedRootObjectRefN015[];
  if (new Set(values.map(key)).size !== values.length || key(values.at(-1)!) !== key(active)) return;
  return values;
}
function mixed(values: readonly MixedRootObjectRefN015[]): boolean {
  return values.length >= 2 && values.length <= 32 && values.some(value => value.type === 'equation') && values.some(value => value.type === 'image');
}
function blocked(session: MixedRootSelectionSessionN015): boolean {
  return Boolean((session.wasm as {requiresPasswordForSave?: boolean}).requiresPasswordForSave)
    || session.cursor.isInTableObjectSelection() || session.cursor.isInHeaderFooter()
    || session.cursor.isInFootnote() || session.cursor.isInTextBox();
}

function semanticDocumentFingerprint(document: DocumentPort): string {
  const count = document.getSectionCount(); if (!integer(count) || count < 1 || count > 1024) throw new Error('문서 구역을 확인하지 못했습니다.');
  const sections: {length: number; text: string}[][] = []; let paragraphs = 0, characters = 0;
  for (let section = 0; section < count; section += 1) {
    const paragraphCount = document.getParagraphCount(section);
    if (!integer(paragraphCount) || (paragraphs += paragraphCount) > 100000) throw new Error('문단 목록을 확인하지 못했습니다.');
    const values: {length: number; text: string}[] = [];
    for (let paragraph = 0; paragraph < paragraphCount; paragraph += 1) {
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

function owner(document: DocumentPort, ref: MixedRootObjectRefN015): {owner: Record<string, unknown>; control: Record<string, unknown>; text: string} {
  const sections = document.getSectionCount(); if (!integer(sections) || ref.section >= sections) throw new Error('개체 구역이 없습니다.');
  const paragraphs = document.getParagraphCount(ref.section); if (!integer(paragraphs) || ref.paragraph >= paragraphs) throw new Error('개체 문단이 없습니다.');
  let flat = ref.paragraph;
  for (let section = 0; section < ref.section; section += 1) { const count = document.getParagraphCount(section); if (!integer(count)) throw new Error('개체 소유 문단을 확인하지 못했습니다.'); flat += count; }
  const objects = array(document.getObjects()), controls = array(document.getControls()), model = object(document.getCursorModel());
  if (!objects || !controls || !model || !Array.isArray(model.lists)) throw new Error('개체 소유 정보를 확인하지 못했습니다.');
  const ownerValue = object(objects.find(item => { const value = object(item); return value?.para === flat && value.controlIndex === ref.control; }));
  const controlValue = object(controls.find(item => { const value = object(item); return value?.list === 0 && value.para === flat && value.controlIndex === ref.control; }));
  const props = object(controlValue?.props), expectedKind = ref.type === 'equation' ? 'equation' : 'picture', expectedControl = ref.type === 'equation' ? 'eqed' : 'gso';
  if (!ownerValue || ownerValue.kind !== expectedKind || ownerValue.anchored !== true || ownerValue.listId !== null
    || !controlValue || controlValue.ctrlId !== expectedControl || (props?.Lock !== undefined && props.Lock !== 0)) throw new Error('root 개체 소유자를 확인하지 못했습니다.');
  if (model.lists.some(item => { const value = object(item); return value?.hostListId === 0 && value.sectionIndex === ref.section
    && value.hostPara === ref.paragraph && value.controlIndex === ref.control; })) throw new Error('중첩 개체는 지원하지 않습니다.');
  const length = document.getParagraphLength(ref.section, ref.paragraph), text = integer(length)
    ? document.getTextRange(ref.section, ref.paragraph, 0, length) : undefined;
  if (!integer(length) || typeof text !== 'string' || Array.from(text).length !== length) throw new Error('개체 host 문단을 확인하지 못했습니다.');
  return {owner: ownerValue, control: {ctrlId: controlValue.ctrlId, lock: props?.Lock ?? null}, text};
}

function objectFingerprint(document: DocumentPort, ref: MixedRootObjectRefN015): string {
  const stableRef: MixedRootObjectRefN015 = {section: ref.section, paragraph: ref.paragraph, control: ref.control, type: ref.type};
  const common = owner(document, stableRef);
  if (stableRef.type === 'equation') {
    const properties = object(document.getEquationProperties(stableRef.section, stableRef.paragraph, stableRef.control, -1, -1));
    if (!properties || properties.hasCaption !== false || properties.sizeProtect !== false
      || !integer(properties.width) || properties.width === 0 || !integer(properties.height) || properties.height === 0
      || !instance(properties.instanceId) || typeof properties.script !== 'string' || !properties.script.length || properties.script.length > 32768
      || !integer(properties.fontSize) || properties.fontSize === 0 || !integer(properties.color) || !integer(properties.baseline)
      || typeof properties.fontName !== 'string' || !properties.fontName.length || JSON.stringify(properties).length > 65536) {
      throw new Error('수식 속성을 완전히 확인하지 못했습니다.');
    }
    return digest({ref: stableRef, ...common, properties});
  }
  const properties = object(document.getPictureProperties(stableRef.section, stableRef.paragraph, stableRef.control));
  const bytes = document.getControlImageData(stableRef.section, stableRef.paragraph, '', stableRef.control);
  const mime = document.getControlImageMime(stableRef.section, stableRef.paragraph, '', stableRef.control);
  if (!properties || properties.hasCaption !== false || properties.sizeProtect !== false
    || !integer(properties.width) || properties.width === 0 || !integer(properties.height) || properties.height === 0
    || JSON.stringify(properties).length > 65536 || !(bytes instanceof Uint8Array) || !bytes.length || bytes.length > 8 * 1024 * 1024
    || typeof mime !== 'string' || !mime.startsWith('image/')) throw new Error('그림 속성 또는 payload를 완전히 확인하지 못했습니다.');
  return digest({ref: stableRef, ...common, properties, mime, payloadSha256: digest(bytes)});
}

export function captureMixedRootSelectionN015(session: MixedRootSelectionSessionN015 | undefined): MixedRootSelectionBookmarkN015 | undefined {
  if (!session || blocked(session)) return;
  try {
    const selected = liveSelection(session); if (!selected || !mixed(selected)) return;
    const document = documentOf(session), entries = selected.map(ref => Object.freeze({...ref, objectFingerprint: objectFingerprint(document, ref)}));
    const checked = {version: 1, kind: 'mixed-root-object-selection', objects: Object.freeze(entries),
      active: entries.length - 1, documentFingerprint: semanticDocumentFingerprint(document)} as const;
    return Object.freeze({...checked, integrity: digest(checked)});
  } catch { return; }
}

function restoreLive(session: MixedRootSelectionSessionN015, refs: readonly MixedRootObjectRefN015[] | null): void {
  if (!refs) session.cursor.exitPictureObjectSelection();
  else if (!session.restoreSessionObjectSelection(refs.map(ref => ({...ref})))) throw new Error('Studio ordered selection 포트가 요청을 거절했습니다.');
  const observed = liveSelection(session);
  if (refs ? !observed || !sameRefs(observed, refs) : observed !== null) throw new Error('Studio ordered selection 포트의 적용 결과가 다릅니다.');
}

class Transition implements MixedRootSelectionTransitionN015 {
  readonly #session: MixedRootSelectionSessionN015; readonly #document: DocumentPort;
  readonly #before: readonly MixedRootObjectRefN015[] | null; readonly #after: readonly MixedRootObjectRefN015[];
  readonly #artifact: Artifact; #state: 'before' | 'after' = 'after';
  constructor(session: MixedRootSelectionSessionN015, document: DocumentPort, before: readonly MixedRootObjectRefN015[] | null,
    after: readonly MixedRootObjectRefN015[], artifactValue: Artifact) {
    this.#session = session; this.#document = document; this.#before = before; this.#after = after; this.#artifact = artifactValue;
  }
  undo(): void {
    const live = liveSelection(this.#session);
    if (this.#state !== 'after' || !live || !sameRefs(live, this.#after) || !sameArtifact(artifact(this.#document), this.#artifact)) throw new Error('적용 후 선택 또는 문서 상태가 아닙니다.');
    restoreLive(this.#session, this.#before); this.#assertBytes(); this.#state = 'before';
  }
  redo(): void {
    const live = liveSelection(this.#session);
    if (this.#state !== 'before' || (this.#before ? !live || !sameRefs(live, this.#before) : live !== null)
      || !sameArtifact(artifact(this.#document), this.#artifact)) throw new Error('되돌린 선택 또는 문서 상태가 아닙니다.');
    restoreLive(this.#session, this.#after); this.#assertBytes(); this.#state = 'after';
  }
  #assertBytes(): void { if (!sameArtifact(artifact(this.#document), this.#artifact)) throw new Error('선택 전환이 HWP/HWPX 문서를 변경했습니다.'); }
}

export function restoreMixedRootSelectionN015(session: MixedRootSelectionSessionN015 | undefined,
  bookmarkInput: unknown): MixedRootSelectionTransitionN015 {
  const bookmark = validateMixedRootSelectionBookmarkN015(bookmarkInput);
  if (!session || !bookmark || blocked(session)) throw new Error('mixed root 개체 선택 복원 요청이 올바르지 않습니다.');
  const document = documentOf(session), previous = liveSelection(session);
  if (previous === undefined) throw new Error('현재 nested·OLE·table 선택은 안전하게 되돌릴 수 없습니다.');
  if (semanticDocumentFingerprint(document) !== bookmark.documentFingerprint) throw new Error('문서가 저장된 선택 이후 바뀌었습니다.');
  for (const entry of bookmark.objects) {
    if (objectFingerprint(document, entry) !== entry.objectFingerprint) throw new Error('수식 또는 그림이 저장된 선택 이후 바뀌었습니다.');
  }
  const target = bookmark.objects.map(({section, paragraph, control, type}) => Object.freeze({section, paragraph, control, type}));
  const beforeArtifact = artifact(document);
  try {
    restoreLive(session, target);
    if (!sameArtifact(artifact(document), beforeArtifact)) throw new Error('선택 복원이 HWP/HWPX 문서를 변경했습니다.');
    return Object.freeze(new Transition(session, document, previous, Object.freeze(target), beforeArtifact));
  } catch (error) {
    try { restoreLive(session, previous); } catch { /* Never report success after rollback failure. */ }
    if (!sameArtifact(artifact(document), beforeArtifact)) throw new Error('실패한 선택 복원 뒤 HWP/HWPX 문서가 바뀌었습니다.');
    throw error;
  }
}
