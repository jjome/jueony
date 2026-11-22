export type HwpReferenceCell = { controlIndex: number; cellIndex: number; cellParagraph: number; row: number; column: number };
export type HwpReferenceAddress = {
  kind: 'hwp'; section: number; paragraph: number; offset: number;
  cell?: HwpReferenceCell;
  ancestors?: HwpReferenceCell[];
};
export type SpreadsheetReferenceAddress = { kind: 'xlsx'; sheet: string; cell: string };
export type OfficeTextReferenceAddress =
  | { kind: 'pdf'; page: number; ocr: boolean }
  | { kind: 'docx'; paragraph: number };
export type SourceAddress = HwpReferenceAddress | SpreadsheetReferenceAddress | OfficeTextReferenceAddress;
export type SourceLocation = { start: number; end: number; address: SourceAddress };
export type SourceVersion = { kind: 'open-document'; revision: string };
export type Source = {
  id:string; name:string; text:string; characters:number; sha256:string; limitation?:string;
  locations?: SourceLocation[]; sourceVersion?: SourceVersion; originSourceId?: string;
};
export type RetrievalScope = { workspaceId: string; chatId: string };
export type SourceChunk = RetrievalScope & {
  id: string; sourceId: string; name: string; sourceSha256: string; contentSha256: string;
  start: number; end: number; startLine: number; endLine: number; text: string; limitation?: string;
  locations?: SourceLocation[]; sourceVersion?: SourceVersion;
};
export type RetrievalHit = Omit<SourceChunk, 'text' | 'workspaceId' | 'chatId' | 'limitation' | 'sourceVersion'> & { score: number };
export type RetrievalMode = 'lexical' | 'bm25';
export type RetrievalSummary = {
  mode: RetrievalMode; selectedSourceCount: number; indexedChunkCount: number; matchedChunkCount: number;
  sentCharacters: number; totalSourceCharacters: number; hits: RetrievalHit[]; warnings: string[];
};
export type RetrievalIndex = RetrievalScope & { chunks: SourceChunk[]; sourceCount: number; sourceCharacters: number };
export type RetrievedSource = Source & { originSourceId: string; contentSha256: string; locator: { start: number; end: number; startLine: number; endLine: number } };
