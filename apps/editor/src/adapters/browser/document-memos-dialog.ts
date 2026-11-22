import type { DocumentCommentB092 } from '../rhwp/document-comments-b092.ts';

type MemoChange = { action: 'update'; text: string } | { action: 'delete' };
type MemoDialogOptions = {
  identity: () => string;
  revision: () => string;
  read: () => readonly DocumentCommentB092[];
  canEdit: () => boolean;
  canUpdate: () => boolean;
  moveTo: (item: DocumentCommentB092) => void;
  apply: (dialog: HTMLDialogElement, item: DocumentCommentB092, change: MemoChange) => void;
};

export function showDocumentMemos(options: MemoDialogOptions): void {
  const owner = options.identity();
  let revision = options.revision();
  const dialog = document.createElement('dialog');
  dialog.id = 'jueony-document-memos';
  dialog.className = 'jueony-page-dialog';
  dialog.style.cssText = 'width:min(36rem,90vw);max-height:80vh;overflow:auto;padding:1.25rem';
  dialog.setAttribute('aria-labelledby', 'jueony-document-memos-title');
  const title = document.createElement('h2');
  title.id = 'jueony-document-memos-title';
  title.textContent = '문서 메모';
  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  const results = document.createElement('ul');

  function button(text: string, action: () => void) {
    const element = document.createElement('button');
    element.type = 'button';
    element.textContent = text;
    element.onclick = () => {
      try { action(); }
      catch (error) { status.textContent = error instanceof Error ? error.message : String(error); }
    };
    return element;
  }

  function assertCurrent() {
    if (options.identity() !== owner || options.revision() !== revision) throw new Error('문서가 바뀌었습니다. 메모 목록을 새로 읽으세요.');
  }

  function mutate(memo: DocumentCommentB092, change: MemoChange) {
    assertCurrent();
    options.apply(dialog, memo, change);
    refresh(change.action === 'delete' ? '메모를 삭제했습니다.' : '메모 내용을 변경했습니다.');
  }

  function openEdit(item: HTMLLIElement, memo: DocumentCommentB092) {
    assertCurrent();
    const previous = results.querySelector('form');
    previous?.remove();
    const form = document.createElement('form');
    const label = document.createElement('label');
    const field = document.createElement('input');
    field.required = true;
    field.maxLength = 4000;
    field.value = memo.text;
    field.style.width = '100%';
    label.append('메모 내용', field);
    const apply = document.createElement('button');
    apply.type = 'submit';
    apply.textContent = '적용';
    apply.disabled = true;
    field.oninput = () => { apply.disabled = field.value === memo.text || !field.value.trim(); };
    form.onsubmit = event => {
      event.preventDefault();
      if (apply.disabled) return;
      try { mutate(memo, {action: 'update', text: field.value}); }
      catch (error) { status.textContent = error instanceof Error ? error.message : String(error); }
    };
    form.append(label, apply, button('편집 취소', () => form.remove()));
    item.append(form);
    field.focus();
  }

  function refresh(message = '') {
    if (options.identity() !== owner) throw new Error('다른 문서가 열렸습니다. 메모 창을 다시 여세요.');
    revision = options.revision();
    const comments = [...options.read()].sort((a,b) => a.section - b.section || a.paragraph - b.paragraph || a.start - b.start);
    assertCurrent();
    results.replaceChildren();
    status.textContent = [message, comments.length ? `메모 ${comments.length}개` : '메모가 없습니다.',
      comments.length > 200 ? '처음 200개를 표시합니다.' : ''].filter(Boolean).join(' ');
    for (const memo of comments.slice(0, 200)) {
      const item = document.createElement('li');
      const contents = document.createElement('p');
      contents.style.cssText = 'white-space:pre-wrap;overflow-wrap:anywhere';
      contents.textContent = `${memo.author || '작성자 없음'} · ${memo.text}`;
      item.append(contents);
      if (!memo.nested) item.append(button(`${memo.section + 1}구역 ${memo.paragraph + 1}문단으로 이동`, () => {
        assertCurrent(); options.moveTo(memo); dialog.close();
      }));
      if (options.canEdit() && memo.pointComment && !memo.nested) {
        if (options.canUpdate() && !/[\r\n\t]/u.test(memo.text)) item.append(button('내용 편집', () => openEdit(item, memo)));
        item.append(button('삭제', () => {
          assertCurrent();
          if (window.confirm('이 메모를 삭제할까요? Ctrl+Z로 되돌릴 수 있습니다.')) mutate(memo, {action: 'delete'});
        }));
      }
      results.append(item);
    }
  }

  dialog.addEventListener('close', () => dialog.remove(), {once: true});
  dialog.append(title, status, results, button('새로 읽기', () => refresh()), button('닫기', () => dialog.close()));
  document.body.append(dialog);
  dialog.showModal();
  try { refresh(); }
  catch (error) { status.textContent = error instanceof Error ? error.message : String(error); }
}
