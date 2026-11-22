import { readOfficeCopy, type OfficeBlock, type OfficeCopy } from '../files/office-copy.ts';

export function showOfficeCopyDialog(openCopy: (name: string, blocks: OfficeBlock[]) => Promise<void>): void {
  const dialog = document.createElement('dialog');
  dialog.id = 'office-copy-dialog';
  dialog.setAttribute('aria-labelledby','office-copy-title');
  const title = document.createElement('h2');
  title.id = 'office-copy-title';
  title.textContent = 'Word·PDF를 한글 사본으로 열기';
  const picker = document.createElement('input');
  picker.type = 'file';
  picker.accept = '.docx,.pdf';
  const label = document.createElement('label');
  label.append('변환할 파일 ',picker);
  const recognize = document.createElement('input');
  recognize.type = 'checkbox';
  const ocr = document.createElement('label');
  ocr.hidden = true;
  ocr.append(recognize, ' 스캔 PDF 글자 인식 (한국어·영어)');
  const status = document.createElement('p');
  status.setAttribute('role','status');
  const losses = document.createElement('ul');
  const open = document.createElement('button');
  open.type = 'button';
  open.textContent = 'HWPX 사본 열기';
  open.disabled = true;
  const close = document.createElement('button');
  close.type = 'button';
  close.textContent = '닫기';
  close.onclick = () => dialog.close();

  let read: AbortController | undefined;
  let prepared: {name: string; copy: OfficeCopy} | undefined;
  let applying = false;
  async function prepare() {
    read?.abort();
    open.disabled = true;
    prepared = undefined;
    losses.replaceChildren();
    const file = picker.files?.[0];
    ocr.hidden = !file || !/\.pdf$/iu.test(file.name);
    if (!file) { status.textContent = ''; return; }
    const controller = new AbortController();
    read = controller;
    status.textContent = '원본에서 변환할 내용을 읽는 중입니다.';
    try {
      const copy = await readOfficeCopy(file, controller.signal, !ocr.hidden && recognize.checked);
      if (controller.signal.aborted || !dialog.open) return;
      prepared = { name: `${file.name.replace(/\.(docx|pdf)$/iu,'')} 변환 사본.hwpx`, copy };
      for (const loss of copy.losses) {
        const item = document.createElement('li');
        item.textContent = loss;
        losses.append(item);
      }
      status.textContent = '아래 항목을 확인한 뒤 새 탭으로 여세요.';
      open.disabled = false;
    } catch (error) {
      if (!controller.signal.aborted) status.textContent = error instanceof Error ? error.message : String(error);
    }
  }
  picker.onchange = prepare;
  recognize.onchange = prepare;

  open.onclick = async () => {
    if (!prepared || applying) return;
    applying = true;
    picker.disabled = recognize.disabled = open.disabled = close.disabled = true;
    try {
      await openCopy(prepared.name,prepared.copy.blocks);
      dialog.close();
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : String(error);
    } finally {
      applying = false;
      picker.disabled = recognize.disabled = open.disabled = close.disabled = false;
    }
  };
  dialog.addEventListener('cancel',event=>{ if (applying) event.preventDefault(); });
  dialog.addEventListener('close',() => { read?.abort(); dialog.remove(); },{once:true});
  dialog.append(title,label,ocr,status,losses,open,close);
  document.body.append(dialog);
  dialog.showModal();
}
