import { assertSaveRevision } from '../../modules/document-files/public/index.ts';

// Downloads have no browser API that confirms a completed disk write. Keep the
// frame and recovery draft alive until the user has checked the saved file.
export async function confirmDownload(blob: Blob, fileName: string): Promise<boolean> {
  const revision = () => (window as any).jueonyEditor.revision() as string;
  const expected = (blob as any).jueonyRevision;
  assertSaveRevision(expected, revision());
  if (document.getElementById('jueony-download-confirm')) return false;
  const dialog = document.createElement('dialog');
  dialog.id = 'jueony-download-confirm';
  const form = document.createElement('form'); form.method = 'dialog';
  const heading = document.createElement('h2'); heading.textContent = '다운로드한 파일을 확인해 주세요';
  const name = document.createElement('p'); name.textContent = fileName;
  const help = document.createElement('p');
  help.textContent = '브라우저의 다운로드가 끝나고 파일이 저장된 것을 확인한 뒤 “저장 확인”을 눌러 주세요. 확인 전에는 문서와 복구 내용을 유지합니다.';
  const buttons = document.createElement('div'); buttons.className = 'j-download-buttons';
  const saved = document.createElement('button'); saved.value = 'saved'; saved.textContent = '저장 확인';
  const cancel = document.createElement('button'); cancel.value = 'cancel'; cancel.textContent = '문서로 돌아가기';
  buttons.append(cancel, saved); form.append(heading, name, help, buttons); dialog.append(form);
  document.body.append(dialog);
  // 탭 iframe을 닫아도 다운로드의 소유 문서는 유지되도록 최상위 호스트에서 시작한다.
  const owner = window.parent !== window && window.parent.location.origin === location.origin ? window.parent : window;
  const ownerDocument = owner.document;
  const urlApi = (owner as any).URL as typeof URL;
  const url = urlApi.createObjectURL(blob);
  try {
    const choice = new Promise<string>(resolve => dialog.addEventListener('close', () => resolve(dialog.returnValue), { once: true }));
    dialog.showModal();
    const anchor = ownerDocument.createElement('a'); anchor.href = url; anchor.download = fileName;
    ownerDocument.body.append(anchor); anchor.click(); anchor.remove();
    if (await choice !== 'saved') return false;
    assertSaveRevision(expected, revision());
    return true;
  } finally { dialog.remove(); urlApi.revokeObjectURL(url); }
}
