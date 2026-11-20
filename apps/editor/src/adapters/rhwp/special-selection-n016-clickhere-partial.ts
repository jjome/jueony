import {sha256} from '@noble/hashes/sha2.js';

export type PartialClickHerePositionN016 = Readonly<{
  sectionIndex: number;
  paragraphIndex: number;
  charOffset: number;
}>;

export type PartialClickHereSelectionSealN016 = Readonly<{
  schemaVersion: 1;
  kind: 'root-clickhere-partial-selection';
  documentIdentity: string;
  documentRevision: string;
  fieldId: number;
  section: number;
  paragraph: number;
  fieldStart: number;
  fieldEnd: number;
  selectionStart: number;
  selectionEnd: number;
  direction: 'forward' | 'backward';
  fieldFingerprint: string;
  paragraphFingerprint: string;
  geometryFingerprint: string;
  selectionFingerprint: string;
  fingerprint: string;
}>;

export type PartialClickHereDocumentPortN016 = Readonly<{
  identity(): unknown;
  revision(): unknown;
  getSectionCount(): unknown;
  getParagraphCount(section: number): unknown;
  getParagraphLength(section: number, paragraph: number): unknown;
  getTextRange(section: number, paragraph: number, offset: number, count: number): unknown;
  getFieldList(): unknown;
  getFieldInfoAt(section: number, paragraph: number, offset: number): unknown;
  getFieldValue(fieldId: number): unknown;
  getCursorRect(section: number, paragraph: number, offset: number): unknown;
}>;

export type PartialClickHereCursorPortN016 = Readonly<{
  getPosition(): unknown;
  getSelection(): unknown;
  hasSelection(): boolean;
  isInHeaderFooter(): boolean;
  isInFootnote(): boolean;
  isInEndnote?(): boolean;
  isInTextBox(): boolean;
  isInTableObjectSelection(): boolean;
  isInPictureObjectSelection(): boolean;
  moveTo(position: PartialClickHerePositionN016): void;
  setAnchor(): void;
  clearSelection(): void;
  resetPreferredX(): void;
}>;

type RootClickHereField = Readonly<{
  fieldId: number;
  fieldType: 'clickhere';
  cellField: false;
  location: Readonly<{sectionIndex: number; paraIndex: number}>;
  startCharIdx: number;
  endCharIdx: number;
  listId: 0;
  paraInList: number;
  editableInForm: boolean;
  value: string;
}>;

const TOKEN = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,255}$/u;
const DIGEST = /^[0-9a-f]{64}$/u;
const MAX_FIELDS = 100_000;
const MAX_PARAGRAPH_SCALARS = 100_000;

const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const index = (value: unknown, maximum = 0x7fff_ffff): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0 && (value as number) <= maximum;

function parse(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  if (new TextEncoder().encode(value).byteLength > 32 * 1024 * 1024) throw new RangeError('wire-too-large');
  return JSON.parse(value);
}

function normalized(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalized);
  if (record(value)) {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, normalized(value[key])]));
  }
  return value;
}

function hash(value: unknown): string {
  return Array.from(
    sha256(new TextEncoder().encode(JSON.stringify(normalized(value)))),
    byte => byte.toString(16).padStart(2, '0'),
  ).join('');
}

function token(value: unknown): string | undefined {
  return typeof value === 'string' && TOKEN.test(value) ? value : undefined;
}

function position(value: unknown): PartialClickHerePositionN016 | undefined {
  if (!record(value) || !index(value.sectionIndex) || !index(value.paragraphIndex) || !index(value.charOffset)) return;
  if (
    value.parentParaIndex !== undefined
    || value.controlIndex !== undefined
    || value.cellIndex !== undefined
    || value.cellParaIndex !== undefined
    || value.isTextBox === true
    || (value.cellPath !== undefined && (!Array.isArray(value.cellPath) || value.cellPath.length !== 0))
  ) return;
  return Object.freeze({
    sectionIndex: value.sectionIndex,
    paragraphIndex: value.paragraphIndex,
    charOffset: value.charOffset,
  });
}

function samePoint(left: PartialClickHerePositionN016, right: PartialClickHerePositionN016): boolean {
  return left.sectionIndex === right.sectionIndex
    && left.paragraphIndex === right.paragraphIndex
    && left.charOffset === right.charOffset;
}

function field(value: unknown): RootClickHereField | undefined {
  if (!record(value) || value.fieldType !== 'clickhere' || value.cellField !== false) return;
  if (!record(value.location)) return;
  if (Object.hasOwn(value.location, 'path')
    && (!Array.isArray(value.location.path) || value.location.path.length > 0)) return;
  if (
    !index(value.fieldId)
    || value.fieldId < 1
    || !index(value.location.sectionIndex)
    || !index(value.location.paraIndex)
    || !index(value.startCharIdx)
    || !index(value.endCharIdx)
    || value.endCharIdx <= value.startCharIdx
    || value.listId !== 0
    || !index(value.paraInList)
    || value.paraInList !== value.location.paraIndex
    || typeof value.editableInForm !== 'boolean'
    || typeof value.value !== 'string'
  ) return;
  return value as unknown as RootClickHereField;
}

function validRect(value: unknown): Record<string, unknown> | undefined {
  const parsed = parse(value);
  if (
    !record(parsed)
    || !index(parsed.pageIndex)
    || !['x', 'y', 'height'].every(key => Number.isFinite(parsed[key]))
    || (parsed.height as number) <= 0
  ) return;
  return parsed;
}

function fieldInfoMatches(value: unknown, target: RootClickHereField): Record<string, unknown> | undefined {
  const info = parse(value);
  if (
    !record(info)
    || info.inField !== true
    || info.fieldId !== target.fieldId
    || info.fieldType !== 'clickhere'
    || info.startCharIdx !== target.startCharIdx
    || info.endCharIdx !== target.endCharIdx
    || typeof info.isGuide !== 'boolean'
    || info.editableInForm !== target.editableInForm
  ) return;
  return info;
}

function documentSeal(document: PartialClickHereDocumentPortN016): {identity: string; revision: string} | undefined {
  const identity = token(document.identity());
  const revision = token(document.revision());
  return identity && revision ? {identity, revision} : undefined;
}

function blocked(cursor: PartialClickHereCursorPortN016): boolean {
  return cursor.isInHeaderFooter()
    || cursor.isInFootnote()
    || cursor.isInEndnote?.() === true
    || cursor.isInTextBox()
    || cursor.isInTableObjectSelection()
    || cursor.isInPictureObjectSelection();
}

function liveSelection(cursor: PartialClickHereCursorPortN016): {
  focus: PartialClickHerePositionN016;
  anchor?: PartialClickHerePositionN016;
} | undefined {
  const focus = position(cursor.getPosition());
  if (!focus) return;
  const raw = cursor.getSelection();
  if (raw === null) return cursor.hasSelection() ? undefined : {focus};
  if (!record(raw) || !cursor.hasSelection()) return;
  const anchor = position(raw.anchor);
  const selectedFocus = position(raw.focus);
  if (!anchor || !selectedFocus || !samePoint(focus, selectedFocus)) return;
  return {focus, anchor};
}

function evidence(
  document: PartialClickHereDocumentPortN016,
  section: number,
  paragraph: number,
  selectionStart: number,
  selectionEnd: number,
  expectedFieldId?: number,
): Readonly<{
  fieldId: number;
  fieldStart: number;
  fieldEnd: number;
  fieldFingerprint: string;
  paragraphFingerprint: string;
  geometryFingerprint: string;
  selectionFingerprint: string;
}> | undefined {
  const sectionCount = document.getSectionCount();
  if (!index(sectionCount) || section >= sectionCount) return;
  const paragraphCount = document.getParagraphCount(section);
  if (!index(paragraphCount) || paragraph >= paragraphCount) return;
  const length = document.getParagraphLength(section, paragraph);
  if (!index(length, MAX_PARAGRAPH_SCALARS) || selectionEnd > length) return;
  const text = document.getTextRange(section, paragraph, 0, length);
  if (typeof text !== 'string' || Array.from(text).length !== length) return;
  const rawFields = parse(document.getFieldList());
  if (!Array.isArray(rawFields) || rawFields.length > MAX_FIELDS) return;
  const parsedFields = rawFields.map(field);
  if (rawFields.some((item, offset) => {
    if (parsedFields[offset]) return false;
    return record(item) && record(item.location)
      && item.location.sectionIndex === section && item.location.paraIndex === paragraph;
  })) return;
  const fields = parsedFields.filter((item): item is RootClickHereField => Boolean(item));
  const candidates = fields.filter(item =>
    item.location.sectionIndex === section
    && item.location.paraIndex === paragraph
    && item.startCharIdx <= selectionStart
    && selectionEnd <= item.endCharIdx
    && (item.startCharIdx !== selectionStart || item.endCharIdx !== selectionEnd)
    && (expectedFieldId === undefined || item.fieldId === expectedFieldId));
  if (candidates.length !== 1) return;
  const target = candidates[0];
  const overlapping = fields.filter(item =>
    item.location.sectionIndex === section
    && item.location.paraIndex === paragraph
    && Math.max(item.startCharIdx, target.startCharIdx) < Math.min(item.endCharIdx, target.endCharIdx));
  if (overlapping.length !== 1 || overlapping[0].fieldId !== target.fieldId) return;
  const fullValue = Array.from(text).slice(target.startCharIdx, target.endCharIdx).join('');
  const partialValue = Array.from(text).slice(selectionStart, selectionEnd).join('');
  if (fullValue.length === 0 || partialValue.length === 0 || fullValue !== target.value) return;
  const value = parse(document.getFieldValue(target.fieldId));
  if (!record(value) || value.ok !== true || typeof value.value !== 'string' || value.value !== fullValue) return;
  const fieldStartInfo = fieldInfoMatches(document.getFieldInfoAt(section, paragraph, target.startCharIdx), target);
  const fieldEndInfo = fieldInfoMatches(document.getFieldInfoAt(section, paragraph, target.endCharIdx), target);
  const selectionStartInfo = fieldInfoMatches(document.getFieldInfoAt(section, paragraph, selectionStart), target);
  const selectionEndInfo = fieldInfoMatches(document.getFieldInfoAt(section, paragraph, selectionEnd - 1), target);
  if (!fieldStartInfo || !fieldEndInfo || !selectionStartInfo || !selectionEndInfo) return;
  const startRect = validRect(document.getCursorRect(section, paragraph, selectionStart));
  const endRect = validRect(document.getCursorRect(section, paragraph, selectionEnd));
  if (!startRect || !endRect) return;
  const fieldFingerprint = hash({target, value, fieldStartInfo, fieldEndInfo});
  const paragraphFingerprint = hash({section, paragraph, length, text});
  const geometryFingerprint = hash({startRect, endRect});
  return Object.freeze({
    fieldId: target.fieldId,
    fieldStart: target.startCharIdx,
    fieldEnd: target.endCharIdx,
    fieldFingerprint,
    paragraphFingerprint,
    geometryFingerprint,
    selectionFingerprint: hash({
      fieldFingerprint,
      paragraphFingerprint,
      geometryFingerprint,
      selectionStart,
      selectionEnd,
      partialValue,
      selectionStartInfo,
      selectionEndInfo,
    }),
  });
}

type StableSeal = Omit<PartialClickHereSelectionSealN016, 'fingerprint'>;

function stable(value: StableSeal): StableSeal {
  return {
    schemaVersion: 1,
    kind: 'root-clickhere-partial-selection',
    documentIdentity: value.documentIdentity,
    documentRevision: value.documentRevision,
    fieldId: value.fieldId,
    section: value.section,
    paragraph: value.paragraph,
    fieldStart: value.fieldStart,
    fieldEnd: value.fieldEnd,
    selectionStart: value.selectionStart,
    selectionEnd: value.selectionEnd,
    direction: value.direction,
    fieldFingerprint: value.fieldFingerprint,
    paragraphFingerprint: value.paragraphFingerprint,
    geometryFingerprint: value.geometryFingerprint,
    selectionFingerprint: value.selectionFingerprint,
  };
}

function validate(value: unknown): PartialClickHereSelectionSealN016 | undefined {
  if (!record(value) || value.schemaVersion !== 1 || value.kind !== 'root-clickhere-partial-selection') return;
  const documentIdentity = token(value.documentIdentity);
  const documentRevision = token(value.documentRevision);
  if (
    !documentIdentity
    || !documentRevision
    || !index(value.fieldId)
    || value.fieldId < 1
    || !index(value.section)
    || !index(value.paragraph)
    || !index(value.fieldStart)
    || !index(value.fieldEnd)
    || !index(value.selectionStart)
    || !index(value.selectionEnd)
    || value.fieldStart >= value.fieldEnd
    || value.selectionStart >= value.selectionEnd
    || value.selectionStart < value.fieldStart
    || value.selectionEnd > value.fieldEnd
    || value.selectionStart === value.fieldStart && value.selectionEnd === value.fieldEnd
    || value.direction !== 'forward' && value.direction !== 'backward'
    || ![value.fieldFingerprint, value.paragraphFingerprint, value.geometryFingerprint,
      value.selectionFingerprint, value.fingerprint].every(item => typeof item === 'string' && DIGEST.test(item))
  ) return;
  const sealed = stable({
    schemaVersion: 1,
    kind: 'root-clickhere-partial-selection',
    documentIdentity,
    documentRevision,
    fieldId: value.fieldId,
    section: value.section,
    paragraph: value.paragraph,
    fieldStart: value.fieldStart,
    fieldEnd: value.fieldEnd,
    selectionStart: value.selectionStart,
    selectionEnd: value.selectionEnd,
    direction: value.direction,
    fieldFingerprint: value.fieldFingerprint as string,
    paragraphFingerprint: value.paragraphFingerprint as string,
    geometryFingerprint: value.geometryFingerprint as string,
    selectionFingerprint: value.selectionFingerprint as string,
  });
  if (hash(sealed) !== value.fingerprint) return;
  return Object.freeze({...sealed, fingerprint: value.fingerprint as string});
}

function apply(
  cursor: PartialClickHereCursorPortN016,
  focus: PartialClickHerePositionN016,
  anchor: PartialClickHerePositionN016 | undefined,
): void {
  cursor.clearSelection();
  if (anchor) {
    cursor.moveTo(anchor);
    cursor.setAnchor();
  }
  cursor.moveTo(focus);
  cursor.resetPreferredX();
}

function rollback(
  cursor: PartialClickHereCursorPortN016,
  original: {focus: PartialClickHerePositionN016; anchor?: PartialClickHerePositionN016},
): void {
  try {
    apply(cursor, original.focus, original.anchor);
  } catch {
    // A failed rollback cannot turn an unverified restoration into success.
  }
}

/** Capture a non-empty strict subset of one unambiguous root ClickHere field. */
export function capturePartialClickHereSelectionN016(
  document: PartialClickHereDocumentPortN016 | undefined,
  cursor: PartialClickHereCursorPortN016 | undefined,
): PartialClickHereSelectionSealN016 | undefined {
  if (!document || !cursor || blocked(cursor)) return;
  try {
    const before = documentSeal(document);
    const selected = liveSelection(cursor);
    if (!before || !selected?.anchor) return;
    if (
      selected.focus.sectionIndex !== selected.anchor.sectionIndex
      || selected.focus.paragraphIndex !== selected.anchor.paragraphIndex
    ) return;
    const selectionStart = Math.min(selected.focus.charOffset, selected.anchor.charOffset);
    const selectionEnd = Math.max(selected.focus.charOffset, selected.anchor.charOffset);
    if (selectionStart === selectionEnd) return;
    const proof = evidence(
      document,
      selected.focus.sectionIndex,
      selected.focus.paragraphIndex,
      selectionStart,
      selectionEnd,
    );
    const after = documentSeal(document);
    if (!proof || !after || after.identity !== before.identity || after.revision !== before.revision) return;
    const sealed = stable({
      schemaVersion: 1,
      kind: 'root-clickhere-partial-selection',
      documentIdentity: before.identity,
      documentRevision: before.revision,
      fieldId: proof.fieldId,
      section: selected.focus.sectionIndex,
      paragraph: selected.focus.paragraphIndex,
      fieldStart: proof.fieldStart,
      fieldEnd: proof.fieldEnd,
      selectionStart,
      selectionEnd,
      direction: selected.focus.charOffset === selectionEnd ? 'forward' : 'backward',
      fieldFingerprint: proof.fieldFingerprint,
      paragraphFingerprint: proof.paragraphFingerprint,
      geometryFingerprint: proof.geometryFingerprint,
      selectionFingerprint: proof.selectionFingerprint,
    });
    return Object.freeze({...sealed, fingerprint: hash(sealed)});
  } catch {
    return;
  }
}

/** Restore a sealed partial field selection after exact stale/tamper checks. */
export function restorePartialClickHereSelectionN016(
  document: PartialClickHereDocumentPortN016 | undefined,
  cursor: PartialClickHereCursorPortN016 | undefined,
  value: unknown,
): boolean {
  const saved = validate(value);
  if (!document || !cursor || !saved || blocked(cursor)) return false;
  let original: ReturnType<typeof liveSelection>;
  try {
    const before = documentSeal(document);
    const proof = evidence(
      document,
      saved.section,
      saved.paragraph,
      saved.selectionStart,
      saved.selectionEnd,
      saved.fieldId,
    );
    if (
      !before
      || before.identity !== saved.documentIdentity
      || before.revision !== saved.documentRevision
      || !proof
      || proof.fieldStart !== saved.fieldStart
      || proof.fieldEnd !== saved.fieldEnd
      || proof.fieldFingerprint !== saved.fieldFingerprint
      || proof.paragraphFingerprint !== saved.paragraphFingerprint
      || proof.geometryFingerprint !== saved.geometryFingerprint
      || proof.selectionFingerprint !== saved.selectionFingerprint
    ) return false;
    original = liveSelection(cursor);
    if (!original) return false;
    const start = {sectionIndex: saved.section, paragraphIndex: saved.paragraph, charOffset: saved.selectionStart};
    const end = {sectionIndex: saved.section, paragraphIndex: saved.paragraph, charOffset: saved.selectionEnd};
    const focus = saved.direction === 'forward' ? end : start;
    const anchor = saved.direction === 'forward' ? start : end;
    apply(cursor, focus, anchor);
    const restored = liveSelection(cursor);
    if (!restored?.anchor || !samePoint(restored.focus, focus) || !samePoint(restored.anchor, anchor)) {
      throw new Error('selection-readback');
    }
    const after = documentSeal(document);
    const afterProof = evidence(document, saved.section, saved.paragraph, saved.selectionStart, saved.selectionEnd, saved.fieldId);
    if (
      !after
      || after.identity !== before.identity
      || after.revision !== before.revision
      || !afterProof
      || afterProof.selectionFingerprint !== proof.selectionFingerprint
    ) throw new Error('stale-after-restore');
    return true;
  } catch {
    if (original) rollback(cursor, original);
    return false;
  }
}
