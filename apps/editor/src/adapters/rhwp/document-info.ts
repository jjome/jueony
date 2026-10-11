/** Read-only statistics over the current in-memory document (including unsaved edits). */
type NativeControl = { ctrlId?: string; userDesc?: string };
type NativeField = { cellField?: boolean };
type NativeInfo = { sectionCount?: number; pageCount?: number; encrypted?: boolean; fontsUsed?: string[] };
type NativeCursorModel = { root?: { paraCount?: number }; lists?: { paraCount?: number }[] };
export type DocumentStatisticsInput = {
  name: string; info: NativeInfo; text: string; controls: NativeControl[]; fields: NativeField[]; cursor: NativeCursorModel;
};
export type DocumentStatistics = {
  name: string; pages: number; sections: number; bodyParagraphs: number; nestedParagraphs: number;
  charactersWithSpaces: number; charactersWithoutSpaces: number; tables: number; pictures: number;
  shapes: number; equations: number; fields: number; namedCells: number; unclassifiedControls: number;
  encrypted: boolean; fonts: string[];
};
const count = (value: unknown): number => Number.isSafeInteger(value) && (value as number) >= 0 ? value as number : 0;

export function collectDocumentStatistics(source: DocumentStatisticsInput): DocumentStatistics {
  // Unicode scalar values, not UTF-16 code units. Paragraph separators and object/control
  // placeholders do not become visible letters. Tabs are one whitespace character.
  const characters = Array.from(source.text).filter(c => !/[\u0000-\u0008\u000a-\u001f\u007f\ufffc]/u.test(c));
  const controls = source.controls;
  return {
    name: source.name, pages: count(source.info.pageCount), sections: count(source.info.sectionCount),
    bodyParagraphs: count(source.cursor.root?.paraCount),
    nestedParagraphs: (source.cursor.lists ?? []).reduce((sum, list) => sum + count(list.paraCount), 0),
    charactersWithSpaces: characters.length, charactersWithoutSpaces: characters.filter(c => !/\s/u.test(c)).length,
    tables: controls.filter(c => c.ctrlId === 'tbl').length,
    pictures: controls.filter(c => c.ctrlId === 'gso' && c.userDesc === '그림').length,
    shapes: controls.filter(c => c.ctrlId === 'gso' && c.userDesc !== '그림').length,
    equations: controls.filter(c => c.ctrlId === 'eqed').length,
    fields: source.fields.filter(field => field.cellField !== true).length,
    namedCells: source.fields.filter(field => field.cellField === true).length,
    unclassifiedControls: controls.filter(c => !c.ctrlId).length,
    encrypted: source.info.encrypted === true,
    fonts: [...new Set((source.info.fontsUsed ?? []).filter(font => typeof font === 'string'))].sort(),
  };
}

const parse = <T>(value: T | string): T => typeof value === 'string' ? JSON.parse(value) as T : value;
export function readDocumentStatistics(wasm: any, name?: string): DocumentStatistics {
  const doc = wasm.borrowDocumentHandle?.() ?? wasm;
  const text = parse<unknown>(doc.getTextFileUnicode());
  if (typeof text !== 'string') throw new Error('문서 텍스트 조회 형식이 맞지 않습니다.');
  return collectDocumentStatistics({
    name: name ?? wasm.fileName ?? '새 문서', text,
    info: parse<NativeInfo>(doc.getDocumentInfo()),
    controls: parse<NativeControl[]>(doc.getControls()),
    fields: parse<NativeField[]>(doc.getFieldList()),
    cursor: parse<NativeCursorModel>(doc.getCursorModel()),
  });
}

export function showDocumentInformation(stats: DocumentStatistics, onClose: () => void): void {
  const existing = document.getElementById('jueony-document-info');
  if (existing) { existing.querySelector('button')?.focus(); return; }
  const overlay = document.createElement('div'); overlay.id = 'jueony-document-info'; overlay.className = 'modal-overlay';
  Object.assign(overlay.style, { position: 'fixed', inset: '0', zIndex: '11000', background: '#0005', display: 'grid', placeItems: 'center' });
  const panel = document.createElement('section'); panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'true'); panel.setAttribute('aria-labelledby', 'jueony-document-info-title');
  Object.assign(panel.style, { width: 'min(580px, calc(100vw - 32px))', maxHeight: 'calc(100vh - 32px)', overflow: 'auto', background: 'var(--ui-bg, #fff)', color: 'var(--ui-text, #172638)', padding: '24px', borderRadius: '8px', boxShadow: '0 12px 40px #0005' });
  const title = document.createElement('h2'); title.id = 'jueony-document-info-title'; title.textContent = '문서 정보'; title.style.marginTop = '0'; panel.append(title);
  const name = document.createElement('p'); name.textContent = stats.name; name.style.overflowWrap = 'anywhere'; panel.append(name);
  const table = document.createElement('table'); table.style.width = '100%'; table.style.borderCollapse = 'collapse';
  const rows: [string, string | number][] = [
    ['쪽', stats.pages], ['구역', stats.sections], ['본문 문단', stats.bodyParagraphs], ['내부 목록 문단', stats.nestedParagraphs],
    ['추출한 글자 · 공백 포함', stats.charactersWithSpaces], ['추출한 글자 · 공백 제외', stats.charactersWithoutSpaces],
    ['표', stats.tables], ['그림', stats.pictures], ['도형·묶음', stats.shapes], ['수식', stats.equations],
    ['필드', stats.fields], ['이름 있는 셀', stats.namedCells], ['분류되지 않은 컨트롤', stats.unclassifiedControls],
    ['원본 암호 속성', stats.encrypted ? '있음' : '없음'],
  ];
  for (const [label, value] of rows) {
    const row = document.createElement('tr'), heading = document.createElement('th'), cell = document.createElement('td');
    heading.scope = 'row'; heading.textContent = label; cell.textContent = typeof value === 'number' ? value.toLocaleString('ko-KR') : value;
    Object.assign(heading.style, { textAlign: 'left', fontWeight: 'normal', padding: '5px 0' }); cell.style.textAlign = 'right'; row.append(heading, cell); table.append(row);
  }
  panel.append(table);
  const fonts = document.createElement('p'); fonts.textContent = '문서 글꼴 목록: ' + (stats.fonts.join(', ') || '없음'); fonts.style.overflowWrap = 'anywhere'; panel.append(fonts);
  const note = document.createElement('p'); note.textContent = '현재 열린 문서의 저장 전 내용 기준입니다. 글자 수는 엔진이 추출한 Unicode 글자를 세며 줄바꿈·제어문자·개체 자리표는 제외합니다. 탭은 공백 1자로 셉니다. 그림 속 글자, 머리말·꼬리말·주석 등 추출되지 않은 내용과 묶음 내부 개체는 일부 집계에서 빠질 수 있습니다. 한글의 문서 통계와 동일한 집계는 아닙니다.';
  Object.assign(note.style, { fontSize: '12px', lineHeight: '1.6', color: 'var(--ui-text-muted, #586579)' }); panel.append(note);
  const close = document.createElement('button'); close.type = 'button'; close.className = 'dialog-btn'; close.textContent = '닫기';
  const finish = () => { overlay.remove(); onClose(); };
  close.addEventListener('click', finish); panel.append(close); overlay.append(panel); document.body.append(overlay); close.focus();
  overlay.addEventListener('keydown', event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); finish(); } else if (event.key === 'Tab') { event.preventDefault(); close.focus(); } });
  overlay.addEventListener('click', event => { if (event.target === overlay) finish(); });
}

export function installDocumentInformation({ registry, input }: { registry: any; input: () => any }): void {
  registry.register({
    id: 'file:document-info', label: '문서 정보', opensDialog: true,
    canExecute: (context: any) => context.hasDocument,
    execute: (services: any) => {
      const ih = input(); ih?.flushDeferredPaginationIfNeeded?.('document-statistics');
      const stats = readDocumentStatistics(services.wasm);
      showDocumentInformation(stats, () => ih?.focus());
    },
  });
}
