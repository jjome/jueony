import assert from 'node:assert/strict';
import {mkdtemp, mkdir, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import {
  canOpenPageNumberPositionDialogN021,
  capturePageNumberPositionDialogTargetN021,
  commitPageNumberPositionDialogN021,
  installPageNumberPositionDialogN021,
} from '../src/adapters/browser/page-number-position-dialog-n021.ts';
import {
  applyPageNumberPositionPatchesN021,
  patchPageNumberPositionInstallN021,
  patchPageNumberPositionKeymapN021,
} from '../scripts/integration/page-number-position-n021-patches.mjs';

const requested = Object.freeze({format: 3, position: 6, sideChar: '-'});

function fixture(options: {story?: 'body'|'header'|'footnote'|'textbox'; sections?: number; exists?: boolean} = {}) {
  let revision = 'r1';
  let identity = 'document-1';
  let composing = false;
  let position = {sectionIndex: 0, paragraphIndex: 0, charOffset: 0};
  let state: Record<string, unknown> = options.exists
    ? {ok: true, exists: true, paragraphIdx: 0, ...requested}
    : {ok: true, exists: false};
  let inserts = 0;
  const operations: any[] = [];
  const document = {
    getSectionCount: () => options.sections ?? 1,
    getPageNumberPosition: () => state,
    insertPageNumberPosition(_section: number, paragraph: number, json: string) {
      inserts++;
      state = {ok: true, exists: true, paragraphIdx: paragraph, ...JSON.parse(json)};
      return {ok: true, inserted: true};
    },
  };
  const story = options.story ?? 'body';
  const cursor = {
    isInHeaderFooter: () => story === 'header', headerFooterMode: story === 'header' ? 'header' : undefined,
    isInFootnote: () => story === 'footnote', isInTextBox: () => story === 'textbox',
    fnSectionIdx: 0, fnParaIdx: 0, fnControlIdx: 0,
  };
  const input: any = {
    cursor,
    get isComposing() { return composing; },
    wasm: {borrowDocumentHandle: () => document, getNoteEditInfo: () => ({ok: true, kind: 'footnote'})},
    getPosition: () => ({...position}),
    getCursorPosition: () => ({...position, isTextBox: story === 'textbox'}),
    executeOperation(operation: any) { operations.push(operation); operation.operation(this.wasm); },
  };
  const context = {hasDocument: true, isEditable: true, isFormMode: false,
    inTable: false, inCellSelectionMode: false, inPictureObjectSelection: false, inTableObjectSelection: false};
  const editor = {busy: () => false, revision: () => revision, documentIdentity: () => identity};
  const environment = {input: () => input, editor: () => editor, context: () => context};
  return {
    context, environment, operations, inserts: () => inserts,
    setRevision: (value: string) => { revision = value; },
    setIdentity: (value: string) => { identity = value; },
    setComposing: (value: boolean) => { composing = value; },
    setPosition: (value: typeof position) => { position = value; },
  };
}

test('N021 pinned Studio transforms the pending key and registers the real dialog command exactly once', () => {
  const keymap = patchPageNumberPositionKeymapN021("x binding('Ctrl+N,P', 'pending:page-number-dialog', '쪽 번호 매기기') y");
  assert.match(keymap, /page:page-number-dialog/);
  assert.doesNotMatch(keymap, /pending:page-number-dialog/);
  assert.throws(() => patchPageNumberPositionKeymapN021(keymap), /already applied/);

  const install = patchPageNumberPositionInstallN021('head\n  const resolver = new HangulKeyResolver();\ntail');
  assert.match(install, /installPageNumberPositionDialogN021\(\{registry, input\}\)/);
  assert.match(install, /page-number-position-dialog-n021\.ts/);
  assert.throws(() => patchPageNumberPositionInstallN021(install), /already applied/);
});

test('N021 integration patch writes only the two generated pinned-Studio seams', async () => {
  const root = await mkdtemp(join(tmpdir(), 'jueony-n021-'));
  try {
    const shortcuts = join(root, 'src', 'jueony', 'shortcuts');
    await mkdir(shortcuts, {recursive: true});
    await writeFile(join(shortcuts, 'keymap.ts'), await readFile(join(import.meta.dirname, '../src/shortcuts/keymap.ts')));
    await writeFile(join(shortcuts, 'install.ts'), await readFile(join(import.meta.dirname, '../src/shortcuts/install.ts')));
    await applyPageNumberPositionPatchesN021({root});
    const keymap = await readFile(join(shortcuts, 'keymap.ts'), 'utf8');
    const install = await readFile(join(shortcuts, 'install.ts'), 'utf8');
    assert.match(keymap, /page:page-number-dialog/);
    assert.doesNotMatch(keymap, /pending:page-number-dialog/);
    assert.match(install, /installPageNumberPositionDialogN021\(\{registry, input\}\)/);
  } finally {
    await rm(root, {recursive: true, force: true});
  }
});

test('N021 command admission is exact-body, single-section, no-control and non-IME only', () => {
  assert.equal(canOpenPageNumberPositionDialogN021(fixture().context, fixture().environment), true);
  for (const options of [
    {story: 'header' as const}, {story: 'footnote' as const}, {story: 'textbox' as const},
    {sections: 2}, {exists: true},
  ]) {
    const f = fixture(options);
    assert.equal(canOpenPageNumberPositionDialogN021(f.context, f.environment), false);
  }
  const composing = fixture(); composing.setComposing(true);
  assert.equal(canOpenPageNumberPositionDialogN021(composing.context, composing.environment), false);
});

test('N021 confirmation keeps the captured owner and routes through exactly one verified snapshot', () => {
  const f = fixture();
  const target = capturePageNumberPositionDialogTargetN021(f.environment, f.context);
  commitPageNumberPositionDialogN021(f.environment, target, requested);
  assert.equal(f.operations.length, 1);
  assert.equal(f.operations[0].kind, 'snapshot');
  assert.equal(f.operations[0].operationType, 'jueonyPageNumberPositionN021');
  assert.equal(f.inserts(), 1);
});

test('N021 revision, identity, caret and IME staleness fail before any snapshot', () => {
  for (const mutate of [
    (f: ReturnType<typeof fixture>) => f.setRevision('r2'),
    (f: ReturnType<typeof fixture>) => f.setIdentity('document-2'),
    (f: ReturnType<typeof fixture>) => f.setPosition({sectionIndex: 0, paragraphIndex: 0, charOffset: 1}),
    (f: ReturnType<typeof fixture>) => f.setComposing(true),
  ]) {
    const f = fixture();
    const target = capturePageNumberPositionDialogTargetN021(f.environment, f.context);
    mutate(f);
    assert.throws(() => commitPageNumberPositionDialogN021(f.environment, target, requested));
    assert.equal(f.operations.length, 0);
    assert.equal(f.inserts(), 0);
  }
  const composingDraft = fixture();
  const target = capturePageNumberPositionDialogTargetN021(composingDraft.environment, composingDraft.context);
  assert.throws(() => commitPageNumberPositionDialogN021(composingDraft.environment, target, requested, {composing: true}));
  assert.equal(composingDraft.operations.length, 0);
});

test('N021 registry definition is a real Ctrl+N,P modal command with fail-closed canExecute', () => {
  const f = fixture(); let definition: any;
  installPageNumberPositionDialogN021({registry: {register(value) { definition = value; }}, input: f.environment.input, environment: f.environment});
  assert.equal(definition.id, 'page:page-number-dialog');
  assert.equal(definition.shortcutLabel, 'Ctrl+N,P');
  assert.equal(definition.opensDialog, true);
  assert.equal(definition.canExecute(f.context), true);
  f.setComposing(true);
  assert.equal(definition.canExecute(f.context), false);
});
