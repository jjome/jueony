import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import test from 'node:test';
import {
  createDocumentStartAssistantB004,
  DocumentStartErrorB004,
  type DocumentStartCatalogB004,
} from '../src/adapters/browser/document-start-assistant-b004.ts';

const A = 'a'.repeat(64);
const B = 'b'.repeat(64);
const base = (): DocumentStartCatalogB004 => ({
  workspaceId: 'workspace-1',
  stamp: 'catalog-1',
  blankSupported: true,
  recents: [{id: 'recent-1', label: '최근 보고서', fingerprint: A}],
  templates: [
    {id: 'approved-hwpx', label: '승인 서식', fingerprint: B, format: 'hwpx', local: true, authorized: true},
    {id: 'remote-hwp', label: '원격 서식', fingerprint: A, format: 'hwp', local: false, authorized: true},
    {id: 'unapproved-hwp', label: '미승인 서식', fingerprint: A, format: 'hwp', local: true, authorized: false},
    {id: 'hwt-structure', label: 'HWT 구조', fingerprint: B, format: 'hwt', local: true, authorized: true},
  ],
});

function fixture(catalog = base()) {
  let current = catalog;
  let raw: string | null = null;
  const calls: unknown[] = [];
  return {
    calls,
    setCatalog(value: DocumentStartCatalogB004) { current = value; },
    storage: {
      getItem: () => raw,
      setItem: (_key: string, value: string) => { raw = value; },
    },
    raw: () => raw,
    host: {
      snapshot: () => current,
      openBlank: async () => { calls.push(['blank']); return {status: 'opened', tabId: 'tab-blank', documentIdentity: 'doc-blank'}; },
      openRecent: async (value: unknown) => { calls.push(['recent', value]); return {status: 'opened', tabId: 'tab-recent', documentIdentity: 'doc-recent'}; },
      openTemplate: async (value: unknown) => { calls.push(['template', value]); return {status: 'opened', tabId: 'tab-template', documentIdentity: 'doc-template'}; },
    },
  };
}

test('B004 exposes only blank, exact native recents, and authorized local HWP/HWPX templates', () => {
  const value = fixture();
  const assistant = createDocumentStartAssistantB004(value);
  assert.deepEqual(assistant.options().map(option => option.key), [
    'blank', 'recent:recent-1', 'template:approved-hwpx',
  ]);
  assert.equal(assistant.selected(), 'blank');
  assistant.cancel();
  assert.deepEqual(value.calls, []);
  assert.equal(value.raw(), null);
});

test('B004 opens the selected recent once with exact fingerprint and persists only its opaque key', async () => {
  const value = fixture();
  const assistant = createDocumentStartAssistantB004(value);
  assistant.select('recent:recent-1');
  assert.deepEqual(await assistant.start(), {
    status: 'opened', tabId: 'tab-recent', documentIdentity: 'doc-recent', preferenceSaved: true,
  });
  assert.deepEqual(value.calls, [['recent', {id: 'recent-1', fingerprint: A}]]);
  assert.deepEqual(JSON.parse(value.raw()!), {version: 1, choiceKey: 'recent:recent-1'});
  await assert.rejects(assistant.start(), (error: unknown) =>
    error instanceof DocumentStartErrorB004 && error.code === 'already-closed');
});

test('B004 stale catalogs and unsupported selections fail before opening a document', async () => {
  const value = fixture();
  const assistant = createDocumentStartAssistantB004(value);
  assert.throws(() => assistant.select('template:unapproved-hwp'), /지원하지 않는/);
  assistant.select('template:approved-hwpx');
  value.setCatalog({...base(), stamp: 'catalog-2'});
  await assert.rejects(assistant.start(), (error: unknown) =>
    error instanceof DocumentStartErrorB004 && error.code === 'stale-catalog');
  assert.deepEqual(value.calls, []);
});

test('B004 malformed host completion never masquerades as an opened document', async () => {
  const value = fixture();
  value.host.openBlank = async () => { value.calls.push(['blank']); return {status: 'opening'}; };
  const assistant = createDocumentStartAssistantB004(value);
  await assert.rejects(assistant.start(), (error: unknown) =>
    error instanceof DocumentStartErrorB004 && error.code === 'invalid-result');
  assert.equal(value.raw(), null);
  assert.deepEqual(value.calls, [['blank']]);
});

test('B004 preference write failure never masks an already opened document', async () => {
  const value = fixture();
  value.storage.setItem = () => { throw new Error('quota'); };
  const result = await createDocumentStartAssistantB004(value).start();
  assert.deepEqual(result, {
    status: 'opened', tabId: 'tab-blank', documentIdentity: 'doc-blank', preferenceSaved: false,
  });
  assert.deepEqual(value.calls, [['blank']]);
});

test('B004 preview and cancel leave an actual document and HWP/HWPX bytes unchanged', async () => {
  const packageDir = fileURLToPath(new URL('../node_modules/@rhwp/core/', import.meta.url));
  const engine = await import(pathToFileURL(resolve(packageDir, 'rhwp.js')).href);
  await engine.default({module_or_path: await readFile(resolve(packageDir, 'rhwp_bg.wasm'))});
  const document = engine.HwpDocument.createEmpty();
  try {
    document.createBlankDocument();
    document.insertText(0, 0, 0, '현재 문서 보존');
    const beforeHwp = createHash('sha256').update(document.exportHwp()).digest('hex');
    const beforeHwpx = createHash('sha256').update(document.exportHwpx()).digest('hex');
    const value = fixture();
    const assistant = createDocumentStartAssistantB004(value);
    assistant.select('template:approved-hwpx');
    assistant.cancel();
    assert.equal(createHash('sha256').update(document.exportHwp()).digest('hex'), beforeHwp);
    assert.equal(createHash('sha256').update(document.exportHwpx()).digest('hex'), beforeHwpx);
    assert.deepEqual(value.calls, []);
  } finally { document.free(); }
});
