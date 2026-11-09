import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import init, {HwpDocument} from '@rhwp/core';
import {
  TOOLBAR_CUSTOMIZATION_KEY_B056,
  ToolbarCustomizationErrorB056,
  createToolbarCustomizationControllerB056,
  parseStoredToolbarCustomizationB056,
} from '../src/adapters/browser/toolbar-customization-b056.ts';

await init({module_or_path: await readFile(new URL('../node_modules/@rhwp/core/rhwp_bg.wasm', import.meta.url))});

const commands = [
  {id: 'file:open', label: '열기'},
  {id: 'file:save', label: '저장'},
  {id: 'edit:undo', label: '되돌리기'},
  {id: 'edit:redo', label: '다시 실행'},
];
const defaults = [
  {toolbarId: 'quick', commandIds: ['file:open', 'file:save', 'edit:undo', 'edit:redo']},
];
const required = {quick: ['file:save']};

class Storage {
  values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

test('B056 hides, restores and orders only registered commands', () => {
  const storage = new Storage();
  const applied: unknown[] = [];
  const controller = createToolbarCustomizationControllerB056({
    storage, commands, defaults, required, target: {apply: value => applied.push(value)},
  });
  controller.setVisible('quick', 'edit:redo', false);
  controller.move('quick', 'edit:undo', 0);
  assert.deepEqual(controller.draft().toolbars[0].commandIds, ['edit:undo', 'file:open', 'file:save']);
  assert.throws(() => controller.setVisible('quick', 'unknown:command', true), (error: unknown) =>
    error instanceof ToolbarCustomizationErrorB056 && error.code === 'unknown-command');
  assert.throws(() => controller.setVisible('quick', 'file:save', false), (error: unknown) =>
    error instanceof ToolbarCustomizationErrorB056 && error.code === 'required-command');
  controller.reset();
  assert.deepEqual(controller.draft().toolbars[0].commandIds, defaults[0].commandIds);
  controller.setVisible('quick', 'edit:redo', false);
  controller.commit();
  assert.equal(storage.getItem(TOOLBAR_CUSTOMIZATION_KEY_B056),
    '{"version":1,"toolbars":[{"toolbarId":"quick","commandIds":["file:open","file:save","edit:undo"]}]}');
  assert.ok(applied.length >= 5);
});

test('B056 restores a valid user layout and cancel reprojects the committed layout', () => {
  const storage = new Storage();
  storage.setItem(TOOLBAR_CUSTOMIZATION_KEY_B056,
    '{"version":1,"toolbars":[{"toolbarId":"quick","commandIds":["file:save","edit:redo"]}]}');
  const applied: unknown[] = [];
  const controller = createToolbarCustomizationControllerB056({
    storage, commands, defaults, required, target: {apply: value => applied.push(value)},
  });
  assert.deepEqual(controller.snapshot().toolbars[0].commandIds, ['file:save', 'edit:redo']);
  controller.setVisible('quick', 'file:open', true, 0);
  controller.cancel();
  assert.deepEqual((applied.at(-1) as any).toolbars[0].commandIds, ['file:save', 'edit:redo']);
  assert.throws(() => controller.reset(), /이미 끝난/);
});

test('B056 rejects corrupt, duplicated, foreign and future saved layouts without repairing them', () => {
  for (const raw of [
    'not-json',
    '{"version":2,"toolbars":[]}',
    '{"version":1,"toolbars":[{"toolbarId":"quick","commandIds":["file:save","file:save"]}]}',
    '{"version":1,"toolbars":[{"toolbarId":"quick","commandIds":["file:save","foreign:run"]}]}',
    '{"version":1,"toolbars":[{"toolbarId":"other","commandIds":["file:save"]}]}',
  ]) assert.throws(() => parseStoredToolbarCustomizationB056(raw, commands, defaults, required),
    ToolbarCustomizationErrorB056);
  const storage = new Storage();
  storage.setItem(TOOLBAR_CUSTOMIZATION_KEY_B056, 'not-json');
  assert.throws(() => createToolbarCustomizationControllerB056({
    storage, commands, defaults, required, target: {apply() {}},
  }), (error: unknown) => error instanceof ToolbarCustomizationErrorB056
    && error.code === 'invalid-stored-value');
});

test('B056 storage failure restores the last committed projection', () => {
  const applied: unknown[] = [];
  const controller = createToolbarCustomizationControllerB056({
    storage: {getItem: () => null, setItem: () => { throw new Error('quota'); }},
    commands, defaults, required, target: {apply: value => applied.push(value)},
  });
  controller.setVisible('quick', 'edit:redo', false);
  assert.throws(() => controller.commit(), (error: unknown) =>
    error instanceof ToolbarCustomizationErrorB056 && error.code === 'write');
  assert.deepEqual((applied.at(-1) as any).toolbars[0].commandIds, defaults[0].commandIds);
});

test('B056 preference previews and commits leave real HWP/HWPX bytes unchanged', () => {
  const document = HwpDocument.createEmpty();
  document.createBlankDocument();
  document.insertText(0, 0, 0, '도구 상자 설정은 문서 데이터가 아닙니다.');
  try {
    const hwp = document.exportHwp();
    const hwpx = document.exportHwpx();
    const storage = new Storage();
    const controller = createToolbarCustomizationControllerB056({
      storage, commands, defaults, required, target: {apply() {}},
    });
    controller.setVisible('quick', 'edit:redo', false);
    controller.move('quick', 'edit:undo', 0);
    controller.commit();
    assert.deepEqual(document.exportHwp(), hwp);
    assert.deepEqual(document.exportHwpx(), hwpx);
  } finally { document.free(); }
});
