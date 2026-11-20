import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';

const dialogStub = 'data:text/javascript,' + encodeURIComponent(`
export class ModalDialog {
  constructor(title, width) { this.title = title; this.width = width; }
  show() { globalThis.__b090Body = this.createBody(); globalThis.__b090Dialog = this; }
  hide() {}
}`);
const hooks = registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === '../../../ui/dialog') return { url: dialogStub, shortCircuit: true };
  return nextResolve(specifier, context);
} });
const {
  SymbolDialogB090,
  createSymbolRecentStoreB090,
  parseOldHangulSequenceB090,
  parseUnicodeSymbolInputB090,
  searchSymbolPresetsB090,
  SYMBOL_RECENTS_STORAGE_KEY_B090,
} = await import('../src/adapters/browser/symbol-dialog-b090.ts');
hooks.deregister();

class FakeElement {
  readonly tagName: string;
  children: FakeElement[] = [];
  attributes = new Map<string, string>();
  dataset: Record<string, string> = {};
  style: Record<string, string> = {};
  value = '';
  textContent = '';
  title = '';
  type = '';
  placeholder = '';
  className = '';
  readOnly = false;
  onclick?: () => void;
  oninput?: () => void;
  constructor(tagName: string) { this.tagName = tagName; }
  append(...values: FakeElement[]) { this.children.push(...values); }
  replaceChildren(...values: FakeElement[]) { this.children = [...values]; }
  setAttribute(name: string, value: string) { this.attributes.set(name, value); }
  get childElementCount() { return this.children.length; }
}

const find = (root: FakeElement, predicate: (value: FakeElement) => boolean): FakeElement | undefined => {
  if (predicate(root)) return root;
  for (const child of root.children) { const found = find(child, predicate); if (found) return found; }
  return undefined;
};
const byLabel = (root: FakeElement, label: string) => find(root, value => value.attributes.get('aria-label') === label)!;
const byText = (root: FakeElement, text: string) => find(root, value => value.textContent === text)!;

test('B090 parses explicit Unicode code points and preserves exact old-Hangul jamo order', () => {
  assert.equal(parseUnicodeSymbolInputB090('U+2605'), '★');
  assert.equal(parseUnicodeSymbolInputB090('0x1100 \\u1161 U+11AB'), '간');
  assert.equal(parseOldHangulSequenceB090('U+1112 U+119E'), 'ᄒᆞ');
  assert.equal(parseOldHangulSequenceB090('ᄫᅡ'), 'ᄫᅡ');
  assert.throws(() => parseOldHangulSequenceB090('가'), /자모/);
  assert.throws(() => parseUnicodeSymbolInputB090('U+110000'), /유니코드/);
  assert.equal(searchSymbolPresetsB090('별').some((value: any) => value.value === '★'), true);
  assert.equal(searchSymbolPresetsB090('U+1112 U+119E').length, 1);
});

test('B090 browser recent-store adapter rejects corrupt, duplicate and oversized writes', () => {
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
  const store = createSymbolRecentStoreB090(storage as Storage);
  store.write(JSON.stringify(['☆', '간']));
  assert.equal(values.get(SYMBOL_RECENTS_STORAGE_KEY_B090), JSON.stringify(['☆', '간']));
  assert.throws(() => store.write(JSON.stringify(['☆', '☆'])), /중복/);
  assert.throws(() => store.write(JSON.stringify(Array.from({ length: 21 }, (_, index) => String.fromCodePoint(0x2460 + index)))), /올바르지/);
  assert.throws(() => store.write('{'), SyntaxError);
  assert.throws(() => store.write(JSON.stringify(['\n'])), /제어 문자/);
});

test('B090 dialog exposes code-point search, old-Hangul sequence, recent selection and no-op confirm', () => {
  const previousDocument = (globalThis as any).document;
  (globalThis as any).document = { createElement: (tag: string) => new FakeElement(tag) };
  let persisted = JSON.stringify(['※']), applied: string[] = [];
  const store = { read: () => persisted, write: (value: string) => { persisted = value; } };
  try {
    const empty = new SymbolDialogB090((value: string) => applied.push(value), store);
    const emptyBody = (empty as any).createBody() as FakeElement;
    assert.equal((empty as any).onConfirm(), true); assert.deepEqual(applied, []);
    assert.ok(byText(emptyBody, '※'));

    const dialog = new SymbolDialogB090((value: string) => applied.push(value), store);
    const body = (dialog as any).createBody() as FakeElement;
    const query = byLabel(body, '문자 이름 또는 유니코드 코드 포인트');
    query.value = 'U+2605'; byText(body, '입력값 선택').onclick!();
    assert.equal(byLabel(body, '선택한 문자').value, '★');
    assert.equal((dialog as any).onConfirm(), true); assert.deepEqual(applied, ['★']);

    const oldDialog = new SymbolDialogB090((value: string) => applied.push(value), store);
    const oldBody = (oldDialog as any).createBody() as FakeElement;
    const old = byLabel(oldBody, '옛한글 자모 순서'); old.value = 'U+1100 U+1161 U+11AB';
    byText(oldBody, '옛한글 순서 선택').onclick!();
    assert.equal((oldDialog as any).onConfirm(), true); assert.deepEqual(applied, ['★', '간']);
  } finally { if (previousDocument === undefined) delete (globalThis as any).document; else (globalThis as any).document = previousDocument; }
});
