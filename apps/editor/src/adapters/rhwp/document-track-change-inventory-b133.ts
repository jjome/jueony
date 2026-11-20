const CONTRACT = 'jueony-document-track-change-opaque-inventory';
const SOURCE = 'hwp-docinfo-opaque-records';
const MAX_RECORDS = 64;
const CHANGE_TAG = 96;
const AUTHOR_TAG = 97;

export type OpaqueTrackChangeRecordB133 = Readonly<{
  kind: 'change' | 'author';
  tagId: typeof CHANGE_TAG | typeof AUTHOR_TAG;
  ordinal: number;
  level: number;
  byteLength: number;
}>;

export type OpaqueTrackChangeInventoryB133 = Readonly<{
  source: typeof SOURCE;
  format: 'hwp' | 'hwpx' | 'hml' | 'hwp3';
  coverage: 'hwp-docinfo-only' | 'unsupported-source-format';
  headerDeclaresTrackedChanges: boolean | null;
  configFlags: number | null;
  opaqueChangeRecordCount: number;
  opaqueAuthorRecordCount: number;
  recordLimit: number;
  returnedRecordCount: number;
  truncated: boolean;
  semanticChangesAvailable: false;
  acceptRejectAvailable: false;
  records: readonly OpaqueTrackChangeRecordB133[];
}>;

export type OpaqueTrackChangeInventoryResultB133 =
  | Readonly<{ kind: 'ready'; value: OpaqueTrackChangeInventoryB133 }>
  | Readonly<{ kind: 'blocked'; reason: 'unsupported' | 'read-failed' | 'invalid-contract' }>;

type NativePort = Readonly<{
  getDocumentTrackChangeInventoryB133?: (maxRecords: number) => unknown;
}>;

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function parseJson(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  if (value.length > 64 * 1024) return null;
  try { return JSON.parse(value); } catch { return null; }
}

function boundedInteger(value: unknown, max = Number.MAX_SAFE_INTEGER): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0 && Number(value) <= max;
}

function parseRecord(value: unknown): OpaqueTrackChangeRecordB133 | null {
  if (!object(value) || !exactKeys(value, ['kind', 'tagId', 'ordinal', 'level', 'byteLength'])) return null;
  const kind = value.kind;
  const tagId = value.tagId;
  if ((kind !== 'change' && kind !== 'author')
    || (tagId !== CHANGE_TAG && tagId !== AUTHOR_TAG)
    || (kind === 'change' && tagId !== CHANGE_TAG)
    || (kind === 'author' && tagId !== AUTHOR_TAG)
    || !boundedInteger(value.ordinal)
    || !boundedInteger(value.level, 1023)
    || !boundedInteger(value.byteLength, 0x0fff_ffff)) return null;
  return { kind, tagId, ordinal: value.ordinal, level: value.level, byteLength: value.byteLength };
}

function parseInventory(value: unknown, expectedLimit: number): OpaqueTrackChangeInventoryB133 | null {
  const parsed = parseJson(value);
  if (!object(parsed) || !exactKeys(parsed, [
    'contract', 'version', 'source', 'format', 'coverage', 'headerDeclaresTrackedChanges',
    'configFlags', 'opaqueChangeRecordCount', 'opaqueAuthorRecordCount', 'recordLimit',
    'returnedRecordCount', 'truncated', 'semanticChangesAvailable', 'acceptRejectAvailable', 'records',
  ])) return null;
  if (parsed.contract !== CONTRACT || parsed.version !== 1 || parsed.source !== SOURCE
    || !['hwp', 'hwpx', 'hml', 'hwp3'].includes(String(parsed.format))
    || !['hwp-docinfo-only', 'unsupported-source-format'].includes(String(parsed.coverage))
    || !boundedInteger(parsed.opaqueChangeRecordCount)
    || !boundedInteger(parsed.opaqueAuthorRecordCount)
    || !boundedInteger(parsed.recordLimit, MAX_RECORDS)
    || parsed.recordLimit !== expectedLimit
    || !boundedInteger(parsed.returnedRecordCount, MAX_RECORDS)
    || typeof parsed.truncated !== 'boolean'
    || parsed.semanticChangesAvailable !== false
    || parsed.acceptRejectAvailable !== false
    || !Array.isArray(parsed.records)
    || parsed.records.length !== parsed.returnedRecordCount) return null;

  const records = parsed.records.map(parseRecord);
  if (records.some((record) => record === null)) return null;
  const total = Number(parsed.opaqueChangeRecordCount) + Number(parsed.opaqueAuthorRecordCount);
  if (parsed.returnedRecordCount !== Math.min(total, Number(parsed.recordLimit))
    || parsed.truncated !== (total > Number(parsed.recordLimit))) return null;

  const isHwp = parsed.format === 'hwp';
  if (isHwp !== (parsed.coverage === 'hwp-docinfo-only')) return null;
  if (isHwp) {
    if (typeof parsed.headerDeclaresTrackedChanges !== 'boolean'
      || (parsed.configFlags !== null && !boundedInteger(parsed.configFlags, 0xffff_ffff))) return null;
  } else if (parsed.headerDeclaresTrackedChanges !== null || parsed.configFlags !== null
    || total !== 0 || parsed.returnedRecordCount !== 0) return null;

  return {
    source: SOURCE,
    format: parsed.format as OpaqueTrackChangeInventoryB133['format'],
    coverage: parsed.coverage as OpaqueTrackChangeInventoryB133['coverage'],
    headerDeclaresTrackedChanges: parsed.headerDeclaresTrackedChanges as boolean | null,
    configFlags: parsed.configFlags as number | null,
    opaqueChangeRecordCount: Number(parsed.opaqueChangeRecordCount),
    opaqueAuthorRecordCount: Number(parsed.opaqueAuthorRecordCount),
    recordLimit: Number(parsed.recordLimit),
    returnedRecordCount: Number(parsed.returnedRecordCount),
    truncated: parsed.truncated,
    semanticChangesAvailable: false,
    acceptRejectAvailable: false,
    records: records as OpaqueTrackChangeRecordB133[],
  };
}

/**
 * Reads bounded metadata for opaque HWP5 DocInfo records only. It deliberately
 * does not call these records semantic changes and cannot accept or reject them.
 */
export function readOpaqueDocumentTrackChangeInventoryB133(
  candidate: unknown,
  maxRecords = 32,
): OpaqueTrackChangeInventoryResultB133 {
  if (!object(candidate)) return { kind: 'blocked', reason: 'unsupported' };
  const port = candidate as NativePort;
  if (typeof port.getDocumentTrackChangeInventoryB133 !== 'function') {
    return { kind: 'blocked', reason: 'unsupported' };
  }
  const limit = Number.isFinite(maxRecords)
    ? Math.min(MAX_RECORDS, Math.max(0, Math.trunc(maxRecords)))
    : 0;
  try {
    const value = parseInventory(port.getDocumentTrackChangeInventoryB133(limit), limit);
    return value ? { kind: 'ready', value } : { kind: 'blocked', reason: 'invalid-contract' };
  } catch {
    return { kind: 'blocked', reason: 'read-failed' };
  }
}
