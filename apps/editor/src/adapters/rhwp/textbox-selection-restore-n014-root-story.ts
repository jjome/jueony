import {sha256} from '@noble/hashes/sha2.js';
import {
  auditTextBoxOwnerCapabilityN014,
  type TextBoxCursorTargetN014,
  type TextBoxOwnerCapabilityPortN014,
} from './session-textbox-owner-capability-n014.ts';

export type TextBoxRootPositionN014 = TextBoxCursorTargetN014;

export type TextBoxRootSelectionSealN014 = Readonly<{
  schemaVersion: 1;
  documentIdentity: string;
  documentRevision: string;
  focus: TextBoxRootPositionN014;
  anchor?: TextBoxRootPositionN014;
  focusOwnerFingerprint: string;
  anchorOwnerFingerprint?: string;
  storyFingerprint: string;
  fingerprint: string;
}>;

export type TextBoxRootSelectionDocumentPortN014 = TextBoxOwnerCapabilityPortN014 & Readonly<{
  identity(): unknown;
  revision(): unknown;
  getCellParagraphCount(section: number, parent: number, control: number, cell: number): unknown;
  getCellParagraphLengthByPath(section: number, parent: number, path: string): unknown;
  getTextInCellByPath(section: number, parent: number, path: string, start: number, count: number): unknown;
}>;

export type TextBoxRootSelectionCursorPortN014 = Readonly<{
  getPosition(): unknown;
  getSelection(): unknown;
  hasSelection(): boolean;
  moveTo(position: TextBoxRootPositionN014): void;
  setAnchor(): void;
  clearSelection(): void;
  resetPreferredX(): void;
  exitHeaderFooterMode(): void;
  exitFootnoteMode(): void;
  exitCellSelectionMode(): void;
  exitBlockSelectionMode(): void;
  exitTableObjectSelection(): void;
  exitPictureObjectSelection(): void;
}>;

const TOKEN = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,255}$/u;
const DIGEST = /^[0-9a-f]{64}$/u;
const MAX_PARAGRAPHS = 1_024;
const MAX_STORY_SCALARS = 100_000;
const MAX_PARAGRAPH_SCALARS = 65_536;

const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const index = (value: unknown, maximum = 0x7fff_ffff): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0 && (value as number) <= maximum;

function hash(value: unknown): string {
  return Array.from(
    sha256(new TextEncoder().encode(JSON.stringify(value))),
    byte => byte.toString(16).padStart(2, '0'),
  ).join('');
}

function token(value: unknown): string | undefined {
  return typeof value === 'string' && TOKEN.test(value) ? value : undefined;
}

function pathFor(controlIndex: number, paragraph: number): readonly [{
  controlIndex: number;
  cellIndex: 0;
  cellParaIndex: number;
}] {
  return [{controlIndex, cellIndex: 0, cellParaIndex: paragraph}];
}

function position(value: unknown): TextBoxRootPositionN014 | undefined {
  if (!record(value) || value.isTextBox !== true || !Array.isArray(value.cellPath) || value.cellPath.length !== 1) return;
  const entry = value.cellPath[0];
  if (!record(entry)) return;
  const fields = [
    value.sectionIndex,
    value.paragraphIndex,
    value.charOffset,
    value.parentParaIndex,
    value.controlIndex,
    value.cellIndex,
    value.cellParaIndex,
    entry.controlIndex,
    entry.cellIndex,
    entry.cellParaIndex,
  ];
  if (!fields.every(field => index(field))) return;
  if (
    value.cellIndex !== 0
    || entry.cellIndex !== 0
    || entry.controlIndex !== value.controlIndex
    || entry.cellParaIndex !== value.cellParaIndex
    || value.cellParaIndex !== value.paragraphIndex
  ) return;
  return Object.freeze({
    sectionIndex: value.sectionIndex as number,
    paragraphIndex: value.paragraphIndex as number,
    charOffset: value.charOffset as number,
    parentParaIndex: value.parentParaIndex as number,
    controlIndex: value.controlIndex as number,
    cellIndex: 0,
    cellParaIndex: value.cellParaIndex as number,
    cellPath: Object.freeze(pathFor(value.controlIndex as number, value.paragraphIndex as number)),
    isTextBox: true,
  });
}

function samePoint(left: TextBoxRootPositionN014, right: TextBoxRootPositionN014): boolean {
  return left.sectionIndex === right.sectionIndex
    && left.paragraphIndex === right.paragraphIndex
    && left.charOffset === right.charOffset
    && left.parentParaIndex === right.parentParaIndex
    && left.controlIndex === right.controlIndex
    && left.cellIndex === right.cellIndex
    && left.cellParaIndex === right.cellParaIndex
    && left.cellPath.length === 1
    && right.cellPath.length === 1
    && left.cellPath[0].controlIndex === right.cellPath[0].controlIndex
    && left.cellPath[0].cellIndex === right.cellPath[0].cellIndex
    && left.cellPath[0].cellParaIndex === right.cellPath[0].cellParaIndex;
}

function sameOwner(left: TextBoxRootPositionN014, right: TextBoxRootPositionN014): boolean {
  return left.sectionIndex === right.sectionIndex
    && left.parentParaIndex === right.parentParaIndex
    && left.controlIndex === right.controlIndex;
}

function owner(
  document: TextBoxRootSelectionDocumentPortN014,
  target: TextBoxRootPositionN014,
): string | undefined {
  const audited = auditTextBoxOwnerCapabilityN014(document, {restoreSessionTextBox: () => true}, target);
  if (
    !audited.complete
    || audited.capability.scope !== 'root-textbox'
    || !audited.capability.geometryAddressable
    || !audited.capability.restorationAddressable
  ) return;
  return audited.capability.evidenceFingerprint;
}

function story(
  document: TextBoxRootSelectionDocumentPortN014,
  focus: TextBoxRootPositionN014,
  anchor: TextBoxRootPositionN014 | undefined,
): Readonly<{
  focusOwnerFingerprint: string;
  anchorOwnerFingerprint?: string;
  storyFingerprint: string;
}> | undefined {
  if (anchor && !sameOwner(focus, anchor)) return;
  const focusOwnerFingerprint = owner(document, focus);
  const anchorOwnerFingerprint = anchor ? owner(document, anchor) : undefined;
  if (!focusOwnerFingerprint || (anchor && !anchorOwnerFingerprint)) return;
  const paragraphCount = document.getCellParagraphCount(
    focus.sectionIndex,
    focus.parentParaIndex,
    focus.controlIndex,
    0,
  );
  if (!index(paragraphCount, MAX_PARAGRAPHS) || paragraphCount < 1) return;
  const texts: string[] = [];
  let total = 0;
  for (let paragraph = 0; paragraph < paragraphCount; paragraph += 1) {
    const path = JSON.stringify(pathFor(focus.controlIndex, paragraph));
    const length = document.getCellParagraphLengthByPath(focus.sectionIndex, focus.parentParaIndex, path);
    if (!index(length, MAX_PARAGRAPH_SCALARS) || total + length > MAX_STORY_SCALARS) return;
    const text = document.getTextInCellByPath(focus.sectionIndex, focus.parentParaIndex, path, 0, length);
    if (typeof text !== 'string' || Array.from(text).length !== length) return;
    total += length;
    texts.push(text);
  }
  for (const point of anchor ? [focus, anchor] : [focus]) {
    if (point.paragraphIndex >= texts.length || point.charOffset > Array.from(texts[point.paragraphIndex]).length) return;
  }
  return Object.freeze({
    focusOwnerFingerprint,
    ...(anchorOwnerFingerprint ? {anchorOwnerFingerprint} : {}),
    storyFingerprint: hash({
      version: 1,
      section: focus.sectionIndex,
      parentParagraph: focus.parentParaIndex,
      controlIndex: focus.controlIndex,
      texts,
    }),
  });
}

function documentSeal(document: TextBoxRootSelectionDocumentPortN014): {identity: string; revision: string} | undefined {
  const identity = token(document.identity());
  const revision = token(document.revision());
  return identity && revision ? {identity, revision} : undefined;
}

function stableSeal(value: Omit<TextBoxRootSelectionSealN014, 'fingerprint'>): Omit<TextBoxRootSelectionSealN014, 'fingerprint'> {
  return {
    schemaVersion: 1,
    documentIdentity: value.documentIdentity,
    documentRevision: value.documentRevision,
    focus: value.focus,
    ...(value.anchor ? {anchor: value.anchor} : {}),
    focusOwnerFingerprint: value.focusOwnerFingerprint,
    ...(value.anchorOwnerFingerprint ? {anchorOwnerFingerprint: value.anchorOwnerFingerprint} : {}),
    storyFingerprint: value.storyFingerprint,
  };
}

function validateSeal(value: unknown): TextBoxRootSelectionSealN014 | undefined {
  if (!record(value) || value.schemaVersion !== 1) return;
  const documentIdentity = token(value.documentIdentity);
  const documentRevision = token(value.documentRevision);
  const focus = position(value.focus);
  const anchor = value.anchor === undefined ? undefined : position(value.anchor);
  if (
    !documentIdentity
    || !documentRevision
    || !focus
    || (value.anchor !== undefined && !anchor)
    || (anchor && !sameOwner(focus, anchor))
    || typeof value.focusOwnerFingerprint !== 'string'
    || !DIGEST.test(value.focusOwnerFingerprint)
    || (anchor && (typeof value.anchorOwnerFingerprint !== 'string' || !DIGEST.test(value.anchorOwnerFingerprint)))
    || (!anchor && value.anchorOwnerFingerprint !== undefined)
    || typeof value.storyFingerprint !== 'string'
    || !DIGEST.test(value.storyFingerprint)
    || typeof value.fingerprint !== 'string'
    || !DIGEST.test(value.fingerprint)
  ) return;
  const stable = stableSeal({
    schemaVersion: 1,
    documentIdentity,
    documentRevision,
    focus,
    ...(anchor ? {anchor} : {}),
    focusOwnerFingerprint: value.focusOwnerFingerprint,
    ...(anchor ? {anchorOwnerFingerprint: value.anchorOwnerFingerprint as string} : {}),
    storyFingerprint: value.storyFingerprint,
  });
  if (hash(stable) !== value.fingerprint) return;
  return Object.freeze({...stable, fingerprint: value.fingerprint});
}

function selection(cursor: TextBoxRootSelectionCursorPortN014): {
  focus: TextBoxRootPositionN014;
  anchor?: TextBoxRootPositionN014;
} | undefined {
  const focus = position(cursor.getPosition());
  if (!focus) return;
  const raw = cursor.getSelection();
  if (raw === null) return cursor.hasSelection() ? undefined : {focus};
  if (!record(raw) || !cursor.hasSelection()) return;
  const anchor = position(raw.anchor);
  const selectedFocus = position(raw.focus);
  if (!anchor || !selectedFocus || !samePoint(selectedFocus, focus) || !sameOwner(anchor, focus)) return;
  return {focus, anchor};
}

function resetModes(cursor: TextBoxRootSelectionCursorPortN014): void {
  cursor.exitHeaderFooterMode();
  cursor.exitFootnoteMode();
  cursor.clearSelection();
  cursor.exitCellSelectionMode();
  cursor.exitBlockSelectionMode();
  cursor.exitTableObjectSelection();
  cursor.exitPictureObjectSelection();
}

function applySelection(
  cursor: TextBoxRootSelectionCursorPortN014,
  focus: TextBoxRootPositionN014,
  anchor: TextBoxRootPositionN014 | undefined,
): void {
  resetModes(cursor);
  if (anchor) {
    cursor.moveTo(anchor);
    cursor.setAnchor();
  }
  cursor.moveTo(focus);
  cursor.resetPreferredX();
}

function rollback(
  cursor: TextBoxRootSelectionCursorPortN014,
  original: {focus: TextBoxRootPositionN014; anchor?: TextBoxRootPositionN014},
): void {
  try {
    applySelection(cursor, original.focus, original.anchor);
  } catch {
    // The operation remains failed; never turn a failed rollback into success.
  }
}

/**
 * Captures only a public, top-level Rectangle text-box story. Nested owner
 * paths and caption stories remain unsupported because the current public
 * owner inventory does not identify those story roles unambiguously.
 */
export function captureRootTextBoxSelectionN014(
  document: TextBoxRootSelectionDocumentPortN014 | undefined,
  cursor: TextBoxRootSelectionCursorPortN014 | undefined,
): TextBoxRootSelectionSealN014 | undefined {
  if (!document || !cursor) return;
  try {
    const initialDocument = documentSeal(document);
    const selected = selection(cursor);
    if (!initialDocument || !selected) return;
    const read = story(document, selected.focus, selected.anchor);
    const finalDocument = documentSeal(document);
    if (
      !read
      || !finalDocument
      || finalDocument.identity !== initialDocument.identity
      || finalDocument.revision !== initialDocument.revision
    ) return;
    const stable = stableSeal({
      schemaVersion: 1,
      documentIdentity: initialDocument.identity,
      documentRevision: initialDocument.revision,
      focus: selected.focus,
      ...(selected.anchor ? {anchor: selected.anchor} : {}),
      focusOwnerFingerprint: read.focusOwnerFingerprint,
      ...(read.anchorOwnerFingerprint ? {anchorOwnerFingerprint: read.anchorOwnerFingerprint} : {}),
      storyFingerprint: read.storyFingerprint,
    });
    return Object.freeze({...stable, fingerprint: hash(stable)});
  } catch {
    return;
  }
}

/**
 * Restores the sealed root text-box range through the public cursor port.
 * All owner, text, geometry and document seals are checked before mutation and
 * revalidated after readback. Document content is never written.
 */
export function restoreRootTextBoxSelectionN014(
  document: TextBoxRootSelectionDocumentPortN014 | undefined,
  cursor: TextBoxRootSelectionCursorPortN014 | undefined,
  value: unknown,
): boolean {
  const saved = validateSeal(value);
  if (!document || !cursor || !saved) return false;
  let original: ReturnType<typeof selection>;
  try {
    const beforeDocument = documentSeal(document);
    const beforeStory = story(document, saved.focus, saved.anchor);
    if (
      !beforeDocument
      || beforeDocument.identity !== saved.documentIdentity
      || beforeDocument.revision !== saved.documentRevision
      || !beforeStory
      || beforeStory.focusOwnerFingerprint !== saved.focusOwnerFingerprint
      || beforeStory.anchorOwnerFingerprint !== saved.anchorOwnerFingerprint
      || beforeStory.storyFingerprint !== saved.storyFingerprint
    ) return false;
    original = selection(cursor);
    if (!original) return false;
    applySelection(cursor, saved.focus, saved.anchor);
    const restored = selection(cursor);
    if (
      !restored
      || !samePoint(restored.focus, saved.focus)
      || Boolean(restored.anchor) !== Boolean(saved.anchor)
      || (restored.anchor && saved.anchor && !samePoint(restored.anchor, saved.anchor))
    ) throw new Error('selection-readback');
    const afterStory = story(document, saved.focus, saved.anchor);
    const afterDocument = documentSeal(document);
    if (
      !afterDocument
      || afterDocument.identity !== beforeDocument.identity
      || afterDocument.revision !== beforeDocument.revision
      || !afterStory
      || afterStory.focusOwnerFingerprint !== beforeStory.focusOwnerFingerprint
      || afterStory.anchorOwnerFingerprint !== beforeStory.anchorOwnerFingerprint
      || afterStory.storyFingerprint !== beforeStory.storyFingerprint
    ) throw new Error('stale-after-restore');
    return true;
  } catch {
    if (original) rollback(cursor, original);
    return false;
  }
}
