import {sha256} from '@noble/hashes/sha2.js';

export type CellPartialPathEntryN016 = Readonly<{
  controlIndex: number;
  cellIndex: number;
  cellParaIndex: number;
}>;

export type CellPartialPositionN016 = Readonly<{
  sectionIndex: number;
  parentParaIndex: number;
  paragraphIndex: number;
  charOffset: number;
  controlIndex: number;
  cellIndex: number;
  cellParaIndex: number;
  cellPath: readonly [CellPartialPathEntryN016];
  isTextBox?: false;
}>;

export type CellPartialClickHereSealN016 = Readonly<{
  schemaVersion: 1;
  kind: 'top-level-cell-clickhere-partial-selection';
  documentIdentity: string;
  documentRevision: string;
  fieldId: number;
  listId: number;
  section: number;
  parentParagraph: number;
  path: readonly [CellPartialPathEntryN016];
  fieldStart: number;
  fieldEnd: number;
  selectionStart: number;
  selectionEnd: number;
  direction: 'forward' | 'backward';
  ownerFingerprint: string;
  fieldFingerprint: string;
  paragraphFingerprint: string;
  geometryFingerprint: string;
  selectionFingerprint: string;
  fingerprint: string;
}>;

export type CellPartialDocumentPortN016 = Readonly<{
  identity(): unknown;
  revision(): unknown;
  getSectionCount(): unknown;
  getParagraphCount(section: number): unknown;
  getControls(): unknown;
  getCursorModel(): unknown;
  getFieldList(): unknown;
  getCellParagraphLengthByPath(section: number, parent: number, path: string): unknown;
  getTextInCellByPath(section: number, parent: number, path: string, start: number, count: number): unknown;
  getFieldInfoAtByPath(section: number, parent: number, path: string, offset: number): unknown;
  getFieldValue(fieldId: number): unknown;
  getCursorRectByPath(section: number, parent: number, path: string, offset: number): unknown;
}>;

export type CellPartialCursorPortN016 = Readonly<{
  getPosition(): unknown;
  getSelection(): unknown;
  hasSelection(): boolean;
  isInHeaderFooter(): boolean;
  isInFootnote(): boolean;
  isInEndnote?(): boolean;
  isInTextBox(): boolean;
  isInTableObjectSelection(): boolean;
  isInPictureObjectSelection(): boolean;
  moveTo(position: CellPartialPositionN016): void;
  setAnchor(): void;
  clearSelection(): void;
  resetPreferredX(): void;
}>;

type Field = Readonly<{
  fieldId: number;
  fieldType: 'clickhere';
  cellField: false;
  location: Readonly<{
    sectionIndex: number;
    paraIndex: number;
    path: readonly [Readonly<{type: 'cell'; controlIndex: number; cellIndex: number; paraIndex: number}>];
  }>;
  startCharIdx: number;
  endCharIdx: number;
  listId: number;
  paraInList: number;
  editableInForm: boolean;
  value: string;
}>;

type Owner = Readonly<{
  listId: number;
  isCell: true;
  hostListId: 0;
  sectionIndex: number;
  hostPara: number;
  controlIndex: number;
  cellIndex: number;
  paraCount: number;
}>;

const TOKEN = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,255}$/u;
const DIGEST = /^[0-9a-f]{64}$/u;
const MAX_ENTRIES = 100_000;
const MAX_SCALARS = 100_000;

const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const index = (value: unknown, maximum = 0x7fff_ffff): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0 && (value as number) <= maximum;

const positive = (value: unknown): value is number => index(value) && value > 0;

function parse(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  if (new TextEncoder().encode(value).byteLength > 32 * 1024 * 1024) throw new RangeError('wire-too-large');
  return JSON.parse(value);
}

function normalized(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalized);
  if (record(value)) return Object.fromEntries(Object.keys(value).sort().map(key => [key, normalized(value[key])]));
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

function pathEntry(value: unknown): CellPartialPathEntryN016 | undefined {
  if (!record(value) || !index(value.controlIndex) || !index(value.cellIndex) || !index(value.cellParaIndex)) return;
  return Object.freeze({
    controlIndex: value.controlIndex,
    cellIndex: value.cellIndex,
    cellParaIndex: value.cellParaIndex,
  });
}

function position(value: unknown): CellPartialPositionN016 | undefined {
  if (!record(value) || !Array.isArray(value.cellPath) || value.cellPath.length !== 1 || value.isTextBox === true) return;
  const path = pathEntry(value.cellPath[0]);
  if (
    !path
    || !index(value.sectionIndex)
    || !index(value.parentParaIndex)
    || !index(value.paragraphIndex)
    || !index(value.charOffset)
    || !index(value.controlIndex)
    || !index(value.cellIndex)
    || !index(value.cellParaIndex)
    || value.controlIndex !== path.controlIndex
    || value.cellIndex !== path.cellIndex
    || value.cellParaIndex !== path.cellParaIndex
    || value.paragraphIndex !== path.cellParaIndex
  ) return;
  return Object.freeze({
    sectionIndex: value.sectionIndex,
    parentParaIndex: value.parentParaIndex,
    paragraphIndex: value.paragraphIndex,
    charOffset: value.charOffset,
    controlIndex: value.controlIndex,
    cellIndex: value.cellIndex,
    cellParaIndex: value.cellParaIndex,
    cellPath: Object.freeze([path]) as readonly [CellPartialPathEntryN016],
    isTextBox: false,
  });
}

function samePoint(left: CellPartialPositionN016, right: CellPartialPositionN016): boolean {
  return left.sectionIndex === right.sectionIndex
    && left.parentParaIndex === right.parentParaIndex
    && left.paragraphIndex === right.paragraphIndex
    && left.charOffset === right.charOffset
    && left.controlIndex === right.controlIndex
    && left.cellIndex === right.cellIndex
    && left.cellParaIndex === right.cellParaIndex
    && left.cellPath[0].controlIndex === right.cellPath[0].controlIndex
    && left.cellPath[0].cellIndex === right.cellPath[0].cellIndex
    && left.cellPath[0].cellParaIndex === right.cellPath[0].cellParaIndex;
}

function sameOwner(left: CellPartialPositionN016, right: CellPartialPositionN016): boolean {
  return left.sectionIndex === right.sectionIndex
    && left.parentParaIndex === right.parentParaIndex
    && left.controlIndex === right.controlIndex
    && left.cellIndex === right.cellIndex
    && left.cellParaIndex === right.cellParaIndex;
}

function field(value: unknown): Field | undefined {
  if (!record(value) || value.fieldType !== 'clickhere' || value.cellField !== false || !record(value.location)) return;
  const rawPath = value.location.path;
  if (!Array.isArray(rawPath) || rawPath.length !== 1 || !record(rawPath[0]) || rawPath[0].type !== 'cell') return;
  if (
    !positive(value.fieldId)
    || !index(value.location.sectionIndex)
    || !index(value.location.paraIndex)
    || !index(rawPath[0].controlIndex)
    || !index(rawPath[0].cellIndex)
    || !index(rawPath[0].paraIndex)
    || !index(value.startCharIdx)
    || !index(value.endCharIdx)
    || value.endCharIdx <= value.startCharIdx
    || !positive(value.listId)
    || !index(value.paraInList)
    || value.paraInList !== rawPath[0].paraIndex
    || typeof value.editableInForm !== 'boolean'
    || typeof value.value !== 'string'
  ) return;
  return value as unknown as Field;
}

function owner(value: unknown): Owner | undefined {
  if (!record(value) || value.isCell !== true || value.hostListId !== 0) return;
  if (
    !positive(value.listId)
    || !index(value.sectionIndex)
    || !index(value.hostPara)
    || !index(value.controlIndex)
    || !index(value.cellIndex)
    || !positive(value.paraCount)
  ) return;
  return value as unknown as Owner;
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

function fieldInfo(value: unknown, target: Field): Record<string, unknown> | undefined {
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

function seal(document: CellPartialDocumentPortN016): {identity: string; revision: string} | undefined {
  const identity = token(document.identity());
  const revision = token(document.revision());
  return identity && revision ? {identity, revision} : undefined;
}

function blocked(cursor: CellPartialCursorPortN016): boolean {
  return cursor.isInHeaderFooter()
    || cursor.isInFootnote()
    || cursor.isInEndnote?.() === true
    || cursor.isInTextBox()
    || cursor.isInTableObjectSelection()
    || cursor.isInPictureObjectSelection();
}

function liveSelection(cursor: CellPartialCursorPortN016): {
  focus: CellPartialPositionN016;
  anchor?: CellPartialPositionN016;
} | undefined {
  const focus = position(cursor.getPosition());
  if (!focus) return;
  const raw = cursor.getSelection();
  if (raw === null) return cursor.hasSelection() ? undefined : {focus};
  if (!record(raw) || !cursor.hasSelection()) return;
  const anchor = position(raw.anchor);
  const selectionFocus = position(raw.focus);
  if (!anchor || !selectionFocus || !samePoint(focus, selectionFocus) || !sameOwner(anchor, focus)) return;
  return {focus, anchor};
}

function flatParagraph(document: CellPartialDocumentPortN016, section: number, paragraph: number): number | undefined {
  const sectionCount = document.getSectionCount();
  if (!index(sectionCount) || section >= sectionCount) return;
  let flat = paragraph;
  for (let current = 0; current < section; current += 1) {
    const count = document.getParagraphCount(current);
    if (!index(count)) return;
    flat += count;
    if (!Number.isSafeInteger(flat) || flat > 0x7fff_ffff) return;
  }
  const count = document.getParagraphCount(section);
  return index(count) && paragraph < count ? flat : undefined;
}

function evidence(
  document: CellPartialDocumentPortN016,
  targetPosition: Omit<CellPartialPositionN016, 'charOffset'>,
  selectionStart: number,
  selectionEnd: number,
  expectedFieldId?: number,
): Readonly<{
  fieldId: number;
  listId: number;
  fieldStart: number;
  fieldEnd: number;
  ownerFingerprint: string;
  fieldFingerprint: string;
  paragraphFingerprint: string;
  geometryFingerprint: string;
  selectionFingerprint: string;
}> | undefined {
  const pathJson = JSON.stringify(targetPosition.cellPath);
  const length = document.getCellParagraphLengthByPath(targetPosition.sectionIndex, targetPosition.parentParaIndex, pathJson);
  if (!index(length, MAX_SCALARS) || selectionEnd > length) return;
  const text = document.getTextInCellByPath(targetPosition.sectionIndex, targetPosition.parentParaIndex, pathJson, 0, length);
  if (typeof text !== 'string' || Array.from(text).length !== length) return;
  const rawFields = parse(document.getFieldList());
  if (!Array.isArray(rawFields) || rawFields.length > MAX_ENTRIES) return;
  const parsedFields = rawFields.map(field);
  const sameParagraph = (item: unknown): boolean => record(item) && record(item.location)
    && item.location.sectionIndex === targetPosition.sectionIndex
    && item.location.paraIndex === targetPosition.parentParaIndex
    && Array.isArray(item.location.path)
    && item.location.path.length === 1
    && record(item.location.path[0])
    && item.location.path[0].controlIndex === targetPosition.controlIndex
    && item.location.path[0].cellIndex === targetPosition.cellIndex
    && item.location.path[0].paraIndex === targetPosition.cellParaIndex;
  if (rawFields.some((item, offset) => sameParagraph(item) && !parsedFields[offset])) return;
  const fields = parsedFields.filter((item): item is Field => Boolean(item) && sameParagraph(item));
  const candidates = fields.filter(item =>
    item.startCharIdx <= selectionStart
    && selectionEnd <= item.endCharIdx
    && (item.startCharIdx !== selectionStart || item.endCharIdx !== selectionEnd)
    && (expectedFieldId === undefined || item.fieldId === expectedFieldId));
  if (candidates.length !== 1) return;
  const target = candidates[0];
  const overlaps = fields.filter(item =>
    Math.max(item.startCharIdx, target.startCharIdx) < Math.min(item.endCharIdx, target.endCharIdx));
  if (overlaps.length !== 1 || overlaps[0].fieldId !== target.fieldId) return;

  const model = parse(document.getCursorModel());
  if (!record(model) || !Array.isArray(model.lists) || model.lists.length > MAX_ENTRIES) return;
  const owners = model.lists.map(owner).filter((item): item is Owner => Boolean(item));
  const matchedOwners = owners.filter(item => item.listId === target.listId);
  if (matchedOwners.length !== 1) return;
  const matchedOwner = matchedOwners[0];
  if (
    matchedOwner.sectionIndex !== targetPosition.sectionIndex
    || matchedOwner.hostPara !== targetPosition.parentParaIndex
    || matchedOwner.controlIndex !== targetPosition.controlIndex
    || matchedOwner.cellIndex !== targetPosition.cellIndex
    || targetPosition.cellParaIndex >= matchedOwner.paraCount
  ) return;

  const flat = flatParagraph(document, targetPosition.sectionIndex, targetPosition.parentParaIndex);
  const rawControls = parse(document.getControls());
  if (flat === undefined || !Array.isArray(rawControls) || rawControls.length > MAX_ENTRIES) return;
  const controls = rawControls.filter(item => record(item)
    && item.list === 0 && item.para === flat && item.controlIndex === targetPosition.controlIndex && item.ctrlId === 'tbl');
  if (controls.length !== 1 || !record(controls[0].props) || controls[0].props.Lock !== 0) return;

  const fullValue = Array.from(text).slice(target.startCharIdx, target.endCharIdx).join('');
  const partialValue = Array.from(text).slice(selectionStart, selectionEnd).join('');
  if (fullValue.length === 0 || partialValue.length === 0 || fullValue !== target.value) return;
  const value = parse(document.getFieldValue(target.fieldId));
  if (!record(value) || value.ok !== true || value.value !== fullValue) return;
  const fieldStartInfo = fieldInfo(document.getFieldInfoAtByPath(
    targetPosition.sectionIndex, targetPosition.parentParaIndex, pathJson, target.startCharIdx), target);
  const fieldEndInfo = fieldInfo(document.getFieldInfoAtByPath(
    targetPosition.sectionIndex, targetPosition.parentParaIndex, pathJson, target.endCharIdx), target);
  const selectionStartInfo = fieldInfo(document.getFieldInfoAtByPath(
    targetPosition.sectionIndex, targetPosition.parentParaIndex, pathJson, selectionStart), target);
  const selectionEndInfo = fieldInfo(document.getFieldInfoAtByPath(
    targetPosition.sectionIndex, targetPosition.parentParaIndex, pathJson, selectionEnd - 1), target);
  if (!fieldStartInfo || !fieldEndInfo || !selectionStartInfo || !selectionEndInfo) return;
  const startRect = validRect(document.getCursorRectByPath(
    targetPosition.sectionIndex, targetPosition.parentParaIndex, pathJson, selectionStart));
  const endRect = validRect(document.getCursorRectByPath(
    targetPosition.sectionIndex, targetPosition.parentParaIndex, pathJson, selectionEnd));
  if (!startRect || !endRect) return;

  const ownerFingerprint = hash({owner: matchedOwner, control: controls[0], path: targetPosition.cellPath});
  const fieldFingerprint = hash({target, value, fieldStartInfo, fieldEndInfo});
  const paragraphFingerprint = hash({ownerFingerprint, length, text});
  const geometryFingerprint = hash({startRect, endRect});
  return Object.freeze({
    fieldId: target.fieldId,
    listId: target.listId,
    fieldStart: target.startCharIdx,
    fieldEnd: target.endCharIdx,
    ownerFingerprint,
    fieldFingerprint,
    paragraphFingerprint,
    geometryFingerprint,
    selectionFingerprint: hash({
      ownerFingerprint,
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

type Stable = Omit<CellPartialClickHereSealN016, 'fingerprint'>;

function stable(value: Stable): Stable {
  return {
    schemaVersion: 1,
    kind: 'top-level-cell-clickhere-partial-selection',
    documentIdentity: value.documentIdentity,
    documentRevision: value.documentRevision,
    fieldId: value.fieldId,
    listId: value.listId,
    section: value.section,
    parentParagraph: value.parentParagraph,
    path: Object.freeze([{...value.path[0]}]),
    fieldStart: value.fieldStart,
    fieldEnd: value.fieldEnd,
    selectionStart: value.selectionStart,
    selectionEnd: value.selectionEnd,
    direction: value.direction,
    ownerFingerprint: value.ownerFingerprint,
    fieldFingerprint: value.fieldFingerprint,
    paragraphFingerprint: value.paragraphFingerprint,
    geometryFingerprint: value.geometryFingerprint,
    selectionFingerprint: value.selectionFingerprint,
  };
}

function validate(value: unknown): CellPartialClickHereSealN016 | undefined {
  if (!record(value) || value.schemaVersion !== 1 || value.kind !== 'top-level-cell-clickhere-partial-selection') return;
  const documentIdentity = token(value.documentIdentity);
  const documentRevision = token(value.documentRevision);
  if (!Array.isArray(value.path) || value.path.length !== 1) return;
  const path = pathEntry(value.path[0]);
  if (
    !documentIdentity
    || !documentRevision
    || !path
    || !positive(value.fieldId)
    || !positive(value.listId)
    || !index(value.section)
    || !index(value.parentParagraph)
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
    || ![value.ownerFingerprint, value.fieldFingerprint, value.paragraphFingerprint,
      value.geometryFingerprint, value.selectionFingerprint, value.fingerprint]
      .every(item => typeof item === 'string' && DIGEST.test(item))
  ) return;
  const sealed = stable({
    schemaVersion: 1,
    kind: 'top-level-cell-clickhere-partial-selection',
    documentIdentity,
    documentRevision,
    fieldId: value.fieldId,
    listId: value.listId,
    section: value.section,
    parentParagraph: value.parentParagraph,
    path: Object.freeze([path]),
    fieldStart: value.fieldStart,
    fieldEnd: value.fieldEnd,
    selectionStart: value.selectionStart,
    selectionEnd: value.selectionEnd,
    direction: value.direction,
    ownerFingerprint: value.ownerFingerprint as string,
    fieldFingerprint: value.fieldFingerprint as string,
    paragraphFingerprint: value.paragraphFingerprint as string,
    geometryFingerprint: value.geometryFingerprint as string,
    selectionFingerprint: value.selectionFingerprint as string,
  });
  if (hash(sealed) !== value.fingerprint) return;
  return Object.freeze({...sealed, fingerprint: value.fingerprint as string});
}

function apply(cursor: CellPartialCursorPortN016, focus: CellPartialPositionN016, anchor?: CellPartialPositionN016): void {
  cursor.clearSelection();
  if (anchor) {
    cursor.moveTo(anchor);
    cursor.setAnchor();
  }
  cursor.moveTo(focus);
  cursor.resetPreferredX();
}

function rollback(
  cursor: CellPartialCursorPortN016,
  original: {focus: CellPartialPositionN016; anchor?: CellPartialPositionN016},
): void {
  try {
    apply(cursor, original.focus, original.anchor);
  } catch {
    // Keep the restore failed if the live cursor cannot be rolled back.
  }
}

/** Capture one non-empty strict subset of an unambiguous top-level table-cell ClickHere field. */
export function captureCellPartialClickHereSelectionN016(
  document: CellPartialDocumentPortN016 | undefined,
  cursor: CellPartialCursorPortN016 | undefined,
): CellPartialClickHereSealN016 | undefined {
  if (!document || !cursor || blocked(cursor)) return;
  try {
    const before = seal(document);
    const selected = liveSelection(cursor);
    if (!before || !selected?.anchor) return;
    const selectionStart = Math.min(selected.focus.charOffset, selected.anchor.charOffset);
    const selectionEnd = Math.max(selected.focus.charOffset, selected.anchor.charOffset);
    if (selectionStart === selectionEnd) return;
    const proof = evidence(document, selected.focus, selectionStart, selectionEnd);
    const after = seal(document);
    if (!proof || !after || after.identity !== before.identity || after.revision !== before.revision) return;
    const sealed = stable({
      schemaVersion: 1,
      kind: 'top-level-cell-clickhere-partial-selection',
      documentIdentity: before.identity,
      documentRevision: before.revision,
      fieldId: proof.fieldId,
      listId: proof.listId,
      section: selected.focus.sectionIndex,
      parentParagraph: selected.focus.parentParaIndex,
      path: selected.focus.cellPath,
      fieldStart: proof.fieldStart,
      fieldEnd: proof.fieldEnd,
      selectionStart,
      selectionEnd,
      direction: selected.focus.charOffset === selectionEnd ? 'forward' : 'backward',
      ownerFingerprint: proof.ownerFingerprint,
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

/** Restore the sealed top-level cell range after exact owner and stale checks. */
export function restoreCellPartialClickHereSelectionN016(
  document: CellPartialDocumentPortN016 | undefined,
  cursor: CellPartialCursorPortN016 | undefined,
  value: unknown,
): boolean {
  const saved = validate(value);
  if (!document || !cursor || !saved || blocked(cursor)) return false;
  let original: ReturnType<typeof liveSelection>;
  try {
    const before = seal(document);
    const base = {
      sectionIndex: saved.section,
      parentParaIndex: saved.parentParagraph,
      paragraphIndex: saved.path[0].cellParaIndex,
      controlIndex: saved.path[0].controlIndex,
      cellIndex: saved.path[0].cellIndex,
      cellParaIndex: saved.path[0].cellParaIndex,
      cellPath: saved.path,
      isTextBox: false as const,
    };
    const proof = evidence(document, base, saved.selectionStart, saved.selectionEnd, saved.fieldId);
    if (
      !before
      || before.identity !== saved.documentIdentity
      || before.revision !== saved.documentRevision
      || !proof
      || proof.listId !== saved.listId
      || proof.fieldStart !== saved.fieldStart
      || proof.fieldEnd !== saved.fieldEnd
      || proof.ownerFingerprint !== saved.ownerFingerprint
      || proof.fieldFingerprint !== saved.fieldFingerprint
      || proof.paragraphFingerprint !== saved.paragraphFingerprint
      || proof.geometryFingerprint !== saved.geometryFingerprint
      || proof.selectionFingerprint !== saved.selectionFingerprint
    ) return false;
    original = liveSelection(cursor);
    if (!original) return false;
    const start = {...base, charOffset: saved.selectionStart};
    const end = {...base, charOffset: saved.selectionEnd};
    const focus = saved.direction === 'forward' ? end : start;
    const anchor = saved.direction === 'forward' ? start : end;
    apply(cursor, focus, anchor);
    const restored = liveSelection(cursor);
    if (!restored?.anchor || !samePoint(restored.focus, focus) || !samePoint(restored.anchor, anchor)) {
      throw new Error('selection-readback');
    }
    const after = seal(document);
    const afterProof = evidence(document, base, saved.selectionStart, saved.selectionEnd, saved.fieldId);
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
