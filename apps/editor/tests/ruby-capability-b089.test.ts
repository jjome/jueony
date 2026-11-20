import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import init, { HwpDocument } from '@rhwp/core';
import {
  RubyCapabilityErrorB089,
  assertRubyRequestSupportedB089,
  auditRubyCapabilityB089,
  type RubyRequestTargetB089,
} from '../src/adapters/rhwp/ruby-capability-b089.ts';

await init({ module_or_path: await readFile(new URL('../node_modules/@rhwp/core/rhwp_bg.wasm', import.meta.url)) });

const validTarget = (): RubyRequestTargetB089 => ({
  revision: 'doc:1', story: 'body', section: 0, paragraph: 0,
  start: 0, end: 2, cellPath: [], selectionKinds: ['plain-text'],
});

test('B089 audit distinguishes model/codec preservation from a complete editing capability', () => {
  const fakeComplete = {
    getRubyContext() {}, insertRubyEx() {}, removeRubyEx() {},
  };
  assert.deepEqual(auditRubyCapabilityB089(fakeComplete), {
    supported: true, missingMethods: [], limitations: [],
  });
  const document = HwpDocument.createEmpty();
  try {
    const current = auditRubyCapabilityB089(document);
    assert.equal(current.supported, false);
    assert.deepEqual(current.missingMethods, ['getRubyContext', 'insertRubyEx', 'removeRubyEx']);
    assert.equal(current.limitations.length, 3);
  } finally { document.free(); }
});

test('B089 rejects stale, protected, non-body, nested, mixed, and invalid selections before capability use', () => {
  const engine = { getRubyContext() {}, insertRubyEx() {}, removeRubyEx() {} };
  const rejected: Array<[RubyRequestTargetB089, RubyCapabilityErrorB089['code']]> = [
    [{ ...validTarget(), revision: 'doc:old' }, 'stale'],
    [{ ...validTarget(), protected: true }, 'protected'],
    [{ ...validTarget(), story: 'header' }, 'nonbody'],
    [{ ...validTarget(), cellPath: [{}] }, 'nonbody'],
    [{ ...validTarget(), selectionKinds: ['plain-text', 'control'] }, 'mixed'],
    [{ ...validTarget(), end: 0 }, 'range'],
  ];
  for (const [target, code] of rejected) {
    assert.throws(() => assertRubyRequestSupportedB089(engine, target, 'doc:1'),
      (error: unknown) => error instanceof RubyCapabilityErrorB089 && error.code === code);
  }
});

test('B089 current engine fails closed and snapshot/HWP/HWPX remain unchanged', () => {
  const document = HwpDocument.createEmpty();
  document.createBlankDocument();
  document.insertText(0, 0, 0, '한글 기준 글자');
  try {
    const snapshot = document.saveSnapshot();
    const hwpBefore = document.exportHwp();
    const hwpxBefore = document.exportHwpx();
    assert.throws(() => assertRubyRequestSupportedB089(document, validTarget(), 'doc:1'),
      (error: unknown) => error instanceof RubyCapabilityErrorB089 && error.code === 'unavailable');
    document.restoreSnapshot(snapshot);
    assert.deepEqual(document.exportHwp(), hwpBefore);
    assert.deepEqual(document.exportHwpx(), hwpxBefore);
    for (const bytes of [hwpBefore, hwpxBefore]) {
      const reopened = new HwpDocument(bytes);
      try { assert.equal(reopened.getTextFileUnicode(), document.getTextFileUnicode()); }
      finally { reopened.free(); }
    }
  } finally {
    document.free();
  }
});

test('B089 source audit records the exact missing bridge and renderer evidence', async () => {
  const root = new URL('../../../upstream/rhwp-source/src/', import.meta.url);
  const [model, hwpxWriter, hwpWriter, wasm, renderer] = await Promise.all([
    readFile(new URL('model/control.rs', root), 'utf8'),
    readFile(new URL('serializer/hwpx/section.rs', root), 'utf8'),
    readFile(new URL('serializer/control.rs', root), 'utf8'),
    readFile(new URL('wasm_api.rs', root), 'utf8'),
    readFile(new URL('renderer/composer.rs', root), 'utf8'),
  ]);
  assert.match(model, /pub struct Ruby\s*\{/);
  assert.match(hwpxWriter, /Control::Ruby\(r\).*render_dutmal/s);
  assert.match(hwpWriter, /Control::Ruby\(ruby\)/);
  assert.doesNotMatch(wasm, /getRubyContext|insertRubyEx|removeRubyEx/);
  assert.doesNotMatch(renderer, /Control::Ruby/);
});
