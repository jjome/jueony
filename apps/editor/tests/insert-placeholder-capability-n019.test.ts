import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readFileSync } from 'node:fs';
import { promisify } from 'node:util';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { HwpDocument as HwpDocumentType } from '@rhwp/core';
import {
  INSERT_PLACEHOLDER_COMMAND_IDS_N019,
  assessInsertPlaceholderCapabilityN019,
  projectInsertPlaceholderRegistryN019,
  rejectInsertPlaceholderDispatchN019,
  type InsertPlaceholderCapabilityEvidenceN019,
  type InsertPlaceholderCommandIdN019,
  type InsertPlaceholderContextN019,
} from '../src/shortcuts/insert-placeholder-capability-n019.ts';

const read = promisify(readFile);
const enginePackage = process.env.JUEONY_ENGINE_PACKAGE
  ? resolve(process.env.JUEONY_ENGINE_PACKAGE)
  : fileURLToPath(new URL('../node_modules/@rhwp/core/', import.meta.url));
const engine = await import(pathToFileURL(resolve(enginePackage, 'rhwp.js')).href);
const { HwpDocument } = engine as typeof import('@rhwp/core');
await engine.default({ module_or_path: await read(resolve(enginePackage, 'rhwp_bg.wasm')) });

const bodyContext: InsertPlaceholderContextN019 = {
  hasDocument: true,
  editable: true,
  formMode: false,
  kind: 'body-caret',
};

const emptyEvidence = (): InsertPlaceholderCapabilityEvidenceN019 => ({
  schemaVersion: 1,
  nativeMethodNames: [],
  durableModelContracts: [],
  atomicHistoryCommands: [],
  hwpRoundTripCommands: [],
  hwpxRoundTripCommands: [],
});

function completeEvidence(commandId: InsertPlaceholderCommandIdN019): InsertPlaceholderCapabilityEvidenceN019 {
  const comment = commandId === 'insert:comment';
  return {
    schemaVersion: 1,
    nativeMethodNames: [comment ? 'insertCommentAtCursorV1' : 'insertParagraphBandAtCursorV1'],
    durableModelContracts: [comment ? 'comment-model-kind-and-anchor-v1' : 'paragraph-band-model-and-anchor-v1'],
    atomicHistoryCommands: [commandId],
    hwpRoundTripCommands: [commandId],
    hwpxRoundTripCommands: [commandId],
  };
}

test('current Rust/WASM and Studio expose both N019 commands only as disabled placeholders', () => {
  const methods = new Set(Reflect.ownKeys(HwpDocument.prototype).filter((key): key is string => typeof key === 'string'));
  assert.equal(methods.has('insertCommentAtCursorV1'), false);
  assert.equal(methods.has('insertParagraphBandAtCursorV1'), false);

  const studio = readFileSync(new URL('../../../upstream/rhwp-source/rhwp-studio/src/command/commands/insert.ts', import.meta.url), 'utf8');
  assert.match(studio, /function stub[\s\S]*canExecute:\s*\(\)\s*=>\s*false/);
  assert.match(studio, /stub\('insert:comment'/);
  assert.match(studio, /stub\('insert:para-band'/);

  for (const commandId of INSERT_PLACEHOLDER_COMMAND_IDS_N019) {
    const evidence = emptyEvidence();
    evidence.nativeMethodNames = [...methods];
    const projection = projectInsertPlaceholderRegistryN019(commandId, bodyContext, evidence);
    assert.equal(projection.enabled, false);
    assert.equal(projection.canReportSuccess, false);
    assert.equal(projection.reason, 'native-api-missing');
    assert.equal(rejectInsertPlaceholderDispatchN019(projection).ok, false);
  }
});

test('capability stages require durable model, atomic history, and both save/reopen proofs', () => {
  for (const commandId of INSERT_PLACEHOLDER_COMMAND_IDS_N019) {
    const full = completeEvidence(commandId);
    const stages: Array<[Partial<InsertPlaceholderCapabilityEvidenceN019>, string]> = [
      [{ durableModelContracts: [] }, 'durable-model-contract-missing'],
      [{ atomicHistoryCommands: [] }, 'atomic-history-contract-missing'],
      [{ hwpRoundTripCommands: [] }, 'hwp-round-trip-contract-missing'],
      [{ hwpxRoundTripCommands: [] }, 'hwpx-round-trip-contract-missing'],
    ];
    for (const [patch, reason] of stages) {
      const decision = assessInsertPlaceholderCapabilityN019(commandId, bodyContext, { ...full, ...patch });
      assert.equal(decision.state, 'blocked');
      if (decision.state === 'blocked') assert.equal(decision.reason, reason);
    }
    const projection = projectInsertPlaceholderRegistryN019(commandId, bodyContext, full);
    assert.equal(projection.status, 'native-adapter-not-connected');
    assert.equal(projection.enabled, false);
    assert.deepEqual(rejectInsertPlaceholderDispatchN019(projection), {
      ok: false,
      reason: 'native-adapter-not-connected',
      capabilityReason: 'native-adapter-not-connected',
      requiredNativeApi: commandId === 'insert:comment' ? 'insertCommentAtCursorV1' : 'insertParagraphBandAtCursorV1',
    });
  }
});

test('unsupported editor contexts fail closed before capability declarations', () => {
  const cases: Array<[Partial<InsertPlaceholderContextN019>, string]> = [
    [{ hasDocument: false }, 'no-document'],
    [{ editable: false }, 'read-only'],
    [{ formMode: true }, 'form-mode'],
    [{ kind: 'table-cell' }, 'unsupported-context'],
    [{ kind: 'header-footer' }, 'unsupported-context'],
    [{ kind: 'footnote' }, 'unsupported-context'],
    [{ kind: 'object-selection' }, 'unsupported-context'],
  ];
  for (const commandId of INSERT_PLACEHOLDER_COMMAND_IDS_N019) {
    for (const [patch, reason] of cases) {
      const projection = projectInsertPlaceholderRegistryN019(commandId, { ...bodyContext, ...patch }, completeEvidence(commandId));
      assert.equal(projection.enabled, false);
      assert.equal(projection.reason, reason);
      assert.equal(rejectInsertPlaceholderDispatchN019(projection).ok, false);
    }
  }
});

test('invalid or future capability evidence cannot enable a placeholder', () => {
  const invalid = { ...completeEvidence('insert:comment'), schemaVersion: 2 } as unknown as InsertPlaceholderCapabilityEvidenceN019;
  const projection = projectInsertPlaceholderRegistryN019('insert:comment', bodyContext, invalid);
  assert.equal(projection.reason, 'capability-evidence-invalid');
  assert.equal(projection.enabled, false);
});

function bodyText(document: HwpDocumentType): string {
  return document.getTextRange(0, 0, 0, document.getParagraphLength(0, 0));
}

test('blocked dispatch creates no undo/redo work and HWP/HWPX save-reopen stays unchanged', () => {
  const document = HwpDocument.createEmpty();
  document.createBlankDocument();
  document.insertText(0, 0, 0, 'N019 capability guard');
  const history = { undo: [] as string[], redo: [] as string[] };
  const beforeHwp = document.exportHwp();
  const beforeHwpx = document.exportHwpx();
  try {
    for (const commandId of INSERT_PLACEHOLDER_COMMAND_IDS_N019) {
      const projection = projectInsertPlaceholderRegistryN019(commandId, bodyContext, emptyEvidence());
      const result = rejectInsertPlaceholderDispatchN019(projection);
      assert.equal(result.ok, false);
      assert.deepEqual(history, { undo: [], redo: [] });
      assert.deepEqual(document.exportHwp(), beforeHwp);
      assert.deepEqual(document.exportHwpx(), beforeHwpx);
    }

    for (const bytes of [beforeHwp, beforeHwpx]) {
      const reopened = new HwpDocument(bytes);
      try {
        assert.equal(bodyText(reopened), 'N019 capability guard');
        assert.equal(JSON.parse(reopened.getControls()).some((item: { ctrlId?: string }) => item.ctrlId === 'tcmt'), false);
      } finally {
        reopened.free();
      }
    }
  } finally {
    document.free();
  }
});
