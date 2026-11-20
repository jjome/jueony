import { ModalDialog } from '../../../ui/dialog';
import {
  readRecentSymbolsB090,
  validateSymbolB090,
  type SymbolRecentStoreB090,
} from '../rhwp/symbol-insertion-b090.ts';

export const SYMBOL_RECENTS_STORAGE_KEY_B090 = 'jueony.symbols.recent.v1';

export type SymbolPresetB090 = Readonly<{
  value: string;
  label: string;
  keywords: string;
  oldHangul?: boolean;
}>;

/** This is a deliberately small, named catalogue. It is not a Unicode database. */
export const SYMBOL_PRESETS_B090: readonly SymbolPresetB090[] = Object.freeze([
  { value: '※', label: '참고표', keywords: 'reference note chamgo' },
  { value: '☆', label: '빈 별', keywords: 'star byeol' },
  { value: '★', label: '검은 별', keywords: 'star byeol' },
  { value: '○', label: '빈 동그라미', keywords: 'circle donggeurami' },
  { value: '●', label: '검은 동그라미', keywords: 'circle donggeurami' },
  { value: '□', label: '빈 네모', keywords: 'square nemo' },
  { value: '■', label: '검은 네모', keywords: 'square nemo' },
  { value: '→', label: '오른쪽 화살표', keywords: 'arrow right hwasalpyo' },
  { value: '←', label: '왼쪽 화살표', keywords: 'arrow left hwasalpyo' },
  { value: '±', label: '플러스마이너스', keywords: 'plus minus math' },
  { value: '℃', label: '섭씨', keywords: 'celsius degree temperature' },
  { value: '㎜', label: '밀리미터', keywords: 'millimeter unit' },
  { value: '㎡', label: '제곱미터', keywords: 'square meter unit' },
  { value: '가', label: '옛한글 ᄀ+ᅡ', keywords: 'old hangul choseong jungseong', oldHangul: true },
  { value: '간', label: '옛한글 ᄀ+ᅡ+ᆫ', keywords: 'old hangul choseong jungseong jongseong', oldHangul: true },
  { value: 'ᄒᆞ', label: '옛한글 ᄒ+ᆞ', keywords: 'old hangul araea', oldHangul: true },
  { value: 'ᄫᅡ', label: '옛한글 ᄫ+ᅡ', keywords: 'old hangul pansios', oldHangul: true },
]);

type StorageB090 = Pick<Storage, 'getItem' | 'setItem'>;

function exactCodePoints(value: string): string {
  return Array.from(value, character => `U+${character.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')}`).join(' ');
}

function codePointTokens(value: string): string[] | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const tokens = trimmed.split(/[\s,;]+/u).filter(Boolean);
  if (tokens.length < 1 || tokens.length > 8) return undefined;
  if (!tokens.every(token => /^(?:U\+|0X|\\U\{?)[0-9A-F]{1,6}\}?$/iu.test(token))) return undefined;
  return tokens;
}

/** Accepts literal text or explicit U+XXXX / 0xXXXX / \\uXXXX sequences. */
export function parseUnicodeSymbolInputB090(value: string): string | undefined {
  const tokens = codePointTokens(value);
  if (tokens) {
    const result = tokens.map(token => {
      const hexadecimal = token.replace(/^(?:U\+|0X|\\U\{?)/iu, '').replace(/\}$/u, '');
      const point = Number.parseInt(hexadecimal, 16);
      if (!Number.isSafeInteger(point) || point < 0 || point > 0x10ffff || (point >= 0xd800 && point <= 0xdfff))
        throw new Error('유효한 유니코드 코드 포인트를 입력해 주세요.');
      return String.fromCodePoint(point);
    }).join('');
    return validateSymbolB090(result);
  }
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  try { return validateSymbolB090(trimmed); } catch { return undefined; }
}

const oldHangulPoint = (point: number): boolean => (point >= 0x1100 && point <= 0x11ff)
  || (point >= 0xa960 && point <= 0xa97f) || (point >= 0xd7b0 && point <= 0xd7ff);

/** Old-Hangul input remains an exact, non-normalized sequence of Hangul jamo. */
export function parseOldHangulSequenceB090(value: string): string {
  const parsed = parseUnicodeSymbolInputB090(value);
  if (!parsed || !Array.from(parsed).every(character => oldHangulPoint(character.codePointAt(0)!)))
    throw new Error('옛한글 자모 또는 자모의 U+ 코드 포인트만 순서대로 입력해 주세요.');
  return parsed;
}

export function searchSymbolPresetsB090(query: string): readonly SymbolPresetB090[] {
  const normalized = query.trim().toLocaleLowerCase('ko-KR');
  if (!normalized) return SYMBOL_PRESETS_B090;
  let literal: string | undefined;
  try { literal = parseUnicodeSymbolInputB090(query); } catch { literal = undefined; }
  return SYMBOL_PRESETS_B090.filter(preset => preset.value === literal
    || `${preset.label} ${preset.keywords} ${preset.value} ${exactCodePoints(preset.value)}`.toLocaleLowerCase('ko-KR').includes(normalized));
}

/** Validates both reads (in the core helper) and writes (at the browser boundary). */
export function createSymbolRecentStoreB090(storage: StorageB090): SymbolRecentStoreB090 {
  if (!storage || typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function')
    throw new Error('최근 문자 저장소를 사용할 수 없습니다.');
  return Object.freeze({
    read: () => storage.getItem(SYMBOL_RECENTS_STORAGE_KEY_B090),
    write(value: string) {
      if (typeof value !== 'string' || value.length > 8192) throw new Error('최근 문자 목록이 올바르지 않습니다.');
      const parsed: unknown = JSON.parse(value);
      if (!Array.isArray(parsed) || parsed.length > 20) throw new Error('최근 문자 목록이 올바르지 않습니다.');
      const checked = parsed.map(validateSymbolB090);
      if (new Set(checked).size !== checked.length) throw new Error('최근 문자 목록에 중복 문자가 있습니다.');
      storage.setItem(SYMBOL_RECENTS_STORAGE_KEY_B090, JSON.stringify(checked));
    },
  });
}

export class SymbolDialogB090 extends ModalDialog {
  private readonly apply: (value: string) => void;
  private readonly recentStore?: SymbolRecentStoreB090;
  private selected?: string;
  private preview!: HTMLInputElement;
  private error!: HTMLParagraphElement;
  private results!: HTMLDivElement;

  constructor(apply: (value: string) => void, recentStore?: SymbolRecentStoreB090) {
    super('문자표 — 유니코드·옛한글', 660);
    this.apply = apply;
    this.recentStore = recentStore;
  }

  private setSelected(value: string): void {
    this.selected = validateSymbolB090(value);
    this.preview.value = this.selected;
    this.preview.title = exactCodePoints(this.selected);
    this.error.textContent = '';
  }

  private renderPresets(query: string): void {
    this.results.replaceChildren();
    for (const preset of searchSymbolPresetsB090(query)) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'dialog-btn';
      button.textContent = `${preset.value}  ${preset.label}`;
      button.title = exactCodePoints(preset.value);
      button.dataset.oldHangul = String(Boolean(preset.oldHangul));
      button.onclick = () => this.setSelected(preset.value);
      this.results.append(button);
    }
    if (!this.results.childElementCount) {
      const empty = document.createElement('span');
      empty.textContent = '일치하는 기본 문자가 없습니다. 위 입력값을 직접 선택할 수 있습니다.';
      this.results.append(empty);
    }
  }

  protected createBody(): HTMLElement {
    const body = document.createElement('div');
    body.dataset.jueonySymbolB090 = 'true';
    const info = document.createElement('p');
    info.textContent = '기본 문자 검색 또는 U+2605 같은 코드 포인트를 입력할 수 있습니다. 전체 유니코드 이름 데이터베이스 검색은 제공하지 않습니다. 한 번에 최대 8문자를 넣습니다.';

    const query = document.createElement('input');
    query.type = 'text'; query.setAttribute('aria-label', '문자 이름 또는 유니코드 코드 포인트');
    query.placeholder = '예: 별, U+2605, U+1100 U+1161 U+11AB'; query.style.width = '78%';
    const useQuery = document.createElement('button');
    useQuery.type = 'button'; useQuery.textContent = '입력값 선택';
    useQuery.onclick = () => { try { const value = parseUnicodeSymbolInputB090(query.value); if (!value) throw new Error('문자나 U+ 코드 포인트를 입력해 주세요.'); this.setSelected(value); } catch (error) { this.error.textContent = String(error instanceof Error ? error.message : error); } };
    query.oninput = () => this.renderPresets(query.value);

    const oldLabel = document.createElement('label'); oldLabel.textContent = '옛한글 자모 순서 ';
    const oldHangul = document.createElement('input'); oldHangul.type = 'text'; oldHangul.setAttribute('aria-label', '옛한글 자모 순서'); oldHangul.placeholder = '예: ᄒᆞ 또는 U+1112 U+119E';
    const useOldHangul = document.createElement('button'); useOldHangul.type = 'button'; useOldHangul.textContent = '옛한글 순서 선택';
    useOldHangul.onclick = () => { try { this.setSelected(parseOldHangulSequenceB090(oldHangul.value)); } catch (error) { this.error.textContent = String(error instanceof Error ? error.message : error); } };
    oldLabel.append(oldHangul, useOldHangul);

    const recentTitle = document.createElement('p'); recentTitle.textContent = '최근 문자 (최대 20개)';
    const recents = document.createElement('div'); recents.dataset.symbolRecentsB090 = 'true';
    const values = this.recentStore ? readRecentSymbolsB090(this.recentStore) : [];
    if (!values.length) recents.textContent = '최근 문자가 없습니다.';
    for (const value of values) { const button = document.createElement('button'); button.type = 'button'; button.textContent = value; button.title = exactCodePoints(value); button.onclick = () => this.setSelected(value); recents.append(button); }

    this.results = document.createElement('div'); this.results.dataset.symbolPresetsB090 = 'true';
    const previewLabel = document.createElement('label'); previewLabel.textContent = '선택한 문자 ';
    this.preview = document.createElement('input'); this.preview.readOnly = true; this.preview.setAttribute('aria-label', '선택한 문자');
    previewLabel.append(this.preview);
    this.error = document.createElement('p'); this.error.setAttribute('role', 'alert');
    body.append(info, query, useQuery, oldLabel, recentTitle, recents, this.results, previewLabel, this.error);
    this.renderPresets('');
    return body;
  }

  protected onConfirm(): boolean {
    if (!this.selected) return true;
    try { this.apply(validateSymbolB090(this.selected)); return true; }
    catch (error) { this.error.textContent = String(error instanceof Error ? error.message : error); return false; }
  }
}
