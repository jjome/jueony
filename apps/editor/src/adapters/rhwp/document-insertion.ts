import { DocumentInsertionDialog } from '../browser/document-insertion-dialog.ts';
import { verifyPreservedExport } from './preservation.ts';

/** Scratch handles are owned here; the live handle is only borrowed for a read. */
export function preflightDocumentInsertion(wasm: any, bytes: Uint8Array, sourceName: string, position: any) {
  if (wasm.requiresPasswordForSave) throw new Error('암호 문서에 끼워 넣기는 아직 지원하지 않습니다.');
  if (!/\.(hwp|hwpx)$/i.test(sourceName) || bytes.byteLength < 1 || bytes.byteLength > 32 * 1024 * 1024) {
    throw new Error('32 MB 이하의 HWP/HWPX 파일을 선택하세요.');
  }
  const { HwpDocument } = wasm.getWasmModuleExports();
  const open = (data: Uint8Array) => new HwpDocument(data);
  const checkedExport = (doc: any, format: 'hwp' | 'hwpx') => {
    const artifact = format === 'hwpx' ? doc.exportHwpxWithReport() : doc.exportHwpWithReport();
    try {
      const loss = artifact.contentLoss(), data = artifact.takeBytes();
      verifyPreservedExport(doc, data, format, loss, open);
      return data;
    } finally { artifact.free(); }
  };
  let source: any, scratch: any;
  try {
    source = open(bytes);
    checkedExport(source, sourceName.toLowerCase().endsWith('.hwpx') ? 'hwpx' : 'hwp');
    const format = wasm.fileName.toLowerCase().endsWith('.hwpx') ? 'hwpx' : 'hwp';
    scratch = open(checkedExport(wasm.borrowDocumentHandle(), format));
    const result = JSON.parse(scratch.insertDocumentBytes(position.sectionIndex, position.paragraphIndex, position.charOffset, bytes));
    if (!result.ok) throw new Error('문서 삽입 사전 검사에 실패했습니다.');
    checkedExport(scratch, format);
    return source.getParagraphCount(0);
  } finally { scratch?.free(); source?.free(); }
}

/** File insertion shares the manual editor's snapshot undo and mutation tracking. */
export function installDocumentInsertion(registry: any, input: () => any, eventBus: any) {
  const can = (c: any) => {
    const ih = input(), cursor = ih?.cursor;
    return !!cursor && c.hasDocument && c.isEditable && !c.isFormMode && !c.inTable
      && !c.inCellSelectionMode && !c.inTableObjectSelection && !c.inPictureObjectSelection
      && !cursor.hasSelection() && !cursor.isInHeaderFooter() && !cursor.isInFootnote()
      && !cursor.isInTextBox() && !ih.isComposing && !ih.wasm.requiresPasswordForSave
      && typeof ih.wasm.borrowDocumentHandle()?.insertDocumentBytes === 'function';
  };
  registry.register({ id: 'ext:jueony-insert-document', label: '문서 끼워 넣기', opensDialog: true, canExecute: can,
    execute: () => {
      const api = (window as any).jueonyEditor, ih = input(), revision = api.revision(), position = ih.getCursorPosition();
      const assertCurrent = () => {
        if (api.revision() !== revision || api.busy() || !can((window as any).rhwpStudio.automation.getContext())
          || JSON.stringify(input().getCursorPosition()) !== JSON.stringify(position)) {
          throw new Error('문서나 커서가 바뀌었습니다. 취소한 뒤 다시 문서 끼워 넣기를 실행하세요.');
        }
      };
      const dialog = new DocumentInsertionDialog((bytes, name) => {
        assertCurrent(); return preflightDocumentInsertion(input().wasm, bytes, name, position);
      }, bytes => {
        assertCurrent();
        input().executeOperation({ kind: 'snapshot', operationType: 'insertDocument', operation: (wasm: any) => {
          const result = wasm.insertDocumentBytes(position.sectionIndex, position.paragraphIndex, position.charOffset, bytes);
          if (!result.ok) throw new Error('문서 삽입에 실패했습니다.');
          return { sectionIndex: position.sectionIndex, paragraphIndex: result.paraIdx, charOffset: result.charOffset };
        } });
        eventBus.emit('document-changed');
      });
      dialog.show();
    },
  });
  const item = document.createElement('div'); item.className = 'md-item'; item.dataset.cmd = 'ext:jueony-insert-document';
  const label = document.createElement('span'); label.className = 'md-label'; label.textContent = '문서 끼워 넣기';
  const key = document.createElement('span'); key.className = 'md-shortcut'; key.textContent = 'Ctrl+O';
  item.append(label, key);
  const anchor = document.querySelector('.md-item[data-cmd="file:open"]');
  anchor?.after(item);
}
