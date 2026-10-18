import {DOCUMENT_METADATA_KEYS, readDocumentMetadata, preflightDocumentMetadata, applyDocumentMetadata} from './document-metadata.ts';
import type {DocumentMetadata, DocumentMetadataValues} from './document-metadata.ts';
import {captureSessionCursor, restoreSessionCursor} from './session-cursor.ts';
import {readStoredDocumentInformation} from './document-stored-information.ts';
import {readStoryInformation,STORY_KINDS} from './document-story-information.ts';
/** Statistics and bounded summary metadata over the current in-memory document. */
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

export function showDocumentInformation(stats: DocumentStatistics, onClose: () => void, metadata?: {state: DocumentMetadata; editable: boolean; apply(values: DocumentMetadataValues): void}, stored?:ReturnType<typeof readStoredDocumentInformation>, stories?:ReturnType<typeof readStoryInformation>): void {
  const existing = document.getElementById('jueony-document-info');
  if (existing) { existing.querySelector('button')?.focus(); return; }
  const overlay = document.createElement('div'); overlay.id = 'jueony-document-info'; overlay.className = 'modal-overlay';
  Object.assign(overlay.style, { position: 'fixed', inset: '0', zIndex: '11000', background: '#0005', display: 'grid', placeItems: 'center' });
  const panel = document.createElement('section'); panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'true'); panel.setAttribute('aria-labelledby', 'jueony-document-info-title');
  Object.assign(panel.style, { width: 'min(580px, calc(100vw - 32px))', maxHeight: 'calc(100vh - 32px)', overflow: 'auto', background: 'var(--ui-bg, #fff)', color: 'var(--ui-text, #172638)', padding: '24px', borderRadius: '8px', boxShadow: '0 12px 40px #0005' });
  const title = document.createElement('h2'); title.id = 'jueony-document-info-title'; title.textContent = '문서 정보'; title.style.marginTop = '0'; panel.append(title);
  const name = document.createElement('p'); name.textContent = stats.name; name.style.overflowWrap = 'anywhere'; panel.append(name);
  const summary = document.createElement('fieldset'); summary.style.cssText = 'margin:12px 0;padding:12px;border:1px solid #cbd5e1';
  const legend = document.createElement('legend'); legend.textContent = '문서 요약'; summary.append(legend);
  const labels = {title: '제목', subject: '주제', author: '작성자', keywords: '키워드', description: '설명'};
  const inputs = new Map<string, HTMLInputElement | HTMLTextAreaElement>();
  const edited = new Set<string>();
  for (const key of DOCUMENT_METADATA_KEYS) {
    const label = document.createElement('label'); label.textContent = labels[key]; label.style.cssText = 'display:grid;gap:4px;margin:8px 0';
    const field = key === 'description' || /[\r\n]/u.test(metadata?.state.values?.[key] ?? '') ? document.createElement('textarea') : document.createElement('input');
    field.id = `jueony-document-metadata-${key}`; field.name = key; field.maxLength = 4096; field.value = metadata?.state.values?.[key] ?? '';
    field.readOnly = metadata?.editable !== true; field.style.cssText = 'box-sizing:border-box;width:100%;font:inherit;padding:6px';
    if (field instanceof HTMLTextAreaElement) field.rows = 3;
    field.addEventListener('input', () => edited.add(key));
    label.append(field); summary.append(label); inputs.set(key, field);
  }
  const scope = document.createElement('p'); scope.style.cssText = 'font-size:12px;line-height:1.6;color:var(--ui-text-muted,#586579)';
  scope.textContent = metadata?.state.values ? '다섯 요약 항목만 편집합니다. 항목별 4,096자 이내이며 한 번에 되돌릴 수 있습니다. 작성·수정 시각과 저장 이력은 편집하지 않습니다. 저장 재열기의 본문·서식·지면 검사를 통과한 문서에서 지원합니다.' : '이 문서의 요약 속성을 읽지 못했습니다. 비어 있는 입력란은 원본 값이 없다는 뜻이 아닙니다.';
  if (!metadata?.editable) scope.textContent += ' ' + (metadata?.state.reason ?? '읽기 전용 상태에서는 요약을 편집할 수 없습니다.');
  summary.append(scope); panel.append(summary);
  if(stored){
    const persisted=document.createElement('fieldset'),legend=document.createElement('legend');legend.textContent='파일에 저장된 날짜·시간';persisted.append(legend);
    if(stored.value){
      for(const[key,label]of [['created','작성 시각'],['modified','수정 시각'],['lastPrinted','마지막 인쇄 시각'],['editingDuration','누적 편집 시간']]as const){
        const item=stored.value[key],row=document.createElement('p');row.dataset.storedInformation=key;
        row.textContent=label+': '+(item.state==='absent'?'원본 값 없음':item.state==='invalid'?'원본 값 해석 불가 (임의 보정하지 않음)':key==='editingDuration'?`${(item as {ticks100ns:string}).ticks100ns} × 100ns`:(item as {utc:string}).utc+' (UTC)');persisted.append(row);
      }
      for(const issue of stored.value.issues){const note=document.createElement('p');note.textContent=issue;persisted.append(note);}
    }else{const note=document.createElement('p');note.textContent=stored.reason??'저장된 날짜 정보 조회 불가';persisted.append(note);}
    const note=document.createElement('p');note.textContent='원본에 기록된 값입니다. 현재 시각으로 추정하거나 저장·편집 시 자동 갱신하지 않습니다.';persisted.append(note);panel.append(persisted);
  }
  if(stories){
    const field=document.createElement('fieldset'),legend=document.createElement('legend');legend.textContent='전체 저장 모델의 문단 텍스트';field.append(legend);
    if(stories.value){
      const value=stories.value,total=document.createElement('p');total.dataset.documentStoryTotal='';
      total.textContent=`문단 ${value.counts.paragraphs.toLocaleString('ko-KR')}개 · 글자 ${value.counts.textScalars.toLocaleString('ko-KR')}자 · 공백 제외 ${value.counts.nonWhitespaceTextScalars.toLocaleString('ko-KR')}자`;field.append(total);
      const labels={body:'본문',tableCell:'표 셀',textBox:'글상자',header:'머리말',footer:'꼬리말',footnote:'각주',endnote:'미주',hiddenComment:'숨은 설명',fieldMemo:'필드 메모',caption:'캡션',masterPage:'바탕쪽'};
      for(const kind of STORY_KINDS){const story=value.stories.find(s=>s.kind===kind);if(!story)continue;const row=document.createElement('p');row.dataset.documentStory=kind;row.textContent=`${labels[kind]}: 문단 ${story.counts.paragraphs.toLocaleString('ko-KR')}개 · 글자 ${story.counts.textScalars.toLocaleString('ko-KR')}자`;field.append(row);}
      const objectLabels={tables:'표',pictures:'그림',shapes:'도형',groups:'묶음',charts:'차트',ole:'OLE',equations:'수식',fields:'필드',unknownControls:'미분류 개체'};
      const objects=document.createElement('p');objects.dataset.documentStoryObjects='';objects.textContent='저장 모델의 개체: '+Object.entries(objectLabels).map(([key,label])=>`${label} ${value.objects[key as keyof typeof value.objects].toLocaleString('ko-KR')}`).join(' · ');field.append(objects);
    }else{const note=document.createElement('p');note.textContent=stories.reason??'전체 저장 모델 집계 불가';field.append(note);}
    const note=document.createElement('p');note.textContent='현재 저장 모델에 있는 문단을 셉니다. 반복되는 머리말·꼬리말·바탕쪽은 정의를 한 번만 셉니다. 수식 코드·그림 OCR·겹침 글자 등의 별도 문자열과 해석하지 못한 개체 내용은 포함하지 않습니다. 한글의 문서 통계와는 집계 방식이 다릅니다.';field.append(note);panel.append(field);
  }
  const table = document.createElement('table'); table.style.width = '100%'; table.style.borderCollapse = 'collapse';
  const basic=document.createElement('h3');basic.textContent='본문·기본 추출 정보';panel.append(basic);
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
  const error = document.createElement('p'); error.setAttribute('role', 'alert'); error.style.color = '#b42318'; panel.append(error);
  const apply = document.createElement('button'); apply.type = 'button'; apply.className = 'dialog-btn'; apply.textContent = '요약 적용'; apply.disabled = metadata?.editable !== true;
  apply.addEventListener('click', () => {
    try {
      metadata?.apply(Object.fromEntries(DOCUMENT_METADATA_KEYS.map(k => [k, edited.has(k) ? inputs.get(k)!.value : metadata?.state.values?.[k] ?? ''])) as DocumentMetadataValues);
      finish();
    } catch (e) { error.textContent = e instanceof Error ? e.message : String(e); }
  });
  const close = document.createElement('button'); close.type = 'button'; close.className = 'dialog-btn'; close.textContent = '닫기';
  const finish = () => { overlay.remove(); onClose(); };
  close.addEventListener('click', finish); panel.append(apply, close); overlay.append(panel); document.body.append(overlay); (metadata?.editable ? inputs.get('title')! : close).focus();
  overlay.addEventListener('keydown', event => {
    // Keep editor shortcuts out of text inputs and this modal's local undo stack.
    event.stopPropagation();
    if (event.key === 'Escape') { event.preventDefault(); finish(); }
    else if (event.key === 'Tab') {
      const focusable = Array.from(panel.querySelectorAll<HTMLElement>('input,textarea,button:not(:disabled)'));
      const index = focusable.indexOf(document.activeElement as HTMLElement);
      if (event.shiftKey && index <= 0) { event.preventDefault(); focusable.at(-1)?.focus(); }
      else if (!event.shiftKey && index === focusable.length - 1) { event.preventDefault(); focusable[0]?.focus(); }
    }
  });
  overlay.addEventListener('click', event => { if (event.target === overlay) finish(); });
}

export function installDocumentInformation({ registry, input }: { registry: any; input: () => any }): void {
  registry.register({
    id: 'file:document-info', label: '문서 정보', opensDialog: true,
    canExecute: (context: any) => context.hasDocument,
    execute: (services: any) => {
      if (document.querySelector('dialog[open],.modal-overlay')) return;
      const ih = input(); ih?.flushDeferredPaginationIfNeeded?.('document-statistics');
      const wasm = services.wasm, doc = wasm.borrowDocumentHandle?.() ?? wasm;
      const stats = readDocumentStatistics(wasm), state = readDocumentMetadata(wasm);
      const api = (window as any).jueonyEditor, revision = api?.revision?.();
      const canEdit = () => services.getContext?.().isEditable === true && !services.getContext?.().isFormMode && !ih?.isComposing && !wasm.requiresPasswordForSave;
      const editable = state.editable && canEdit() && (typeof revision === 'string' || typeof revision === 'number') && typeof ih?.executeOperation === 'function';
      showDocumentInformation(stats, () => ih?.focus(), {state, editable, apply(values) {
        const current = () => {
          if (!editable || !canEdit() || input() !== ih || (wasm.borrowDocumentHandle?.() ?? wasm) !== doc || api.revision() !== revision || api.busy(document.getElementById('jueony-document-info'))) throw new Error('문서나 편집 상태가 바뀌었습니다. 문서 정보 창을 다시 여세요.');
        };
        current(); preflightDocumentMetadata(wasm, state, values); current();
        const saved = captureSessionCursor(ih), position = ih.getCursorPosition();
        const selection = ih.cursor.getSelection?.(), block = ih.cursor.captureCellSelection?.();
        const selectionBefore = block ? {mode: 'cellBlock', state: block} : selection ? {start: selection.anchor, end: selection.focus, blockPhase: ih.cursor.blockSelectionPhase()} : null;
        ih.executeOperation({kind: 'snapshot', operationType: 'editDocumentMetadata', selectionBefore, operation: (value: any) => {
          current(); return applyDocumentMetadata(value, state, values) ? position : null;
        }});
        if (saved) restoreSessionCursor(ih, saved);
        const actual = readDocumentMetadata(wasm).values;
        if (!actual || !DOCUMENT_METADATA_KEYS.every(k => actual[k] === values[k])) throw new Error('문서 속성 적용 결과를 확인하지 못했습니다.');
      }},readStoredDocumentInformation(wasm),readStoryInformation(wasm));
    },
  });
}
