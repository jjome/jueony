import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import test from 'node:test';
import {
  applyCommentPlanB092,
  auditDocumentCommentsB092,
  captureCreateCommentB092,
  captureDeleteCommentB092,
  captureUpdateCommentB092,
  readDocumentCommentsB092,
  type CommentContextB092,
} from '../src/adapters/rhwp/document-comments-b092.ts';
import {verifyPreservedExport} from '../src/adapters/rhwp/preservation.ts';

const packageRoot = process.env.JUEONY_ENGINE_PACKAGE;
const engine = packageRoot ? await import(pathToFileURL(resolve(packageRoot, 'rhwp.js')).href) : undefined;
if (engine && packageRoot) await engine.default({module_or_path: await readFile(resolve(packageRoot, 'rhwp_bg.wasm'))});
const HwpDocument = engine?.HwpDocument;
const digest = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

function port(document: any, overrides: Partial<{story: string; editable: boolean; protected: boolean}> = {}): CommentContextB092 {
  return {
    documentIdentity: () => 'memo-document-1',
    revision: () => digest(document.exportHwp()),
    story: () => overrides.story ?? 'body',
    editable: () => overrides.editable ?? true,
    protected: () => overrides.protected ?? false,
  };
}

test('B092/B136 capability is fail-closed unless the complete native MEMO contract exists', () => {
  assert.deepEqual(auditDocumentCommentsB092({}), {supported: false, reason: 'api-unavailable'});
  const partial = {
    getCommentListV1: () => '[]', insertCommentAtCursorV1: () => '{}', removeCommentV1: () => '{}',
    saveSnapshot: () => 1, restoreSnapshot: () => '{}',
  };
  assert.deepEqual(auditDocumentCommentsB092(partial), {supported: false, reason: 'api-unavailable'});
  assert.equal(readDocumentCommentsB092({getCommentListV1: () => '[{"fieldId":1}]'}), undefined);
});

test('actual Rust/WASM point comment creates, queries, deletes, restores, and survives HWP/HWPX reopen',
  {skip: !HwpDocument ? 'set JUEONY_ENGINE_PACKAGE to the freshly built Jueony engine' : false}, () => {
  const document = HwpDocument.createEmpty();
  try {
    document.createBlankDocument();
    document.insertText(0, 0, 0, '검토할 본문입니다.');
    const bodyBytes = new TextEncoder().encode(document.getTextRange(0, 0, 0, 100));
    assert.deepEqual(auditDocumentCommentsB092(document), {
      supported: true, model: 'rhwp-memo-field', scope: 'body-point-comment', formats: ['hwp', 'hwpx'],
    });
    const before = document.exportHwp();
    const create = captureCreateCommentB092(document, port(document), {section: 0, paragraph: 0, offset: 3}, '근거를 보강하세요.', '검토자');
    assert.equal(create.status, 'ready');
    if (create.status !== 'ready') return;
    const created = applyCommentPlanB092(document, port(document), create.plan);
    assert.equal(created.status, 'applied');
    if (created.status !== 'applied') return;
    assert.deepEqual(created.comment, {
      fieldId: 1, memoIndex: 2, text: '근거를 보강하세요.', author: '검토자',
      section: 0, paragraph: 0, start: 3, end: 3, pointComment: true,
    });
    const afterCreate = document.exportHwp();
    assert.notDeepEqual(afterCreate, before);

    for (const [format, bytes] of [['hwp', afterCreate], ['hwpx', document.exportHwpx()]] as const) {
      const reopened = new HwpDocument(bytes);
      try {
        assert.deepEqual(readDocumentCommentsB092(reopened), [created.comment], `${format} comment`);
        assert.equal(reopened.getTextRange(0, 0, 0, 100), '검토할 본문입니다.', `${format} body unchanged`);
        const storedField = JSON.parse(reopened.getFieldList()).find((field: any) => field.fieldType === 'memo');
        assert.equal(storedField?.command, 'MEMO/65535/2/1/1/검토자/\\;;', `${format} author command`);
      } finally { reopened.free(); }
    }

    assert.equal(created.command.undo().status, 'restored');
    assert.deepEqual(document.exportHwp(), before);
    assert.deepEqual(readDocumentCommentsB092(document), []);
    assert.equal(created.command.redo().status, 'restored');
    assert.deepEqual(document.exportHwp(), afterCreate);
    created.command.dispose();

    const remove = captureDeleteCommentB092(document, port(document), created.comment.fieldId);
    assert.equal(remove.status, 'ready');
    if (remove.status !== 'ready') return;
    const removed = applyCommentPlanB092(document, port(document), remove.plan);
    assert.equal(removed.status, 'applied');
    if (removed.status !== 'applied') return;
    assert.deepEqual(readDocumentCommentsB092(document), []);
    assert.deepEqual(new TextEncoder().encode(document.getTextRange(0, 0, 0, 100)), bodyBytes, 'delete preserves body bytes');
    const afterDeleteHwp = document.exportHwp(), afterDeleteHwpx = document.exportHwpx();
    for (const bytes of [afterDeleteHwp, afterDeleteHwpx]) {
      const reopened = new HwpDocument(bytes);
      try {
        assert.deepEqual(readDocumentCommentsB092(reopened), []);
        assert.equal(reopened.getTextRange(0, 0, 0, 100), '검토할 본문입니다.');
      } finally { reopened.free(); }
    }
    assert.equal(removed.command.undo().status, 'restored');
    assert.deepEqual(readDocumentCommentsB092(document), [created.comment]);
    assert.equal(removed.command.redo().status, 'restored');
    assert.deepEqual(readDocumentCommentsB092(document), []);
    removed.command.dispose();
  } finally { document.free(); }
});

test('updating a memo preserves its source ID, anchor, author command and the other memo in HWP and HWPX',
  {skip: typeof HwpDocument?.prototype.updateCommentTextV1 !== 'function' && 'requires the memo update engine'}, () => {
    const blank = HwpDocument.createEmpty();
    try {
      blank.createBlankDocument();
      blank.insertText(0,0,0,'그대로 유지되는 본문');
      const first = JSON.parse(blank.insertCommentAtCursorV1(0,0,3,'원래 내용','작성자'));
      assert.equal(first.ok,true);
      assert.equal(JSON.parse(blank.insertCommentAtCursorV1(0,0,8,'다른 메모','검수자')).ok,true);
      for (const format of ['hwp','hwpx']) {
        const exportBytes = (doc: any) => format === 'hwp' ? doc.exportHwp() : doc.exportHwpx();
        const doc = new HwpDocument(exportBytes(blank));
        try {
          const original=readDocumentCommentsB092(doc)!;
          const authorMetadata=JSON.parse(doc.getFieldList()).find((item:any)=>item.fieldId===first.fieldId).command;
          const scope=port(doc);
          assert.equal(JSON.parse(doc.updateCommentTextV1(first.fieldId,'stale','실패해야 함')).ok,false);
          const capture=captureUpdateCommentB092(doc,scope,first.fieldId,'고친 내용 📝');
          assert.equal(capture.status,'ready');
          if(capture.status!=='ready')throw new Error('capture failed');
          const update=applyCommentPlanB092(doc,scope,capture.plan);
          assert.equal(update.status,'applied');
          if(update.status!=='applied')throw new Error('update failed');
          const proof=format==='hwp'?doc.exportHwpWithReport():doc.exportHwpxWithReport();
          try{
            const bytes=proof.takeBytes(),loss=proof.contentLoss();
            assert.ok(verifyPreservedExport(doc,bytes,format,loss,data=>new HwpDocument(data)).checked.includes('document-memos'));
            assert.throws(()=>verifyPreservedExport(doc,bytes,format,loss,data=>{
              const replaced=new HwpDocument(data);
              replaced.getCommentListV1=()=>'[]';
              return replaced;
            }),/document-memos/);
          }finally{proof.free();}
          const saved=new HwpDocument(exportBytes(doc));
          try {
            assert.deepEqual(readDocumentCommentsB092(saved),[{...original[0],text:'고친 내용 📝'},original[1]]);
            assert.equal(JSON.parse(saved.getFieldList()).find((item:any)=>item.fieldId===first.fieldId).command,authorMetadata);
            assert.equal(saved.getTextRange(0,0,0,100),'그대로 유지되는 본문');
          } finally { saved.free(); }
          assert.equal(update.command.undo().status,'restored');
          assert.deepEqual(readDocumentCommentsB092(doc),original);
          update.command.dispose();
        } finally { doc.free(); }
      }
    } finally { blank.free(); }
  });

test('B092/B136 rejects protected, non-body, stale, malformed, and ranged-comment mutations without snapshots',
  {skip: !HwpDocument ? 'set JUEONY_ENGINE_PACKAGE to the freshly built Jueony engine' : false}, () => {
  const document = HwpDocument.createEmpty();
  try {
    document.createBlankDocument();
    document.insertText(0, 0, 0, '본문');
    assert.deepEqual(captureCreateCommentB092(document, port(document, {story: 'cell'}), {section: 0, paragraph: 0, offset: 0}, '메모', '작성자'),
      {status: 'blocked', reason: 'unsupported-story'});
    assert.deepEqual(captureCreateCommentB092(document, port(document, {protected: true}), {section: 0, paragraph: 0, offset: 0}, '메모', '작성자'),
      {status: 'blocked', reason: 'protected-document'});
    assert.deepEqual(captureCreateCommentB092(document, port(document), {section: 0, paragraph: 0, offset: 0}, '메모\n둘째 줄', '작성자'),
      {status: 'blocked', reason: 'invalid-input'});
    assert.deepEqual(captureCreateCommentB092(document, port(document), {section: 0, paragraph: 0, offset: 0}, '메모', '잘못/된작성자'),
      {status: 'blocked', reason: 'invalid-input'});

    const captured = captureCreateCommentB092(document, port(document), {section: 0, paragraph: 0, offset: 1}, '메모', '작성자');
    assert.equal(captured.status, 'ready');
    if (captured.status !== 'ready') return;
    document.insertText(0, 0, 0, '변경');
    assert.deepEqual(applyCommentPlanB092(document, port(document), captured.plan), {status: 'blocked', reason: 'stale-document'});

    const ranged = new Proxy(document, {get(target, key) {
      if (key === 'getCommentListV1') return () => JSON.stringify([{
        fieldId: 99, memoIndex: 2, text: '기존 범위 메모', author: '작성자',
        location: {sectionIndex: 0, paraIndex: 0}, startCharIdx: 0, endCharIdx: 1, pointComment: false,
      }]);
      const value = Reflect.get(target, key, target);
      return typeof value === 'function' ? value.bind(target) : value;
    }});
    assert.deepEqual(captureDeleteCommentB092(ranged, port(document), 99), {status: 'blocked', reason: 'unsupported-range-comment'});
  } finally { document.free(); }
});
