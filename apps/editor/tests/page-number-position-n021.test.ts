import assert from 'node:assert/strict';
import test from 'node:test';
import {applyPageNumberPositionN021, validatePageNumberPositionN021} from '../src/adapters/rhwp/page-number-position-n021.ts';

const next = Object.freeze({format: 3, position: 6, sideChar: '-'});

function fixture(options: {sections?: number; section?: number; exists?: boolean; story?: 'body' | 'header' | 'footnote' | 'textbox'} = {}) {
  const expectedSection = options.section ?? 0;
  let state = options.exists ? {...next, exists: true, paragraphIdx: 0} : {exists: false};
  let inserts = 0;
  const operations: any[] = [];
  const document = {
    getSectionCount: () => options.sections ?? 1,
    getPageNumberPosition(section: number) {
      assert.equal(section, expectedSection);
      return {ok: true, ...state};
    },
    insertPageNumberPosition(section: number, paragraph: number, json: string) {
      assert.equal(section, expectedSection);
      inserts++;
      const value = JSON.parse(json);
      state = {...value, exists: true, paragraphIdx: paragraph};
      return {ok: true, inserted: true};
    },
  };
  const story = options.story ?? 'body';
  const cursor = {
    isInHeaderFooter: () => story === 'header',
    headerFooterMode: story === 'header' ? 'header' : undefined,
    isInFootnote: () => story === 'footnote',
    isInTextBox: () => story === 'textbox',
    fnSectionIdx: 0,
    fnParaIdx: 0,
    fnControlIdx: 0,
  };
  const input = {
    cursor,
    wasm: {
      borrowDocumentHandle: () => document,
      getNoteEditInfo: () => ({ok: true, kind: 'footnote'}),
    },
    getPosition: () => ({sectionIndex: expectedSection, paragraphIndex: 0, charOffset: 0}),
    getCursorPosition: () => ({isTextBox: story === 'textbox'}),
    executeOperation(operation: any) {
      operations.push(operation);
      operation.operation(this.wasm);
    },
  };
  return {document, input, operations, inserts: () => inserts};
}

test('N021 validates exact position/format/side-character before any engine call', () => {
  assert.deepEqual(validatePageNumberPositionN021(next), next);
  for (const invalid of [
    {...next, format: 8},
    {...next, position: 0},
    {...next, position: 11},
    {...next, sideChar: '--'},
    {...next, sideChar: '😀'},
    {...next, extra: true},
  ]) assert.throws(() => validatePageNumberPositionN021(invalid));
});

test('N021 routes one exact root-body mutation through one snapshot and verifies readback', () => {
  const f = fixture();
  applyPageNumberPositionN021(f.input, next);
  assert.equal(f.inserts(), 1);
  assert.equal(f.operations.length, 1);
  assert.equal(f.operations[0].kind, 'snapshot');
  assert.equal(f.operations[0].operationType, 'jueonyPageNumberPositionN021');
  assert.deepEqual(f.operations[0].meta, {
    actionId: 'page:page-number-dialog', domain: 'page', refresh: 'full', dirtyScope: 'document',
  });
});

test('N021 inserts at the current section in a multi-section body', () => {
  const f = fixture({sections: 3, section: 1});
  applyPageNumberPositionN021(f.input, next);
  assert.equal(f.inserts(), 1);
  assert.equal(f.operations.length, 1);
});

test('N021 special stories, out-of-bounds sections and existing controls fail before snapshot', () => {
  for (const options of [
    {story: 'header' as const},
    {story: 'footnote' as const},
    {story: 'textbox' as const},
    {sections: 2, section: 2},
    {exists: true},
  ]) {
    const f = fixture(options);
    assert.throws(() => applyPageNumberPositionN021(f.input, next));
    assert.equal(f.operations.length, 0);
    assert.equal(f.inserts(), 0);
  }
});

test('N021 stale existing-control race and malformed readback fail closed inside snapshot', () => {
  const stale = fixture();
  let reads = 0;
  stale.document.getPageNumberPosition = () => ++reads === 1
    ? {ok: true, exists: false}
    : {ok: true, exists: true, paragraphIdx: 0, ...next};
  assert.throws(() => applyPageNumberPositionN021(stale.input, next), /변경/);
  assert.equal(stale.operations.length, 1);
  assert.equal(stale.inserts(), 0);

  const malformed = fixture();
  const insert = malformed.document.insertPageNumberPosition;
  malformed.document.insertPageNumberPosition = (...args: Parameters<typeof insert>) => {
    const receipt = insert(...args);
    malformed.document.getPageNumberPosition = () => ({ok: true, exists: true, paragraphIdx: 0, ...next, position: 5});
    return receipt;
  };
  assert.throws(() => applyPageNumberPositionN021(malformed.input, next), /결과/);
  assert.equal(malformed.operations.length, 1);
  assert.equal(malformed.inserts(), 1);
});
