import assert from 'node:assert/strict';
import test from 'node:test';

import {
  SCRIPT_MACRO_B142_SCHEMA,
  SCRIPT_MACRO_B142_VERSION,
  normalizeScriptMacroArgumentsB142,
  parseScriptMacroB142,
  serializeScriptMacroB142,
  validateScriptMacroB142,
} from '../src/modules/script-macros/public/index.ts';
import type {
  ScriptMacroArgumentsB142,
  ScriptMacroB142,
  ScriptMacroDocumentVersionB142,
} from '../src/modules/script-macros/public/index.ts';
import {
  ScriptMacroCommandCatalogB142,
  ScriptMacroRecorderB142,
  ScriptMacroReplayControlB142,
  ScriptMacroRuntimeErrorB142,
  replayScriptMacroB142,
} from '../src/adapters/rhwp/script-macro-runtime-b142.ts';
import type {
  RecordableScriptMacroCommandB142,
  ScriptMacroAtomicPortB142,
  ScriptMacroAtomicRequestB142,
  ScriptMacroRuntimeStateB142,
} from '../src/adapters/rhwp/script-macro-runtime-b142.ts';

interface TestDocumentB142 {
  identity: string;
  revision: number;
  text: string;
  undo: string[];
  composing: boolean;
  selected: boolean;
}

function state(document: TestDocumentB142): ScriptMacroRuntimeStateB142 {
  return {
    documentIdentity: document.identity,
    revision: `r${document.revision}`,
    active: true,
    editable: true,
    busy: false,
    composing: document.composing,
    hasSelection: document.selected,
  };
}

function textArgument(value: unknown): { text: string } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('text argument expected');
  const text = (value as Record<string, unknown>).text;
  if (typeof text !== 'string' || text.length > 20) throw new Error('bounded text expected');
  return { text };
}

const safe = {
  deterministic: true,
  dialogFree: true,
  selectionIndependent: true,
  imeIndependent: true,
} as const;

function appendCommand(
  after?: (document: TestDocumentB142) => void,
): RecordableScriptMacroCommandB142<TestDocumentB142> {
  return {
    id: 'text:append',
    recordable: true,
    safety: safe,
    validateArguments: textArgument,
    execute(document, argumentsValue) {
      document.text += argumentsValue.text;
      after?.(document);
    },
  };
}

function atomicPort(document: TestDocumentB142): ScriptMacroAtomicPortB142<TestDocumentB142> {
  return {
    readState: () => state(document),
    executeAtomic(request: ScriptMacroAtomicRequestB142<TestDocumentB142>) {
      assert.equal(request.operationType, 'jueonyScriptMacroB142');
      assert.deepEqual(request.expected, {
        documentIdentity: document.identity,
        revision: `r${document.revision}`,
      });
      const before = document.text;
      const beforeRevision = `r${document.revision}`;
      try {
        request.operation(document);
      } catch (error) {
        document.text = before;
        throw error;
      }
      document.undo.push(before);
      document.revision += 1;
      return {
        committed: true,
        documentIdentity: document.identity,
        beforeRevision,
        afterRevision: `r${document.revision}`,
        undoUnits: 1,
      };
    },
  };
}

function macroWithSteps(
  identity: string,
  steps: Array<{ commandId: string; arguments: ScriptMacroArgumentsB142 }>,
): ScriptMacroB142 {
  return validateScriptMacroB142({
    schema: SCRIPT_MACRO_B142_SCHEMA,
    version: SCRIPT_MACRO_B142_VERSION,
    name: '시험 매크로',
    recordedFrom: { documentIdentity: identity, startRevision: 'r0', endRevision: 'r1' },
    steps: steps.map((step, sequence) => ({ sequence, ...step })),
  });
}

test('B142 records only a contiguous chain of successful registered dispatcher commands', () => {
  const document: TestDocumentB142 = {
    identity: 'document-1', revision: 0, text: '', undo: [], composing: false, selected: false,
  };
  const catalog = new ScriptMacroCommandCatalogB142([appendCommand()]);
  const recorder = new ScriptMacroRecorderB142(catalog);
  recorder.start(state(document));

  const beforeFirst = state(document);
  document.text += 'A'; document.revision += 1;
  recorder.recordSuccessfulCommand({
    source: 'command-dispatcher', outcome: 'success', commandId: 'text:append', arguments: { text: 'A' },
    before: beforeFirst, after: state(document),
  });
  const beforeSecond = state(document);
  document.text += 'B'; document.revision += 1;
  recorder.recordSuccessfulCommand({
    source: 'command-dispatcher', outcome: 'success', commandId: 'text:append', arguments: { text: 'B' },
    before: beforeSecond, after: state(document),
  });

  const macro = recorder.stop('두 글자', state(document));
  assert.equal(recorder.recording, false);
  assert.deepEqual(macro.steps.map(step => [step.sequence, step.commandId, step.arguments.text]), [
    [0, 'text:append', 'A'],
    [1, 'text:append', 'B'],
  ]);
  assert.deepEqual(macro.recordedFrom, {
    documentIdentity: 'document-1', startRevision: 'r0', endRevision: 'r2',
  });
});

test('B142 invalidates recording for raw input, failed or unregistered commands, selection, IME and revision drift', () => {
  const catalog = new ScriptMacroCommandCatalogB142([appendCommand()]);
  const base = (): TestDocumentB142 => ({
    identity: 'document-1', revision: 0, text: '', undo: [], composing: false, selected: false,
  });
  const invalidEvents: Array<(document: TestDocumentB142) => unknown> = [
    document => ({ source: 'raw-keyboard', outcome: 'success', commandId: 'text:append', arguments: { text: 'A' }, before: state(document), after: { ...state(document), revision: 'r1' } }),
    document => ({ source: 'command-dispatcher', outcome: 'failed', commandId: 'text:append', arguments: { text: 'A' }, before: state(document), after: state(document) }),
    document => ({ source: 'command-dispatcher', outcome: 'success', commandId: 'text:unknown', arguments: {}, before: state(document), after: { ...state(document), revision: 'r1' } }),
    document => ({ source: 'command-dispatcher', outcome: 'success', commandId: 'text:append', arguments: { text: 'A' }, before: { ...state(document), hasSelection: true }, after: { ...state(document), revision: 'r1' } }),
    document => ({ source: 'command-dispatcher', outcome: 'success', commandId: 'text:append', arguments: { text: 'A' }, before: { ...state(document), composing: true }, after: { ...state(document), revision: 'r1' } }),
    document => ({ source: 'command-dispatcher', outcome: 'success', commandId: 'text:append', arguments: { text: 'A' }, before: { ...state(document), revision: 'r9' }, after: { ...state(document), revision: 'r10' } }),
  ];
  for (const makeEvent of invalidEvents) {
    const document = base();
    const recorder = new ScriptMacroRecorderB142(catalog);
    recorder.start(state(document));
    assert.throws(() => recorder.recordSuccessfulCommand(makeEvent(document)));
    assert.equal(recorder.recording, false, 'unsafe event cancels the whole recording');
  }

  const selected = base(); selected.selected = true;
  assert.throws(() => new ScriptMacroRecorderB142(catalog).start(state(selected)), /선택 영역/);
  const composing = base(); composing.composing = true;
  assert.throws(() => new ScriptMacroRecorderB142(catalog).start(state(composing)), /IME/);
});

test('B142 cancel discards a recording and stop refuses empty or stale sessions', () => {
  const document: TestDocumentB142 = {
    identity: 'document-1', revision: 0, text: '', undo: [], composing: false, selected: false,
  };
  const recorder = new ScriptMacroRecorderB142(new ScriptMacroCommandCatalogB142([appendCommand()]));
  recorder.start(state(document));
  assert.throws(() => recorder.stop('비어 있음', state(document)), /기록된 명령/);
  assert.equal(recorder.recording, true);
  recorder.cancel();
  assert.equal(recorder.recording, false);
});

test('B142 serialization is canonical, bounded and rejects unsafe schema data', () => {
  const first = macroWithSteps('document-1', [{ commandId: 'text:append', arguments: { z: 1, a: 'A' } }]);
  const second = macroWithSteps('document-1', [{ commandId: 'text:append', arguments: { a: 'A', z: 1 } }]);
  const serialized = serializeScriptMacroB142(first);
  assert.equal(serialized, serializeScriptMacroB142(second));
  assert.deepEqual(parseScriptMacroB142(serialized), second);
  assert.throws(() => validateScriptMacroB142({ ...first, extra: true }), /알 수 없는/);
  assert.throws(() => validateScriptMacroB142({ ...first, steps: [{ ...first.steps[0], sequence: 1 }] }), /실행 순서/);
  assert.throws(() => normalizeScriptMacroArgumentsB142({ number: Number.NaN }), /유한/);
  assert.throws(() => normalizeScriptMacroArgumentsB142({ text: '가'.repeat(1_400) }), /너무 큽니다/);
  assert.throws(() => normalizeScriptMacroArgumentsB142(JSON.parse('{"__proto__":{"polluted":true}}')), /안전하지/);
  let deep: unknown = 'end';
  for (let index = 0; index < 10; index += 1) deep = { child: deep };
  assert.throws(() => normalizeScriptMacroArgumentsB142({ deep }), /중첩/);
});

test('B142 replays deterministically in one outer undo unit and verifies the committed revision', () => {
  const document: TestDocumentB142 = {
    identity: 'document-1', revision: 4, text: 'base', undo: [], composing: false, selected: false,
  };
  const macro = macroWithSteps(document.identity, [
    { commandId: 'text:append', arguments: { text: 'A' } },
    { commandId: 'text:append', arguments: { text: 'B' } },
  ]);
  const expected: ScriptMacroDocumentVersionB142 = { documentIdentity: document.identity, revision: 'r4' };
  const receipt = replayScriptMacroB142({
    macro,
    expected,
    catalog: new ScriptMacroCommandCatalogB142([appendCommand()]),
    port: atomicPort(document),
  });
  assert.equal(document.text, 'baseAB');
  assert.equal(document.undo.length, 1);
  assert.equal(receipt.appliedSteps, 2);
  assert.equal(receipt.beforeRevision, 'r4');
  assert.equal(receipt.afterRevision, 'r5');
  document.text = document.undo.pop()!;
  assert.equal(document.text, 'base', 'one undo restores the whole macro');
});

test('B142 rolls back every step when execution fails or stop is requested', () => {
  const failureDocument: TestDocumentB142 = {
    identity: 'document-1', revision: 2, text: 'base', undo: [], composing: false, selected: false,
  };
  const exploding: RecordableScriptMacroCommandB142<TestDocumentB142> = {
    id: 'text:explode', recordable: true, safety: safe,
    validateArguments: value => value,
    execute(document) { document.text += 'partial'; throw new Error('boom'); },
  };
  const failureMacro = macroWithSteps(failureDocument.identity, [
    { commandId: 'text:append', arguments: { text: 'A' } },
    { commandId: 'text:explode', arguments: {} },
  ]);
  assert.throws(() => replayScriptMacroB142({
    macro: failureMacro,
    expected: { documentIdentity: failureDocument.identity, revision: 'r2' },
    catalog: new ScriptMacroCommandCatalogB142([appendCommand(), exploding]),
    port: atomicPort(failureDocument),
  }), /boom/);
  assert.equal(failureDocument.text, 'base');
  assert.equal(failureDocument.undo.length, 0);
  assert.equal(failureDocument.revision, 2);

  const stoppedDocument: TestDocumentB142 = {
    identity: 'document-1', revision: 7, text: 'base', undo: [], composing: false, selected: false,
  };
  const control = new ScriptMacroReplayControlB142();
  const stoppingCommand = appendCommand(() => control.stop());
  const stoppedMacro = macroWithSteps(stoppedDocument.identity, [
    { commandId: 'text:append', arguments: { text: 'A' } },
    { commandId: 'text:append', arguments: { text: 'B' } },
  ]);
  assert.throws(() => replayScriptMacroB142({
    macro: stoppedMacro,
    expected: { documentIdentity: stoppedDocument.identity, revision: 'r7' },
    catalog: new ScriptMacroCommandCatalogB142([stoppingCommand]),
    port: atomicPort(stoppedDocument),
    control,
  }), (error: unknown) => error instanceof ScriptMacroRuntimeErrorB142 && error.code === 'REPLAY_CANCELLED');
  assert.equal(stoppedDocument.text, 'base');
  assert.equal(stoppedDocument.undo.length, 0);
});

test('B142 blocks stale identity/revision, unsafe editor state and unknown commands before atomic execution', () => {
  const document: TestDocumentB142 = {
    identity: 'document-1', revision: 3, text: '', undo: [], composing: false, selected: false,
  };
  const port = atomicPort(document);
  let transactions = 0;
  const countedPort: ScriptMacroAtomicPortB142<TestDocumentB142> = {
    readState: port.readState,
    executeAtomic(request) { transactions += 1; return port.executeAtomic(request); },
  };
  const catalog = new ScriptMacroCommandCatalogB142([appendCommand()]);
  const macro = macroWithSteps(document.identity, [{ commandId: 'text:append', arguments: { text: 'A' } }]);
  assert.throws(() => replayScriptMacroB142({
    macro, expected: { documentIdentity: document.identity, revision: 'r2' }, catalog, port: countedPort,
  }), /revision/);
  assert.equal(transactions, 0);

  document.selected = true;
  assert.throws(() => replayScriptMacroB142({
    macro, expected: { documentIdentity: document.identity, revision: 'r3' }, catalog, port: countedPort,
  }), /선택 영역/);
  document.selected = false;
  const unknown = macroWithSteps(document.identity, [{ commandId: 'text:missing', arguments: {} }]);
  assert.throws(() => replayScriptMacroB142({
    macro: unknown, expected: { documentIdentity: document.identity, revision: 'r3' }, catalog, port: countedPort,
  }), /등록되지 않은/);
  assert.equal(transactions, 0);
});

test('B142 rejects a host that does not attest one committed undo transaction', () => {
  const document: TestDocumentB142 = {
    identity: 'document-1', revision: 0, text: '', undo: [], composing: false, selected: false,
  };
  const macro = macroWithSteps(document.identity, [{ commandId: 'text:append', arguments: { text: 'A' } }]);
  const lyingPort: ScriptMacroAtomicPortB142<TestDocumentB142> = {
    readState: () => state(document),
    executeAtomic(request) {
      request.operation(document);
      return {
        committed: true,
        documentIdentity: document.identity,
        beforeRevision: 'r0',
        afterRevision: 'r0',
        undoUnits: 1,
      };
    },
  };
  assert.throws(() => replayScriptMacroB142({
    macro,
    expected: { documentIdentity: document.identity, revision: 'r0' },
    catalog: new ScriptMacroCommandCatalogB142([appendCommand()]),
    port: lyingPort,
  }), (error: unknown) => error instanceof ScriptMacroRuntimeErrorB142 && error.code === 'ATOMIC_CONTRACT_VIOLATION');
});
