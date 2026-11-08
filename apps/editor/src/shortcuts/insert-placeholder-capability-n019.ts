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
