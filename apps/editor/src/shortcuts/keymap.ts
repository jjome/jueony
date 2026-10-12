/** Hangul 2024 default layout. Native/browser delivery is separate from resolution.
 * Sources: help.hancom.com/hoffice130/ko-KR/Hwp/{menu,view/toolbar}.
 * Do not assign a browser workaround to a different Hangul command's key.
 */
import { defaultStyleNames } from './style-slots.ts';
export type Scope = 'document' | 'table' | 'cells' | 'object';
export type Binding = { keys: string; command: string; label: string; scope: Scope; params?: Record<string, unknown>; nativeClipboard?: boolean; repeatable?: boolean };
const binding = (keys: string, command: string, label: string, scope: Scope = 'document', params?: Record<string, unknown>): Binding => ({ keys, command, label, scope, ...(params ? { params } : {}) });
export const hangulBindings: Binding[] = [
  ...[['Ctrl+C', 'edit:copy', '복사하기'], ['Ctrl+X', 'edit:cut', '오려 두기'], ['Ctrl+V', 'edit:paste', '붙이기'], ['Shift+Delete', 'edit:cut', '오려 두기'], ['Shift+Insert', 'edit:paste', '붙이기']].map(([keys, command, label]) => ({ ...binding(keys, command, label), nativeClipboard: true })),
  binding('Alt+N', 'file:new-doc', '새 문서'),
  binding('Ctrl+Alt+T', 'file:new-doc', '새 탭'),
  binding('Alt+O', 'file:open', '불러오기'),
  binding('Alt+S', 'file:save', '저장하기'), binding('Ctrl+S', 'file:save', '저장하기'),
  binding('Alt+V', 'file:save-as', '다른 이름으로 저장하기'),
  binding('Alt+P', 'file:print', '인쇄'), binding('Ctrl+P', 'file:print', '인쇄'),
  binding('Ctrl+F4', 'ext:jueony-close', '문서 닫기'),
  binding('Ctrl+O', 'pending:insert-document', '문서 끼워 넣기'),
  binding('Ctrl+K,D', 'ext:jueony-calendar-stamp', '날짜/시간 문자열'),
  ...(['PageUp', 'PageDown', 'Home', 'End'] as const).map((key, i) => binding('Ctrl+' + key, 'ext:jueony-navigate', ['문서 처음', '문서 끝', '화면 첫 줄', '화면 끝줄'][i], 'document', { edge: ['document-start', 'document-end', 'screen-start', 'screen-end'][i] })),
  binding('Alt+Home', 'ext:jueony-navigate', '문단 처음', 'document', { edge: 'paragraph-start' }),
  binding('Alt+End', 'ext:jueony-navigate', '문단 끝', 'document', { edge: 'paragraph-end' }),
  binding('Ctrl+Z', 'edit:undo', '되돌리기'), binding('Ctrl+Shift+Z', 'edit:redo', '다시 실행'),
  binding('Ctrl+Y', 'ext:jueony-delete-line', '한 줄 지우기'), binding('Alt+Y', 'ext:jueony-delete-line-end', '줄 뒤 지우기'),
  binding('Ctrl+T', 'ext:jueony-delete-word', '한 단어 지우기'),
  binding('Ctrl+A', 'edit:select-all', '모두 선택'), binding('Ctrl+E', 'edit:delete', '지우기'),
  binding('Alt+C', 'edit:format-copy', '모양 복사'),
  binding('Ctrl+Q,F', 'edit:find', '찾기'), binding('Ctrl+F', 'ext:jueony-navigation-pane', '탐색 작업 창'),
  binding('Ctrl+F2', 'edit:find-replace', '찾아 바꾸기'), binding('Ctrl+Q,A', 'edit:find-replace', '찾아 바꾸기'),
  binding('Ctrl+H', 'edit:find-replace', '찾아 바꾸기'), binding('Ctrl+L', 'edit:find-again', '다시 찾기'),
  binding('Alt+G', 'edit:goto', '찾아가기'),
  binding('Alt+L', 'format:char-shape', '글자 모양'), binding('Alt+T', 'format:para-shape', '문단 모양'),
  binding('F6', 'format:style-dialog', '스타일'), binding('F7', 'file:page-setup', '편집 용지'),
  ...[
    ['Ctrl+Alt+F5', 'Ctrl+Shift+E', 'left-less', '왼쪽 여백 줄이기'],
    ['Ctrl+Alt+F6', 'Ctrl+Shift+G', 'left-more', '왼쪽 여백 늘이기'],
    ['Ctrl+Alt+F7', 'Ctrl+Shift+D', 'right-more', '오른쪽 여백 늘이기'],
    ['Ctrl+Alt+F8', 'Ctrl+Shift+F', 'right-less', '오른쪽 여백 줄이기'],
    ['Ctrl+F5', 'Ctrl+Shift+O', 'indent-less', '첫 줄 내어쓰기'],
    ['Ctrl+F6', 'Ctrl+Shift+I', 'indent-more', '첫 줄 들여쓰기'],
    ['Ctrl+F7', '', 'both-less', '양쪽 여백 줄이기'],
    ['Ctrl+F8', '', 'both-more', '양쪽 여백 늘이기'],
  ].flatMap(([primary, alternate, operation, label]) => [primary, alternate].filter(Boolean).map(keys => ({...binding(keys, 'ext:jueony-paragraph-spacing', label, 'document', { operation }), repeatable: true}))),
  ...defaultStyleNames.map((name, slot) => binding(`Ctrl+${(slot + 1) % 10}`, 'ext:jueony-default-style', `${name} 기본 스타일`, 'document', { slot })),
  binding('Ctrl+B', 'format:bold', '진하게'), binding('Alt+Shift+B', 'format:bold', '진하게'),
  binding('Ctrl+I', 'format:italic', '기울임'), binding('Alt+Shift+I', 'format:italic', '기울임'),
  binding('Ctrl+U', 'format:underline', '밑줄'), binding('Alt+Shift+U', 'format:underline', '밑줄'),
  binding('Alt+Shift+P', 'format:superscript', '위 첨자'), binding('Alt+Shift+S', 'format:subscript', '아래 첨자'),
  binding('Alt+Shift+C', 'ext:jueony-normal', '보통 모양'),
  binding('Alt+Shift+E', 'format:font-size-increase', '글씨 크게'), binding('Ctrl+]', 'format:font-size-increase', '글씨 크게'),
  binding('Alt+Shift+R', 'format:font-size-decrease', '글씨 작게'), binding('Ctrl+[', 'format:font-size-decrease', '글씨 작게'),
  binding('Alt+Shift+W', 'format:char-spacing-increase', '자간 넓게'), binding('Alt+Shift+N', 'format:char-spacing-decrease', '자간 좁게'),
  binding('Alt+Shift+J', 'format:char-ratio-decrease', '장으로'), binding('Alt+Shift+K', 'format:char-ratio-increase', '평으로'),
  binding('Alt+Shift+Z', 'format:line-spacing-increase', '줄 간격 넓게'), binding('Ctrl+Shift+W', 'format:line-spacing-increase', '줄 간격 넓게'),
  binding('Alt+Shift+A', 'format:line-spacing-decrease', '줄 간격 좁게'), binding('Ctrl+Shift+Q', 'format:line-spacing-decrease', '줄 간격 좁게'),
  ...(['M', 'L', 'R', 'C', 'T'] as const).map((key, i) => binding('Ctrl+Shift+' + key, 'format:align-' + ['justify', 'left', 'right', 'center', 'distribute'][i], ['양쪽 정렬', '왼쪽 정렬', '오른쪽 정렬', '가운데 정렬', '배분 정렬'][i])),
  binding('Ctrl+K,N', 'format:para-num-shape', '문단 번호 모양'),
  binding('Ctrl+Shift+Insert', 'format:toggle-numbering', '문단 번호 적용/해제'),
  binding('Ctrl+Shift+Delete', 'format:toggle-bullet', '글머리표 적용/해제'),
  ...(['K', 'R', 'B', 'D', 'G', 'Y', 'C', 'W'] as const).map((key, i) => binding('Ctrl+M,' + key, 'ext:jueony-color', ['검정', '빨강', '파랑', '자주', '초록', '노랑', '청록', '흰색'][i] + ' 글자색', 'document', { textColor: ['#000000', '#ff0000', '#0000ff', '#ff00ff', '#00ff00', '#ffff00', '#00ffff', '#ffffff'][i] })),
  binding('Ctrl+F10', 'insert:symbols', '문자표'),
  binding('Ctrl+N,T', 'table:create', '표 만들기', 'document', { inputDialog: true }), binding('Ctrl+N,I', 'insert:image', '그림'),
  binding('Ctrl+N,B', 'insert:textbox', '글상자'), binding('Ctrl+N,M', 'insert:equation', '수식'),
  binding('Ctrl+N,N', 'insert:footnote', '각주'), binding('Ctrl+N,E', 'insert:endnote', '미주'),
  binding('Ctrl+N,C', 'insert:caption-toggle', '캡션 넣기'),
  binding('Ctrl+K,B', 'insert:bookmark', '책갈피'), binding('Ctrl+K,H', 'insert:hyperlink', '하이퍼링크'),
  binding('Ctrl+K,E', 'insert:field', '필드 입력'),
  binding('Ctrl+N,G', 'page:section-settings', '구역 설정'), binding('Ctrl+N,S', 'page:hide', '감추기'),
  binding('Ctrl+N,H', 'page:header-footer-dialog', '머리말/꼬리말'), binding('Ctrl+N,P', 'pending:page-number-dialog', '쪽 번호 매기기'),
  binding('Ctrl+Enter', 'table:insert-row-below', '줄 추가하기', 'table'),
  binding('Ctrl+Backspace', 'table:delete-row', '줄 지우기', 'table'),
  binding('Ctrl+Enter', 'page:break', '쪽 나누기'), binding('Ctrl+J', 'page:break', '쪽 나누기'),
  binding('Ctrl+Shift+Enter', 'page:column-break', '단 나누기'), binding('Ctrl+Alt+Enter', 'page:col-settings', '단 설정'),
  binding('Alt+Shift+Enter', 'page:section-break', '구역 나누기'),
  binding('Ctrl+F1', 'view:toolbox-basic', '기본 도구 상자 접기/펴기'),
  binding('F7', 'ext:jueony-select-cell-columns', '칸 전체 블록', 'cells'),
  binding('F8', 'ext:jueony-select-cell-rows', '줄 전체 블록', 'cells'),
  binding('Ctrl+G,C', 'view:ctrl-mark', '조판 부호'), binding('Ctrl+G,T', 'view:para-mark', '문단 부호'),
  binding('Ctrl+G,P', 'view:zoom-fit-page', '쪽 맞춤'), binding('Ctrl+G,W', 'view:zoom-fit-width', '폭 맞춤'), binding('Ctrl+G,Q', 'view:zoom-100', '100%'),
  binding('Ctrl+N,A', 'table:split', '표 나누기', 'table'), binding('Ctrl+N,Z', 'table:attach', '표 붙이기', 'table'),
  binding('Alt+Insert', 'table:insert-row-col', '줄/칸 추가', 'table'), binding('Alt+Delete', 'table:delete-row-col', '줄/칸 지우기', 'table'),
  binding('S', 'table:cell-split', '셀 나누기', 'cells'), binding('M', 'table:cell-merge', '셀 합치기', 'cells'),
  binding('H', 'table:cell-height-equal', '셀 높이를 같게', 'cells'), binding('W', 'table:cell-width-equal', '셀 너비를 같게', 'cells'),
  binding('P', 'table:cell-props', '표/셀 속성', 'cells'),
  binding('L', 'table:border-each', '각 셀 테두리', 'cells', { tab: 'border' }),
  binding('C', 'table:border-each', '각 셀 배경', 'cells', { tab: 'background' }),
  binding('B', 'table:border-one', '여러 셀 테두리', 'cells', { tab: 'border' }),
  binding('F', 'table:border-one', '여러 셀 배경', 'cells', { tab: 'background' }),
  binding('Ctrl+N,F', 'table:formula', '계산식', 'table'),
  binding('Ctrl+N,C', 'table:caption-toggle', '표 캡션 넣기', 'table'),
  binding('Ctrl+Shift+S', 'table:block-sum', '블록 합계', 'cells'), binding('Ctrl+Shift+A', 'table:block-avg', '블록 평균', 'cells'), binding('Ctrl+Shift+P', 'table:block-product', '블록 곱', 'cells'),
  binding('P', 'format:object-properties', '개체 속성', 'object'), binding('G', 'insert:group-shapes', '개체 묶기', 'object'), binding('U', 'insert:ungroup-shapes', '개체 풀기', 'object'),
  binding('Shift+PageUp', 'insert:arrange-front', '맨 앞으로', 'object'), binding('Shift+PageDown', 'insert:arrange-back', '맨 뒤로', 'object'),
  // Reserve former upstream shortcuts that would run a DIFFERENT Hangul function.
  binding('Alt+Shift+H', 'pending:macro-record', '스크립트 매크로 정의'),
  binding('Ctrl+=', 'ext:jueony-previous-cursor', '이전 커서 위치'), binding('Ctrl+Shift+=', 'ext:jueony-next-cursor', '다음 커서 위치'),
  binding('Ctrl+-', 'pending:clear-char-style', '글자 스타일 해제'),
];
export type Key = Pick<KeyboardEvent, 'key' | 'code' | 'ctrlKey' | 'altKey' | 'shiftKey' | 'metaKey' | 'repeat' | 'isComposing'>;
export type KeyContext = { table: boolean; cells: boolean; object: boolean };
export function keyStroke(e: Key): string {
  const code = e.code ?? '';
  const key = /^Key[A-Z]$/.test(code) ? code.slice(3) : /^Digit\d$/.test(code) ? code.slice(5) : ({ BracketLeft: '[', BracketRight: ']', Equal: '=', Minus: '-' } as Record<string, string>)[code] ?? (e.key.length === 1 ? e.key.toUpperCase() : e.key);
  return [e.ctrlKey ? 'Ctrl' : '', e.altKey ? 'Alt' : '', e.shiftKey ? 'Shift' : '', key].filter(Boolean).join('+');
}
export class HangulKeyResolver {
  private pending: { prefix: string; until: number } | null = null;
  reset() { this.pending = null; }
  resolve(e: Key, ctx: KeyContext, now: number = Date.now()): { handled: boolean; binding?: Binding; hint?: string } {
    if (e.metaKey) { this.reset(); return { handled: false }; }
    if (this.pending && now > this.pending.until) this.reset();
    if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return { handled: false };
    if (this.pending && e.key === 'Escape') { this.reset(); return { handled: true, hint: '연속키 취소' }; }
    if (e.isComposing) { this.reset(); return { handled: false }; }
    const stroke = keyStroke(e);
    if (this.pending) {
      if (e.repeat) return { handled: true };
      const prefix = this.pending.prefix; this.reset();
      const key = stroke.replace(/^Ctrl\+/, '');
      const found = this.find(prefix + ',' + key, ctx);
      return found ? { handled: true, binding: found } : { handled: true, hint: '이 연속키는 현재 지원하지 않습니다.' };
    }
    const found = this.find(stroke, ctx);
    if (found) return e.repeat && !found.repeatable ? { handled: true } : { handled: true, binding: found };
    if ((e.ctrlKey || e.altKey) && hangulBindings.some(b => b.keys === stroke)) return { handled: true, hint: '현재 선택 문맥에서 사용할 수 없는 단축키입니다.' };
    if (hangulBindings.some(b => b.keys.startsWith(stroke + ','))) {
      this.pending = { prefix: stroke, until: now + 3000 };
      return { handled: true, hint: stroke + ' → 다음 키 (Esc 취소)' };
    }
    return { handled: false };
  }
  private find(keys: string, ctx: KeyContext) {
    const candidates = hangulBindings.filter(b => b.keys === keys && (b.scope === 'document' || ctx[b.scope]));
    return candidates.find(b => b.scope !== 'document') ?? candidates[0];
  }
}
