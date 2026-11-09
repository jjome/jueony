import test from 'node:test';
import assert from 'node:assert/strict';
import { readOpaqueDocumentTrackChangeInventoryB133 } from '../src/adapters/rhwp/document-track-change-inventory-b133.ts';

const base = {
  contract: 'jueony-document-track-change-opaque-inventory', version: 1,
  source: 'hwp-docinfo-opaque-records', format: 'hwp', coverage: 'hwp-docinfo-only',
  headerDeclaresTrackedChanges: true, configFlags: 56,
  opaqueChangeRecordCount: 2, opaqueAuthorRecordCount: 1,
  recordLimit: 3, returnedRecordCount: 3, truncated: false,
  semanticChangesAvailable: false, acceptRejectAvailable: false,
  records: [
    { kind: 'change', tagId: 96, ordinal: 0, level: 1, byteLength: 24 },
    { kind: 'author', tagId: 97, ordinal: 1, level: 1, byteLength: 18 },
    { kind: 'change', tagId: 96, ordinal: 2, level: 1, byteLength: 32 },
  ],
};

test('missing native inventory stays unsupported', () => {
  assert.deepEqual(readOpaqueDocumentTrackChangeInventoryB133({}),
    { kind: 'blocked', reason: 'unsupported' });
});

test('bounded HWP opaque-record inventory is accepted without implying semantic support', () => {
  const result = readOpaqueDocumentTrackChangeInventoryB133({
    getDocumentTrackChangeInventoryB133: (limit: number) => {
      assert.equal(limit, 64);
      return JSON.stringify({ ...base, recordLimit: 64 });
    },
  }, 500);
  assert.equal(result.kind, 'ready');
  if (result.kind === 'ready') {
    assert.equal(result.value.opaqueChangeRecordCount, 2);
    assert.equal(result.value.semanticChangesAvailable, false);
    assert.equal(result.value.acceptRejectAvailable, false);
  }
});

test('unsupported source formats must return no invented HWP record state', () => {
  const candidate = {
    getDocumentTrackChangeInventoryB133: () => JSON.stringify({
      ...base, format: 'hwpx', coverage: 'unsupported-source-format',
      headerDeclaresTrackedChanges: null, configFlags: null,
      opaqueChangeRecordCount: 0, opaqueAuthorRecordCount: 0,
      recordLimit: 32, returnedRecordCount: 0, records: [],
    }),
  };
  assert.equal(readOpaqueDocumentTrackChangeInventoryB133(candidate).kind, 'ready');
  const invented = { ...JSON.parse(candidate.getDocumentTrackChangeInventoryB133()), opaqueChangeRecordCount: 1 };
  assert.deepEqual(readOpaqueDocumentTrackChangeInventoryB133({
    getDocumentTrackChangeInventoryB133: () => invented,
  }), { kind: 'blocked', reason: 'invalid-contract' });
});

test('extra fields, inconsistent totals, mutating claims and exceptions fail closed', () => {
  for (const value of [
    { ...base, unexpected: true },
    { ...base, returnedRecordCount: 2 },
    { ...base, acceptRejectAvailable: true },
    { ...base, records: [{ ...base.records[0], tagId: 97 }] },
  ]) assert.equal(readOpaqueDocumentTrackChangeInventoryB133({
    getDocumentTrackChangeInventoryB133: () => value,
  }).kind, 'blocked');
  assert.deepEqual(readOpaqueDocumentTrackChangeInventoryB133({
    getDocumentTrackChangeInventoryB133: () => { throw new Error('read failed'); },
  }), { kind: 'blocked', reason: 'read-failed' });
});
