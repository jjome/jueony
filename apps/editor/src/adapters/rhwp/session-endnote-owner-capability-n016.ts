import { sha256 } from '@noble/hashes/sha2.js';

export type EndnoteOwnerScope =
  | 'root-body'
  | 'table-cell'
  | 'nested-table-cell'
  | 'shape-list'
  | 'unknown-list';

export type NestedEndnoteBlocker =
  | 'owner-list-unresolvable'
  | 'owner-list-cycle'
  | 'shape-list-kind-ambiguous'
  | 'story-owner-address-is-root-only'
  | 'note-layout-address-is-root-only'
  | 'studio-selection-address-is-root-only';

export type EndnoteOwnerAddress = Readonly<{
  list: number;
  paragraph: number;
  control: number;
  streamPosition: number;
}>;

export type EndnoteOwnerAudit = Readonly<{
  owner: EndnoteOwnerAddress;
  ownerFingerprint: string;
  scope: EndnoteOwnerScope;
  /** Whether this inventory address can be handed to an exact restore adapter. */
  restorationAddressable: boolean;
  blockers: readonly NestedEndnoteBlocker[];
}>;

export type EndnoteOwnerAuditResult =
  | Readonly<{ complete: true; owners: readonly EndnoteOwnerAudit[] }>
  | Readonly<{
      complete: false;
      owners: readonly [];
      reason:
        | 'owner-inventory-unavailable'
        | 'owner-inventory-malformed'
        | 'owner-inventory-too-large';
    }>;

export type EndnoteOwnerAuditPort = Readonly<{
  getControls?: () => unknown;
  getCursorModel?: () => unknown;
}>;

type ControlEntry = Readonly<{
  ctrlId: string;
  ctrlCh: number;
  list: number;
  para: number;
  pos: number;
  controlIndex: number;
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
const MAX_CONTROLS = 100_000;
const MAX_LISTS = 100_000;
const ROOT_LIST = 0;

const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const integer = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0 && (value as number) <= 0xffff_ffff;

function parseWire(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  if (new TextEncoder().encode(value).byteLength > MAX_WIRE_BYTES) {
    throw new RangeError('wire-too-large');
  }
  return JSON.parse(value);
}

function controlEntry(value: unknown): ControlEntry | undefined {
  if (!record(value)) return undefined;
  const { ctrlId, ctrlCh, list, para, pos, controlIndex } = value;
  if (
    typeof ctrlId !== 'string'
    || !integer(ctrlCh)
    || !integer(list)
    || !integer(para)
    || !integer(pos)
    || !integer(controlIndex)
  ) return undefined;
  return { ctrlId, ctrlCh, list, para, pos, controlIndex };
}

function listEntry(value: unknown): ListEntry | undefined {
  if (!record(value)) return undefined;
  const {
    listId,
    isCell,
    hostListId,
    sectionIndex,
    hostPara,
    controlIndex,
    cellIndex,
    paraCount,
  } = value;
  if (
    !integer(listId)
    || typeof isCell !== 'boolean'
    || !integer(hostListId)
    || !integer(sectionIndex)
    || !integer(hostPara)
    || !integer(controlIndex)
    || !integer(cellIndex)
    || !integer(paraCount)
    || listId === ROOT_LIST
  ) return undefined;
  return {
    listId,
    isCell,
    hostListId,
    sectionIndex,
    hostPara,
    controlIndex,
    cellIndex,
    paraCount,
  };
}

function fingerprint(value: unknown): string {
  const digest = sha256(new TextEncoder().encode(JSON.stringify(value)));
  return Array.from(digest, byte => byte.toString(16).padStart(2, '0')).join('');
}

function blocked(
  control: ControlEntry,
  scope: EndnoteOwnerScope,
  lineage: readonly ListEntry[],
  extra: readonly NestedEndnoteBlocker[] = [],
): EndnoteOwnerAudit {
  const owner = {
    list: control.list,
    paragraph: control.para,
    control: control.controlIndex,
    streamPosition: control.pos,
  };
  const blockers: NestedEndnoteBlocker[] = [
    ...extra,
    'story-owner-address-is-root-only',
    'note-layout-address-is-root-only',
    'studio-selection-address-is-root-only',
  ];
  return {
    owner,
    ownerFingerprint: fingerprint({
      version: 1,
      owner,
      ctrlId: control.ctrlId,
      ctrlCh: control.ctrlCh,
      lineage,
    }),
    scope,
    restorationAddressable: false,
    blockers,
  };
}

/**
 * Audits every endnote owner exposed by the public cursor/control inventory.
 *
 * The current engine can identify nested owners through `getControls()` and
 * `getCursorModel()`, but all three ports needed for safe selection restore
 * still accept only root `(section, paragraph, control)` addresses. This gate
 * therefore delegates only root-body owners to the existing N016 adapter and
 * returns explicit, non-restorable evidence for every nested owner. It never
 * guesses a root address from a nested list.
 */
export function auditEndnoteOwnerCapabilities(
  document: EndnoteOwnerAuditPort | undefined,
): EndnoteOwnerAuditResult {
  if (
    !document
    || typeof document.getControls !== 'function'
    || typeof document.getCursorModel !== 'function'
  ) {
    return { complete: false, owners: [], reason: 'owner-inventory-unavailable' };
  }

  let controlsWire: unknown;
  let modelWire: unknown;
  try {
    controlsWire = parseWire(document.getControls());
    modelWire = parseWire(document.getCursorModel());
  } catch (error) {
    return {
      complete: false,
      owners: [],
      reason: error instanceof RangeError
        ? 'owner-inventory-too-large'
        : 'owner-inventory-malformed',
    };
  }

  if (!Array.isArray(controlsWire) || controlsWire.length > MAX_CONTROLS || !record(modelWire)) {
    return { complete: false, owners: [], reason: 'owner-inventory-malformed' };
  }
  const controls = controlsWire.map(controlEntry);
  if (controls.some(value => value === undefined)) {
    return { complete: false, owners: [], reason: 'owner-inventory-malformed' };
  }
  const rawLists = modelWire.lists;
  if (!Array.isArray(rawLists) || rawLists.length > MAX_LISTS) {
    return { complete: false, owners: [], reason: 'owner-inventory-malformed' };
  }
  const lists = rawLists.map(listEntry);
  if (lists.some(value => value === undefined)) {
    return { complete: false, owners: [], reason: 'owner-inventory-malformed' };
  }
  const byId = new Map<number, ListEntry>();
  for (const value of lists as ListEntry[]) {
    if (byId.has(value.listId)) {
      return { complete: false, owners: [], reason: 'owner-inventory-malformed' };
    }
    byId.set(value.listId, value);
  }

  const owners: EndnoteOwnerAudit[] = [];
  for (const control of controls as ControlEntry[]) {
    if (control.ctrlId !== 'en') continue;
    const owner = {
      list: control.list,
      paragraph: control.para,
      control: control.controlIndex,
      streamPosition: control.pos,
    };
    if (control.list === ROOT_LIST) {
      owners.push({
        owner,
        ownerFingerprint: fingerprint({
          version: 1,
          owner,
          ctrlId: control.ctrlId,
          ctrlCh: control.ctrlCh,
          lineage: [],
        }),
        scope: 'root-body',
        restorationAddressable: true,
        blockers: [],
      });
      continue;
    }

    const lineage: ListEntry[] = [];
    const visited = new Set<number>();
    let listId = control.list;
    let failure: NestedEndnoteBlocker | undefined;
    while (listId !== ROOT_LIST) {
      if (visited.has(listId)) {
        failure = 'owner-list-cycle';
        break;
      }
      visited.add(listId);
      const entry = byId.get(listId);
      if (!entry) {
        failure = 'owner-list-unresolvable';
        break;
      }
      lineage.push(entry);
      listId = entry.hostListId;
    }
    if (failure) {
      owners.push(blocked(control, 'unknown-list', lineage, [failure]));
      continue;
    }

    const current = lineage[0];
    if (!current) {
      owners.push(blocked(control, 'unknown-list', lineage, ['owner-list-unresolvable']));
    } else if (!current.isCell) {
      owners.push(blocked(control, 'shape-list', lineage, ['shape-list-kind-ambiguous']));
    } else {
      const cellDepth = lineage.filter(entry => entry.isCell).length;
      owners.push(blocked(
        control,
        cellDepth > 1 ? 'nested-table-cell' : 'table-cell',
        lineage,
      ));
    }
  }
  return { complete: true, owners };
}
