import {
  SCRIPT_MACRO_B142_LIMITS,
  SCRIPT_MACRO_B142_SCHEMA,
  SCRIPT_MACRO_B142_VERSION,
  ScriptMacroValidationErrorB142,
  assertScriptMacroCommandIdB142,
  assertScriptMacroDocumentVersionB142,
  normalizeScriptMacroArgumentsB142,
  validateScriptMacroB142,
} from '../../modules/script-macros/public/index.ts';
import type {
  ScriptMacroArgumentsB142,
  ScriptMacroB142,
  ScriptMacroDocumentVersionB142,
  ScriptMacroStepB142,
} from '../../modules/script-macros/public/index.ts';

export interface ScriptMacroRuntimeStateB142 extends ScriptMacroDocumentVersionB142 {
  active: boolean;
  editable: boolean;
  busy: boolean;
  composing: boolean;
  hasSelection: boolean;
}

export interface RecordableScriptMacroCommandB142<Context> {
  readonly id: string;
  readonly recordable: true;
  readonly safety: {
    readonly deterministic: true;
    readonly dialogFree: true;
    readonly selectionIndependent: true;
    readonly imeIndependent: true;
  };
  validateArguments(value: unknown): unknown;
  execute(context: Context, argumentsValue: ScriptMacroArgumentsB142): void;
}

export interface SuccessfulScriptMacroCommandEventB142 {
  source: 'command-dispatcher';
  outcome: 'success';
  commandId: string;
  arguments: unknown;
  before: ScriptMacroRuntimeStateB142;
  after: ScriptMacroRuntimeStateB142;
}

export interface ScriptMacroAtomicRequestB142<Context> {
  operationType: 'jueonyScriptMacroB142';
  expected: ScriptMacroDocumentVersionB142;
  operation(context: Context): void;
}

export interface ScriptMacroAtomicReceiptB142 {
  committed: true;
  documentIdentity: string;
  beforeRevision: string;
  afterRevision: string;
  undoUnits: 1;
}

export interface ScriptMacroAtomicPortB142<Context> {
  readState(): ScriptMacroRuntimeStateB142;
  /**
   * Host integration seam. The host must run `operation` inside exactly one snapshot undo unit,
   * restore the whole document when it throws, and only return after the transaction commits.
   */
  executeAtomic(request: ScriptMacroAtomicRequestB142<Context>): ScriptMacroAtomicReceiptB142;
}

export interface ScriptMacroReplayReceiptB142 extends ScriptMacroAtomicReceiptB142 {
  appliedSteps: number;
}

export class ScriptMacroRuntimeErrorB142 extends Error {
  readonly code:
    | 'INVALID_STATE'
    | 'UNREGISTERED_COMMAND'
    | 'UNSAFE_COMMAND'
    | 'STALE_DOCUMENT'
    | 'RECORDING_INVALIDATED'
    | 'REPLAY_CANCELLED'
    | 'ATOMIC_CONTRACT_VIOLATION';

  constructor(
    code:
      | 'INVALID_STATE'
      | 'UNREGISTERED_COMMAND'
      | 'UNSAFE_COMMAND'
      | 'STALE_DOCUMENT'
      | 'RECORDING_INVALIDATED'
      | 'REPLAY_CANCELLED'
      | 'ATOMIC_CONTRACT_VIOLATION',
    message: string,
  ) {
    super(message);
    this.name = 'ScriptMacroRuntimeErrorB142';
    this.code = code;
  }
}

function runtimeFail(code: ScriptMacroRuntimeErrorB142['code'], message: string): never {
  throw new ScriptMacroRuntimeErrorB142(code, message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function assertExactKeys(value: Record<string, unknown>, expected: readonly string[], label: string): void {
  const allowed = new Set(expected);
  if (Object.keys(value).some(key => !allowed.has(key)) || expected.some(key => !Object.hasOwn(value, key))) {
    runtimeFail('INVALID_STATE', `${label} 형식이 잘못되었습니다.`);
  }
}

export function validateScriptMacroRuntimeStateB142(value: unknown): ScriptMacroRuntimeStateB142 {
  if (!isRecord(value)) runtimeFail('INVALID_STATE', '편집기 상태를 확인할 수 없습니다.');
  assertExactKeys(
    value,
    ['documentIdentity', 'revision', 'active', 'editable', 'busy', 'composing', 'hasSelection'],
    '편집기 상태',
  );
  const version: unknown = {
      documentIdentity: value.documentIdentity,
      revision: value.revision,
  };
  try {
    assertScriptMacroDocumentVersionB142(version);
  } catch (error) {
    if (error instanceof ScriptMacroValidationErrorB142) runtimeFail('INVALID_STATE', error.message);
    throw error;
  }
  if (typeof value.active !== 'boolean') runtimeFail('INVALID_STATE', '편집기 active 상태가 잘못되었습니다.');
  if (typeof value.editable !== 'boolean') runtimeFail('INVALID_STATE', '편집기 editable 상태가 잘못되었습니다.');
  if (typeof value.busy !== 'boolean') runtimeFail('INVALID_STATE', '편집기 busy 상태가 잘못되었습니다.');
  if (typeof value.composing !== 'boolean') runtimeFail('INVALID_STATE', '편집기 composing 상태가 잘못되었습니다.');
  if (typeof value.hasSelection !== 'boolean') runtimeFail('INVALID_STATE', '편집기 hasSelection 상태가 잘못되었습니다.');
  return {
    documentIdentity: version.documentIdentity,
    revision: version.revision,
    active: value.active,
    editable: value.editable,
    busy: value.busy,
    composing: value.composing,
    hasSelection: value.hasSelection,
  };
}

function assertRecordableState(stateValue: unknown): ScriptMacroRuntimeStateB142 {
  const state = validateScriptMacroRuntimeStateB142(stateValue);
  if (!state.active || !state.editable || state.busy) {
    runtimeFail('INVALID_STATE', '활성 편집 가능 문서가 준비된 상태에서만 스크립트 매크로를 사용할 수 있습니다.');
  }
  if (state.composing) runtimeFail('INVALID_STATE', 'IME 조합 중인 입력은 스크립트 매크로에 기록하지 않습니다.');
  if (state.hasSelection) runtimeFail('INVALID_STATE', '선택 영역에 의존하는 동작은 스크립트 매크로에 기록하지 않습니다.');
  return state;
}

function sameVersion(left: ScriptMacroDocumentVersionB142, right: ScriptMacroDocumentVersionB142): boolean {
  return left.documentIdentity === right.documentIdentity && left.revision === right.revision;
}

export class ScriptMacroCommandCatalogB142<Context> {
  readonly #commands = new Map<string, RecordableScriptMacroCommandB142<Context>>();

  constructor(commands: readonly RecordableScriptMacroCommandB142<Context>[]) {
    for (const command of commands) {
      assertScriptMacroCommandIdB142(command.id);
      if (this.#commands.has(command.id)) runtimeFail('UNSAFE_COMMAND', `중복 스크립트 매크로 명령입니다: ${command.id}`);
      if (
        command.recordable !== true
        || command.safety?.deterministic !== true
        || command.safety.dialogFree !== true
        || command.safety.selectionIndependent !== true
        || command.safety.imeIndependent !== true
        || typeof command.validateArguments !== 'function'
        || typeof command.execute !== 'function'
      ) {
        runtimeFail('UNSAFE_COMMAND', `안전 조건을 선언하지 않은 명령은 등록할 수 없습니다: ${command.id}`);
      }
      this.#commands.set(command.id, command);
    }
  }

  normalizeArguments(commandId: string, value: unknown): ScriptMacroArgumentsB142 {
    const command = this.#commands.get(commandId);
    if (!command) runtimeFail('UNREGISTERED_COMMAND', `등록되지 않은 스크립트 매크로 명령입니다: ${commandId}`);
    return normalizeScriptMacroArgumentsB142(command.validateArguments(value));
  }

  execute(context: Context, step: ScriptMacroStepB142): void {
    const command = this.#commands.get(step.commandId);
    if (!command) runtimeFail('UNREGISTERED_COMMAND', `등록되지 않은 스크립트 매크로 명령입니다: ${step.commandId}`);
    const normalized = this.normalizeArguments(step.commandId, step.arguments);
    command.execute(context, normalized);
  }
}

interface RecordingSessionB142 {
  start: ScriptMacroRuntimeStateB142;
  current: ScriptMacroRuntimeStateB142;
  steps: ScriptMacroStepB142[];
}

export class ScriptMacroRecorderB142<Context> {
  #session: RecordingSessionB142 | undefined;
  readonly #catalog: ScriptMacroCommandCatalogB142<Context>;

  constructor(catalog: ScriptMacroCommandCatalogB142<Context>) {
    this.#catalog = catalog;
  }

  get recording(): boolean {
    return this.#session !== undefined;
  }

  start(stateValue: unknown): void {
    if (this.#session) runtimeFail('INVALID_STATE', '이미 스크립트 매크로를 기록하고 있습니다.');
    const state = assertRecordableState(stateValue);
    this.#session = { start: state, current: state, steps: [] };
  }

  recordSuccessfulCommand(eventValue: unknown): void {
    const session = this.#session;
    if (!session) runtimeFail('INVALID_STATE', '스크립트 매크로 기록을 먼저 시작하세요.');
    try {
      if (!isRecord(eventValue)) runtimeFail('RECORDING_INVALIDATED', '명령 실행 이벤트 형식이 잘못되었습니다.');
      assertExactKeys(eventValue, ['source', 'outcome', 'commandId', 'arguments', 'before', 'after'], '명령 실행 이벤트');
      if (eventValue.source !== 'command-dispatcher' || eventValue.outcome !== 'success') {
        runtimeFail('RECORDING_INVALIDATED', '디스패처가 성공으로 확인한 명령만 기록할 수 있습니다.');
      }
      assertScriptMacroCommandIdB142(eventValue.commandId);
      const before = assertRecordableState(eventValue.before);
      const after = assertRecordableState(eventValue.after);
      if (!sameVersion(session.current, before)) {
        runtimeFail('STALE_DOCUMENT', '기록 중 문서 또는 revision이 예상과 달라졌습니다.');
      }
      if (before.documentIdentity !== after.documentIdentity || before.revision === after.revision) {
        runtimeFail('RECORDING_INVALIDATED', '문서를 실제로 한 번 변경한 명령만 기록할 수 있습니다.');
      }
      if (session.steps.length >= SCRIPT_MACRO_B142_LIMITS.maximumSteps) {
        runtimeFail('RECORDING_INVALIDATED', '스크립트 매크로의 최대 명령 수를 초과했습니다.');
      }
      const argumentsValue = this.#catalog.normalizeArguments(eventValue.commandId, eventValue.arguments);
      session.steps.push({
        sequence: session.steps.length,
        commandId: eventValue.commandId,
        arguments: argumentsValue,
      });
      session.current = after;
    } catch (error) {
      this.#session = undefined;
      throw error;
    }
  }

  stop(name: string, stateValue: unknown): ScriptMacroB142 {
    const session = this.#session;
    if (!session) runtimeFail('INVALID_STATE', '기록 중인 스크립트 매크로가 없습니다.');
    const state = assertRecordableState(stateValue);
    if (!sameVersion(session.current, state)) {
      this.#session = undefined;
      runtimeFail('STALE_DOCUMENT', '기록을 마치기 전에 문서 또는 revision이 달라졌습니다.');
    }
    if (!session.steps.length) runtimeFail('INVALID_STATE', '기록된 명령이 없습니다.');
    const macro = validateScriptMacroB142({
      schema: SCRIPT_MACRO_B142_SCHEMA,
      version: SCRIPT_MACRO_B142_VERSION,
      name,
      recordedFrom: {
        documentIdentity: session.start.documentIdentity,
        startRevision: session.start.revision,
        endRevision: session.current.revision,
      },
      steps: session.steps,
    });
    this.#session = undefined;
    return macro;
  }

  cancel(): void {
    this.#session = undefined;
  }
}

export class ScriptMacroReplayControlB142 {
  #reason: 'stopped' | 'cancelled' | undefined;

  get requested(): boolean {
    return this.#reason !== undefined;
  }

  stop(): void {
    this.#reason = 'stopped';
  }

  cancel(): void {
    this.#reason = 'cancelled';
  }

  assertContinue(): void {
    if (this.#reason) runtimeFail('REPLAY_CANCELLED', `스크립트 매크로 재생이 ${this.#reason === 'stopped' ? '중지' : '취소'}되었습니다.`);
  }
}

export function replayScriptMacroB142<Context>(options: {
  macro: unknown;
  expected: ScriptMacroDocumentVersionB142;
  catalog: ScriptMacroCommandCatalogB142<Context>;
  port: ScriptMacroAtomicPortB142<Context>;
  control?: ScriptMacroReplayControlB142;
}): ScriptMacroReplayReceiptB142 {
  const macro = validateScriptMacroB142(options.macro);
  assertScriptMacroDocumentVersionB142(options.expected, '재생 기준 문서 버전');
  if (macro.recordedFrom.documentIdentity !== options.expected.documentIdentity) {
    runtimeFail('STALE_DOCUMENT', '이 매크로를 기록한 문서와 현재 문서가 다릅니다.');
  }
  for (const step of macro.steps) options.catalog.normalizeArguments(step.commandId, step.arguments);
  const state = assertRecordableState(options.port.readState());
  if (!sameVersion(state, options.expected)) runtimeFail('STALE_DOCUMENT', '현재 문서 또는 revision이 재생 기준과 다릅니다.');
  options.control?.assertContinue();

  let appliedSteps = 0;
  const receipt = options.port.executeAtomic({
    operationType: 'jueonyScriptMacroB142',
    expected: { ...options.expected },
    operation(context) {
      for (const step of macro.steps) {
        options.control?.assertContinue();
        options.catalog.execute(context, step);
        appliedSteps += 1;
      }
      options.control?.assertContinue();
    },
  });
  if (
    !receipt
    || receipt.committed !== true
    || receipt.undoUnits !== 1
    || receipt.documentIdentity !== options.expected.documentIdentity
    || receipt.beforeRevision !== options.expected.revision
    || receipt.afterRevision === receipt.beforeRevision
    || appliedSteps !== macro.steps.length
  ) {
    runtimeFail('ATOMIC_CONTRACT_VIOLATION', '매크로 재생의 단일 undo 거래 결과를 확인할 수 없습니다.');
  }
  const after = assertRecordableState(options.port.readState());
  if (after.documentIdentity !== receipt.documentIdentity || after.revision !== receipt.afterRevision) {
    runtimeFail('ATOMIC_CONTRACT_VIOLATION', '매크로 재생 후 문서 revision이 거래 결과와 다릅니다.');
  }
  return { ...receipt, appliedSteps };
}
