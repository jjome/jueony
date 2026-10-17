import test from 'node:test';
import assert from 'node:assert/strict';
import {readDocumentMetadata, validateDocumentMetadataValues, applyDocumentMetadata, preflightDocumentMetadata} from '../src/adapters/rhwp/document-metadata.ts';
import {capturePreservationEvidence, comparePreservationEvidence} from '../src/adapters/rhwp/preservation.ts';
const values = {title: '업무 😀', subject: '<&>', author: '작성자', keywords: '가, 나', description: '설명\n두 줄\t탭'};
const state = {editable: true, values, fingerprint: 'a'.repeat(64), reason: null};
test('document summary validates exactly five Unicode strings including emoji', () => {
  assert.deepEqual(validateDocumentMetadataValues(values), values);
  for (const bad of [{...values, extra: ''}, {...values, title: 1}, {...values, title: 'x'.repeat(4097)}, {...values, title: '\ud800'}, {...values, description: '\u0000'}, []]) assert.throws(() => validateDocumentMetadataValues(bad));
  assert.doesNotThrow(() => validateDocumentMetadataValues({...values, title: '😀'.repeat(2048)}));
  assert.throws(() => validateDocumentMetadataValues({...values, title: '😀'.repeat(2049)}));
});
test('metadata reader fails closed for old engines and malformed ownership without inventing empty values', () => {
  assert.equal(readDocumentMetadata({}).editable, false);
  for (const response of [{...state, fingerprint: 'fake'}, {...state, editable: 'yes'}, {...state, values: {title: ''}}, {editable: false, reason: 1}, 'not JSON']) {
    const result = readDocumentMetadata({getDocumentMetadata: () => response, setDocumentMetadata() {}});
    assert.equal(result.editable, false); assert.equal(result.values, undefined);
  }
});
test('metadata reader retains actual read-only values and borrowed document identity', () => {
  const result = readDocumentMetadata({borrowDocumentHandle: () => ({getDocumentMetadata: () => JSON.stringify({...state, editable: false, reason: '배포 문서'}), setDocumentMetadata() {}})});
  assert.equal(result.editable, false); assert.deepEqual(result.values, values); assert.equal(result.reason, '배포 문서');
});
function doc(response: unknown = state) {
  let active = true, writes = 0;
  return {get active() {return active;}, get writes() {return writes;}, canvasMetricsActive: () => active,
    selectCanvasMetrics: (v: boolean) => {active = v;}, getDocumentMetadata: () => response,
    setDocumentMetadata: () => {writes++; throw Error('unexpected mutation');}};
}
test('metadata no-op neither mutates nor serializes and restores Canvas mode', () => {
  const d = doc(); assert.equal(applyDocumentMetadata(d, state, values), false); assert.equal(d.active, true); assert.equal(d.writes, 0);
  preflightDocumentMetadata(d, state, values); assert.equal(d.active, true); assert.equal(d.writes, 0);
});
test('stale fingerprint or changed native values refuse before export/write and restore Canvas finally', () => {
  for (const response of [{...state, fingerprint: 'b'.repeat(64)}, {...state, values: {...values, title: '외부 변경'}}, {...state, editable: false}]) {
    const d = doc(response); assert.throws(() => applyDocumentMetadata(d, state, {...values, title: '새 제목'}), /다시/); assert.equal(d.active, true); assert.equal(d.writes, 0);
    assert.throws(() => preflightDocumentMetadata(d, state, {...values, title: '새 제목'}), /다시/); assert.equal(d.active, true); assert.equal(d.writes, 0);
  }
});
test('unknown Canvas state refuses metadata mutation', () => {
  const d = {...doc(), canvasMetricsActive: () => undefined}; assert.throws(() => applyDocumentMetadata(d, state, values), /측정/); assert.equal(d.writes, 0);
});
test('generic preservation reads five summary strings exactly and rejects lost or unreadable values', () => {
  const capture = (value: any) => capturePreservationEvidence({getDocumentMetadata: () => value});
  const before = capture(state), changed = capture({...state, values: {...values, keywords: '손실'}});
  assert.deepEqual(before.values['summary-metadata'], values);
  const report = comparePreservationEvidence(before, changed, 'hwpx', {schemaVersion: 1, outputFormat: 'hwpx', count: 0, losses: []});
  assert.ok(report.issues.some(i => i.path === 'summary-metadata' && i.code === 'changed'));
  assert.ok(!JSON.stringify(report).includes('손실'));
  assert.deepEqual(capture({...state, fingerprint: 'b'.repeat(64)}).values['summary-metadata'], values, 'raw container tokens are not semantic values');
  assert.ok(capture({editable: false, reason: 'ambiguous storage'}).issues.some(i => i.path === 'summary-metadata' && i.code === 'unreadable'));
  assert.ok(capturePreservationEvidence({}).unverified.some(s => s.includes('보존 읽기 API')));
});
