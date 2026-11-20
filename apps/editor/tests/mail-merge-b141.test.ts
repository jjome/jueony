import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import init, { HwpDocument } from '@rhwp/core';
import {
  MailMergeErrorB141,
  auditMailMergeCapabilityB141,
  createMailMergePlanB141,
  executeMailMergeB141,
  type MailMergeDocumentCopyB141,
  type MailMergeTemplateStateB141,
} from '../src/modules/document/application/mail-merge-b141.ts';

await init({ module_or_path: await readFile(new URL('../node_modules/@rhwp/core/rhwp_bg.wasm', import.meta.url)) });
const fingerprint = 'a'.repeat(64);
const state = (format: 'hwp' | 'hwpx' = 'hwpx'): MailMergeTemplateStateB141 => ({ revision: 'template:1', fingerprint, format, placeholders: ['성명'] });
const plan = (format: 'hwp' | 'hwpx' = 'hwpx') => createMailMergePlanB141({
  template: state(format), columns: ['성명'], rows: [{ 성명: '홍길동' }, { 성명: '김민수' }],
  outputNames: [`홍길동.${format}`, `김민수.${format}`],
});

test('B141 plan validates schema, row budget, values, extensions, and output collisions', () => {
  assert.equal(plan().rows.length, 2);
  const invalid = [
    () => createMailMergePlanB141({ template: state(), columns: ['부서'], rows: [{ 부서: '총무과' }], outputNames: ['a.hwpx'] }),
    () => createMailMergePlanB141({ template: state(), columns: ['성명'], rows: [{ 성명: '가', 부서: '총무과' }], outputNames: ['a.hwpx'] }),
    () => createMailMergePlanB141({ template: state(), columns: ['성명'], rows: Array.from({ length: 101 }, () => ({ 성명: '가' })), outputNames: Array.from({ length: 101 }, (_, i) => `${i}.hwpx`) }),
    () => createMailMergePlanB141({ template: state(), columns: ['성명'], rows: [{ 성명: '가' }, { 성명: '나' }], outputNames: ['결과.hwpx', '결과.HWPX'] }),
    () => createMailMergePlanB141({ template: state(), columns: ['성명'], rows: [{ 성명: '가' }], outputNames: ['../결과.hwpx'] }),
  ];
  for (const run of invalid) assert.throws(run, MailMergeErrorB141);
});

test('B141 capability requires both isolated document cloning and transactional output', () => {
  assert.deepEqual(auditMailMergeCapabilityB141({}), { supported: false, missing: ['template-clone-field-port', 'transactional-output-port'] });
  assert.deepEqual(auditMailMergeCapabilityB141({ template: { observe() {}, clone() {} }, output: { begin() {} } }), { supported: true, missing: [] });
});

test('B141 creates independent real HWP/HWPX copies, fills fields, and never mutates the template', async () => {
  for (const format of ['hwp', 'hwpx'] as const) {
    const source = HwpDocument.createEmpty(); source.createBlankDocument(); source.insertText(0, 0, 0, ' ');
    source.insertClickHereField(0, 0, 1, '성명을 입력하세요', '', '성명', true);
    const save = (document: HwpDocument) => format === 'hwp' ? document.exportHwp() : document.exportHwpx();
    const sourceBytes = save(source);
    const outputs = new Map<string, Uint8Array>(); let staged = new Map<string, Uint8Array>();
    const template = {
      observe: async () => state(format),
      clone: async (): Promise<MailMergeDocumentCopyB141> => {
        const copy = new HwpDocument(sourceBytes);
        return {
          sourceFingerprint: fingerprint,
          async setField(name, value) { const result = JSON.parse(copy.setFieldValueByName(name, value)); if (!result.ok) throw Error('field'); },
          async readFields(names) { const fields = JSON.parse(copy.getFieldList()); return Object.fromEntries(names.map(name => [name, fields.find((field: any) => field.name === name)?.value])); },
          async export() { return save(copy); }, dispose() { copy.free(); },
        };
      },
    };
    const output = { async begin() { staged = new Map(); return {
      async stage(name: string, bytes: Uint8Array) { staged.set(name, bytes); },
      async commit() { for (const entry of staged) outputs.set(...entry); staged.clear(); },
      async rollback() { staged.clear(); },
    }; } };
    try {
      const receipt = await executeMailMergeB141(plan(format), { template, output });
      assert.deepEqual(receipt, { status: 'committed', count: 2, outputNames: [`홍길동.${format}`, `김민수.${format}`] });
      assert.deepEqual(save(source), sourceBytes);
      for (const [name, expected] of [[`홍길동.${format}`, '홍길동'], [`김민수.${format}`, '김민수']] as const) {
        const reopened = new HwpDocument(outputs.get(name)!);
        try { assert.equal(JSON.parse(reopened.getFieldList()).find((field: any) => field.name === '성명').value, expected); }
        finally { reopened.free(); }
      }
    } finally { source.free(); }
  }
});

test('B141 stale template and partial row failure roll back every staged output and dispose copies', async () => {
  for (const fault of ['stale', 'row'] as const) {
    let observations = 0, disposed = 0, rolledBack = 0, committed = 0;
    const staged = new Map<string, Uint8Array>();
    const template = {
      observe: async () => fault === 'stale' && ++observations >= 3 ? { ...state(), revision: 'template:2' } : state(),
      clone: async (): Promise<MailMergeDocumentCopyB141> => {
        let values: Record<string, string> = {};
        return { sourceFingerprint: fingerprint,
          async setField(name, value) { if (fault === 'row' && value === '김민수') throw Error('injected'); values[name] = value; },
          async readFields() { return { ...values }; }, async export() { return new Uint8Array([1, 2, 3]); },
          dispose() { disposed += 1; },
        };
      },
    };
    const output = { async begin() { return {
      async stage(name: string, bytes: Uint8Array) { staged.set(name, bytes); },
      async commit() { committed += 1; }, async rollback() { rolledBack += 1; staged.clear(); },
    }; } };
    await assert.rejects(executeMailMergeB141(plan(), { template, output }));
    assert.equal(committed, 0); assert.equal(rolledBack, 1); assert.equal(staged.size, 0);
    assert.ok(disposed >= 1);
  }
});
