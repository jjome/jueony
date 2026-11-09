import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import test from 'node:test';
import {
  applyOutlineTransferN011,
  exportOutlineBindingN011,
  parseOutlineBindingPackageN011,
  planOutlineTransferN011,
} from '../src/adapters/rhwp/style-transfer-n011-outline-binding.ts';

const packageRoot = process.env.JUEONY_ENGINE_PACKAGE;

async function engine() {
  if (!packageRoot) throw new Error('JUEONY_ENGINE_PACKAGE is required');
  const root = resolve(packageRoot), module: any = await import(pathToFileURL(resolve(root, 'rhwp.js')).href + `?n011-outline=${Date.now()}`);
  await module.default({module_or_path: await readFile(resolve(root, 'rhwp_bg.wasm'))});
  return module.HwpDocument;
}

function json(value: unknown): any { return typeof value === 'string' ? JSON.parse(value) : value; }

function enableOutline(document: any, level: number): void {
  const state = json(document.getAgentParagraphOutline(0, 0));
  const result = json(document.setAgentParagraphOutline(0, 0, JSON.stringify({enabled: true, level, token: state.token})));
  assert.equal(result.editable, true);
}

test('N011 transfers an exact no-CharShape outline binding and survives HWP/HWPX plus undo/redo', {skip: !packageRoot}, async () => {
  const HwpDocument = await engine(), source = HwpDocument.createEmpty(), target = HwpDocument.createEmpty();
  source.createBlankDocument(); target.createBlankDocument();
  try {
    source.insertText(0, 0, 0, '원본'); enableOutline(source, 3);
    const sourceHwp = source.exportHwp(), sourceHwpx = source.exportHwpx();
    const packageValue = exportOutlineBindingN011(source, 0, 0);
    assert.equal(packageValue.level, 3); assert.equal(packageValue.definition.heads.length, 7);
    assert.equal(packageValue.definition.heads.every(head => head.char_shape_id === 4294967295), true);
    assert.deepEqual(source.exportHwp(), sourceHwp); assert.deepEqual(source.exportHwpx(), sourceHwpx);
    assert.deepEqual(parseOutlineBindingPackageN011(structuredClone(packageValue)), packageValue);

    target.insertText(0, 0, 0, '대상');
    const beforeHwp = target.exportHwp(), beforeHwpx = target.exportHwpx(), beforeText = target.getTextFileUnicode();
    const plan = planOutlineTransferN011(target, packageValue, 0, 0);
    assert.deepEqual(target.exportHwp(), beforeHwp); assert.deepEqual(target.exportHwpx(), beforeHwpx);
    const transition = applyOutlineTransferN011(target, plan);
    const afterHwp = target.exportHwp(), afterHwpx = target.exportHwpx();
    assert.notDeepEqual(afterHwp, beforeHwp); assert.notDeepEqual(afterHwpx, beforeHwpx);
    assert.equal(target.getTextFileUnicode(), beforeText);
    for (const bytes of [afterHwp, afterHwpx]) {
      const reopened = new HwpDocument(bytes);
      try {
        const properties = json(reopened.getParaPropertiesAt(0, 0));
        assert.equal(properties.headType, 'Outline'); assert.equal(properties.numberingId, 0); assert.equal(properties.paraLevel, 3);
        assert.equal(json(reopened.getAgentOutlineDefinition(0)).definitionId, 1);
        assert.deepEqual(json(reopened.getAgentListDefinitions()).numberings[0], packageValue.definition);
        assert.equal(reopened.getTextFileUnicode(), beforeText);
      } finally { reopened.free(); }
    }
    transition.undo(); assert.deepEqual(target.exportHwp(), beforeHwp); assert.deepEqual(target.exportHwpx(), beforeHwpx);
    transition.redo(); assert.deepEqual(target.exportHwp(), afterHwp); assert.deepEqual(target.exportHwpx(), afterHwpx);
    transition.dispose();
  } finally { source.free(); target.free(); }
});

test('N011 rejects referenced CharShape graphs, tampering, collisions and stale plans without mutation', {skip: !packageRoot}, async () => {
  const HwpDocument = await engine(), source = HwpDocument.createEmpty(), target = HwpDocument.createEmpty();
  source.createBlankDocument(); target.createBlankDocument();
  try {
    enableOutline(source, 1); const packageValue = exportOutlineBindingN011(source, 0, 0);
    const tampered: any = structuredClone(packageValue); tampered.definition.level_formats[0] = '^1)';
    assert.throws(() => parseOutlineBindingPackageN011(tampered), /지문/);
    const referenced: any = structuredClone(packageValue); referenced.definition.heads[0].char_shape_id = 0;
    referenced.definitionSha256 = packageValue.definitionSha256;
    assert.throws(() => parseOutlineBindingPackageN011(referenced), /CharShape/);

    const sourceDefinitions = source.getAgentListDefinitions.bind(source), sourceBefore = source.exportHwpx();
    source.getAgentListDefinitions = () => {
      const value = json(sourceDefinitions()); value.numberings[0].heads[0].char_shape_id = 0; return JSON.stringify(value);
    };
    try { assert.throws(() => exportOutlineBindingN011(source, 0, 0), /CharShape/); }
    finally { source.getAgentListDefinitions = sourceDefinitions; }
    assert.deepEqual(source.exportHwpx(), sourceBefore);

    const targetDefinitions = target.getAgentListDefinitions.bind(target), targetBefore = target.exportHwpx();
    target.getAgentListDefinitions = () => {
      const value = json(targetDefinitions()); value.numberings.push(structuredClone(value.numberings[0])); return JSON.stringify(value);
    };
    try { assert.throws(() => planOutlineTransferN011(target, packageValue, 0, 0), /여러 개/); }
    finally { target.getAgentListDefinitions = targetDefinitions; }
    assert.deepEqual(target.exportHwpx(), targetBefore);

    const targetBinding = target.getAgentOutlineDefinition.bind(target);
    target.getAgentOutlineDefinition = () => JSON.stringify({definitionId: 2});
    try { assert.throws(() => planOutlineTransferN011(target, packageValue, 0, 0), /공개 포트/); }
    finally { target.getAgentOutlineDefinition = targetBinding; }
    assert.deepEqual(target.exportHwpx(), targetBefore);

    const plan = planOutlineTransferN011(target, packageValue, 0, 0);
    target.insertText(0, 0, 0, '변경'); const staleHwp = target.exportHwp(), staleHwpx = target.exportHwpx();
    assert.throws(() => applyOutlineTransferN011(target, plan), /계획 이후/);
    assert.deepEqual(target.exportHwp(), staleHwp); assert.deepEqual(target.exportHwpx(), staleHwpx);
  } finally { source.free(); target.free(); }
});

test('N011 rolls back both native formats when the outline setter cannot prove the result', {skip: !packageRoot}, async () => {
  const HwpDocument = await engine(), source = HwpDocument.createEmpty(), target = HwpDocument.createEmpty();
  source.createBlankDocument(); target.createBlankDocument();
  try {
    enableOutline(source, 5); const packageValue = exportOutlineBindingN011(source, 0, 0);
    target.insertText(0, 0, 0, '기존 본문');
    const plan = planOutlineTransferN011(target, packageValue, 0, 0), beforeHwp = target.exportHwp(), beforeHwpx = target.exportHwpx();
    const setter = target.setAgentParagraphOutline.bind(target);
    target.setAgentParagraphOutline = () => JSON.stringify({editable: false});
    try { assert.throws(() => applyOutlineTransferN011(target, plan), /적용하지 못했습니다/); }
    finally { target.setAgentParagraphOutline = setter; }
    assert.deepEqual(target.exportHwp(), beforeHwp); assert.deepEqual(target.exportHwpx(), beforeHwpx);
  } finally { source.free(); target.free(); }
});
