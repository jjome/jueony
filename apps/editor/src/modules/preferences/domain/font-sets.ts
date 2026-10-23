export const FONT_SET_LANGUAGES = ['korean', 'english', 'chinese', 'japanese', 'other', 'symbol', 'user'] as const;
export type FontSetDefinition = { name: string } & Record<typeof FONT_SET_LANGUAGES[number], string>;
export type FontSetChange = { kind: 'add'; value: unknown } | { kind: 'edit'; expected: FontSetDefinition; value: unknown } | { kind: 'delete'; expected: FontSetDefinition };
const identity = (value: string) => value.normalize('NFC').toLocaleLowerCase('en-US');
function name(value: unknown, family: boolean): string {
  if (typeof value !== 'string' || !value.trim() || value.length > 100 || /[\u0000-\u001f\u007f]/u.test(value) || family && value.trim().startsWith('__fontset__')) throw new Error(family ? '7개 언어의 글꼴 이름을 모두 확인하세요. 이름은 100자 이하여야 합니다.' : '대표 글꼴 이름을 1~100자로 입력하세요.');
  return value.trim();
}
export function validateFontSet(value: unknown): FontSetDefinition {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('대표 글꼴 형식이 올바르지 않습니다.');
  const record = value as Record<string, unknown>;
  return { name: name(record.name, false), ...Object.fromEntries(FONT_SET_LANGUAGES.map(key => [key, name(record[key], true)])) } as FontSetDefinition;
}
export function validateFontSetLibrary(value: unknown): FontSetDefinition[] {
  if (!Array.isArray(value) || value.length > 100) throw new Error('사용자 대표 글꼴 목록은 100개 이하여야 합니다.');
  const result = value.map(validateFontSet), names = new Set(result.map(item => identity(item.name)));
  if (names.size !== result.length) throw new Error('저장된 대표 글꼴 이름이 중복됩니다. 먼저 목록을 확인하세요.');
  return result;
}
/** Match the captured definition, not its old array position, after another window edits the list. */
export function prepareFontSetChange(current: unknown, builtins: readonly FontSetDefinition[], change: FontSetChange): FontSetDefinition[] {
  const values = validateFontSetLibrary(current), originals = current as FontSetDefinition[];
  let index = -1;
  if (change.kind !== 'add') {
    const expected = validateFontSet(change.expected);
    index = values.findIndex(item => identity(item.name) === identity(expected.name));
    if (index < 0 || JSON.stringify(values[index]) !== JSON.stringify(expected)) throw new Error('다른 창에서 선택한 대표 글꼴이 바뀌었거나 삭제되었습니다. 목록을 다시 열어 선택하세요.');
  }
  const result = originals.map(item => ({ ...item }));
  if (change.kind === 'delete') { result.splice(index, 1); return result; }
  const replacement = validateFontSet(change.value);
  if (builtins.some(item => identity(item.name) === identity(replacement.name)) || values.some((item, i) => i !== index && identity(item.name) === identity(replacement.name))) throw new Error('같은 이름의 대표 글꼴이 이미 있습니다. 다른 이름을 입력하세요.');
  if (change.kind === 'add') {
    if (result.length >= 100) throw new Error('사용자 대표 글꼴은 최대 100개까지 등록할 수 있습니다.');
    result.push(replacement);
  } else result[index] = { ...result[index], ...replacement };
  return result;
}
