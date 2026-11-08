import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import init, { HwpDocument } from '../node_modules/@rhwp/core/rhwp.js';
import { auditTextBoxOwnerCapabilityN014 } from '../src/adapters/rhwp/session-textbox-owner-capability-n014.ts';

const restore = { restoreSessionTextBox: () => true };
const target = (controlIndex = 0) => ({
  sectionIndex: 0,
  paragraphIndex: 0,
  charOffset: 0,
  parentParaIndex: 1,
  controlIndex,
  cellIndex: 0,
  cellParaIndex: 0,
  cellPath: [{ controlIndex, cellIndex: 0, cellParaIndex: 0 }],
  isTextBox: true as const,
});

function fixture(overrides: Record<string, unknown> = {}) {
  const controls = [{ ctrlId: 'gso', list: 0, para: 1, controlIndex: 0, props: { Lock: 0 } }];
  const lists = [{
    listId: 2,
    isCell: false,
    hostListId: 0,
    sectionIndex: 0,
    hostPara: 1,
    controlIndex: 0,
    cellIndex: 0,
    paraCount: 1,
  }];
  return {
    getSectionCount: () => 1,
    getParagraphCount: () => 2,
    getControls: () => JSON.stringify(controls),
    getCursorModel: () => JSON.stringify({ lists }),
    getShapeProperties: () => JSON.stringify({ roundRate: 0, hasCaption: false }),
    getCursorRectByPath: () => JSON.stringify({ pageIndex: 0, x: 1, y: 2, height: 13 }),
    controls,
    lists,
    ...overrides,
  };
}

test('only an exact root story with geometry and the Studio callback is restorable', () => {
  const document = fixture();
  const result = auditTextBoxOwnerCapabilityN014(document, restore, target());
  assert.equal(result.complete, true);
  if (!result.complete) return;
  assert.equal(result.capability.scope, 'root-textbox');
  assert.equal(result.capability.geometryAddressable, true);
  assert.equal(result.capability.restorationAddressable, true);
  assert.deepEqual(result.capability.blockers, []);
  assert.match(result.capability.evidenceFingerprint, /^[a-f0-9]{64}$/u);

  const noCallback = auditTextBoxOwnerCapabilityN014(document, {}, target());
  assert.equal(noCallback.complete, true);
  if (noCallback.complete) {
    assert.equal(noCallback.capability.restorationAddressable, false);
    assert.deepEqual(noCallback.capability.blockers, ['restore-callback-unavailable']);
  }
});

test('caption, nested path, nested story and group-like inventory fail closed with exact blockers', () => {
  const caption = fixture();
  caption.lists.push({
    ...caption.lists[0],
    listId: 3,
    cellIndex: 1,
  });
  const captionResult = auditTextBoxOwnerCapabilityN014({
    ...caption,
    getShapeProperties: () => JSON.stringify({ roundRate: 0, hasCaption: true }),
  }, restore, target());
  assert.equal(captionResult.complete, true);
  if (captionResult.complete) {
    assert.equal(captionResult.capability.scope, 'captioned-textbox');
    assert.equal(captionResult.capability.geometryAddressable, false);
    assert.equal(captionResult.capability.restorationAddressable, false);
    assert.deepEqual(captionResult.capability.blockers, [
      'caption-story-role-ambiguous',
      'caption-geometry-address-unavailable',
      'studio-restore-address-is-root-only',
    ]);
  }

  const nestedPath = {
    ...target(),
    paragraphIndex: 2,
    cellParaIndex: 2,
    cellPath: [
      { controlIndex: 0, cellIndex: 4, cellParaIndex: 0 },
      { controlIndex: 1, cellIndex: 0, cellParaIndex: 2 },
    ],
  };
  const nestedResult = auditTextBoxOwnerCapabilityN014(fixture(), restore, nestedPath);
  assert.equal(nestedResult.complete, true);
  if (nestedResult.complete) {
    assert.equal(nestedResult.capability.scope, 'nested-textbox');
    assert.deepEqual(nestedResult.capability.blockers, [
      'nested-owner-chain-not-representable',
      'studio-restore-address-is-root-only',
    ]);
  }

  const nestedStory = fixture();
  nestedStory.controls.push({ ctrlId: 'gso', list: 2, para: 0, controlIndex: 0, props: { Lock: 0 } });
  const nestedStoryResult = auditTextBoxOwnerCapabilityN014(nestedStory, restore, target());
  assert.equal(nestedStoryResult.complete, true);
  if (nestedStoryResult.complete) {
    assert.equal(nestedStoryResult.capability.scope, 'nested-textbox');
    assert.equal(nestedStoryResult.capability.blockers[0], 'nested-story-owner-ambiguous');
  }

  const groupResult = auditTextBoxOwnerCapabilityN014({
    ...fixture(),
    getCursorModel: () => JSON.stringify({ lists: [] }),
    getShapeProperties: () => JSON.stringify({ hasCaption: false, instanceId: 0 }),
    getCursorRectByPath: () => { throw new Error('not a text box'); },
  }, restore, target());
  assert.equal(groupResult.complete, true);
  if (groupResult.complete) {
    assert.equal(groupResult.capability.scope, 'shape-story-ambiguous');
    assert.deepEqual(groupResult.capability.blockers, [
      'shape-story-owner-ambiguous',
      'studio-restore-address-is-root-only',
      'geometry-unavailable',
    ]);
  }
});

test('malformed targets and inventories never become restorable', () => {
  assert.deepEqual(auditTextBoxOwnerCapabilityN014(undefined, restore, target()), {
    complete: false,
    reason: 'owner-inventory-unavailable',
  });
  assert.equal(auditTextBoxOwnerCapabilityN014(fixture(), restore, {
    ...target(),
    cellPath: [],
  }).complete, false);
  assert.equal(auditTextBoxOwnerCapabilityN014({
    ...fixture(),
    getControls: () => '{',
  }, restore, target()).complete, false);
  const malformedGeometry = auditTextBoxOwnerCapabilityN014({
    ...fixture(),
    getCursorRectByPath: () => JSON.stringify({ pageIndex: 0, x: 0, y: 0, height: 0 }),
  }, restore, target());
  assert.equal(malformedGeometry.complete, true);
  if (malformedGeometry.complete) {
    assert.equal(malformedGeometry.capability.restorationAddressable, false);
    assert.deepEqual(malformedGeometry.capability.blockers, ['geometry-malformed']);
  }
});

await init({ module_or_path: await readFile(new URL('../node_modules/@rhwp/core/rhwp_bg.wasm', import.meta.url)) });

function createRootTextBox() {
  const document = HwpDocument.createEmpty();
  document.createBlankDocument();
  document.splitParagraph(0, 0, 0);
  const created = JSON.parse(document.createShapeControl(JSON.stringify({
    sectionIdx: 0,
    paraIdx: 1,
    charOffset: 0,
    width: 9000,
    height: 4000,
    treatAsChar: true,
    shapeType: 'textbox',
  })));
  assert.equal(created.ok, true);
  document.insertTextInCell(0, 1, created.controlIdx, 0, 0, 0, '글상자');
  return document;
}

test('actual public engine proves the root owner and geometry across HWP and HWPX reopen without writes', () => {
  const source = createRootTextBox();
  try {
    for (const format of ['hwp', 'hwpx'] as const) {
      const method = format === 'hwp' ? 'exportHwp' : 'exportHwpx';
      const bytes = source[method]();
      const reopened = new HwpDocument(bytes);
      try {
        const before = reopened[method]();
        const result = auditTextBoxOwnerCapabilityN014(reopened, restore, target());
        assert.equal(result.complete, true, format);
        if (!result.complete) continue;
        assert.equal(result.capability.scope, 'root-textbox', format);
        assert.equal(result.capability.geometryAddressable, true, format);
        assert.equal(result.capability.restorationAddressable, true, format);
        assert.deepEqual(reopened[method](), before, `${format} audit must be read-only`);
      } finally {
        reopened.free();
      }
    }
  } finally {
    source.free();
  }
});

test('actual public engine exposes caption role ambiguity and hides grouped child ownership after reopen', () => {
  const captioned = createRootTextBox();
  try {
    assert.equal(JSON.parse(captioned.setShapeProperties(0, 1, 0, JSON.stringify({
      hasCaption: true,
      captionText: '캡션',
    }))).ok, true);
    for (const format of ['hwp', 'hwpx'] as const) {
      const bytes = captioned[format === 'hwp' ? 'exportHwp' : 'exportHwpx']();
      const reopened = new HwpDocument(bytes);
      try {
        const result = auditTextBoxOwnerCapabilityN014(reopened, restore, target());
        assert.equal(result.complete, true, format);
        if (!result.complete) continue;
        assert.equal(result.capability.scope, 'captioned-textbox', format);
        assert.equal(result.capability.restorationAddressable, false, format);
        assert.equal(result.capability.blockers[0], 'caption-story-role-ambiguous', format);
      } finally {
        reopened.free();
      }
    }
  } finally {
    captioned.free();
  }

  const grouped = createRootTextBox();
  try {
    const ellipse = JSON.parse(grouped.createShapeControl(JSON.stringify({
      sectionIdx: 0,
      paraIdx: 1,
      charOffset: 0,
      width: 5000,
      height: 3000,
      shapeType: 'ellipse',
    })));
    assert.equal(ellipse.ok, true);
    const objects = JSON.parse(grouped.getObjects());
    const groupedRef = JSON.parse(grouped.groupShapes(JSON.stringify({
      sectionIdx: 0,
      targets: objects.map((object: any) => ({
        paraIdx: object.para,
        controlIdx: object.controlIndex,
      })),
    })));
    assert.equal(groupedRef.ok, true);
    for (const format of ['hwp', 'hwpx'] as const) {
      const bytes = grouped[format === 'hwp' ? 'exportHwp' : 'exportHwpx']();
      const reopened = new HwpDocument(bytes);
      try {
        const result = auditTextBoxOwnerCapabilityN014(reopened, restore, target(groupedRef.controlIdx));
        assert.equal(result.complete, true, format);
        if (!result.complete) continue;
        assert.equal(result.capability.scope, 'shape-story-ambiguous', format);
        assert.equal(result.capability.restorationAddressable, false, format);
        assert.ok(result.capability.blockers.includes('shape-story-owner-ambiguous'), format);
        assert.ok(result.capability.blockers.includes('geometry-unavailable'), format);
      } finally {
        reopened.free();
      }
    }
  } finally {
    grouped.free();
  }
});
