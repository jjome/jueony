import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { isAbsolute, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { auditEndnoteOwnerCapabilities } from '../src/adapters/rhwp/session-endnote-owner-capability-n016.ts';
import { readOwnedZip, writeOwnedZip } from '../scripts/lib/owned-zip.mjs';

test('root owners delegate while table, nested-table and shape lists fail closed with exact blockers', () => {
  const controls = [
    { ctrlId: 'en', ctrlCh: 2, list: 0, para: 0, pos: 16, controlIndex: 2 },
    { ctrlId: 'en', ctrlCh: 2, list: 2, para: 0, pos: 3, controlIndex: 0 },
    { ctrlId: 'en', ctrlCh: 2, list: 3, para: 0, pos: 4, controlIndex: 0 },
    { ctrlId: 'en', ctrlCh: 2, list: 4, para: 0, pos: 5, controlIndex: 0 },
  ];
  const lists = [
    { listId: 2, isCell: true, hostListId: 0, sectionIndex: 0, hostPara: 0, controlIndex: 3, cellIndex: 0, paraCount: 1 },
    { listId: 3, isCell: true, hostListId: 2, sectionIndex: 0, hostPara: 0, controlIndex: 1, cellIndex: 0, paraCount: 1 },
    { listId: 4, isCell: false, hostListId: 0, sectionIndex: 0, hostPara: 1, controlIndex: 0, cellIndex: 0, paraCount: 1 },
  ];
  const result = auditEndnoteOwnerCapabilities({
    getControls: () => JSON.stringify(controls),
    getCursorModel: () => JSON.stringify({ lists }),
  });
  assert.equal(result.complete, true);
  if (!result.complete) return;
  assert.deepEqual(result.owners.map(owner => [owner.scope, owner.restorationAddressable]), [
    ['root-body', true],
    ['table-cell', false],
    ['nested-table-cell', false],
    ['shape-list', false],
  ]);
  assert.deepEqual(result.owners[1].blockers, [
    'story-owner-address-is-root-only',
    'note-layout-address-is-root-only',
    'studio-selection-address-is-root-only',
  ]);
  assert.equal(result.owners[3].blockers[0], 'shape-list-kind-ambiguous');
  assert.match(result.owners[2].ownerFingerprint, /^[a-f0-9]{64}$/u);
});

test('malformed, missing, oversized, duplicate and cyclic inventory never yields a restorable owner', () => {
  assert.deepEqual(auditEndnoteOwnerCapabilities(undefined), {
    complete: false,
    owners: [],
    reason: 'owner-inventory-unavailable',
  });
  assert.equal(auditEndnoteOwnerCapabilities({
    getControls: () => '{',
    getCursorModel: () => '{}',
  }).complete, false);
  assert.equal(auditEndnoteOwnerCapabilities({
    getControls: () => 'x'.repeat(32 * 1024 * 1024 + 1),
    getCursorModel: () => '{}',
  }).complete, false);
  assert.equal(auditEndnoteOwnerCapabilities({
    getControls: () => '[]',
    getCursorModel: () => JSON.stringify({ lists: [
      { listId: 2, isCell: true, hostListId: 0, sectionIndex: 0, hostPara: 0, controlIndex: 0, cellIndex: 0, paraCount: 1 },
      { listId: 2, isCell: true, hostListId: 0, sectionIndex: 0, hostPara: 0, controlIndex: 1, cellIndex: 1, paraCount: 1 },
    ] }),
  }).complete, false);
  const cyclic = auditEndnoteOwnerCapabilities({
    getControls: () => JSON.stringify([{ ctrlId: 'en', ctrlCh: 2, list: 2, para: 0, pos: 0, controlIndex: 0 }]),
    getCursorModel: () => JSON.stringify({ lists: [
      { listId: 2, isCell: true, hostListId: 3, sectionIndex: 0, hostPara: 0, controlIndex: 0, cellIndex: 0, paraCount: 1 },
      { listId: 3, isCell: true, hostListId: 2, sectionIndex: 0, hostPara: 0, controlIndex: 0, cellIndex: 0, paraCount: 1 },
    ] }),
  });
  assert.equal(cyclic.complete, true);
  if (cyclic.complete) {
    assert.equal(cyclic.owners[0].restorationAddressable, false);
    assert.equal(cyclic.owners[0].blockers[0], 'owner-list-cycle');
  }
});

const enginePackage = process.env.JUEONY_ENGINE_PACKAGE;

test('actual table-cell endnote owner stays identifiable but non-restorable across HWP and HWPX reopen', {
  skip: !enginePackage ? 'set JUEONY_ENGINE_PACKAGE to a Jueony engine package' : false,
}, async () => {
  assert.ok(enginePackage && isAbsolute(enginePackage));
  const module = await import(pathToFileURL(resolve(enginePackage, 'rhwp.js')).href);
  await module.default({ module_or_path: await readFile(resolve(enginePackage, 'rhwp_bg.wasm')) });
  const { HwpDocument } = module;

  const seed = HwpDocument.createEmpty();
  let document: any;
  try {
    seed.createBlankDocument();
    seed.insertText(0, 0, 0, '본문');
    const ref = JSON.parse(seed.insertEndnote(0, 0, 1));
    seed.insertTextInFootnote(0, ref.paraIdx, ref.controlIdx, 0, 2, '표 안 미주 😀');
    seed.splitParagraph(0, 0, seed.getParagraphLength(0, 0));
    seed.pasteHtml(0, 1, 0, '<table><tr><td>셀</td></tr></table>');

    const parts = readOwnedZip(seed.exportHwpx());
    const section = parts.find(([name]: [string, Buffer]) => name === 'Contents/section0.xml');
    assert.ok(section);
    let xml = section[1].toString('utf8');
    const noteStart = xml.indexOf('<hp:ctrl><hp:endNote ');
    const noteClose = '</hp:endNote></hp:ctrl>';
    const noteEnd = xml.indexOf(noteClose, noteStart);
    assert.ok(noteStart >= 0 && noteEnd > noteStart);
    const note = xml.slice(noteStart, noteEnd + noteClose.length);
    xml = xml.slice(0, noteStart) + xml.slice(noteEnd + noteClose.length);
    const cellStart = xml.indexOf('<hp:tc ');
    const cellRunEnd = xml.indexOf('</hp:run>', cellStart);
    assert.ok(cellStart >= 0 && cellRunEnd > cellStart);
    xml = xml.slice(0, cellRunEnd) + note + xml.slice(cellRunEnd);
    section[1] = Buffer.from(xml);
    document = new HwpDocument(writeOwnedZip(parts));
  } finally {
    seed.free();
  }

  try {
    const first = auditEndnoteOwnerCapabilities(document);
    assert.equal(first.complete, true);
    if (!first.complete) return;
    const nested = first.owners.find(owner => owner.scope === 'table-cell');
    assert.ok(nested);
    assert.equal(nested.restorationAddressable, false);
    assert.deepEqual(nested.blockers, [
      'story-owner-address-is-root-only',
      'note-layout-address-is-root-only',
      'studio-selection-address-is-root-only',
    ]);

    const controls = JSON.parse(document.getControls());
    const endnote = controls.find((control: any) => control.ctrlId === 'en');
    assert.ok(endnote && endnote.list > 0);
    const rootOnly = JSON.parse(document.getSessionStoryEvidence(JSON.stringify({
      kind: 'endnote',
      section: 0,
      parent: endnote.para,
      control: endnote.controlIndex,
    })));
    assert.equal(rootOnly.complete, false);
    const nestedRequest = JSON.parse(document.getSessionStoryEvidence(JSON.stringify({
      kind: 'endnote',
      section: 0,
      parent: endnote.para,
      control: endnote.controlIndex,
      list: endnote.list,
    })));
    assert.equal(nestedRequest.complete, false);

    for (const format of ['hwp', 'hwpx'] as const) {
      const exportMethod = format === 'hwp' ? 'exportHwp' : 'exportHwpx';
      const before = document[exportMethod]();
      auditEndnoteOwnerCapabilities(document);
      assert.deepEqual(document[exportMethod](), before, `${format} audit must be read-only`);
      const reopened = new HwpDocument(before);
      try {
        const after = auditEndnoteOwnerCapabilities(reopened);
        assert.equal(after.complete, true, format);
        if (!after.complete) continue;
        const reopenedNested = after.owners.find(owner => owner.scope === 'table-cell');
        assert.ok(reopenedNested, format);
        assert.equal(reopenedNested.restorationAddressable, false, format);
        assert.equal(reopenedNested.ownerFingerprint, nested.ownerFingerprint, format);
      } finally {
        reopened.free();
      }
    }
  } finally {
    document.free();
  }
});
