import { sha256 } from '@noble/hashes/sha2.js';

export type TextBoxOwnerScopeN014 =
  | 'root-textbox'
  | 'captioned-textbox'
  | 'nested-textbox'
  | 'shape-story-ambiguous';

export type TextBoxOwnerBlockerN014 =
  | 'restore-callback-unavailable'
  | 'root-owner-unresolvable'
  | 'shape-story-owner-ambiguous'
  | 'caption-story-role-ambiguous'
  | 'caption-geometry-address-unavailable'
  | 'nested-owner-chain-not-representable'
  | 'nested-story-owner-ambiguous'
  | 'studio-restore-address-is-root-only'
  | 'geometry-unavailable'
  | 'geometry-malformed';

export type TextBoxPathEntryN014 = Readonly<{
  controlIndex: number;
  cellIndex: number;
  cellParaIndex: number;
}>;

export type TextBoxCursorTargetN014 = Readonly<{
  sectionIndex: number;
  paragraphIndex: number;
  charOffset: number;
  parentParaIndex: number;
  controlIndex: number;
  cellIndex: number;
  cellParaIndex: number;
  cellPath: readonly TextBoxPathEntryN014[];
  isTextBox: true;
}>;

export type TextBoxOwnerCapabilityN014 = Readonly<{
  scope: TextBoxOwnerScopeN014;
  address: Readonly<{
    section: number;
    parentParagraph: number;
    path: readonly TextBoxPathEntryN014[];
    paragraph: number;
    offset: number;
  }>;
  evidenceFingerprint: string;
  geometryAddressable: boolean;
  restorationAddressable: boolean;
  blockers: readonly TextBoxOwnerBlockerN014[];
}>;

export type TextBoxOwnerCapabilityResultN014 =
  | Readonly<{ complete: true; capability: TextBoxOwnerCapabilityN014 }>
  | Readonly<{
      complete: false;
      capability?: never;
      reason:
        | 'target-malformed'
        | 'owner-inventory-unavailable'
        | 'owner-inventory-malformed'
        | 'owner-inventory-too-large';
    }>;

export type TextBoxOwnerCapabilityPortN014 = Readonly<{
  getSectionCount?: () => unknown;
  getParagraphCount?: (section: number) => unknown;
  getControls?: () => unknown;
  getCursorModel?: () => unknown;
  getShapeProperties?: (section: number, parent: number, control: number) => unknown;
  getCursorRectByPath?: (
    section: number,
    parent: number,
    path: string,
    offset: number,
  ) => unknown;
}>;

export type TextBoxStudioRestorePortN014 = Readonly<{
  /** Existing Studio callback consumes the root-only TextBoxBookmark contract. */
  restoreSessionTextBox?: (bookmark: unknown) => boolean;
}>;

type ControlEntry = Readonly<{
  ctrlId: string;
  list: number;
  para: number;
  controlIndex: number;
  locked: boolean | undefined;
}>;

type ListEntry = Readonly<{
  listId: number;
  isCell: boolean;
  hostListId: number;
  sectionIndex: number;
  hostPara: number;
  controlIndex: number;
  cellIndex: number;
  paraCount: number;
}>;

const MAX_WIRE_BYTES = 32 * 1024 * 1024;
const MAX_ENTRIES = 100_000;
const MAX_PATH_DEPTH = 8;

const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const index = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0 && (value as number) <= 0x7fff_ffff;

function parseWire(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  if (new TextEncoder().encode(value).byteLength > MAX_WIRE_BYTES) {
    throw new RangeError('wire-too-large');
  }
  return JSON.parse(value);
}

function parseTarget(value: unknown): TextBoxCursorTargetN014 | undefined {
  if (!record(value) || value.isTextBox !== true || !Array.isArray(value.cellPath)) return;
  if (value.cellPath.length < 1 || value.cellPath.length > MAX_PATH_DEPTH) return;
  const path: TextBoxPathEntryN014[] = [];
  for (const raw of value.cellPath) {
    if (!record(raw) || !index(raw.controlIndex) || !index(raw.cellIndex) || !index(raw.cellParaIndex)) return;
    path.push({
      controlIndex: raw.controlIndex,
      cellIndex: raw.cellIndex,
      cellParaIndex: raw.cellParaIndex,
    });
  }
  const fields = [
    value.sectionIndex,
    value.paragraphIndex,
    value.charOffset,
    value.parentParaIndex,
    value.controlIndex,
    value.cellIndex,
    value.cellParaIndex,
  ];
  if (!fields.every(index)) return;
  const first = path[0];
  const last = path[path.length - 1];
  if (
    first.controlIndex !== value.controlIndex
    || last.cellIndex !== value.cellIndex
    || last.cellParaIndex !== value.cellParaIndex
    || last.cellParaIndex !== value.paragraphIndex
  ) return;
  return {
    sectionIndex: value.sectionIndex as number,
    paragraphIndex: value.paragraphIndex as number,
    charOffset: value.charOffset as number,
    parentParaIndex: value.parentParaIndex as number,
    controlIndex: value.controlIndex as number,
    cellIndex: value.cellIndex as number,
    cellParaIndex: value.cellParaIndex as number,
    cellPath: path,
    isTextBox: true,
  };
}

function parseControl(value: unknown): ControlEntry | undefined {
  if (!record(value) || typeof value.ctrlId !== 'string') return;
  if (!index(value.list) || !index(value.para) || !index(value.controlIndex)) return;
  let locked: boolean | undefined;
  if (record(value.props) && value.props.Lock !== undefined) {
    if (value.props.Lock === 0) locked = false;
    else if (value.props.Lock === 1) locked = true;
  }
  return {
    ctrlId: value.ctrlId,
    list: value.list,
    para: value.para,
    controlIndex: value.controlIndex,
    locked,
  };
}

function parseList(value: unknown): ListEntry | undefined {
  if (!record(value)) return;
  const numeric = [
    value.listId,
    value.hostListId,
    value.sectionIndex,
    value.hostPara,
    value.controlIndex,
    value.cellIndex,
    value.paraCount,
  ];
  if (!numeric.every(index) || value.listId === 0 || typeof value.isCell !== 'boolean') return;
  return {
    listId: value.listId as number,
    isCell: value.isCell,
    hostListId: value.hostListId as number,
    sectionIndex: value.sectionIndex as number,
    hostPara: value.hostPara as number,
    controlIndex: value.controlIndex as number,
    cellIndex: value.cellIndex as number,
    paraCount: value.paraCount as number,
  };
}

function hash(value: unknown): string {
  const digest = sha256(new TextEncoder().encode(JSON.stringify(value)));
  return Array.from(digest, byte => byte.toString(16).padStart(2, '0')).join('');
}

function flatParagraph(
  document: TextBoxOwnerCapabilityPortN014,
  section: number,
  paragraph: number,
): number | undefined {
  if (typeof document.getSectionCount !== 'function' || typeof document.getParagraphCount !== 'function') return;
  const sectionCount = document.getSectionCount();
  if (!index(sectionCount) || section >= sectionCount) return;
  let flat = paragraph;
  for (let current = 0; current < section; current += 1) {
    const count = document.getParagraphCount(current);
    if (!index(count)) return;
    flat += count;
    if (!Number.isSafeInteger(flat) || flat > 0x7fff_ffff) return;
  }
  const currentCount = document.getParagraphCount(section);
  if (!index(currentCount) || paragraph >= currentCount) return;
  return flat;
}

function geometry(
  document: TextBoxOwnerCapabilityPortN014,
  target: TextBoxCursorTargetN014,
): 'verified' | 'unavailable' | 'malformed' {
  if (typeof document.getCursorRectByPath !== 'function') return 'unavailable';
  try {
    const raw = parseWire(document.getCursorRectByPath(
      target.sectionIndex,
      target.parentParaIndex,
      JSON.stringify(target.cellPath),
      target.charOffset,
    ));
    if (
      !record(raw)
      || !index(raw.pageIndex)
      || !['x', 'y', 'height'].every(key => Number.isFinite(raw[key]))
      || (raw.height as number) <= 0
    ) return 'malformed';
    return 'verified';
  } catch {
    return 'unavailable';
  }
}

function result(
  scope: TextBoxOwnerScopeN014,
  target: TextBoxCursorTargetN014,
  geometryState: ReturnType<typeof geometry>,
  blockers: readonly TextBoxOwnerBlockerN014[],
  evidence: unknown,
): TextBoxOwnerCapabilityResultN014 {
  const address = {
    section: target.sectionIndex,
    parentParagraph: target.parentParaIndex,
    path: target.cellPath.map(entry => ({ ...entry })),
    paragraph: target.paragraphIndex,
    offset: target.charOffset,
  };
  const unique = [...new Set(blockers)];
  const geometryAddressable = geometryState === 'verified'
    && !unique.includes('caption-geometry-address-unavailable');
  return {
    complete: true,
    capability: {
      scope,
      address,
      evidenceFingerprint: hash({ version: 1, scope, address, evidence }),
      geometryAddressable,
      restorationAddressable: unique.length === 0 && geometryAddressable,
      blockers: unique,
    },
  };
}

/**
 * Read-only capability gate for text-box cursor restoration.
 *
 * `TextBoxBookmark` and Studio's current callback contain only a root
 * `(section, parent paragraph, control)` address.  The gate therefore never
 * truncates a nested path and never guesses which of a captioned shape's two
 * non-cell lists is the requested story.
 */
export function auditTextBoxOwnerCapabilityN014(
  document: TextBoxOwnerCapabilityPortN014 | undefined,
  studio: TextBoxStudioRestorePortN014 | undefined,
  rawTarget: unknown,
): TextBoxOwnerCapabilityResultN014 {
  const target = parseTarget(rawTarget);
  if (!target) return { complete: false, reason: 'target-malformed' };
  if (
    !document
    || typeof document.getControls !== 'function'
    || typeof document.getCursorModel !== 'function'
    || typeof document.getShapeProperties !== 'function'
  ) return { complete: false, reason: 'owner-inventory-unavailable' };

  let controlsWire: unknown;
  let modelWire: unknown;
  let properties: unknown;
  try {
    controlsWire = parseWire(document.getControls());
    modelWire = parseWire(document.getCursorModel());
    properties = parseWire(document.getShapeProperties(
      target.sectionIndex,
      target.parentParaIndex,
      target.controlIndex,
    ));
  } catch (error) {
    return {
      complete: false,
      reason: error instanceof RangeError ? 'owner-inventory-too-large' : 'owner-inventory-malformed',
    };
  }
  if (
    !Array.isArray(controlsWire)
    || controlsWire.length > MAX_ENTRIES
    || !record(modelWire)
    || !record(properties)
    || !Array.isArray(modelWire.lists)
    || modelWire.lists.length > MAX_ENTRIES
  ) return { complete: false, reason: 'owner-inventory-malformed' };
  const controls = controlsWire.map(parseControl);
  const lists = modelWire.lists.map(parseList);
  if (controls.some(value => !value) || lists.some(value => !value)) {
    return { complete: false, reason: 'owner-inventory-malformed' };
  }

  const geometryState = geometry(document, target);
  const callbackAvailable = typeof studio?.restoreSessionTextBox === 'function';
  const geometryBlocker: TextBoxOwnerBlockerN014[] = geometryState === 'verified'
    ? []
    : [geometryState === 'malformed' ? 'geometry-malformed' : 'geometry-unavailable'];

  if (target.cellPath.length > 1) {
    return result('nested-textbox', target, geometryState, [
      'nested-owner-chain-not-representable',
      'studio-restore-address-is-root-only',
      ...geometryBlocker,
      ...(!callbackAvailable ? ['restore-callback-unavailable' as const] : []),
    ], { pathDepth: target.cellPath.length });
  }

  const flat = flatParagraph(document, target.sectionIndex, target.parentParaIndex);
  if (flat === undefined) return { complete: false, reason: 'owner-inventory-malformed' };
  const host = (controls as ControlEntry[]).filter(control =>
    control.list === 0
    && control.para === flat
    && control.controlIndex === target.controlIndex
    && control.ctrlId === 'gso');
  const owned = (lists as ListEntry[]).filter(list =>
    list.sectionIndex === target.sectionIndex
    && list.hostPara === target.parentParaIndex
    && list.controlIndex === target.controlIndex
    && !list.isCell);

  if (host.length !== 1 || host[0].locked !== false) {
    return result('shape-story-ambiguous', target, geometryState, [
      'root-owner-unresolvable',
      'studio-restore-address-is-root-only',
      ...geometryBlocker,
      ...(!callbackAvailable ? ['restore-callback-unavailable' as const] : []),
    ], { hostCount: host.length, ownedCount: owned.length });
  }

  const hasCaption = properties.hasCaption;
  if (hasCaption === true || owned.length > 1) {
    return result('captioned-textbox', target, geometryState, [
      'caption-story-role-ambiguous',
      'caption-geometry-address-unavailable',
      'studio-restore-address-is-root-only',
      ...(!callbackAvailable ? ['restore-callback-unavailable' as const] : []),
    ], {
      hasCaption,
      owned: owned.map(list => ({ cellIndex: list.cellIndex, paraCount: list.paraCount })),
    });
  }

  const story = owned[0];
  const nestedContent = story
    ? (controls as ControlEntry[]).some(control => control.list === story.listId)
      || (lists as ListEntry[]).some(list => list.hostListId === story.listId)
    : false;
  if (nestedContent) {
    return result('nested-textbox', target, geometryState, [
      'nested-story-owner-ambiguous',
      'studio-restore-address-is-root-only',
      ...geometryBlocker,
      ...(!callbackAvailable ? ['restore-callback-unavailable' as const] : []),
    ], { storyCellIndex: story?.cellIndex, nestedContent: true });
  }

  const rootStory =
    properties.hasCaption === false
    && Object.hasOwn(properties, 'roundRate')
    && owned.length === 1
    && story?.hostListId === 0
    && story.cellIndex === 0
    && story.paraCount > 0;
  if (!rootStory) {
    return result('shape-story-ambiguous', target, geometryState, [
      'shape-story-owner-ambiguous',
      'studio-restore-address-is-root-only',
      ...geometryBlocker,
      ...(!callbackAvailable ? ['restore-callback-unavailable' as const] : []),
    ], {
      hasRoundRate: Object.hasOwn(properties, 'roundRate'),
      hasCaption,
      ownedCount: owned.length,
    });
  }

  return result('root-textbox', target, geometryState, [
    ...geometryBlocker,
    ...(!callbackAvailable ? ['restore-callback-unavailable' as const] : []),
  ], {
    storyCellIndex: story.cellIndex,
    storyParagraphs: story.paraCount,
    locked: host[0].locked,
  });
}
