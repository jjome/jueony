import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyCrossReferenceB093,
  auditCrossReferenceCapabilityB093,
  captureCrossReferenceB093,
  planCrossReferenceDisplayUpdateB093,
  planCrossReferenceInsertB093,
  queryCrossReferencesB093,
  type CrossReferenceDocumentB093,
  type CrossReferenceOwnerB093,
} from '../src/adapters/rhwp/cross-reference-b093.ts';

type State = {
  format: 'hwp' | 'hwpx';
  lengths: number[][];
  bookmarks: Array<{name: string; sec: number; para: number; ctrlIdx: number; charPos: number}>;
  fields: Array<{
    fieldId: number;
    fieldType: string;
    command: string;
    value: string;
    location: {sectionIndex: number; paraIndex: number};
    startCharIdx: number;
    endCharIdx: number;
  }>;
  controls: Array<{list: number; para: number; controlIndex: number; ctrlId: string}>;
};

const encode = (state: State): Uint8Array => new TextEncoder().encode(JSON.stringify(state));
const decode = (bytes: Uint8Array): State => JSON.parse(new TextDecoder().decode(bytes));
const clone = <T>(value: T): T => structuredClone(value);

class FakeDocument implements CrossReferenceDocumentB093 {
  static mutations = 0;
  state: State;
  snapshots = new Map<number, State>();
  nextSnapshot = 1;
  wrongInsertReceipt = false;
  freed = false;

  constructor(bytes?: Uint8Array) {
    this.state = bytes ? decode(bytes) : {
      format: 'hwp',
      lengths: [[8]],
      bookmarks: [{name: '정책 근거', sec: 0, para: 0, ctrlIdx: 2, charPos: 4}],
      fields: [],
      controls: [
        {list: 0, para: 0, controlIndex: 0, ctrlId: 'secd'},
        {list: 0, para: 0, controlIndex: 1, ctrlId: 'cold'},
        {list: 0, para: 0, controlIndex: 2, ctrlId: 'bokm'},
      ],
    };
  }

  getSourceFormat() { return this.state.format; }
  getSectionCount() { return this.state.lengths.length; }
  getParagraphCount(section: number) { return this.state.lengths[section]?.length ?? -1; }
  getParagraphLength(section: number, paragraph: number) { return this.state.lengths[section]?.[paragraph] ?? -1; }
  getBookmarks() { return JSON.stringify(this.state.bookmarks); }
  getControls() { return JSON.stringify(this.state.controls); }
  getFieldList() { return JSON.stringify(this.state.fields); }

  insertCrossReferenceB093(
    section: number,
    paragraph: number,
    charOffset: number,
    bookmarkName: string,
    bookmarkSection: number,
    bookmarkParagraph: number,
    bookmarkControlIndex: number,
    bookmarkCharOffset: number,
    displayText: string,
  ) {
    FakeDocument.mutations++;
    const bookmark = this.state.bookmarks.filter(item => item.name === bookmarkName);
    if (bookmark.length !== 1 || JSON.stringify(bookmark[0]) !== JSON.stringify({
      name: bookmarkName,
      sec: bookmarkSection,
      para: bookmarkParagraph,
      ctrlIdx: bookmarkControlIndex,
      charPos: bookmarkCharOffset,
    })) throw new Error('stale bookmark');
    const fieldId = Math.max(0, ...this.state.fields.map(field => field.fieldId)) + 1;
    const command = `?${bookmarkName};0;1;1;0;`;
    this.state.fields.push({
      fieldId,
      fieldType: 'crossref',
      command,
      value: displayText,
      location: {sectionIndex: section, paraIndex: paragraph},
      startCharIdx: charOffset,
      endCharIdx: charOffset + Array.from(displayText).length,
    });
    this.state.controls.push({list: 0, para: paragraph, controlIndex: this.state.controls.length, ctrlId: '%xrf'});
    return JSON.stringify({ok: true, fieldId, charOffset, command: this.wrongInsertReceipt ? '?wrong;0;1;1;0;' : command});
  }

  setFieldValue(fieldId: number, value: string) {
    FakeDocument.mutations++;
    const field = this.state.fields.find(item => item.fieldId === fieldId);
    if (!field) throw new Error('missing field');
    const oldValue = field.value;
    field.value = value;
    field.endCharIdx = field.startCharIdx + Array.from(value).length;
    return JSON.stringify({ok: true, fieldId, oldValue, newValue: value});
  }

  saveSnapshot() {
    const id = this.nextSnapshot++;
    this.snapshots.set(id, clone(this.state));
    return id;
  }

  restoreSnapshot(id: number) {
    const state = this.snapshots.get(id);
    if (!state) throw new Error('missing snapshot');
    this.state = clone(state);
    return '{"ok":true}';
  }

  discardSnapshot(id: number) { this.snapshots.delete(id); }
  exportHwp() { return encode({...clone(this.state), format: 'hwp'}); }
  exportHwpx() { return encode({...clone(this.state), format: 'hwpx'}); }
  free() { this.freed = true; }
}

function fixture(): {document: FakeDocument; owner: CrossReferenceOwnerB093; setRevision(value: string): void; setProtected(value: boolean): void; setStory(value: string): void} {
  const document = new FakeDocument();
  let revision = 'doc:1';
  let protectedState = false;
  let story = 'body';
  return {
    document,
    owner: {
      documentIdentity: () => 'document-A',
      revision: () => revision,
      editable: () => true,
      protected: () => protectedState,
      story: () => story,
    },
    setRevision: value => { revision = value; },
    setProtected: value => { protectedState = value; },
    setStory: value => { story = value; },
  };
}

test('B093 capability audit truthfully reports the current no-insertion engine surface', () => {
  const fixtureValue = fixture();
  const currentEngine = {
    getFieldList: fixtureValue.document.getFieldList.bind(fixtureValue.document),
    getBookmarks: fixtureValue.document.getBookmarks.bind(fixtureValue.document),
    setFieldValue: fixtureValue.document.setFieldValue.bind(fixtureValue.document),
  };
  assert.deepEqual(auditCrossReferenceCapabilityB093(currentEngine), {
    status: 'partial',
    storedFieldQuery: true,
    storedDisplayUpdate: true,
    namedBodyInsertion: false,
    automaticTargetResolution: false,
    reason: '현재 공개 엔진에는 상호참조 삽입 API가 없습니다. 일반 텍스트로 대체하지 않으며 조회·기존 표시값 갱신만 별도 검증 대상입니다.',
  });
  assert.equal(auditCrossReferenceCapabilityB093(fixtureValue.document).status, 'ready');
});

test('B093 fake port contract verifies both export branches and snapshot undo/redo', () => {
  FakeDocument.mutations = 0;
  const fixtureValue = fixture();
  const before = captureCrossReferenceB093(fixtureValue.document, fixtureValue.owner);
  const plan = planCrossReferenceInsertB093(before, {bookmarkName: '정책 근거', section: 0, paragraph: 0, charOffset: 2, displayText: '제1장'});
  const receipt = applyCrossReferenceB093(fixtureValue.document, fixtureValue.owner, plan);
  assert.equal(FakeDocument.mutations, 1);
  assert.deepEqual(queryCrossReferencesB093(fixtureValue.document, fixtureValue.owner).map(field => [field.targetName, field.displayText]), [['정책 근거', '제1장']]);
  receipt.undo();
  assert.deepEqual(JSON.parse(fixtureValue.document.getFieldList()), []);
  receipt.redo();
  assert.equal(JSON.parse(fixtureValue.document.getFieldList())[0].value, '제1장');
  receipt.dispose();
  assert.equal(fixtureValue.document.snapshots.size, 0);
});

test('B093 updates only the captured field display and retains bookmark command and location', () => {
  const fixtureValue = fixture();
  const initial = planCrossReferenceInsertB093(captureCrossReferenceB093(fixtureValue.document, fixtureValue.owner), {
    bookmarkName: '정책 근거', section: 0, paragraph: 0, charOffset: 3, displayText: '초안',
  });
  const inserted = applyCrossReferenceB093(fixtureValue.document, fixtureValue.owner, initial);
  inserted.dispose();
  const update = planCrossReferenceDisplayUpdateB093(captureCrossReferenceB093(fixtureValue.document, fixtureValue.owner), inserted.fieldId, '확정');
  const receipt = applyCrossReferenceB093(fixtureValue.document, fixtureValue.owner, update);
  const field = queryCrossReferencesB093(fixtureValue.document, fixtureValue.owner)[0];
  assert.deepEqual([field.command, field.displayText, field.section, field.paragraph, field.start], ['?정책 근거;0;1;1;0;', '확정', 0, 0, 3]);
  receipt.undo();
  assert.equal(JSON.parse(fixtureValue.document.getFieldList())[0].value, '초안');
  receipt.redo();
  assert.equal(JSON.parse(fixtureValue.document.getFieldList())[0].value, '확정');
  receipt.dispose();
});

test('B093 stale identity/revision/bookmark evidence refuses before snapshots or mutation', () => {
  for (const mutate of [
    (fixtureValue: ReturnType<typeof fixture>) => fixtureValue.setRevision('doc:2'),
    (fixtureValue: ReturnType<typeof fixture>) => { fixtureValue.document.state.bookmarks[0].charPos = 5; },
    (fixtureValue: ReturnType<typeof fixture>) => { fixtureValue.document.state.bookmarks[0].name = '이름 변경'; },
  ]) {
    FakeDocument.mutations = 0;
    const fixtureValue = fixture();
    const plan = planCrossReferenceInsertB093(captureCrossReferenceB093(fixtureValue.document, fixtureValue.owner), {
      bookmarkName: '정책 근거', section: 0, paragraph: 0, charOffset: 0, displayText: '표시',
    });
    mutate(fixtureValue);
    assert.throws(() => applyCrossReferenceB093(fixtureValue.document, fixtureValue.owner, plan));
    assert.equal(FakeDocument.mutations, 0);
    assert.equal(fixtureValue.document.snapshots.size, 0);
  }
});

test('B093 protected and special-story contexts, duplicate targets and malformed commands fail closed', () => {
  for (const mutate of [
    (fixtureValue: ReturnType<typeof fixture>) => fixtureValue.setProtected(true),
    (fixtureValue: ReturnType<typeof fixture>) => fixtureValue.setStory('header'),
    (fixtureValue: ReturnType<typeof fixture>) => fixtureValue.document.state.bookmarks.push({...fixtureValue.document.state.bookmarks[0]}),
    (fixtureValue: ReturnType<typeof fixture>) => fixtureValue.document.state.controls.push({list: 0, para: 0, controlIndex: 3, ctrlId: 'head'}),
  ]) {
    FakeDocument.mutations = 0;
    const fixtureValue = fixture();
    mutate(fixtureValue);
    assert.throws(() => captureCrossReferenceB093(fixtureValue.document, fixtureValue.owner));
    assert.equal(FakeDocument.mutations, 0);
  }
  const fixtureValue = fixture();
  fixtureValue.document.state.fields.push({fieldId: 1, fieldType: 'crossref', command: '?#12;0;1;1;0;', value: '1', location: {sectionIndex: 0, paraIndex: 0}, startCharIdx: 0, endCharIdx: 1});
  fixtureValue.document.state.controls.push({list: 0, para: 0, controlIndex: 3, ctrlId: '%xrf'});
  assert.throws(() => captureCrossReferenceB093(fixtureValue.document, fixtureValue.owner));
});

test('B093 malformed names, display controls and out-of-range insertion never reach the engine', () => {
  const fixtureValue = fixture();
  const snapshot = captureCrossReferenceB093(fixtureValue.document, fixtureValue.owner);
  for (const request of [
    {bookmarkName: '정책;근거', section: 0, paragraph: 0, charOffset: 0, displayText: '표시'},
    {bookmarkName: '정책 근거', section: 0, paragraph: 0, charOffset: 9, displayText: '표시'},
    {bookmarkName: '정책 근거', section: 0, paragraph: 0, charOffset: 0, displayText: '잘못\n된 값'},
  ]) assert.throws(() => planCrossReferenceInsertB093(snapshot, request));
});

test('B093 a post-mutation receipt mismatch restores exact source-format bytes', () => {
  FakeDocument.mutations = 0;
  const fixtureValue = fixture();
  const before = fixtureValue.document.exportHwp();
  const plan = planCrossReferenceInsertB093(captureCrossReferenceB093(fixtureValue.document, fixtureValue.owner), {
    bookmarkName: '정책 근거', section: 0, paragraph: 0, charOffset: 1, displayText: '표시',
  });
  fixtureValue.document.wrongInsertReceipt = true;
  assert.throws(() => applyCrossReferenceB093(fixtureValue.document, fixtureValue.owner, plan));
  assert.deepEqual(fixtureValue.document.exportHwp(), before);
  assert.equal(fixtureValue.document.snapshots.size, 0);
  assert.equal(FakeDocument.mutations, 1);
});
