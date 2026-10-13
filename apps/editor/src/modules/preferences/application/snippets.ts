import { validateSnippetLibrary, type Snippet, type SnippetLibrary } from '../domain/snippets.ts';
import type { PreferenceStorage } from '../ports/storage.ts';
export const SNIPPETS_KEY = 'jueony-common-snippets';
export function readSnippetLibrary(storage: PreferenceStorage): SnippetLibrary {
  const text = storage.getItem(SNIPPETS_KEY); if (text === null) return { version: 1, snippets: [] };
  try { if (text.length > 1_000_000) throw new Error('limit'); return validateSnippetLibrary(JSON.parse(text)); } catch { throw new Error('저장된 상용구 목록이 손상되었거나 지원하지 않는 버전입니다. 자동으로 덮어쓰지 않았습니다.'); }
}
export function updateSnippetLibrary(storage: PreferenceStorage, expected: SnippetLibrary, action: { kind: 'save'; previousName?: string; snippet: Snippet } | { kind: 'delete'; name: string }): SnippetLibrary {
  const current = readSnippetLibrary(storage);
  if (JSON.stringify(current) !== JSON.stringify(validateSnippetLibrary(expected))) throw new Error('다른 창에서 상용구 목록이 바뀌었습니다. 창을 다시 여세요.');
  let snippets = current.snippets;
  if (action.kind === 'save') {
    const snippet = validateSnippetLibrary({ version: 1, snippets: [action.snippet] }).snippets[0], previous = action.previousName;
    if (previous !== undefined && !snippets.some(item => item.name === previous)) throw new Error('수정할 상용구를 다시 선택하세요.');
    if (snippets.some(item => item.name === snippet.name && item.name !== previous)) throw new Error('같은 이름의 상용구가 있습니다. 목록에서 선택해 수정하세요.');
    snippets = previous === undefined ? [...snippets, snippet] : snippets.map(item => item.name === previous ? snippet : item);
  } else {
    if (!snippets.some(item => item.name === action.name)) throw new Error('삭제할 상용구를 선택하세요.'); snippets = snippets.filter(item => item.name !== action.name);
  }
  const next = validateSnippetLibrary({ version: 1, snippets }); storage.setItem(SNIPPETS_KEY, JSON.stringify(next)); return next;
}
