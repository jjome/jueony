import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import test from 'node:test';
import {
  captureSingleEquationSelectionN015,
  restoreSingleEquationSelectionN015,
  validateSingleEquationSelectionBookmarkN015,
} from '../src/adapters/rhwp/object-selection-n015-single-equation.ts';

const packageRoot = process.env.JUEONY_ENGINE_PACKAGE;

async function engine() {
  if (!packageRoot) throw new Error('JUEONY_ENGINE_PACKAGE is required');
  const root = resolve(packageRoot), module: any = await import(pathToFileURL(resolve(root, 'rhwp.js')).href + `?n015-single=${Date.now()}`);
  await module.default({module_or_path: await readFile(resolve(root, 'rhwp_bg.wasm'))});
  return module.HwpDocument;
}

function ref(document: any) {
  const equation = JSON.parse(document.getObjects()).find((value: any) => value.kind === 'equation');
  return {sec: 0, ppi: equation.para, ci: equation.controlIndex, type: 'equation'};
}

function sessionFor(document: any, initial: any[] = []) {
  let selected = structuredClone(initial), selects = 0, clears = 0;
  const cursor = {
    isInPictureObjectSelection: () => selected.length > 0,
    isInTableObjectSelection: () => false,
    isInHeaderFooter: () => false,
    isInFootnote: () => false,
    isInTextBox: () => false,
    getSelectedPictureRefs: () => structuredClone(selected),
    getSelectedPictureRef: () => structuredClone(selected.at(-1) ?? null),
    exitPictureObjectSelection: () => { clears += 1; selected = []; },
  };
  const session: any = {
    wasm: {requiresPasswordForSave: false, borrowDocumentHandle: () => document}, cursor,
    selectPictureObject: (section: number, paragraph: number, control: number, type: string) => {
      selects += 1; selected = [{sec: section, ppi: paragraph, ci: control, type}];
    },
  };
  return {session, selected: () => structuredClone(selected), selects: () => selects, clears: () => clears,
    setSelected: (value: any[]) => { selected = structuredClone(value); }};
}

async function equationDocument() {
  const HwpDocument = await engine(), document = HwpDocument.createEmpty(); document.createBlankDocument();
  const result = JSON.parse(document.insertEquation(0, 0, 0, 'x^2 + y^2', 1000, 0)); assert.equal(result.ok, true);
  return {HwpDocument, document};
}

test('N015 restores one root equation across HWP/HWPX and selection undo/redo never changes bytes', {skip: !packageRoot}, async () => {
  const {HwpDocument, document} = await equationDocument();
  try {
    const source = sessionFor(document, [ref(document)]), bookmark = captureSingleEquationSelectionN015(source.session)!;
    assert.equal(bookmark.kind, 'single-root-equation-selection');
    assert.deepEqual(validateSingleEquationSelectionBookmarkN015(structuredClone(bookmark)), bookmark);
    assert.doesNotMatch(JSON.stringify(bookmark), /x\^2|y\^2|HYhwpEQ/u);
    for (const bytes of [document.exportHwp(), document.exportHwpx()]) {
      const reopened = new HwpDocument(bytes);
      try {
        const fixture = sessionFor(reopened), beforeHwp = reopened.exportHwp(), beforeHwpx = reopened.exportHwpx();
        const transition = restoreSingleEquationSelectionN015(fixture.session, bookmark);
        assert.deepEqual(fixture.selected(), [ref(reopened)]); assert.equal(fixture.selects(), 1);
        assert.deepEqual(reopened.exportHwp(), beforeHwp); assert.deepEqual(reopened.exportHwpx(), beforeHwpx);
        transition.undo(); assert.deepEqual(fixture.selected(), []); assert.equal(fixture.clears(), 1);
        assert.deepEqual(reopened.exportHwp(), beforeHwp); assert.deepEqual(reopened.exportHwpx(), beforeHwpx);
        transition.redo(); assert.deepEqual(fixture.selected(), [ref(reopened)]); assert.equal(fixture.selects(), 2);
        assert.deepEqual(reopened.exportHwp(), beforeHwp); assert.deepEqual(reopened.exportHwpx(), beforeHwpx);
      } finally { reopened.free(); }
    }
  } finally { document.free(); }
});

test('N015 rejects tampered or stale equation evidence before invoking the Studio selection port', {skip: !packageRoot}, async () => {
  const {document} = await equationDocument();
  try {
    const selected = ref(document), bookmark = captureSingleEquationSelectionN015(sessionFor(document, [selected]).session)!;
    const tampered: any = structuredClone(bookmark); tampered.target.control += 1;
    assert.equal(validateSingleEquationSelectionBookmarkN015(tampered), undefined);
    const target = sessionFor(document);
    assert.throws(() => restoreSingleEquationSelectionN015(target.session, tampered), /올바르지/); assert.equal(target.selects(), 0);

    const proxy = new Proxy(document, {get(value, key) {
      if (key === 'getEquationProperties') return (...args: any[]) => JSON.stringify({...JSON.parse(value.getEquationProperties(...args)), script: 'changed'});
      const member = value[key]; return typeof member === 'function' ? member.bind(value) : member;
    }});
    const stale = sessionFor(proxy);
    assert.throws(() => restoreSingleEquationSelectionN015(stale.session, bookmark), /바뀌었습니다/); assert.equal(stale.selects(), 0);

    const changed = new Uint8Array(document.exportHwpx()), before = document.exportHwp();
    document.insertText(0, 0, 0, '변경'); const changedFixture = sessionFor(document);
    assert.throws(() => restoreSingleEquationSelectionN015(changedFixture.session, bookmark), /바뀌었습니다/);
    assert.equal(changedFixture.selects(), 0); assert.notDeepEqual(document.exportHwp(), before); assert.ok(changed.length > 0);
  } finally { document.free(); }
});

test('N015 keeps mixed, nested, OLE and table selection capabilities fail-closed', {skip: !packageRoot}, async () => {
  const {document} = await equationDocument();
  try {
    const equation = ref(document);
    for (const unsupported of [
      [equation, {...equation, ci: equation.ci + 1, type: 'image'}],
      [{...equation, cellPath: [{controlIndex: 0, cellIndex: 0, cellParaIndex: 0}]}],
      [{...equation, type: 'ole'}],
    ]) assert.equal(captureSingleEquationSelectionN015(sessionFor(document, unsupported).session), undefined);
    const table = sessionFor(document, [equation]); table.session.cursor.isInTableObjectSelection = () => true;
    assert.equal(captureSingleEquationSelectionN015(table.session), undefined);

    const bookmark = captureSingleEquationSelectionN015(sessionFor(document, [equation]).session)!;
    const mixedCurrent = sessionFor(document, [equation, {...equation, ci: equation.ci + 1, type: 'image'}]);
    assert.throws(() => restoreSingleEquationSelectionN015(mixedCurrent.session, bookmark), /mixed/);
    assert.equal(mixedCurrent.selects(), 0);
  } finally { document.free(); }
});
