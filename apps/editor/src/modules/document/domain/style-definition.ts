export type StyleDefinition = { name: string; englishName: string; type: 0 | 1; nextStyleId: number };
export type NamedStyle = StyleDefinition & { id: number };

/** Style IDs are u8; validation happens before any engine mutation. */
export function validateStyleDefinition(styles: readonly NamedStyle[], value: StyleDefinition, editingId?: number): StyleDefinition {
  const name = value.name.trim(), englishName = value.englishName.trim();
  if (!name || name.length > 250 || englishName.length > 250 || /[\u0000-\u001f\u007f]/.test(name + englishName)) throw new Error('스타일 이름은 제어문자 없는 1~250자여야 합니다.');
  if (value.type !== 0 && value.type !== 1) throw new Error('스타일 종류가 올바르지 않습니다.');
  if (editingId !== undefined && !styles.some(s => s.id === editingId && s.type === value.type)) throw new Error('편집 대상 스타일이 바뀌었습니다.');
  if (editingId === undefined && styles.length >= 256) throw new Error('문서에는 최대 256개의 스타일을 저장할 수 있습니다.');
  const others = styles.filter(s => s.id !== editingId);
  if (others.some(s => s.name.normalize('NFC') === name.normalize('NFC'))) throw new Error('같은 이름의 스타일이 있습니다. 다른 이름을 입력하세요.');
  if (englishName && others.some(s => s.englishName.normalize('NFC') === englishName.normalize('NFC'))) throw new Error('같은 영문 이름의 스타일이 있습니다. 다른 영문 이름을 입력하세요.');
  if (value.type === 0 && (!Number.isInteger(value.nextStyleId) || !styles.some(s => s.id === value.nextStyleId && s.type === 0))) throw new Error('다음 문단 스타일을 다시 선택하세요.');
  return { name, englishName, type: value.type, nextStyleId: value.type === 0 ? value.nextStyleId : 0 };
}
