// Provider wire projection of DocumentControl's semantic validators.
// No native engine calls or execution permissions belong in a provider adapter.
export const controlKinds = ['format_characters', 'format_paragraph', 'create_table', 'set_table_cell', 'format_table_cells', 'set_page_setup', 'insert_table_row','insert_table_column','delete_table_row','delete_table_column'];
const text = { type: 'string' }, number = { type: 'number' }, bool = { type: 'boolean' }, integer = { type: 'integer', minimum: 0 };
const object = properties => ({ type: 'object', properties, required: Object.keys(properties) });
const properties = values => ({ type: 'object', properties: values });
const characters = {bold:bool,italic:bool,underline:bool,strikethrough:bool,fontSizePt:number,color:text,fontFamily:text,ratioPercent:integer,spacingPercent:{type:'integer'},superscript:bool,subscript:bool};
const operation = (kind, fields) => object({ kind: { type: 'string', enum: [kind] }, ...fields });
export function controlSchemas() {
 return [
  operation('format_characters', { target: text, properties: properties(characters) }),
  operation('format_paragraph', { target: text, properties: properties({ alignment: text, lineSpacingPercent: number, marginLeftMm: number, marginRightMm: number, indentMm: number, beforeMm: number, afterMm: number, keepWithNext: bool, keepLines: bool, pageBreakBefore: bool }) }),
  operation('create_table', { after: text, resultId: text, rows: { type: 'array', items: { type: 'array', items: text } } }),
  operation('set_table_cell', { target: text, row: integer, column: integer, originalText: text, text }),
  operation('format_table_cells', { target: text, startRow: integer, rowCount: integer, startColumn: integer, columnCount: integer, properties: properties({ ...characters, background: text, alignment: text, verticalAlignment: text }) }),
  operation('set_page_setup', { section: integer, properties: properties({ widthMm: number, heightMm: number, landscape: bool, marginLeftMm: number, marginRightMm: number, marginTopMm: number, marginBottomMm: number, marginHeaderMm: number, marginFooterMm: number }) }),
  operation('insert_table_row',{target:text,index:integer,values:{type:'array',items:text}}),
  operation('insert_table_column',{target:text,index:integer,values:{type:'array',items:text}}),
  operation('delete_table_row',{target:text,index:integer}),
  operation('delete_table_column',{target:text,index:integer}),
 ];
}
export const CONTROL_SYSTEM = `
Additional supported DocumentControl operations (only if document.structure exists):
{"kind":"format_characters","target":"s0p0","properties":{"bold":true,"fontSizePt":16,"color":"#000000"}}: whole editable nonempty body paragraph. Also italic, underline, strikethrough booleans; fontFamily (font name), ratioPercent (integer 50-200), spacingPercent (integer -50..50), superscript/subscript booleans (mutually exclusive when true). Font bytes are not downloaded; missing installed fonts use rendering fallback. Change only requested properties; omitted properties remain unchanged. format_table_cells accepts these character properties too.
{"kind":"format_paragraph","target":"s0p1","properties":{"alignment":"center","lineSpacingPercent":160}}: alignment left/right/center/justify/distribute; margins marginLeftMm/marginRightMm, indentMm, beforeMm/afterMm; keepWithNext/keepLines/pageBreakBefore booleans.
{"kind":"create_table","after":"s0p1","resultId":"schedule","rows":[["단계","기간"],["준비","미정"]]}: rectangular 1-50 rows, 1-20 columns, <=200 cells. New resultId unique ASCII identifier. Each cell single paragraph <=4000 characters. Afterwards reference this table with target:"@schedule" within this request. Existing table targets use exact document.structure.tables IDs. All row/column indices are zero-based.
{"kind":"set_table_cell","target":"s0p2t0","row":1,"column":0,"originalText":"기존 셀 원문","text":"새 내용"}: only editable unmerged single-paragraph cells; exact originalText required.
{"kind":"format_table_cells","target":"@schedule","startRow":0,"rowCount":1,"startColumn":0,"columnCount":2,"properties":{"bold":true,"background":"#eeeeee"}}: rectangular range of simple unmerged cells. rowCount/columnCount are HOW MANY rows/columns, not end indices. Also fontSizePt, color, alignment(left/right/center/justify/distribute), verticalAlignment(top/center/bottom). Empty cells cannot receive character formatting yet.
{"kind":"set_page_setup","section":0,"properties":{"widthMm":210,"heightMm":297,"landscape":true,"marginLeftMm":20,"marginRightMm":20,"marginTopMm":20,"marginBottomMm":20}}: existing section index only, paper sizes are portrait/unrotated dimensions. Additional marginHeaderMm/marginFooterMm supported. Width/height units mm, font size pt, colors #RRGGBB.
rowCount와 columnCount는 행/열 개수입니다. 첫 행만 꾸밀 때는 반드시 startRow:0,rowCount:1입니다. 3열 표의 첫 행 전체는 startRow:0,rowCount:1,startColumn:0,columnCount:3입니다. endRow/endColumn 필드는 지원하지 않습니다. 요청받지 않은 행의 서식은 변경하지 마세요.
{"kind":"insert_table_row","target":"@schedule","index":1,"values":["새 단계","미정"]}: inserts one row BEFORE the zero-based index; index=rowCount appends. values must match column count. insert_table_column uses the same fields, index=columnCount appends; values must match row count.
{"kind":"delete_table_row","target":"@schedule","index":1}: deletes one row and its text. delete_table_column deletes one column. Never delete the last row/column. Only simple, unmerged, unnested single-paragraph cells supported. Result <=50 rows,20 columns,200 cells. Subsequent cell row/column indices refer to the UPDATED grid after each operation. Preserve all unrelated cells.
Operations execute in order. Body/table IDs keep their original identity even when preceding inserts shift them. At most one text mutation per existing body paragraph, but formatting may accompany it. New-document creation remains the only operation in its request; populate/format a newly created document on a subsequent request. Prefer create_table rows to fill a new table in one command. No arbitrary editor command execution, object editing, merged/nested table edits, section creation, automatic save or document move support. Explain unsupported requests without claiming success. Never claim a save occurred.`;
