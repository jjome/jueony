import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { registerHooks } from 'node:module';
import test from 'node:test';
import init, { HwpDocument } from '@rhwp/core';

const transformStub = 'data:text/javascript,' + encodeURIComponent('export class TextTransformDialog { constructor() {} show() {} }');
const plainStub = 'data:text/javascript,' + encodeURIComponent('export class PlainTextDialog { constructor() {} show() {} }');
const symbolStub = 'data:text/javascript,' + encodeURIComponent(`
export const createSymbolRecentStoreB090 = storage => ({read:()=>storage.getItem('b090'),write:value=>storage.setItem('b090',value)});
export class SymbolDialogB090 { constructor(apply, store) { globalThis.__b090Apply = apply; globalThis.__b090Store = store; } show() { globalThis.__b090Shown = true; } }
`);
const hooks = registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === '../browser/text-transform-dialog.ts') return { url: transformStub, shortCircuit: true };
  if (specifier === '../browser/plain-text-dialog.ts') return { url: plainStub, shortCircuit: true };
  if (specifier === '../browser/symbol-dialog-b090.ts') return { url: symbolStub, shortCircuit: true };
  return nextResolve(specifier, context);
} });
const { installBasicTextCommands } = await import('../src/adapters/rhwp/basic-text-commands.ts');
hooks.deregister();
await init({ module_or_path: await readFile(new URL('../node_modules/@rhwp/core/rhwp_bg.wasm', import.meta.url)) });

test('B090 replaces the exact insert:symbols command and fails closed after stale document revision', () => {
  const native: any = HwpDocument.createEmpty(); native.createBlankDocument(); native.insertText(0, 0, 0, '앞뒤');
  const definitions = new Map<string, any>(); let revision = 1, emitted = 0, position = { sectionIndex: 0, paragraphIndex: 0, charOffset: 1 };
  const context = { hasDocument: true, isEditable: true, isFormMode: false, inField: false, inCellSelectionMode: false, inTableObjectSelection: false, inPictureObjectSelection: false, inTable: false };
  const cursor = { hasSelection: () => false, isInHeaderFooter: () => false, isInFootnote: () => false, isInTextBox: () => false };
  const bridge = { requiresPasswordForSave: false, borrowDocumentHandle: () => native };
  const input: any = { active: true, isComposing: false, isFormMode: () => false, wasm: bridge, cursor,
    getPosition: () => ({ ...position }), getCursorPosition: () => ({ ...position }), getSelection: () => null,
    executeOperation(operation: any) { const snapshot = native.saveSnapshot(); try { return operation.operation(bridge); } catch (error) { native.restoreSnapshot(snapshot); throw error; } finally { native.discardSnapshot(snapshot); } },
  };
  const storage = new Map<string, string>();
  const previousWindow = (globalThis as any).window, previousDocument = (globalThis as any).document;
  (globalThis as any).window = { localStorage: { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value) }, rhwpStudio: { automation: { getContext: () => context } }, jueonyEditor: { busy: () => false, revision: () => revision, documentIdentity: () => 'b090-document' } };
  (globalThis as any).document = { querySelector: () => null };
  try {
    installBasicTextCommands({ register(value: any) { definitions.set(value.id, value); } }, () => input, { emit() { emitted++; } });
    const command = definitions.get('insert:symbols'); assert.ok(command); assert.equal(command.id, 'insert:symbols'); assert.equal(command.shortcutLabel, 'Ctrl+F10'); assert.equal(command.opensDialog, true); assert.equal(command.canExecute(context), true);
    command.execute(); assert.equal((globalThis as any).__b090Shown, true); (globalThis as any).__b090Apply('간');
    assert.equal(native.getTextRange(0, 0, 0, native.getParagraphLength(0, 0)), '앞간뒤'); assert.equal(emitted, 1);

    command.execute(); revision += 1;
    assert.throws(() => (globalThis as any).__b090Apply('☆'), /바뀌었습니다/);
    assert.equal(native.getTextRange(0, 0, 0, native.getParagraphLength(0, 0)), '앞간뒤'); assert.equal(emitted, 1);
    position = { ...position, charOffset: 0 }; assert.equal(command.canExecute({ ...context, inTable: true }), false);
  } finally {
    native.free();
    for (const key of ['__b090Apply', '__b090Store', '__b090Shown']) delete (globalThis as any)[key];
    if (previousWindow === undefined) delete (globalThis as any).window; else (globalThis as any).window = previousWindow;
    if (previousDocument === undefined) delete (globalThis as any).document; else (globalThis as any).document = previousDocument;
  }
});
