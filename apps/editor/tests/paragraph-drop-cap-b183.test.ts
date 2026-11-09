import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import test from 'node:test';
import {
  applyExistingParagraphDropCapB183,
  captureParagraphDropCapB183,
  readParagraphDropCapB183,
  type ParagraphDropCapContextB183,
  type ParagraphDropCapSessionB183,
} from '../src/adapters/rhwp/paragraph-drop-cap-b183.ts';

const enginePackage = process.env.JUEONY_ENGINE_PACKAGE
  ? resolve(process.env.JUEONY_ENGINE_PACKAGE)
  : fileURLToPath(new URL('../node_modules/@rhwp/core/', import.meta.url));
const engine = await import(pathToFileURL(resolve(enginePackage, 'rhwp.js')).href);
const {HwpDocument} = engine as typeof import('@rhwp/core');
await engine.default({module_or_path: await readFile(resolve(enginePackage, 'rhwp_bg.wasm'))});

const PNG = Uint8Array.from(Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WlKxYQAAAAASUVORK5CYII=',
  'base64',
));

const BODY: ParagraphDropCapContextB183 = Object.freeze({
  sectionIndex: 0,
  paragraphIndex: 0,
  story: 'body',
  editable: true,
  documentProtected: false,
  selectionCollapsed: true,
});

function digest(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function revision(document: any): string {
  return digest(document.exportHwpx());
}

function insertPicture(document: any): {paraIdx: number; controlIdx: number} {
  const result = JSON.parse(document.insertPicture(0, 0, 0, '', PNG, 3600, 7200, 1, 1, 'png', 'B183 fixture'));
  assert.equal(result.ok, true);
  assert.ok(Number.isSafeInteger(result.paraIdx));
  assert.ok(Number.isSafeInteger(result.controlIdx));
  return result;
}

function hwpxFixture(style: 'None' | 'DoubleLine' | 'TripleLine' | 'Margin'): any {
  const seed: any = HwpDocument.createEmpty();
  try {
    seed.createBlankDocument();
    const ref = insertPicture(seed);
    const changed = JSON.parse(seed.setPictureProperties(0, ref.paraIdx, ref.controlIdx, JSON.stringify({dropCapStyle: style})));
    assert.equal(changed.ok, true);
    return new HwpDocument(seed.exportHwpx());
  } finally { seed.free(); }
}

function session(document: any, context = BODY): ParagraphDropCapSessionB183 {
  return {document, context: () => context, revision: () => revision(document)};
}

test('B183 reads, changes, undo-restores, and HWPX save-reopens one existing picture-backed drop cap', () => {
  const document = hwpxFixture('DoubleLine');
  let reopened: any;
  try {
    const initial = readParagraphDropCapB183(document, BODY);
    assert.equal(initial.status, 'available');
    assert.equal(initial.status === 'available' && initial.target?.style, 'double-line');

    const captured = captureParagraphDropCapB183(session(document));
    assert.equal(captured.status, 'ready');
    if (captured.status !== 'ready') return;
    const receipt = applyExistingParagraphDropCapB183(session(document), captured.plan, 'triple-line');
    assert.equal(receipt.before.style, 'double-line');
    assert.equal(receipt.after.style, 'triple-line');

    reopened = new HwpDocument(document.exportHwpx());
    assert.equal(reopened.getSourceFormat(), 'hwpx');
    const stored = readParagraphDropCapB183(reopened, BODY);
    assert.equal(stored.status, 'available');
    assert.equal(stored.status === 'available' && stored.target?.style, 'triple-line');
    reopened.free(); reopened = undefined;

    assert.equal(receipt.undo(), true);
    const restored = readParagraphDropCapB183(document, BODY);
    assert.equal(restored.status, 'available');
    assert.equal(restored.status === 'available' && restored.target?.style, 'double-line');
    reopened = new HwpDocument(document.exportHwpx());
    assert.equal(readParagraphDropCapB183(reopened, BODY).status, 'available');
    assert.equal((readParagraphDropCapB183(reopened, BODY) as any).target.style, 'double-line');
  } finally { reopened?.free(); document.free(); }
});

test('B183 never treats an ordinary picture as a creatable paragraph drop cap', () => {
  const document = hwpxFixture('None');
  try {
    assert.deepEqual(readParagraphDropCapB183(document, BODY), {status: 'available', target: null});
    assert.deepEqual(captureParagraphDropCapB183(session(document)), {status: 'blocked', reason: 'no-existing-drop-cap'});
  } finally { document.free(); }
});

test('B183 stale revision, special story, selection, protection, and ambiguous evidence fail closed', () => {
  const document = hwpxFixture('Margin');
  try {
    const captured = captureParagraphDropCapB183(session(document));
    assert.equal(captured.status, 'ready');
    if (captured.status !== 'ready') return;
    document.insertText(0, 0, document.getParagraphLength(0, 0), 'stale');
    assert.throws(() => applyExistingParagraphDropCapB183(session(document), captured.plan, 'double-line'), /계획 이후 변경/);
    assert.equal((readParagraphDropCapB183(document, BODY) as any).target.style, 'margin');

    for (const story of ['table-cell', 'header-footer', 'footnote', 'endnote', 'textbox'] as const) {
      assert.deepEqual(readParagraphDropCapB183(document, {...BODY, story}), {status: 'blocked', reason: 'unsupported-story'});
    }
    assert.deepEqual(readParagraphDropCapB183(document, {...BODY, selectionCollapsed: false}),
      {status: 'blocked', reason: 'unsupported-selection'});
    assert.deepEqual(captureParagraphDropCapB183(session(document, {...BODY, editable: false})),
      {status: 'blocked', reason: 'read-only'});
    assert.deepEqual(captureParagraphDropCapB183(session(document, {...BODY, documentProtected: true})),
      {status: 'blocked', reason: 'read-only'});

    const controls = JSON.parse(document.getControls()).map((control: any) =>
      control.userDesc === '그림' ? {...control, props: {...control.props, Lock: 1}} : control);
    const locked = new Proxy(document, {get(target, key) {
      if (key === 'getControls') return () => JSON.stringify(controls);
      const value = target[key as keyof typeof target];
      return typeof value === 'function' ? value.bind(target) : value;
    }});
    assert.deepEqual(readParagraphDropCapB183(locked as any, BODY), {status: 'blocked', reason: 'protected'});
    const ambiguous = {
      getSourceFormat: () => 'hwpx', getSectionCount: () => 1, getParagraphCount: () => 1,
      getControls: () => JSON.stringify([0, 1].map(controlIndex => ({
        ctrlId: 'gso', userDesc: '그림', list: 0, para: 0, pos: controlIndex * 8,
        controlIndex, props: {Lock: 0},
      }))),
      getPictureProperties: () => JSON.stringify({dropCapStyle: 'DoubleLine'}),
    };
    assert.deepEqual(readParagraphDropCapB183(ambiguous, BODY), {status: 'blocked', reason: 'ambiguous-drop-cap'});
  } finally { document.free(); }
});

test('B183 reports the exact missing native field and rejects HWP without pretending to preserve it', () => {
  const malformed = {
    getSourceFormat: () => 'hwpx',
    getSectionCount: () => 1,
    getParagraphCount: () => 1,
    getControls: () => JSON.stringify([{ctrlId: 'gso', userDesc: '그림', list: 0, para: 0, pos: 0, controlIndex: 0, props: {Lock: 0}}]),
    getPictureProperties: () => JSON.stringify({textWrap: 'Square'}),
  };
  assert.deepEqual(readParagraphDropCapB183(malformed, BODY), {status: 'blocked', reason: 'native-contract-missing'});

  const document = hwpxFixture('DoubleLine');
  let hwp: any;
  try {
    hwp = new HwpDocument(document.exportHwp());
    assert.equal(hwp.getSourceFormat(), 'hwp');
    assert.deepEqual(readParagraphDropCapB183(hwp, BODY), {status: 'blocked', reason: 'unsupported-format'});
  } finally { hwp?.free(); document.free(); }
});
