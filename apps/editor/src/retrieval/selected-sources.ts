import type { Source } from '../mvp/model.ts';

export type RetrievalScope = { workspaceId: string; chatId: string };
export type SourceChunk = RetrievalScope & {
  id: string; sourceId: string; name: string; sourceSha256: string; contentSha256: string;
  start: number; end: number; startLine: number; endLine: number; text: string; limitation?: string;
};
export type RetrievalHit = Omit<SourceChunk, 'text' | 'workspaceId' | 'chatId' | 'limitation'> & { score: number };
export type RetrievalSummary = {
  mode: 'lexical'; selectedSourceCount: number; indexedChunkCount: number; matchedChunkCount: number;
  sentCharacters: number; totalSourceCharacters: number; hits: RetrievalHit[]; warnings: string[];
};
export type RetrievalIndex = RetrievalScope & { chunks: SourceChunk[]; sourceCount: number; sourceCharacters: number };
export type RetrievedSource = Source & { originSourceId: string; contentSha256: string; locator: { start: number; end: number; startLine: number; endLine: number } };
const MAX_CHUNK = 1000, MAX_RESULTS = 8, MAX_CHARACTERS = 8000, MAX_PER_SOURCE = 3;
const stopped = (signal?: AbortSignal) => signal?.throwIfAborted();
const normalize = (text: string) => text.normalize('NFKC').toLocaleLowerCase('ko-KR');
const compare = (left: string, right: string) => left < right ? -1 : left > right ? 1 : 0;
async function sha256(text: string) {
  const value = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(value)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}
function verifyScope(scope: RetrievalScope) {
  if (!scope.workspaceId || !scope.chatId) throw new Error('검색할 업무와 채팅을 확인하지 못했습니다.');
}
function lineAt(starts: number[], offset: number) {
  let low = 0, high = starts.length;
  while (low + 1 < high) { const middle = (low + high) >> 1; if (starts[middle] <= offset) low = middle; else high = middle; }
  return low + 1;
}

// This index is rebuilt from the explicitly selected, permission-checked sources
// of one request. It never enumerates folders or retains sources between runs.
export async function indexSelectedSources(scope: RetrievalScope, sources: Source[], signal?: AbortSignal): Promise<RetrievalIndex> {
  verifyScope(scope); stopped(signal);
  if (sources.length > 20 || sources.reduce((sum, source) => sum + source.text.length, 0) > 120000) throw new Error('선택 자료 검색은 20개 파일·120,000자까지입니다.');
  const seen = new Set<string>(), chunks: SourceChunk[] = [];
  for (const source of [...sources].sort((a, b) => compare(a.id, b.id))) {
    stopped(signal);
    if (!source.id || seen.has(source.id) || !/^[0-9a-f]{64}$/i.test(source.sha256)) throw new Error('자료 식별자 또는 버전 hash가 올바르지 않습니다.');
    seen.add(source.id);
    const starts = [0]; for (const match of source.text.matchAll(/\r\n|\r|\n/g)) starts.push(match.index! + match[0].length);
    for (let start = 0; start < source.text.length;) {
      stopped(signal); let end = Math.min(source.text.length, start + MAX_CHUNK);
      if (end < source.text.length) {
        const newline = source.text.lastIndexOf('\n', end - 1);
        if (newline >= start + MAX_CHUNK / 2) end = newline + 1;
        if (/[\uD800-\uDBFF]/.test(source.text[end - 1]) && /[\uDC00-\uDFFF]/.test(source.text[end])) end--;
        if (source.text[end - 1] === '\r' && source.text[end] === '\n') end--;
      }
      const text = source.text.slice(start, end), contentSha256 = await sha256(text);
      const id = 'chunk:' + await sha256(JSON.stringify([scope.workspaceId, scope.chatId, source.id, source.sha256, start, end, contentSha256]));
      chunks.push({ ...scope, id, sourceId: source.id, name: source.name, sourceSha256: source.sha256, contentSha256,
        start, end, startLine: lineAt(starts, start), endLine: lineAt(starts, Math.max(start, end - 1)), text, limitation: source.limitation });
      start = end;
    }
  }
  stopped(signal);
  return { ...scope, chunks, sourceCount: sources.length, sourceCharacters: sources.reduce((sum, source) => sum + source.text.length, 0) };
}
const stopWords = new Set(['해줘', '해주세요', '작성해줘', '작성해주세요', '참고해서', '참고하여', '자료', '문서', 'the', 'and', 'please', 'from', 'with']);
function queryTerms(query: string) {
  const words = [...new Set(normalize(query).match(/[\p{L}\p{N}]+/gu) ?? [])].filter(word => word.length > 1 && !stopWords.has(word));
  const terms = new Map<string, number>();
  for (const word of words) {
    terms.set(word, 1);
    if (/^[가-힣]{3,}$/.test(word)) for (let index = 0; index < word.length - 1; index++) if (!terms.has(word.slice(index, index + 2))) terms.set(word.slice(index, index + 2), 0.2);
  }
  return [...terms.entries()].slice(0, 160);
}
function occurrences(text: string, word: string) {
  let count = 0, from = 0; while (count < 20) { const at = text.indexOf(word, from); if (at < 0) break; count++; from = at + word.length; } return count;
}

export function searchSelectedSources(index: RetrievalIndex, scope: RetrievalScope, query: string, signal?: AbortSignal): { references: RetrievedSource[]; retrieval: RetrievalSummary } {
  verifyScope(scope); stopped(signal);
  if (index.workspaceId !== scope.workspaceId || index.chatId !== scope.chatId || index.chunks.some(chunk => chunk.workspaceId !== scope.workspaceId || chunk.chatId !== scope.chatId)) throw new Error('다른 업무 또는 채팅의 검색 자료입니다.');
  if (typeof query !== 'string' || query.length > 12000) throw new Error('검색 요청은 12,000자 이내여야 합니다.');
  const terms = queryTerms(query), content = index.chunks.map(chunk => ({ chunk, text: normalize(chunk.text), title: normalize(chunk.name) }));
  const frequencies = terms.map(([term]) => content.filter(item => item.text.includes(term) || item.title.includes(term)).length);
  const scored = content.map(({ chunk, text, title }) => {
    stopped(signal); let score = 0;
    for (let termIndex = 0; termIndex < terms.length; termIndex++) {
      const [term, weight] = terms[termIndex], frequency = frequencies[termIndex];
      if (!frequency) continue;
      const count = occurrences(text, term), titleMatch = title.includes(term) ? 2 : 0;
      score += weight * Math.log(1 + (content.length + 1) / frequency) * (Math.log(1 + count) + titleMatch);
    }
    return { chunk, score };
  }).filter(item => item.score > 0).sort((a, b) => b.score - a.score || compare(a.chunk.sourceId, b.chunk.sourceId) || a.chunk.start - b.chunk.start);
  const selected: typeof scored = [], perSource = new Map<string, number>(); let characters = 0;
  for (const item of scored) {
    if (selected.length >= MAX_RESULTS) break;
    const count = perSource.get(item.chunk.sourceId) ?? 0;
    if (count >= MAX_PER_SOURCE || characters + item.chunk.text.length > MAX_CHARACTERS) continue;
    selected.push(item); perSource.set(item.chunk.sourceId, count + 1); characters += item.chunk.text.length;
  }
  stopped(signal);
  const hits: RetrievalHit[] = selected.map(({ chunk: { text, workspaceId, chatId, limitation, ...metadata }, score }) => ({ ...metadata, score }));
  const references: RetrievedSource[] = selected.map(({ chunk }) => ({
    id: chunk.id, name: `${chunk.name} · 추출문 ${chunk.startLine}–${chunk.endLine}줄`, text: chunk.text, characters: chunk.text.length,
    sha256: chunk.sourceSha256, originSourceId: chunk.sourceId, contentSha256: chunk.contentSha256,
    locator: { start: chunk.start, end: chunk.end, startLine: chunk.startLine, endLine: chunk.endLine },
    limitation: [chunk.limitation, `선택한 원본 중 관련 구간만 전달. 위치는 추출 텍스트의 0부터 시작하는 UTF-16 [${chunk.start}, ${chunk.end}) 범위이며 한글 쪽/셀 좌표가 아닙니다. 원본 ID: ${chunk.sourceId}. 구간 SHA-256: ${chunk.contentSha256}.`].filter(Boolean).join(' '),
  }));
  return { references, retrieval: { mode: 'lexical', selectedSourceCount: index.sourceCount, indexedChunkCount: index.chunks.length,
    matchedChunkCount: scored.length, sentCharacters: characters, totalSourceCharacters: index.sourceCharacters, hits,
    warnings: selected.length ? ['문자열 기반 관련도 검색입니다. 전체 자료를 모델에 전달하지 않으며 숫자·사실의 정확성을 보증하지 않습니다.'] : ['선택한 자료에서 관련 구간을 찾지 못했습니다. 이번 요청에는 참고 자료 본문을 전달하지 않습니다. 검색어를 구체화하거나 전체 자료 전달 모드를 사용하세요.'] } };
}