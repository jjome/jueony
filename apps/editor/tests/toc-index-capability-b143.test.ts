import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile, readFileSync} from 'node:fs';
import {promisify} from 'node:util';
import {resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import type {HwpDocument as HwpDocumentType} from '@rhwp/core';
import {
  NO_TOC_INDEX_MUTATION_EVIDENCE_B143,
  TOC_INDEX_OPERATION_IDS_B143,
  assessTocIndexCapabilityB143,
  projectTocIndexRegistryB143,
  readTocIndexInventoryB143,
  type TocIndexCapabilityEvidenceB143,
  type TocIndexContextB143,
  type TocIndexOperationIdB143,
} from '../src/adapters/rhwp/toc-index-capability-b143.ts';

const read = promisify(readFile);
const enginePackage = process.env.JUEONY_ENGINE_PACKAGE
  ? resolve(process.env.JUEONY_ENGINE_PACKAGE)
  : fileURLToPath(new URL('../node_modules/@rhwp/core/', import.meta.url));
const engine = await import(pathToFileURL(resolve(enginePackage, 'rhwp.js')).href);
const {HwpDocument} = engine as typeof import('@rhwp/core');
await engine.default({module_or_path: await read(resolve(enginePackage, 'rhwp_bg.wasm'))});

const body: TocIndexContextB143 = {hasDocument: true, editable: true, story: 'body'};

const nativeName: Record<TocIndexOperationIdB143, string> = {
  'insert-index-mark': 'insertIndexMarkV1',
  'update-index-mark': 'updateIndexMarkV1',
  'insert-table-of-contents': 'insertTableOfContentsV1',
  'refresh-table-of-contents': 'refreshTableOfContentsV1',
  'hide-title-mark': 'setTitleMarkIgnoredV1',
  'show-title-mark': 'setTitleMarkIgnoredV1',
};

function complete(operation: TocIndexOperationIdB143): TocIndexCapabilityEvidenceB143 {
  return {
    schemaVersion: 1,
    nativeMethodNames: [nativeName[operation]],
    durableModelOperations: [operation],
    atomicHistoryOperations: [operation],
    exactReadbackOperations: [operation],
    hwpRoundTripOperations: [operation],
    hwpxRoundTripOperations: [operation],
  };
}

test('Rust model/serializers preserve B143 constructs but current public WASM has no mutation or regeneration API', () => {
  const root = new URL('../../../upstream/rhwp-source/src/', import.meta.url);
  const model = readFileSync(new URL('model/control.rs', root), 'utf8');
  const paragraph = readFileSync(new URL('model/paragraph.rs', root), 'utf8');
  const hwp = readFileSync(new URL('serializer/control.rs', root), 'utf8');
  const hwpx = readFileSync(new URL('serializer/hwpx/section.rs', root), 'utf8');
  assert.match(model, /Control::IndexMark|IndexMark\(IndexMark\)/);
  assert.match(model, /TableOfContents/);
  assert.match(paragraph, /pub struct TitleMark[\s\S]*pub ignore: bool/);
  assert.match(hwp, /serialize_index_mark_payload/);
  assert.match(hwpx, /<hp:indexmark>|<hp:titleMark ignore=/);

  const methods = new Set(Reflect.ownKeys(HwpDocument.prototype).filter((key): key is string => typeof key === 'string'));
  assert.equal(methods.has('getControls'), true);
  assert.equal(methods.has('getFieldList'), true);
  assert.equal(methods.has('setFieldValue'), true, 'generic field text editing exists but is not TOC regeneration');
  for (const method of new Set(Object.values(nativeName))) assert.equal(methods.has(method), false);
});

test('current runtime keeps every B143 mutation disabled and names its exact missing API', () => {
  const methods = Reflect.ownKeys(HwpDocument.prototype).filter((key): key is string => typeof key === 'string');
  for (const operation of TOC_INDEX_OPERATION_IDS_B143) {
    const evidence = {...NO_TOC_INDEX_MUTATION_EVIDENCE_B143, nativeMethodNames: methods};
    const decision = assessTocIndexCapabilityB143(operation, body, evidence);
    assert.equal(decision.state, 'blocked');
    if (decision.state === 'blocked') {
      assert.equal(decision.reason, 'native-api-missing');
      assert.equal(decision.requirement.nativeApi, nativeName[operation]);
    }
    const projection = projectTocIndexRegistryB143(operation, body, evidence);
    assert.equal(projection.enabled, false);
    assert.equal(projection.canReportSuccess, false);
  }
});

test('declaration evidence alone never enables a menu command or reports success', () => {
  for (const operation of TOC_INDEX_OPERATION_IDS_B143) {
    const decision = assessTocIndexCapabilityB143(operation, body, complete(operation));
    assert.equal(decision.state, 'ready-for-native-adapter');
    const projection = projectTocIndexRegistryB143(operation, body, complete(operation));
    assert.deepEqual(
      {enabled: projection.enabled, canReportSuccess: projection.canReportSuccess, reason: projection.reason},
      {enabled: false, canReportSuccess: false, reason: 'native-adapter-not-connected'},
    );
  }
});

test('missing durable model, history, readback, or either file-format proof fails closed', () => {
  const operation: TocIndexOperationIdB143 = 'show-title-mark';
  const cases: Array<[keyof TocIndexCapabilityEvidenceB143, string]> = [
    ['durableModelOperations', 'durable-model-contract-missing'],
    ['atomicHistoryOperations', 'atomic-history-contract-missing'],
    ['exactReadbackOperations', 'exact-readback-contract-missing'],
    ['hwpRoundTripOperations', 'hwp-round-trip-contract-missing'],
    ['hwpxRoundTripOperations', 'hwpx-round-trip-contract-missing'],
  ];
  for (const [key, reason] of cases) {
    const evidence = {...complete(operation), [key]: []};
    const decision = assessTocIndexCapabilityB143(operation, body, evidence);
    assert.equal(decision.state, 'blocked');
    if (decision.state === 'blocked') assert.equal(decision.reason, reason);
  }
});

test('read-only and special-story contexts are not widened to body mutations', () => {
  const evidence = complete('insert-index-mark');
  assert.equal(assessTocIndexCapabilityB143('insert-index-mark', {...body, editable: false}, evidence).state, 'blocked');
  for (const story of ['table-cell', 'header-footer', 'footnote', 'endnote', 'textbox'] as const) {
    const decision = assessTocIndexCapabilityB143('insert-index-mark', {...body, story}, evidence);
    assert.deepEqual(decision.state === 'blocked' && decision.reason, 'unsupported-story');
  }
});

test('the public read seam shows exact TOC fields but never guesses anonymous controls are index marks', () => {
  const port = {
    getFieldList: () => JSON.stringify([
      {fieldId: 9, fieldType: 'toc', name: '', command: 'levels=3', value: '1. 제목\t1',
        location: {sectionIndex: 0, paraIndex: 2}, startCharIdx: 0, endCharIdx: 7},
      {fieldId: 1, fieldType: 'clickhere', name: 'not toc', command: '', value: '',
        location: {sectionIndex: 0, paraIndex: 0}, startCharIdx: 0, endCharIdx: 0},
    ]),
    getControls: () => JSON.stringify([{ctrlId: '', list: 0, para: 1, controlIndex: 3}]),
  };
  const inventory = readTocIndexInventoryB143(port);
  assert.equal(inventory.status, 'available');
  if (inventory.status !== 'available') return;
  assert.equal(inventory.indexMarks, 'unavailable-exact-api');
  assert.equal(inventory.opaqueControlCount, 1);
  assert.deepEqual(inventory.tocFields.map(field => ({id: field.fieldId, value: field.value})), [
    {id: 9, value: '1. 제목\t1'},
  ]);
});

test('malformed field/control data is blocked instead of returning a partial inventory', () => {
  assert.deepEqual(readTocIndexInventoryB143(undefined), {status: 'blocked', reason: 'read-api-unavailable'});
  assert.deepEqual(readTocIndexInventoryB143({getFieldList: () => '{', getControls: () => '[]'}),
    {status: 'blocked', reason: 'malformed-native-response'});
  assert.deepEqual(readTocIndexInventoryB143({
    getFieldList: () => JSON.stringify([{fieldId: 1, fieldType: 'toc'}]),
    getControls: () => '[]',
  }), {status: 'blocked', reason: 'malformed-native-response'});
});

function bodyText(document: HwpDocumentType): string {
  return document.getTextRange(0, 0, 0, document.getParagraphLength(0, 0));
}

test('blocked B143 commands create no mutation and HWP/HWPX save-reopen remains unchanged', () => {
  const document = HwpDocument.createEmpty();
  document.createBlankDocument();
  document.insertText(0, 0, 0, 'B143 fail-closed');
  const hwp = document.exportHwp();
  const hwpx = document.exportHwpx();
  try {
    for (const operation of TOC_INDEX_OPERATION_IDS_B143) {
      const projection = projectTocIndexRegistryB143(operation, body, NO_TOC_INDEX_MUTATION_EVIDENCE_B143);
      assert.equal(projection.enabled, false);
      assert.deepEqual(document.exportHwp(), hwp);
      assert.deepEqual(document.exportHwpx(), hwpx);
    }
    for (const bytes of [hwp, hwpx]) {
      const reopened = new HwpDocument(bytes);
      try {
        assert.equal(bodyText(reopened), 'B143 fail-closed');
        assert.deepEqual(readTocIndexInventoryB143({
          getFieldList: () => reopened.getFieldList(),
          getControls: () => reopened.getControls(),
        }), {
          status: 'available',
          tocFields: [],
          indexMarks: 'unavailable-exact-api',
          opaqueControlCount: JSON.parse(reopened.getControls()).length,
          evidenceStamp: JSON.stringify({
            tocFields: [], indexMarks: 'unavailable-exact-api',
            opaqueControlCount: JSON.parse(reopened.getControls()).length,
          }),
        });
      } finally {
        reopened.free();
      }
    }
  } finally {
    document.free();
  }
});
