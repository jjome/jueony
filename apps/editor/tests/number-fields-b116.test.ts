import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import init, {HwpDocument} from '@rhwp/core';
import {
  applyNumberFieldB116,
  installNumberFieldCommandsB116,
  type NumberFieldKindB116,
} from '../src/adapters/rhwp/number-fields-b116.ts';

await init({module_or_path: await readFile(new URL('../node_modules/@rhwp/core/rhwp_bg.wasm', import.meta.url))});

function fixture(options: {
  sections?: number;
  story?: 'body' | 'header' | 'footnote' | 'textbox';
  selected?: boolean;
  cell?: boolean;
  composing?: boolean;
  capability?: boolean;
  formMode?: boolean;
  password?: boolean;
} = {}) {
  let controls: any[] = [{ctrlId: 'secd', list: 0, para: 0, pos: 0, controlIndex: 0}];
  const calls: string[] = [];
  const operations: any[] = [];
  const position = {sectionIndex: 0, paragraphIndex: 0, charOffset: 2};
  const document: Record<string, any> = {
    getSectionCount: () => options.sections ?? 1,
    getParagraphCount: () => 1,
    getParagraphLength: () => 4,
    getControls: () => JSON.stringify(controls),
    insertAutoNumberAtCursor(list: number, paragraph: number, offset: number, kind: string) {
      calls.push(kind);
      controls = [{
        ctrlId: 'atno', list, para: paragraph, pos: offset, controlIndex: 0,
      }, ...controls.map((item, index) => ({...item, controlIndex: index + 1}))];
      return JSON.stringify({ok: true});
    },
  };
  if (options.capability === false) delete document.insertAutoNumberAtCursor;
  const story = options.story ?? 'body';
  const cursor = {
    headerFooterMode: story === 'header' ? 'header' : undefined,
    isInHeaderFooter: () => story === 'header',
    isInFootnote: () => story === 'footnote',
    isInTextBox: () => story === 'textbox',
    isInTableObjectSelection: () => false,
    isInPictureObjectSelection: () => false,
    hasSelection: () => options.selected ?? false,
    fnSectionIdx: 0,
    fnParaIdx: 0,
    fnControlIdx: 0,
  };
  const input: Record<string, any> = {
    cursor,
    isComposing: options.composing ?? false,
    isFormMode: () => options.formMode ?? false,
    wasm: {
      borrowDocumentHandle: () => document,
      getNoteEditInfo: () => ({ok: true, kind: 'footnote'}),
      requiresPasswordForSave: options.password ?? false,
    },
    getPosition: () => ({...position}),
    getCursorPosition: () => options.cell
      ? {...position, parentParaIndex: 0, cellPath: [0]}
      : {...position, isTextBox: story === 'textbox'},
    executeOperation(operation: any) {
      operations.push(operation);
      operation.operation(this.wasm);
    },
  };
  return {
    document,
    input,
    operations,
    calls,
    setControls(value: any[]) { controls = value; },
    controls: () => controls,
  };
}

for (const [kind, native, action] of [
  ['current-page', 'current', 'insert:current-page-number'],
  ['total-pages', 'total', 'insert:total-page-number'],
] as const satisfies readonly (readonly [NumberFieldKindB116, string, string])[]) {
  test(`B116 ${kind} inserts one durable AutoNumber through one snapshot`, () => {
    const f = fixture();
    applyNumberFieldB116(f.input, kind);
    assert.deepEqual(f.calls, [native]);
    assert.equal(f.operations.length, 1);
    assert.equal(f.operations[0].kind, 'snapshot');
    assert.equal(f.operations[0].operationType, 'jueonyNumberFieldB116');
    assert.deepEqual(f.operations[0].meta, {
      actionId: action, domain: 'insert', refresh: 'full', dirtyScope: 'document',
    });
    assert.equal(f.controls().filter(item => item.ctrlId === 'atno').length, 1);
  });
}

test('B116 rejects unsupported stories, selections, table cells, IME and multi-section documents before snapshot', () => {
  for (const options of [
    {story: 'header' as const},
    {story: 'footnote' as const},
    {story: 'textbox' as const},
    {selected: true},
    {cell: true},
    {composing: true},
    {formMode: true},
    {password: true},
    {sections: 2},
  ]) {
    const f = fixture(options);
    assert.throws(() => applyNumberFieldB116(f.input, 'current-page'));
    assert.equal(f.operations.length, 0);
    assert.equal(f.calls.length, 0);
  }
});

test('B116 rejects a control collision and missing engine capability without mutation', () => {
  const collision = fixture();
  collision.setControls([
    ...collision.controls(),
    {ctrlId: 'bokm', list: 0, para: 0, pos: 2, controlIndex: 1},
  ]);
  assert.throws(() => applyNumberFieldB116(collision.input, 'total-pages'), /필드나 개체/);
  assert.equal(collision.operations.length, 0);

  const missing = fixture({capability: false});
  assert.throws(() => applyNumberFieldB116(missing.input, 'current-page'), /지원하지 않습니다/);
  assert.equal(missing.operations.length, 0);
  assert.equal(missing.calls.length, 0);
});

test('B116 stale controls and malformed readback fail closed inside the snapshot', () => {
  const stale = fixture();
  const originalExecute = stale.input.executeOperation;
  stale.input.executeOperation = function(operation: any) {
    stale.setControls([...stale.controls(), {
      ctrlId: 'bokm', list: 0, para: 0, pos: 3, controlIndex: 1,
    }]);
    originalExecute.call(this, operation);
  };
  assert.throws(() => applyNumberFieldB116(stale.input, 'current-page'), /상태가 바뀌었습니다/);
  assert.equal(stale.calls.length, 0);

  const malformed = fixture();
  malformed.document.insertAutoNumberAtCursor = () => {
    malformed.calls.push('current');
    return JSON.stringify({ok: true});
  };
  assert.throws(() => applyNumberFieldB116(malformed.input, 'current-page'), /결과/);
  assert.deepEqual(malformed.calls, ['current']);
});

test('B116 exposes explicit registry commands without claiming an unverified shortcut', () => {
  const f = fixture();
  const commands: any[] = [];
  installNumberFieldCommandsB116({register: command => commands.push(command)}, () => f.input);
  assert.deepEqual(commands.map(command => [command.id, command.label]), [
    ['insert:current-page-number', '현재 쪽 번호 필드'],
    ['insert:total-page-number', '전체 쪽수 필드'],
  ]);
  assert.equal(commands.every(command => command.shortcutLabel === undefined), true);
  const context = {
    hasDocument: true, isEditable: true, isFormMode: false,
    inTable: false, inCellSelectionMode: false,
    inPictureObjectSelection: false, inTableObjectSelection: false,
  };
  assert.equal(commands[0].canExecute(context), true);
  commands[0].execute();
  assert.deepEqual(f.calls, ['current']);
  assert.equal(commands[1].canExecute({...context, inTable: true}), false);
});

test('B116 public Rust/WASM fields survive focused HWP and HWPX save/reopen', () => {
  const serialized = new Map<string, Uint8Array>();
  const seed = HwpDocument.createEmpty();
  let baseline: Uint8Array;
  try {
    seed.createBlankDocument();
    seed.insertText(0, 0, 0, '가나다라');
    baseline = seed.exportHwpx();
  } finally { seed.free(); }
  for (const kind of ['current', 'total'] as const) {
    const document = new HwpDocument(baseline);
    try {
      const position = {sectionIndex: 0, paragraphIndex: 0, charOffset: 2};
      const input: any = {
        cursor: {
          isInHeaderFooter: () => false,
          isInFootnote: () => false,
          isInTextBox: () => false,
          isInTableObjectSelection: () => false,
          isInPictureObjectSelection: () => false,
          hasSelection: () => false,
        },
        isComposing: false,
        isFormMode: () => false,
        wasm: {borrowDocumentHandle: () => document, requiresPasswordForSave: false},
        getPosition: () => ({...position}),
        getCursorPosition: () => ({...position, isTextBox: false}),
        executeOperation(operation: any) { operation.operation(this.wasm); },
      };
      applyNumberFieldB116(input, kind === 'current' ? 'current-page' : 'total-pages');
      for (const extension of ['hwp', 'hwpx'] as const) {
        const bytes = extension === 'hwp' ? document.exportHwp() : document.exportHwpx();
        serialized.set(`${kind}.${extension}`, bytes);
        const reopened = new HwpDocument(bytes);
        try {
          const controls = JSON.parse(reopened.getControls());
          assert.equal(controls.filter((value: any) => value.ctrlId === 'atno').length, 1);
        } finally { reopened.free(); }
      }
    } finally { document.free(); }
  }
  for (const extension of ['hwp', 'hwpx'] as const) {
    assert.equal(
      Buffer.from(serialized.get(`current.${extension}`)!).equals(
        Buffer.from(serialized.get(`total.${extension}`)!),
      ),
      false,
      `${extension} must retain the distinct Page/TotalPage model value`,
    );
  }
});

