import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import test from 'node:test';
import type {HwpDocument as HwpDocumentType} from '@rhwp/core';
import {applyTableBoundaryB068, captureTableBoundaryB068, type TableBoundaryContextB068} from '../src/adapters/rhwp/table-boundary-tool-b068.ts';

const enginePackage = process.env.JUEONY_ENGINE_PACKAGE ? resolve(process.env.JUEONY_ENGINE_PACKAGE) : resolve('apps/editor/node_modules/@rhwp/core');
const engine = await import(pathToFileURL(resolve(enginePackage, 'rhwp.js')).href);
const {HwpDocument} = engine as typeof import('@rhwp/core');
await engine.default({module_or_path: await readFile(resolve(enginePackage, 'rhwp_bg.wasm'))});
const digest = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

function fixture(merged = false) {
  const document = HwpDocument.createEmpty(); document.createBlankDocument();
  const made = JSON.parse(document.createTable(0, 0, 0, 2, 2));
  if (merged) assert.equal(JSON.parse(document.mergeTableCells(0, made.paraIdx, made.controlIdx, 0, 0, 0, 1)).ok, true);
  let identity = 'document-b068', revisionOverride: string | undefined, story = 'body', editable = true, protectedDocument = false;
  const context: TableBoundaryContextB068 = {documentIdentity: () => identity, revision: () => revisionOverride ?? digest(document.exportHwp()),
    story: () => story, editable: () => editable, protected: () => protectedDocument};
  return {document, context, address: {section: 0, paragraph: made.paraIdx, control: made.controlIdx},
    setIdentity(value: string) { identity = value; }, setRevision(value: string | undefined) { revisionOverride = value; },
    setStory(value: string) { story = value; }, setEditable(value: boolean) { editable = value; }, setProtected(value: boolean) { protectedDocument = value; }};
}

function dimensions(document: HwpDocumentType, address: {section: number; paragraph: number; control: number}) {
  return JSON.parse(document.getTableDimensions(address.section, address.paragraph, address.control));
}

test('B068 erases one empty-cell boundary and exactly undo/redoes both formats', () => {
  const f = fixture();
  try {
    const beforeHwp = f.document.exportHwp(), beforeHwpx = f.document.exportHwpx();
    const plan = captureTableBoundaryB068(f.document, f.context, f.address, {kind: 'erase', row: 0, column: 0, direction: 'right'});
    const applied = applyTableBoundaryB068(f.document, f.context, plan);
    assert.equal(applied.status, 'applied'); if (applied.status !== 'applied') return;
    assert.deepEqual(dimensions(f.document, f.address), {rowCount: 2, colCount: 2, cellCount: 3});
    const afterHwp = f.document.exportHwp(), afterHwpx = f.document.exportHwpx();
    for (const bytes of [afterHwp, afterHwpx]) {
      const reopened = new HwpDocument(bytes); try { assert.deepEqual(dimensions(reopened, f.address), {rowCount: 2, colCount: 2, cellCount: 3}); } finally { reopened.free(); }
    }
    assert.equal(applied.command.undo().status, 'restored'); assert.deepEqual(f.document.exportHwp(), beforeHwp); assert.deepEqual(f.document.exportHwpx(), beforeHwpx);
    assert.equal(applied.command.redo().status, 'restored'); assert.deepEqual(f.document.exportHwp(), afterHwp); assert.deepEqual(f.document.exportHwpx(), afterHwpx);
    applied.command.dispose();
  } finally { f.document.free(); }
});

test('B068 draws the witnessed original grid inside one empty merged cell', () => {
  const f = fixture(true);
  try {
    const plan = captureTableBoundaryB068(f.document, f.context, f.address, {kind: 'draw', row: 0, column: 0});
    const applied = applyTableBoundaryB068(f.document, f.context, plan);
    assert.equal(applied.status, 'applied'); if (applied.status !== 'applied') return;
    assert.deepEqual(dimensions(f.document, f.address), {rowCount: 2, colCount: 2, cellCount: 4});
    for (const bytes of [f.document.exportHwp(), f.document.exportHwpx()]) {
      const reopened = new HwpDocument(bytes); try { assert.deepEqual(dimensions(reopened, f.address), {rowCount: 2, colCount: 2, cellCount: 4}); } finally { reopened.free(); }
    }
    assert.equal(applied.command.undo().status, 'restored'); assert.equal(dimensions(f.document, f.address).cellCount, 3);
    assert.equal(applied.command.redo().status, 'restored'); assert.equal(dimensions(f.document, f.address).cellCount, 4);
    applied.command.dispose();
  } finally { f.document.free(); }
});

test('B068 rejects text, protected/stale state and invalid strokes before snapshot', () => {
  for (const scenario of ['text', 'protected', 'story', 'stale', 'bad-stroke'] as const) {
    const f = fixture();
    try {
      if (scenario === 'text') f.document.insertTextInCell(0, f.address.paragraph, f.address.control, 0, 0, 0, '내용');
      if (scenario === 'protected') f.setProtected(true);
      if (scenario === 'story') f.setStory('header');
      const op = scenario === 'bad-stroke' ? {kind: 'erase', row: 0, column: 1, direction: 'right'} : {kind: 'erase', row: 0, column: 0, direction: 'right'};
      if (scenario === 'stale') {
        const plan = captureTableBoundaryB068(f.document, f.context, f.address, op);
        f.setRevision('other-revision');
        assert.equal(applyTableBoundaryB068(f.document, f.context, plan).status, 'blocked');
      } else assert.throws(() => captureTableBoundaryB068(f.document, f.context, f.address, op));
      assert.equal(dimensions(f.document, f.address).cellCount, 4);
    } finally { f.document.free(); }
  }
});

test('B068 restores exact bytes when the native boundary mutation is rejected', () => {
  const f = fixture();
  try {
    const plan = captureTableBoundaryB068(f.document, f.context, f.address, {kind: 'erase', row: 0, column: 0, direction: 'right'});
    const beforeHwp = f.document.exportHwp(), beforeHwpx = f.document.exportHwpx();
    const host = new Proxy(f.document, {get(target, key) {
      if (key === 'mergeTableCells') return () => '{"ok":false}';
      const value = Reflect.get(target, key, target); return typeof value === 'function' ? value.bind(target) : value;
    }});
    assert.equal(applyTableBoundaryB068(host, f.context, plan).status, 'blocked');
    assert.deepEqual(f.document.exportHwp(), beforeHwp); assert.deepEqual(f.document.exportHwpx(), beforeHwpx);
  } finally { f.document.free(); }
});
