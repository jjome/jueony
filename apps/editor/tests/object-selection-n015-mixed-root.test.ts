import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import test from 'node:test';
import {
  captureMixedRootSelectionN015,
  restoreMixedRootSelectionN015,
  validateMixedRootSelectionBookmarkN015,
} from '../src/adapters/rhwp/object-selection-n015-mixed-root.ts';

const packageRoot = process.env.JUEONY_ENGINE_PACKAGE;
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4AWPgmnbnPwAEpgJ8+MzEcgAAAABJRU5ErkJggg==', 'base64');
async function engine() {
  if (!packageRoot) throw new Error('JUEONY_ENGINE_PACKAGE is required');
  const root = resolve(packageRoot), module: any = await import(pathToFileURL(resolve(root, 'rhwp.js')).href + `?n015-mixed=${Date.now()}`);
  await module.default({module_or_path: await readFile(resolve(root, 'rhwp_bg.wasm'))}); return module.HwpDocument;
}
function refs(document: any) {
  const values = JSON.parse(document.getObjects());
  const equation = values.find((value: any) => value.kind === 'equation'), image = values.find((value: any) => value.kind === 'picture');
  return {
    equation: {sec: 0, ppi: equation.para, ci: equation.controlIndex, type: 'equation'},
    image: {sec: 0, ppi: image.para, ci: image.controlIndex, type: 'image'},
  };
}
function fixture(document: any, initial: any[] = []) {
  let selected = structuredClone(initial), calls = 0, failOnce = false;
  const cursor: any = {
    isInPictureObjectSelection: () => selected.length > 0, isInTableObjectSelection: () => false,
    isInHeaderFooter: () => false, isInFootnote: () => false, isInTextBox: () => false,
    getSelectedPictureRefs: () => structuredClone(selected), getSelectedPictureRef: () => structuredClone(selected.at(-1) ?? null),
    exitPictureObjectSelection: () => { selected = []; },
  };
  const session: any = {wasm: {requiresPasswordForSave: false, borrowDocumentHandle: () => document}, cursor,
    restoreSessionObjectSelection: (value: any[]) => { calls += 1; if (failOnce) { failOnce = false; selected = []; return false; }
      selected = value.map(ref => ({sec: ref.section, ppi: ref.paragraph, ci: ref.control, type: ref.type})); return true; }};
  return {session, selected: () => structuredClone(selected), calls: () => calls,
    failNext: () => { failOnce = true; }, set: (value: any[]) => { selected = structuredClone(value); }};
}
async function mixedDocument() {
  const HwpDocument = await engine(), document = HwpDocument.createEmpty(); document.createBlankDocument();
  assert.equal(JSON.parse(document.insertPicture(0, 0, 0, '', PNG, 7200, 7200, 1, 1, 'png', 'private-image-description')).ok, true);
  assert.equal(JSON.parse(document.insertEquation(0, 0, 1, 'a over b', 1100, 255)).ok, true);
  return {HwpDocument, document};
}

test('N015 restores ordered root equation+image selection through HWP/HWPX with byte-invariant undo/redo', {skip: !packageRoot}, async () => {
  const {HwpDocument, document} = await mixedDocument();
  try {
    const root = refs(document), order = [root.equation, root.image], source = fixture(document, order);
    const bookmark = captureMixedRootSelectionN015(source.session)!;
    assert.deepEqual(bookmark.objects.map(value => value.type), ['equation', 'image']); assert.equal(bookmark.active, 1);
    assert.deepEqual(validateMixedRootSelectionBookmarkN015(structuredClone(bookmark)), bookmark);
    assert.doesNotMatch(JSON.stringify(bookmark), /a over b|private-image|iVBOR|137,80,78,71/u);
    for (const bytes of [document.exportHwp(), document.exportHwpx()]) {
      const reopened = new HwpDocument(bytes);
      try {
        const reopenedRefs = refs(reopened), targetOrder = [reopenedRefs.equation, reopenedRefs.image], state = fixture(reopened);
        const beforeHwp = reopened.exportHwp(), beforeHwpx = reopened.exportHwpx();
        const transition = restoreMixedRootSelectionN015(state.session, bookmark);
        assert.deepEqual(state.selected(), targetOrder); assert.equal(state.calls(), 1);
        assert.deepEqual(reopened.exportHwp(), beforeHwp); assert.deepEqual(reopened.exportHwpx(), beforeHwpx);
        transition.undo(); assert.deepEqual(state.selected(), []);
        assert.deepEqual(reopened.exportHwp(), beforeHwp); assert.deepEqual(reopened.exportHwpx(), beforeHwpx);
        transition.redo(); assert.deepEqual(state.selected(), targetOrder);
        assert.deepEqual(reopened.exportHwp(), beforeHwp); assert.deepEqual(reopened.exportHwpx(), beforeHwpx);
      } finally { reopened.free(); }
    }
  } finally { document.free(); }
});

test('N015 mixed bookmark rejects order/active tampering and stale typed evidence before selection', {skip: !packageRoot}, async () => {
  const {document} = await mixedDocument();
  try {
    const root = refs(document), bookmark = captureMixedRootSelectionN015(fixture(document, [root.equation, root.image]).session)!;
    for (const mutate of [
      (value: any) => { value.active = 0; },
      (value: any) => { value.objects.reverse(); },
      (value: any) => { value.objects[0].objectFingerprint = '0'.repeat(64); },
    ]) { const copy = structuredClone(bookmark); mutate(copy); assert.equal(validateMixedRootSelectionBookmarkN015(copy), undefined); }
    for (const kind of ['equation', 'image', 'document'] as const) {
      const proxy = new Proxy(document, {get(value, key) {
        if (kind === 'equation' && key === 'getEquationProperties') return (...args: any[]) => JSON.stringify({...JSON.parse(value.getEquationProperties(...args)), script: 'changed'});
        if (kind === 'image' && key === 'getControlImageData') return () => new Uint8Array([1, 2, 3]);
        if (kind === 'document' && key === 'getControls') return () => JSON.stringify([...JSON.parse(value.getControls()), {ctrlId: 'other', list: 0, para: 0, controlIndex: 999, props: {}}]);
        const member = value[key]; return typeof member === 'function' ? member.bind(value) : member;
      }});
      const state = fixture(proxy); assert.throws(() => restoreMixedRootSelectionN015(state.session, bookmark), /바뀌었습니다/); assert.equal(state.calls(), 0);
    }
  } finally { document.free(); }
});

test('N015 mixed restore rolls selection back on port failure and keeps nested OLE table fail-closed', {skip: !packageRoot}, async () => {
  const {document} = await mixedDocument();
  try {
    const root = refs(document), order = [root.equation, root.image], bookmark = captureMixedRootSelectionN015(fixture(document, order).session)!;
    const previous = [root.equation], state = fixture(document, previous), beforeHwp = document.exportHwp(), beforeHwpx = document.exportHwpx();
    state.failNext(); assert.throws(() => restoreMixedRootSelectionN015(state.session, bookmark), /거절/);
    assert.deepEqual(state.selected(), previous); assert.equal(state.calls(), 2);
    assert.deepEqual(document.exportHwp(), beforeHwp); assert.deepEqual(document.exportHwpx(), beforeHwpx);
    assert.equal(captureMixedRootSelectionN015(fixture(document, [{...root.equation, cellPath: [{}]}, root.image]).session), undefined);
    assert.equal(captureMixedRootSelectionN015(fixture(document, [{...root.equation, type: 'ole'}, root.image]).session), undefined);
    const table = fixture(document, order); table.session.cursor.isInTableObjectSelection = () => true;
    assert.equal(captureMixedRootSelectionN015(table.session), undefined);
  } finally { document.free(); }
});
