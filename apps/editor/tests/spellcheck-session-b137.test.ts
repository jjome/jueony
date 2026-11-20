import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import init, {HwpDocument} from '@rhwp/core';
import {
  applySpellcheckSuggestionB137,
  spellcheckCapabilityB137,
  startSpellcheckB137,
  type SpellcheckProviderB137,
} from '../src/adapters/rhwp/spellcheck-session-b137.ts';

await init({module_or_path: await readFile(new URL('../node_modules/@rhwp/core/rhwp_bg.wasm', import.meta.url))});

const context = Object.freeze({
  hasDocument: true,
  isEditable: true,
  isFormMode: false,
  inField: false,
  inTable: false,
  inCellSelectionMode: false,
  inTableObjectSelection: false,
  inPictureObjectSelection: false,
});

function provider(response?: (request: any) => unknown): SpellcheckProviderB137 {
  return {
    capabilities: () => ({
      available: true,
      execution: 'offline',
      locales: ['ko-KR'],
      dictionaryVersion: 'test-ko-1',
      maxCodePoints: 1024,
    }),
    async check(request) {
      return response?.(request) ?? {
        requestId: request.requestId,
        locale: request.locale,
        dictionaryVersion: request.dictionaryVersion,
        issues: [{
          kind: 'spelling', start: 0, end: 5, original: '틀렷습니다', suggestions: ['틀렸습니다'],
        }],
      };
    },
  };
}

function fixture(options: {provider?: SpellcheckProviderB137; selection?: any; controls?: any[]} = {}) {
  const document = HwpDocument.createEmpty();
  document.createBlankDocument();
  document.insertText(0, 0, 0, '틀렷습니다.');
  document.applyCharFormat(0, 0, 0, 5, JSON.stringify({bold: true}));
  const selected = options.selection ?? {
    start: {sectionIndex: 0, paragraphIndex: 0, charOffset: 0},
    end: {sectionIndex: 0, paragraphIndex: 0, charOffset: 5},
  };
  let revision = 1;
  let identity = 'spell-document-1';
  let operations = 0;
  let busy = false;
  const bridge: any = {
    borrowDocumentHandle: () => document,
    requiresPasswordForSave: false,
  };
  if (options.controls) bridge.borrowDocumentHandle = () => ({
    getSectionCount: () => document.getSectionCount(),
    getParagraphCount: (section: number) => document.getParagraphCount(section),
    getParagraphLength: (section: number, paragraph: number) => document.getParagraphLength(section, paragraph),
    getTextRange: (section: number, paragraph: number, offset: number, count: number) => document.getTextRange(section, paragraph, offset, count),
    getControls: () => JSON.stringify(options.controls),
  });
  const cursor = {
    isInHeaderFooter: () => false,
    isInFootnote: () => false,
    isInTextBox: () => false,
  };
  const input: any = {
    cursor,
    isComposing: false,
    wasm: bridge,
    getSelection: () => structuredClone(selected),
    getCursorPosition: () => structuredClone(selected.start),
    executeOperation(operation: any) {
      operations++;
      busy = true;
      try { operation.operation(this.wasm); revision++; }
      finally { busy = false; }
    },
  };
  const editor = {
    busy: () => busy,
    documentIdentity: () => identity,
    revision: () => revision,
  };
  const environment = {
    input: () => input,
    editor: () => editor,
    context: () => context,
    provider: options.provider ?? provider(),
    createRequestId: () => 'request-12345678',
  };
  return {
    document,
    input,
    editor,
    environment,
    operations: () => operations,
    setRevision(value: number) { revision = value; },
    setIdentity(value: string) { identity = value; },
  };
}

test('B137 capability exposes only an explicit offline Korean dictionary', () => {
  assert.deepEqual(spellcheckCapabilityB137(), {available: false, reason: 'provider-unavailable'});
  assert.equal(spellcheckCapabilityB137(provider()).available, true);
  assert.deepEqual(spellcheckCapabilityB137({
    capabilities: () => ({available: true, execution: 'network', locales: ['ko-KR'], dictionaryVersion: 'x', maxCodePoints: 10}),
    check: async () => ({}),
  }), {available: false, reason: 'provider-online'});
  assert.deepEqual(spellcheckCapabilityB137({
    capabilities: () => ({available: true, execution: 'offline', locales: ['en-US'], dictionaryVersion: 'x', maxCodePoints: 10}),
    check: async () => ({}),
  }), {available: false, reason: 'locale-unsupported'});
});

test('B137 validates provider offsets/original text and applies one suggestion through one snapshot', async () => {
  const f = fixture();
  try {
    const session = await startSpellcheckB137(f.environment);
    assert.deepEqual(session.issues, [{
      kind: 'spelling', start: 0, end: 5, original: '틀렷습니다', suggestions: ['틀렸습니다'],
    }]);
    applySpellcheckSuggestionB137(session, 0, 0);
    assert.equal(f.operations(), 1);
    assert.equal(f.document.getTextRange(0, 0, 0, f.document.getParagraphLength(0, 0)), '틀렸습니다.');
    assert.throws(() => applySpellcheckSuggestionB137(session, 0, 0), /만료/);
    for (const format of ['hwp', 'hwpx'] as const) {
      const bytes = format === 'hwp' ? f.document.exportHwp() : f.document.exportHwpx();
      const reopened = new HwpDocument(bytes);
      try {
        assert.equal(reopened.getTextRange(0, 0, 0, reopened.getParagraphLength(0, 0)), '틀렸습니다.');
        assert.equal(JSON.parse(reopened.getCharPropertiesAt(0, 0, 0)).bold, true);
      } finally { reopened.free(); }
    }
  } finally { f.document.free(); }
});

test('B137 malformed, overlapping and mismatched provider evidence fails without mutation', async () => {
  for (const issues of [
    [{kind: 'spelling', start: 0, end: 99, original: '틀렷습니다', suggestions: ['틀렸습니다']}],
    [{kind: 'spelling', start: 0, end: 2, original: '다름', suggestions: ['맞음']}],
    [
      {kind: 'spelling', start: 0, end: 3, original: '틀렷습', suggestions: ['틀렸습']},
      {kind: 'spelling', start: 2, end: 5, original: '습니다', suggestions: ['습니다']},
    ],
  ]) {
    const f = fixture({provider: provider(request => ({
      requestId: request.requestId,
      locale: request.locale,
      dictionaryVersion: request.dictionaryVersion,
      issues,
    }))});
    try {
      await assert.rejects(startSpellcheckB137(f.environment));
      assert.equal(f.operations(), 0);
      assert.equal(f.document.getTextRange(0, 0, 0, 6), '틀렷습니다.');
    } finally { f.document.free(); }
  }
});

test('B137 stale owner after an asynchronous provider response fails closed', async () => {
  let release!: (value: unknown) => void;
  const delayed: SpellcheckProviderB137 = {
    ...provider(),
    check: request => new Promise(resolve => {
      release = () => resolve({
        requestId: request.requestId,
        locale: request.locale,
        dictionaryVersion: request.dictionaryVersion,
        issues: [],
      });
    }),
  };
  const f = fixture({provider: delayed});
  try {
    const pending = startSpellcheckB137(f.environment);
    await Promise.resolve();
    f.setRevision(2);
    release(undefined);
    await assert.rejects(pending, /바뀌었습니다/);
    assert.equal(f.operations(), 0);
  } finally { f.document.free(); }
});

test('B137 table/field owners, empty selection and invalid request identity are rejected', async () => {
  const withControl = fixture({controls: [
    {ctrlId: 'secd', list: 0, para: 0},
    {ctrlId: 'bokm', list: 0, para: 0},
  ]});
  try { await assert.rejects(startSpellcheckB137(withControl.environment), /필드나 개체/); }
  finally { withControl.document.free(); }

  const empty = fixture({selection: {
    start: {sectionIndex: 0, paragraphIndex: 0, charOffset: 1},
    end: {sectionIndex: 0, paragraphIndex: 0, charOffset: 1},
  }});
  try { await assert.rejects(startSpellcheckB137(empty.environment), /선택/); }
  finally { empty.document.free(); }

  const invalidId = fixture();
  invalidId.environment.createRequestId = () => 'short';
  try { await assert.rejects(startSpellcheckB137(invalidId.environment), /식별자/); }
  finally { invalidId.document.free(); }
});

