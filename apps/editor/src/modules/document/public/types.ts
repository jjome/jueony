/** Detached JSON data. No engine handles cross this boundary. */
export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
export type DocumentProperties = { [key: string]: JsonValue | undefined };
export type Cell = { index: number; row: number; column: number; rowSpan: number; columnSpan: number; text: string; editable: boolean; properties: DocumentProperties; characters?: DocumentProperties; paragraphProperties?: DocumentProperties };
export type Table = { id: string; section: number; paragraph: number; control: number; rows: number; columns: number; cells: Cell[] };
export type Structure = { sections: { index: number; page: DocumentProperties }[]; tables: Table[]; paragraphs: { id: string; characters: DocumentProperties; paragraph: DocumentProperties }[]; unsupportedControls: string[] };
export type BodyNode = { id: string; section: number; paragraph: number; text: string; editable: boolean; reason?: string };
export type Snapshot = { revision: string; name: string; plainText?: string; nodes: BodyNode[]; limitations: string[]; structure?: Structure };
export type BodyOp =
 | { kind: 'create_document'; paragraphs: string[] }
 | { kind: 'insert_body_paragraphs'; after: string; paragraphs: string[] }
 | { kind: 'replace_body_text'; target: string; start: number; count: number; text: string }
 | { kind: 'delete_body_text'; target: string; start: number; count: number };
export type ControlOp =
  | { kind: 'format_characters' | 'format_paragraph'; target: string; properties: Record<string, unknown> }
  | { kind: 'create_table'; after: string; resultId: string; rows: string[][] }
  | { kind: 'set_table_cell'; target: string; row: number; column: number; originalText: string; text: string }
  | { kind: 'format_table_cells'; target: string; startRow: number; rowCount: number; startColumn: number; columnCount: number; properties: Record<string, unknown> }
  | { kind: 'insert_table_row' | 'insert_table_column'; target: string; index: number; values: string[] }
  | { kind: 'delete_table_row' | 'delete_table_column'; target: string; index: number }
  | { kind: 'set_page_setup'; section: number; properties: Record<string, unknown> };
export type EditOp = BodyOp | ControlOp;
export type Receipt = { runId: string; beforeRevision: string; afterRevision: string; before: string; after: string; operationCount: number; beforeStructure?: Structure; afterStructure?: Structure };
export function plainSnapshot(snapshot: Snapshot): string { return snapshot.nodes.map(node => node.text).join('\n'); }

/** Metadata accompanying a batch proposed by a caller; no agent implementation types. */
export type EditProposal = {message: string; operations: EditOp[]; sourceIds: string[]};
