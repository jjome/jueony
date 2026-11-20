import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import test from 'node:test';
import {
  createDocumentSplitViewControllerB062,
  documentSplitLayoutStorageKeyB062,
  parseStoredDocumentSplitLayoutB062,
  type DocumentSplitViewportB062,
  type SharedDocumentDescriptorB062,
  type SharedDocumentOwnerB062,
} from '../src/adapters/iframe/document-split-view-b062.ts';

const coordinator = {};
const state: SharedDocumentDescriptorB062 = {
  workspaceId: 'work-1',
  tabId: 'tab-1',
  documentIdentity: 'document-1',
  documentInstance: 'instance-1',
  revision: 'revision-1',
  mutationCoordinator: coordinator,
};

function owner(read: () => SharedDocumentDescriptorB062 = () => state): SharedDocumentOwnerB062 {
  return {current: read};
}

function storage(initial?: unknown, failWrite = false) {
  const values = new Map<string, string>();
  if (initial !== undefined) values.set('layout', JSON.stringify(initial));
  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem(key: string, value: string) {
      if (failWrite) throw new Error('quota');
      values.set(key, value);
    },
  };
}

function viewport(id: string, binding: () => SharedDocumentDescriptorB062 = () => state) {
  let attached: SharedDocumentOwnerB062 | undefined;
  let detached = 0;
  let focused = 0;
  const port: DocumentSplitViewportB062 = {
    id,
    attach(value) { attached = value; },
    binding() {
      assert.ok(attached, 'view must be attached before it reports a binding');
      return binding();
    },
    focus() { focused += 1; },
    detach() { detached += 1; attached = undefined; },
  };
  return {port, counts: () => ({detached, focused}), attached: () => attached};
}

test('B062 binds two viewports to the exact same document owner and mutation coordinator', () => {
  const shared = owner();
  const primary = viewport('primary');
  const secondary = viewport('secondary');
  const store = storage();
  const controller = createDocumentSplitViewControllerB062({
    owner: shared, primary: primary.port, storage: store, storageKey: 'layout',
  });
  assert.deepEqual(controller.split(received => {
    assert.equal(received, shared);
    return secondary.port;
  }, 'vertical'), {split: true, direction: 'vertical', ratio: 0.5, active: 'secondary'});
  assert.equal(primary.attached(), shared);
  assert.equal(secondary.attached(), shared);
  assert.equal(secondary.port.binding().mutationCoordinator, primary.port.binding().mutationCoordinator);
  assert.equal(secondary.counts().focused, 1);

  assert.equal(controller.setRatio(0.65).ratio, 0.65);
  assert.equal(controller.activate('primary').active, 'primary');
  assert.deepEqual(controller.closeSecondary(), {
    split: false, direction: 'vertical', ratio: 0.65, active: 'primary',
  });
  assert.equal(secondary.counts().detached, 1);
  assert.equal(primary.counts().focused, 2);
  assert.deepEqual(parseStoredDocumentSplitLayoutB062(store.values.get('layout')!), controller.snapshot());
});

test('B062 restores a persisted split only after a verified secondary viewport is supplied', () => {
  const desired = {version: 1, split: true, direction: 'horizontal', ratio: 0.4, active: 'secondary'};
  const primary = viewport('primary');
  const secondary = viewport('secondary');
  const controller = createDocumentSplitViewControllerB062({
    owner: owner(), primary: primary.port, storage: storage(desired), storageKey: 'layout',
  });
  assert.equal(controller.restorePending(), true);
  assert.deepEqual(controller.snapshot(), {split: false, direction: 'horizontal', ratio: 0.4, active: 'primary'});
  assert.deepEqual(controller.restore(() => secondary.port), {
    split: true, direction: 'horizontal', ratio: 0.4, active: 'secondary',
  });
  assert.equal(secondary.counts().focused, 1);
});

test('B062 rejects a cloned engine, stale revision, duplicate view id and unsafe layout', () => {
  const primary = viewport('primary');
  const shared = owner();
  const make = () => createDocumentSplitViewControllerB062({
    owner: shared, primary: primary.port, storage: storage(), storageKey: 'layout',
  });
  const cloned = viewport('secondary', () => ({...state, mutationCoordinator: {}}));
  assert.throws(() => make().split(() => cloned.port), /같은 문서 상태/);
  assert.equal(cloned.counts().detached, 1);
  assert.throws(() => make().split(() => viewport('primary').port), /같은 문서 상태/);
  const stale = viewport('secondary', () => ({...state, revision: 'old'}));
  assert.throws(() => make().split(() => stale.port), /같은 문서 상태/);
  assert.throws(() => make().setRatio(0.81), /올바르지/);
  assert.throws(() => parseStoredDocumentSplitLayoutB062(JSON.stringify({
    version: 1, split: false, direction: 'horizontal', ratio: 0.5, active: 'secondary',
  })), /올바르지/);

  let current = state;
  const replacedPrimary = viewport('primary', () => state);
  const replacedController = createDocumentSplitViewControllerB062({
    owner: owner(() => current), primary: replacedPrimary.port, storage: storage(), storageKey: 'layout',
  });
  current = {...state, documentIdentity: 'replacement-document', documentInstance: 'replacement-instance'};
  assert.throws(() => replacedController.setRatio(0.6), /같은 문서 상태/);
});

test('B062 storage failure rolls a newly attached view back without touching the owner', () => {
  const shared = owner();
  const primary = viewport('primary');
  const secondary = viewport('secondary');
  const controller = createDocumentSplitViewControllerB062({
    owner: shared, primary: primary.port, storage: storage(undefined, true), storageKey: 'layout',
  });
  assert.throws(() => controller.split(() => secondary.port), /저장하지 못/);
  assert.deepEqual(controller.snapshot(), {split: false, direction: 'horizontal', ratio: 0.5, active: 'primary'});
  assert.equal(secondary.counts().detached, 1);
  assert.equal(shared.current(), state);
});

test('B062 layout changes leave real HWP and HWPX export bytes unchanged', async () => {
  const enginePackage = process.env.JUEONY_ENGINE_PACKAGE
    ? resolve(process.env.JUEONY_ENGINE_PACKAGE)
    : fileURLToPath(new URL('../node_modules/@rhwp/core/', import.meta.url));
  const engine = await import(pathToFileURL(resolve(enginePackage, 'rhwp.js')).href);
  const {HwpDocument} = engine as typeof import('@rhwp/core');
  await engine.default({module_or_path: await readFile(resolve(enginePackage, 'rhwp_bg.wasm'))});
  const document = HwpDocument.createEmpty();
  try {
    document.createBlankDocument();
    document.insertText(0, 0, 0, '분할 화면은 문서를 복제하지 않습니다.');
    const digest = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
    const beforeHwp = digest(document.exportHwp());
    const beforeHwpx = digest(document.exportHwpx());
    const liveOwner = owner(() => ({
      ...state,
      revision: digest(document.exportHwpx()),
    }));
    const liveView = (id: string) => viewport(id, () => liveOwner.current());
    const controller = createDocumentSplitViewControllerB062({
      owner: liveOwner,
      primary: liveView('primary').port,
      storage: storage(),
      storageKey: documentSplitLayoutStorageKeyB062('user-1', 'work-1', 'tab-1'),
    });
    controller.split(() => liveView('secondary').port);
    controller.setDirection('vertical');
    controller.setRatio(0.7);
    controller.activate('primary');
    controller.closeSecondary();
    assert.equal(digest(document.exportHwp()), beforeHwp);
    assert.equal(digest(document.exportHwpx()), beforeHwpx);
  } finally { document.free(); }
});
