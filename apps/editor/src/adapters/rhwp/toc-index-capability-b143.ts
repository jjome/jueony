export const TOC_INDEX_OPERATION_IDS_B143 = [
  'insert-index-mark',
  'update-index-mark',
  'insert-table-of-contents',
  'refresh-table-of-contents',
  'hide-title-mark',
  'show-title-mark',
] as const;

export type TocIndexOperationIdB143 = typeof TOC_INDEX_OPERATION_IDS_B143[number];

export type TocIndexNativeApiB143 =
  | 'insertIndexMarkV1'
  | 'updateIndexMarkV1'
  | 'insertTableOfContentsV1'
  | 'refreshTableOfContentsV1'
  | 'setTitleMarkIgnoredV1';

export interface TocIndexContextB143 {
  hasDocument: boolean;
  editable: boolean;
  story: 'body' | 'table-cell' | 'header-footer' | 'footnote' | 'endnote' | 'textbox';
}

export interface TocIndexRequirementB143 {
  operation: TocIndexOperationIdB143;
  nativeApi: TocIndexNativeApiB143;
  durableModelContract:
    | 'index-mark-keys-and-anchor-v1'
    | 'toc-field-and-generation-options-v1'
    | 'title-mark-ignore-and-anchor-v1';
}

const REQUIREMENTS: Readonly<Record<TocIndexOperationIdB143, TocIndexRequirementB143>> = {
  'insert-index-mark': {
    operation: 'insert-index-mark',
    nativeApi: 'insertIndexMarkV1',
    durableModelContract: 'index-mark-keys-and-anchor-v1',
  },
  'update-index-mark': {
    operation: 'update-index-mark',
    nativeApi: 'updateIndexMarkV1',
    durableModelContract: 'index-mark-keys-and-anchor-v1',
  },
  'insert-table-of-contents': {
    operation: 'insert-table-of-contents',
    nativeApi: 'insertTableOfContentsV1',
    durableModelContract: 'toc-field-and-generation-options-v1',
  },
  'refresh-table-of-contents': {
    operation: 'refresh-table-of-contents',
    nativeApi: 'refreshTableOfContentsV1',
    durableModelContract: 'toc-field-and-generation-options-v1',
  },
  'hide-title-mark': {
    operation: 'hide-title-mark',
    nativeApi: 'setTitleMarkIgnoredV1',
    durableModelContract: 'title-mark-ignore-and-anchor-v1',
  },
  'show-title-mark': {
    operation: 'show-title-mark',
    nativeApi: 'setTitleMarkIgnoredV1',
    durableModelContract: 'title-mark-ignore-and-anchor-v1',
  },
};

export interface TocIndexCapabilityEvidenceB143 {
  schemaVersion: 1;
  nativeMethodNames: readonly string[];
  durableModelOperations: readonly TocIndexOperationIdB143[];
  atomicHistoryOperations: readonly TocIndexOperationIdB143[];
  exactReadbackOperations: readonly TocIndexOperationIdB143[];
  hwpRoundTripOperations: readonly TocIndexOperationIdB143[];
  hwpxRoundTripOperations: readonly TocIndexOperationIdB143[];
}

export type TocIndexBlockedReasonB143 =
  | 'capability-evidence-invalid'
  | 'no-document'
  | 'read-only'
  | 'unsupported-story'
  | 'native-api-missing'
  | 'durable-model-contract-missing'
  | 'atomic-history-contract-missing'
  | 'exact-readback-contract-missing'
  | 'hwp-round-trip-contract-missing'
  | 'hwpx-round-trip-contract-missing';

export type TocIndexCapabilityDecisionB143 =
  | Readonly<{
      state: 'blocked';
      reason: TocIndexBlockedReasonB143;
      requirement: TocIndexRequirementB143;
    }>
  | Readonly<{
      /** Evidence is sufficient to implement an adapter, not to report success. */
      state: 'ready-for-native-adapter';
      requirement: TocIndexRequirementB143;
    }>;

export interface TocIndexRegistryProjectionB143 {
  operation: TocIndexOperationIdB143;
  enabled: false;
  canReportSuccess: false;
  status: 'unsupported-capability' | 'native-adapter-not-connected';
  reason: TocIndexBlockedReasonB143 | 'native-adapter-not-connected';
  requirement: TocIndexRequirementB143;
}

export interface TocIndexReadPortB143 {
  getFieldList(): string;
  getControls(): string;
}

export interface ExistingTocFieldB143 {
  fieldId: number;
  fieldType: 'toc';
  name: string;
  command: string;
  value: string;
  sectionIndex: number;
  paragraphIndex: number;
  startCharIndex: number;
  endCharIndex: number;
}

export type TocIndexInventoryB143 =
  | Readonly<{
      status: 'available';
      tocFields: readonly ExistingTocFieldB143[];
      /** getControls() does not expose IndexMark identity or keys in the current runtime. */
      indexMarks: 'unavailable-exact-api';
      opaqueControlCount: number;
      evidenceStamp: string;
    }>
  | Readonly<{
      status: 'blocked';
      reason: 'read-api-unavailable' | 'malformed-native-response';
    }>;

const NO_EVIDENCE: TocIndexCapabilityEvidenceB143 = Object.freeze({
  schemaVersion: 1,
  nativeMethodNames: Object.freeze([]),
  durableModelOperations: Object.freeze([]),
  atomicHistoryOperations: Object.freeze([]),
  exactReadbackOperations: Object.freeze([]),
  hwpRoundTripOperations: Object.freeze([]),
  hwpxRoundTripOperations: Object.freeze([]),
});

export const NO_TOC_INDEX_MUTATION_EVIDENCE_B143 = NO_EVIDENCE;

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every(item => typeof item === 'string');
}

function validEvidence(value: TocIndexCapabilityEvidenceB143): boolean {
  return value?.schemaVersion === 1
    && isStringArray(value.nativeMethodNames)
    && isStringArray(value.durableModelOperations)
    && isStringArray(value.atomicHistoryOperations)
    && isStringArray(value.exactReadbackOperations)
    && isStringArray(value.hwpRoundTripOperations)
    && isStringArray(value.hwpxRoundTripOperations);
}

export function tocIndexRequirementB143(operation: TocIndexOperationIdB143): TocIndexRequirementB143 {
  return REQUIREMENTS[operation];
}

/**
 * A similarly named generic field setter is deliberately not accepted here:
 * replacing a TABLEOFCONTENTS field body is not evidence that headings were
 * regenerated, index keys were changed, or title-mark visibility was stored.
 */
export function assessTocIndexCapabilityB143(
  operation: TocIndexOperationIdB143,
  context: TocIndexContextB143,
  evidence: TocIndexCapabilityEvidenceB143,
): TocIndexCapabilityDecisionB143 {
  const requirement = tocIndexRequirementB143(operation);
  const blocked = (reason: TocIndexBlockedReasonB143): TocIndexCapabilityDecisionB143 => ({
    state: 'blocked', reason, requirement,
  });
  if (!validEvidence(evidence)) return blocked('capability-evidence-invalid');
  if (!context.hasDocument) return blocked('no-document');
  if (!context.editable) return blocked('read-only');
  if (context.story !== 'body') return blocked('unsupported-story');
  if (!evidence.nativeMethodNames.includes(requirement.nativeApi)) return blocked('native-api-missing');
  if (!evidence.durableModelOperations.includes(operation)) return blocked('durable-model-contract-missing');
  if (!evidence.atomicHistoryOperations.includes(operation)) return blocked('atomic-history-contract-missing');
  if (!evidence.exactReadbackOperations.includes(operation)) return blocked('exact-readback-contract-missing');
  if (!evidence.hwpRoundTripOperations.includes(operation)) return blocked('hwp-round-trip-contract-missing');
  if (!evidence.hwpxRoundTripOperations.includes(operation)) return blocked('hwpx-round-trip-contract-missing');
  return {state: 'ready-for-native-adapter', requirement};
}

/** Mutation commands remain disabled until an executable adapter is connected. */
export function projectTocIndexRegistryB143(
  operation: TocIndexOperationIdB143,
  context: TocIndexContextB143,
  evidence: TocIndexCapabilityEvidenceB143 = NO_EVIDENCE,
): TocIndexRegistryProjectionB143 {
  const decision = assessTocIndexCapabilityB143(operation, context, evidence);
  if (decision.state === 'blocked') {
    return {
      operation,
      enabled: false,
      canReportSuccess: false,
      status: 'unsupported-capability',
      reason: decision.reason,
      requirement: decision.requirement,
    };
  }
  return {
    operation,
    enabled: false,
    canReportSuccess: false,
    status: 'native-adapter-not-connected',
    reason: 'native-adapter-not-connected',
    requirement: decision.requirement,
  };
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function nonNegativeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0;
}

function parseTocField(value: unknown): ExistingTocFieldB143 | undefined {
  if (!record(value) || String(value.fieldType).toLowerCase() !== 'toc'
    || !nonNegativeInteger(value.fieldId) || typeof value.name !== 'string'
    || typeof value.command !== 'string' || typeof value.value !== 'string'
    || !record(value.location) || !nonNegativeInteger(value.location.sectionIndex)
    || !nonNegativeInteger(value.location.paraIndex)
    || !nonNegativeInteger(value.startCharIdx) || !nonNegativeInteger(value.endCharIdx)
    || value.startCharIdx > value.endCharIdx) return;
  return Object.freeze({
    fieldId: value.fieldId,
    fieldType: 'toc',
    name: value.name,
    command: value.command,
    value: value.value,
    sectionIndex: value.location.sectionIndex,
    paragraphIndex: value.location.paraIndex,
    startCharIndex: value.startCharIdx,
    endCharIndex: value.endCharIdx,
  });
}

/**
 * The one exact public operation available today: read existing TOC fields.
 * Index marks are not inferred from anonymous getControls() entries.
 */
export function readTocIndexInventoryB143(port: TocIndexReadPortB143 | undefined): TocIndexInventoryB143 {
  if (!port || typeof port.getFieldList !== 'function' || typeof port.getControls !== 'function') {
    return {status: 'blocked', reason: 'read-api-unavailable'};
  }
  try {
    const fields: unknown = JSON.parse(port.getFieldList());
    const controls: unknown = JSON.parse(port.getControls());
    if (!Array.isArray(fields) || !Array.isArray(controls) || controls.some(item => !record(item))) {
      return {status: 'blocked', reason: 'malformed-native-response'};
    }
    const tocCandidates = fields.filter(item => record(item)
      && ['toc', 'tableofcontents'].includes(String(item.fieldType).toLowerCase()));
    const tocFields = tocCandidates.map(parseTocField);
    if (tocFields.some(item => item === undefined)) {
      return {status: 'blocked', reason: 'malformed-native-response'};
    }
    const exact = (tocFields as ExistingTocFieldB143[]).sort((left, right) =>
      left.sectionIndex - right.sectionIndex
      || left.paragraphIndex - right.paragraphIndex
      || left.startCharIndex - right.startCharIndex
      || left.fieldId - right.fieldId);
    const payload = {tocFields: exact, indexMarks: 'unavailable-exact-api' as const, opaqueControlCount: controls.length};
    return Object.freeze({
      status: 'available',
      ...payload,
      evidenceStamp: JSON.stringify(payload),
    });
  } catch {
    return {status: 'blocked', reason: 'malformed-native-response'};
  }
}

