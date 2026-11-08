import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { registerHooks } from 'node:module';
import init, { HwpDocument } from '../node_modules/@rhwp/core/rhwp.js';
import { readMultiParagraphPlainTextPlan } from '../src/adapters/rhwp/multi-paragraph-plain-text.ts';

const dialogStub = 'data:text/javascript,' + encodeURIComponent('export class ModalDialog { constructor() {} show() {} hide() {} }');
const textDialogStub = 'data:text/javascript,' + encodeURIComponent('export class TextTransformDialog { constructor() {} show() {} }');
const plainDialogStub = 'data:text/javascript,' + encodeURIComponent('export class PlainTextDialog { constructor(apply) { globalThis.__jueonyPlainTextApply = apply; } show() { globalThis.__jueonyPlainTextShown = true; } }');
const hooks = registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === '../../../ui/dialog') return { url: dialogStub, shortCircuit: true };
  if (specifier === '../browser/text-transform-dialog.ts') return { url: textDialogStub, shortCircuit: true };
  if (specifier === '../browser/plain-text-dialog.ts') return { url: plainDialogStub, shortCircuit: true };
  return nextResolve(specifier, context);
} });
const { installBasicTextCommands, isMultiParagraphBodySelection, MultiParagraphPlainTextCommand } = await import('../src/adapters/rhwp/basic-text-commands.ts');
hooks.deregister();

let initialized: Promise<unknown> | undefined;
const wasm = () => initialized ??= init({ module_or_path: readFile(new URL('../node_modules/@rhwp/core/rhwp_bg.wasm', import.meta.url)) as any });
const bytes = (document: any, format: 'hwp' | 'hwpx') => document[format === 'hwp' ? 'exportHwp' : 'exportHwpx']();
const texts = (document: any) => Array.from({ length: document.getParagraphCount(0) }, (_, paragraph) => document.getTextRange(0, paragraph, 0, document.getParagraphLength(0, paragraph)));
const range = { start: { sectionIndex: 0, paragraphIndex: 0, charOffset: 1 }, end: { sectionIndex: 0, paragraphIndex: 2, charOffset: 1 } };

function fixture() {
  const document: any = HwpDocument.createEmpty(); document.createBlankDocument(); document.insertText(0, 0, 0, '가A');
  document.splitParagraph(0, 0, 2); document.insertText(0, 1, 0, 'B');
  document.splitParagraph(0, 1, 1); document.insertText(0, 2, 0, 'C라');
  document.applyCharFormat(0, 2, 1, 2, JSON.stringify({ italic: true }));
  return document;
}

test('paste-special command owns one snapshot across execute, undo and redo and preserves both exports', async () => {
  await wasm(); const document = fixture();
  try {
    let revision = 1, identity = 'document-1', selection: any = structuredClone(range);
    const original = { hwp: bytes(document, 'hwp'), hwpx: bytes(document, 'hwpx') };
    const plan = readMultiParagraphPlainTextPlan(document, range, '첫\n끝', String(revision));
    const command = new MultiParagraphPlainTextCommand(plan, () => revision, () => structuredClone(selection), () => identity, identity);
    assert.deepEqual(command.execute(document), { sectionIndex: 0, paragraphIndex: 1, charOffset: 1 });
    assert.equal(command.snapshotResourceCount(), 1); assert.deepEqual(texts(document), ['가첫', '끝라']);
    for (const format of ['hwp', 'hwpx'] as const) { const reopened: any = new HwpDocument(bytes(document, format)); try { assert.deepEqual(texts(reopened), ['가첫', '끝라']); } finally { reopened.free(); } }
    revision++; assert.deepEqual(command.undo(), range.end); assert.equal(command.snapshotResourceCount(), 0);
    assert.deepEqual(bytes(document, 'hwp'), original.hwp); assert.deepEqual(bytes(document, 'hwpx'), original.hwpx);
    selection = structuredClone(range); revision++;
    assert.deepEqual(command.execute(document), { sectionIndex: 0, paragraphIndex: 1, charOffset: 1 });
    assert.equal(command.snapshotResourceCount(), 1); command.discard(); assert.equal(command.snapshotResourceCount(), 0);
  } finally { document.free(); }
});

test('paste-special command and selection classifier fail closed for changed owner or selection', async () => {
  await wasm(); const document = fixture();
  try {
    let identity = 'document-1', selection: any = structuredClone(range);
    const command = new MultiParagraphPlainTextCommand(readMultiParagraphPlainTextPlan(document, range, 'X', '1'), () => 1, () => structuredClone(selection), () => identity, identity);
    selection = { start: { ...range.start, charOffset: 0 }, end: range.end };
    assert.throws(() => command.execute(document), /선택/); assert.deepEqual(texts(document), ['가A', 'B', 'C라']);
    selection = structuredClone(range); identity = 'document-2'; assert.throws(() => command.execute(document), /identity/);
    assert.equal(isMultiParagraphBodySelection(range), true);
    assert.equal(isMultiParagraphBodySelection({ start: range.start, end: { ...range.start, charOffset: 2 } }), false);
    assert.equal(isMultiParagraphBodySelection({ start: { ...range.start, parentParaIndex: 0 }, end: range.end }), false);
  } finally { document.free(); }
});

test('installed edit:paste-special routes multi-paragraph selection to command and retains the single-paragraph snapshot path', async () => {
  await wasm(); const native = fixture();
  const definitions = new Map<string, any>(); let revision = 1, emitted = 0, executed: any, selection: any = structuredClone(range);
  const context = { hasDocument: true, isEditable: true, isFormMode: false, inField: false, inCellSelectionMode: false, inTableObjectSelection: false, inPictureObjectSelection: false, inTable: false };
  const cursor = { hasSelection: () => true, isInHeaderFooter: () => false, isInFootnote: () => false, isInTextBox: () => false };
  const bridge = { borrowDocumentHandle: () => native, requiresPasswordForSave: false, fileName: 'paste-special.hwp', getWasmModuleExports: () => ({ HwpDocument }) };
  const input: any = { wasm: bridge, cursor, isComposing: false, getCursorPosition: () => selection.start, getSelection: () => structuredClone(selection), executeOperation(value: any) { executed = value; if (value.kind === 'command') value.command.execute(bridge); else value.operation(bridge); } };
  (globalThis as any).window = { rhwpStudio: { automation: { getContext: () => context } }, jueonyEditor: { busy: () => false, revision: () => revision, documentIdentity: () => 'document-1' } };
  (globalThis as any).document = { querySelector: () => null };
  try {
    installBasicTextCommands({ register(value: any) { definitions.set(value.id, value); } }, () => input, { emit() { emitted++; } });
    const paste = definitions.get('edit:paste-special'); assert.ok(paste); assert.equal(paste.canExecute(context), true);
    paste.execute(); assert.equal((globalThis as any).__jueonyPlainTextShown, true);
    (globalThis as any).__jueonyPlainTextApply('첫\n끝');
    assert.equal(executed.kind, 'command'); assert.equal(executed.command.type, 'jueonyMultiParagraphPlainText');
    assert.deepEqual(texts(native), ['가첫', '끝라']); assert.equal(emitted, 1);
    revision++; assert.deepEqual(executed.command.undo(), range.end);
    selection = { start: { sectionIndex: 0, paragraphIndex: 0, charOffset: 0 }, end: { sectionIndex: 0, paragraphIndex: 0, charOffset: 1 } };
    paste.execute(); (globalThis as any).__jueonyPlainTextApply('단일');
    assert.equal(executed.kind, 'snapshot'); assert.equal(executed.operationType, 'jueonyPlainText');
    assert.deepEqual(texts(native), ['단일A', 'B', 'C라']); assert.equal(emitted, 2);
  } finally {
    delete (globalThis as any).__jueonyPlainTextApply; delete (globalThis as any).__jueonyPlainTextShown;
    delete (globalThis as any).window; delete (globalThis as any).document; native.free();
  }
});
