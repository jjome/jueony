export const INSERT_PLACEHOLDER_COMMAND_IDS_N019 = [
  'insert:comment',
  'insert:para-band',
] as const;

export type InsertPlaceholderCommandIdN019 = typeof INSERT_PLACEHOLDER_COMMAND_IDS_N019[number];

export type InsertPlaceholderContextKindN019 =
  | 'body-caret'
  | 'table-cell'
  | 'header-footer'
  | 'footnote'
  | 'object-selection';

export interface InsertPlaceholderContextN019 {
  hasDocument: boolean;
  editable: boolean;
  formMode: boolean;
  kind: InsertPlaceholderContextKindN019;
}

export type InsertPlaceholderNativeApiN019 =
  | 'insertCommentAtCursorV1'
  | 'insertParagraphBandAtCursorV1';

export interface InsertPlaceholderRequirementN019 {
  commandId: InsertPlaceholderCommandIdN019;
  nativeApi: InsertPlaceholderNativeApiN019;
  /**
   * The native contract must name the durable document model it creates.  In
   * particular, a UI label named "comment" is not evidence that a MEMO field
   * and HWP HiddenComment are interchangeable.
   */
  durableModelContract:
    | 'comment-model-kind-and-anchor-v1'
    | 'paragraph-band-model-and-anchor-v1';
  historyContract: 'atomic-undo-redo-v1';
  roundTripContracts: readonly ['hwp-save-reopen-v1', 'hwpx-save-reopen-v1'];
}

const REQUIREMENTS: Readonly<Record<InsertPlaceholderCommandIdN019, InsertPlaceholderRequirementN019>> = {
  'insert:comment': {
    commandId: 'insert:comment',
    nativeApi: 'insertCommentAtCursorV1',
    durableModelContract: 'comment-model-kind-and-anchor-v1',
    historyContract: 'atomic-undo-redo-v1',
    roundTripContracts: ['hwp-save-reopen-v1', 'hwpx-save-reopen-v1'],
  },
  'insert:para-band': {
    commandId: 'insert:para-band',
    nativeApi: 'insertParagraphBandAtCursorV1',
    durableModelContract: 'paragraph-band-model-and-anchor-v1',
    historyContract: 'atomic-undo-redo-v1',
    roundTripContracts: ['hwp-save-reopen-v1', 'hwpx-save-reopen-v1'],
  },
};

export interface InsertPlaceholderCapabilityEvidenceN019 {
  schemaVersion: 1;
  nativeMethodNames: readonly string[];
  durableModelContracts: readonly InsertPlaceholderRequirementN019['durableModelContract'][];
  atomicHistoryCommands: readonly InsertPlaceholderCommandIdN019[];
  hwpRoundTripCommands: readonly InsertPlaceholderCommandIdN019[];
  hwpxRoundTripCommands: readonly InsertPlaceholderCommandIdN019[];
}

export type InsertPlaceholderBlockedReasonN019 =
  | 'capability-evidence-invalid'
  | 'no-document'
  | 'read-only'
  | 'form-mode'
  | 'unsupported-context'
  | 'native-api-missing'
  | 'durable-model-contract-missing'
  | 'atomic-history-contract-missing'
  | 'hwp-round-trip-contract-missing'
  | 'hwpx-round-trip-contract-missing';

export type InsertPlaceholderCapabilityDecisionN019 =
  | {
      state: 'blocked';
      reason: InsertPlaceholderBlockedReasonN019;
      requirement: InsertPlaceholderRequirementN019;
    }
  | {
      /**
       * Evidence is sufficient to start implementing an adapter.  This is not
       * an executable/success state: no adapter is connected in this module.
       */
      state: 'ready-for-native-adapter';
      requirement: InsertPlaceholderRequirementN019;
    };

export interface InsertPlaceholderRegistryProjectionN019 {
  commandId: InsertPlaceholderCommandIdN019;
  enabled: false;
  canReportSuccess: false;
  status: 'unsupported-capability' | 'native-adapter-not-connected';
  reason: InsertPlaceholderBlockedReasonN019 | 'native-adapter-not-connected';
  requirement: InsertPlaceholderRequirementN019;
}

export interface InsertPlaceholderDispatchRejectionN019 {
  ok: false;
  reason: 'unsupported-capability' | 'native-adapter-not-connected';
  capabilityReason: InsertPlaceholderBlockedReasonN019 | 'native-adapter-not-connected';
  requiredNativeApi: InsertPlaceholderNativeApiN019;
}

export interface InsertPlaceholderStudioContextN019 {
  hasDocument: boolean;
  isEditable: boolean;
  isFormMode: boolean;
  inTable: boolean;
  inCellSelectionMode: boolean;
  inTableObjectSelection: boolean;
  inPictureObjectSelection: boolean;
}

export interface InsertPlaceholderStudioCommandN019 {
  readonly id: InsertPlaceholderCommandIdN019;
  readonly label: string;
  readonly icon?: string;
  canExecute(context: InsertPlaceholderStudioContextN019): false;
  execute(): never;
}

/**
 * The checked-in runtime has no explicit native/model/history/round-trip
 * evidence for either placeholder.  Discovering a similarly named WASM
 * method must not silently turn a menu item on.
 */
export const NO_INSERT_PLACEHOLDER_CAPABILITY_EVIDENCE_N019:
InsertPlaceholderCapabilityEvidenceN019 = Object.freeze({
  schemaVersion: 1,
  nativeMethodNames: Object.freeze([]),
  durableModelContracts: Object.freeze([]),
  atomicHistoryCommands: Object.freeze([]),
  hwpRoundTripCommands: Object.freeze([]),
  hwpxRoundTripCommands: Object.freeze([]),
});

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every(item => typeof item === 'string');
}

function validEvidence(value: InsertPlaceholderCapabilityEvidenceN019): boolean {
  return value.schemaVersion === 1
    && isStringArray(value.nativeMethodNames)
    && isStringArray(value.durableModelContracts)
    && isStringArray(value.atomicHistoryCommands)
    && isStringArray(value.hwpRoundTripCommands)
    && isStringArray(value.hwpxRoundTripCommands);
}

function includes<T extends string>(values: readonly T[], value: T): boolean {
  return values.includes(value);
}

export function requirementForInsertPlaceholderN019(
  commandId: InsertPlaceholderCommandIdN019,
): InsertPlaceholderRequirementN019 {
  return REQUIREMENTS[commandId];
}

export function assessInsertPlaceholderCapabilityN019(
  commandId: InsertPlaceholderCommandIdN019,
  context: InsertPlaceholderContextN019,
  evidence: InsertPlaceholderCapabilityEvidenceN019,
): InsertPlaceholderCapabilityDecisionN019 {
  const requirement = requirementForInsertPlaceholderN019(commandId);
  const blocked = (reason: InsertPlaceholderBlockedReasonN019): InsertPlaceholderCapabilityDecisionN019 => ({
    state: 'blocked', reason, requirement,
  });

  if (!validEvidence(evidence)) return blocked('capability-evidence-invalid');
  if (!context.hasDocument) return blocked('no-document');
  if (!context.editable) return blocked('read-only');
  if (context.formMode) return blocked('form-mode');
  if (context.kind !== 'body-caret') return blocked('unsupported-context');
  if (!evidence.nativeMethodNames.includes(requirement.nativeApi)) return blocked('native-api-missing');
  if (!includes(evidence.durableModelContracts, requirement.durableModelContract)) {
    return blocked('durable-model-contract-missing');
  }
  if (!includes(evidence.atomicHistoryCommands, commandId)) return blocked('atomic-history-contract-missing');
  if (!includes(evidence.hwpRoundTripCommands, commandId)) return blocked('hwp-round-trip-contract-missing');
  if (!includes(evidence.hwpxRoundTripCommands, commandId)) return blocked('hwpx-round-trip-contract-missing');
  return { state: 'ready-for-native-adapter', requirement };
}

/**
 * UI command registry projection for the two pinned Studio placeholders.
 *
 * Even complete evidence does not enable the item until a real native adapter
 * is connected.  That prevents a declaration-only capability from becoming an
 * enabled menu item or a false successful dispatch.
 */
export function projectInsertPlaceholderRegistryN019(
  commandId: InsertPlaceholderCommandIdN019,
  context: InsertPlaceholderContextN019,
  evidence: InsertPlaceholderCapabilityEvidenceN019,
): InsertPlaceholderRegistryProjectionN019 {
  const decision = assessInsertPlaceholderCapabilityN019(commandId, context, evidence);
  if (decision.state === 'blocked') {
    return {
      commandId,
      enabled: false,
      canReportSuccess: false,
      status: 'unsupported-capability',
      reason: decision.reason,
      requirement: decision.requirement,
    };
  }
  return {
    commandId,
    enabled: false,
    canReportSuccess: false,
    status: 'native-adapter-not-connected',
    reason: 'native-adapter-not-connected',
    requirement: decision.requirement,
  };
}

/** Dispatcher-side rejection. It is deliberately pure and cannot mutate a document or history. */
export function rejectInsertPlaceholderDispatchN019(
  projection: InsertPlaceholderRegistryProjectionN019,
): InsertPlaceholderDispatchRejectionN019 {
  return {
    ok: false,
    reason: projection.status,
    capabilityReason: projection.reason,
    requiredNativeApi: projection.requirement.nativeApi,
  };
}

function projectStudioContextN019(
  context: InsertPlaceholderStudioContextN019,
): InsertPlaceholderContextN019 {
  const objectSelected = context.inTableObjectSelection || context.inPictureObjectSelection;
  const table = context.inTable || context.inCellSelectionMode;
  return {
    hasDocument: context.hasDocument,
    editable: context.isEditable,
    formMode: context.isFormMode,
    kind: objectSelected ? 'object-selection' : table ? 'table-cell' : 'body-caret',
  };
}

/**
 * Registry definition used by the Studio patch seam.  It remains disabled
 * even if all declaration evidence is supplied because no executable native
 * adapter is connected.  A direct execute bypass throws and cannot report a
 * successful command.
 */
export function createInsertPlaceholderStudioCommandN019(
  commandId: InsertPlaceholderCommandIdN019,
  label: string,
  icon?: string,
  evidence: InsertPlaceholderCapabilityEvidenceN019 = NO_INSERT_PLACEHOLDER_CAPABILITY_EVIDENCE_N019,
): InsertPlaceholderStudioCommandN019 {
  return Object.freeze({
    id: commandId,
    label,
    ...(icon ? { icon } : {}),
    canExecute(context: InsertPlaceholderStudioContextN019): false {
      projectInsertPlaceholderRegistryN019(commandId, projectStudioContextN019(context), evidence);
      return false;
    },
    execute(): never {
      const projection = projectInsertPlaceholderRegistryN019(
        commandId,
        { hasDocument: true, editable: true, formMode: false, kind: 'body-caret' },
        evidence,
      );
      const rejection = rejectInsertPlaceholderDispatchN019(projection);
      throw new Error(
        `N019 ${commandId} rejected: ${rejection.capabilityReason}; requires ${rejection.requiredNativeApi}`,
      );
    },
  });
}
