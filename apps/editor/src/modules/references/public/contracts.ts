export type Source = { id:string; name:string; text:string; characters:number; sha256:string; limitation?:string };
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
