export type Snippet = { name: string; text: string };
export type SnippetLibrary = { version: 1; snippets: Snippet[] };
export function validateSnippetLibrary(value: unknown): SnippetLibrary {
  const source = value as SnippetLibrary;
  if (!source || typeof source !== 'object' || source.version !== 1 || !Array.isArray(source.snippets) || source.snippets.length > 100) throw new Error('지원하는 상용구 목록은 v1이며 100개 이하여야 합니다.');
  const names = new Set<string>(); let characters = 0;
  const snippets = source.snippets.map(item => {
    if (!item || typeof item.name !== 'string' || !item.name.trim() || item.name.trim().length > 100 || /[\u0000-\u001f\u007f]/u.test(item.name) || typeof item.text !== 'string' || !item.text || [...item.text].length > 8000 || item.text.split(/\r\n?|\n/u).length > 200 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(item.text)) throw new Error('상용구 이름은 1~100자, 내용은 1~8,000자·200줄 이하여야 합니다.');
    const name = item.name.trim().normalize('NFC'); if (names.has(name)) throw new Error('상용구 이름이 중복됩니다.'); names.add(name); characters += [...item.text].length; if (characters > 100_000) throw new Error('전체 상용구 내용은 100,000자 이하여야 합니다.');
    return { name, text: item.text.replace(/\r\n?/gu, '\n') };
  });
  return { version: 1, snippets };
}
