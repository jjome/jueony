export const DOCUMENT_CONTEXT_TEXT_LIMIT = 120_000;
export const DOCUMENT_TOOL_EDIT_TEXT_LIMIT = 1_200_000;
export const DOCUMENT_TOOL_READ_LENGTH = 4_000;
export const DOCUMENT_TOOL_PAGE_SIZE = 40;
export const DOCUMENT_TOOL_SECTION_LIMIT = 100;
export const DOCUMENT_TOOL_PARAGRAPH_LIMIT = 50_000;

export type DocumentToolOutline = {
  name: string; revision: string; sectionParagraphs: number[];
};
export type DocumentToolWindow = {
  id: string; text: string; editable: boolean; length: number;
  start?: number; end?: number; nextOffset?: number;
};
