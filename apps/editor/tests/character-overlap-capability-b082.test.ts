import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import init, {HwpDocument} from '../node_modules/@rhwp/core/rhwp.js';
import {
  auditCharacterOverlapCapabilityB082,
  characterOverlapRequiredMethodsB082,
} from '../src/adapters/rhwp/character-overlap-capability-b082.ts';

await init({module_or_path: await readFile(new URL('../node_modules/@rhwp/core/rhwp_bg.wasm', import.meta.url))});

test('B082 capability remains closed unless query, mutation and snapshot methods all exist', () => {
  assert.deepEqual(auditCharacterOverlapCapabilityB082({}), {
    supported: false,
    reason: 'api-unavailable',
    missing: [...characterOverlapRequiredMethodsB082],
  });
  const partial = {
    getCharOverlapListV1: () => '[]',
    insertCharOverlapAtSelectionV1: () => '{"ok":true}',
    removeCharOverlapV1: () => '{"ok":true}',
    saveSnapshot: () => 1,
    restoreSnapshot: () => '{"ok":true}',
  };
  assert.deepEqual(auditCharacterOverlapCapabilityB082(partial), {
    supported: false,
    reason: 'api-unavailable',
    missing: ['discardSnapshot'],
  });
});

test('B082 installed HwpDocument exposes no editing contract and the audit does not mutate either format', () => {
  const document = HwpDocument.createEmpty();
  try {
    document.createBlankDocument();
    document.insertText(0, 0, 0, '겹치기 전용 개체가 아닌 일반 본문');
    const beforeHwp = document.exportHwp(), beforeHwpx = document.exportHwpx();
    const capability = auditCharacterOverlapCapabilityB082(document as never);
    assert.equal(capability.supported, false);
    if (capability.supported) return;
    assert.deepEqual(capability.missing.slice(0, 3), [
      'getCharOverlapListV1',
      'insertCharOverlapAtSelectionV1',
      'removeCharOverlapV1',
    ]);
    assert.deepEqual(document.exportHwp(), beforeHwp);
    assert.deepEqual(document.exportHwpx(), beforeHwpx);
  } finally { document.free(); }
});

test('B082 source audit proves storage/render support but no public edit API', async () => {
  const root = new URL('../../../upstream/rhwp-source/src/', import.meta.url);
  const [model, hwpParser, hwpxParser, hwpSerializer, hwpxSerializer, renderer, wasmApi, blockValidation] = await Promise.all([
    readFile(new URL('model/control.rs', root), 'utf8'),
    readFile(new URL('parser/control.rs', root), 'utf8'),
    readFile(new URL('parser/hwpx/section.rs', root), 'utf8'),
    readFile(new URL('serializer/control.rs', root), 'utf8'),
    readFile(new URL('serializer/hwpx/section.rs', root), 'utf8'),
    readFile(new URL('../rhwp-studio/src/view/canvaskit-renderer.ts', root), 'utf8'),
    readFile(new URL('wasm_api.rs', root), 'utf8'),
    readFile(new URL('document_core/commands/paragraph_block/validation/support.rs', root), 'utf8'),
  ]);

  assert.match(model, /pub struct CharOverlap/);
  assert.match(hwpParser, /fn parse_char_overlap/);
  assert.match(hwpxParser, /fn parse_compose/);
  assert.match(hwpSerializer, /fn serialize_char_overlap/);
  assert.match(hwpxSerializer, /fn render_compose/);
  assert.match(renderer, /private renderCharOverlap/);
  assert.match(blockValidation, /Control::CharOverlap\(_\) => Err\(self\.unsupported\("CharOverlap"\)\)/);

  for (const method of characterOverlapRequiredMethodsB082.slice(0, 3)) {
    assert.equal(wasmApi.includes(method), false, `${method} must not be claimed before a native API exists`);
  }
});
