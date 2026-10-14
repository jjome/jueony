/** Detached JSON data. No engine handles cross this boundary. */
export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
export type DocumentProperties = { [key: string]: JsonValue | undefined };
export type Cell = { index: number; row: number; column: number; rowSpan: number; columnSpan: number; text: string; editable: boolean; properties: DocumentProperties; characters?: DocumentProperties; paragraphProperties?: DocumentProperties };
export type Table = { id: string; section: number; paragraph: number; control: number; rows: number; columns: number; cells: Cell[] };
export type LineNumberRestart = 'page' | 'section' | 'continuous';
export type AgentLineNumbers = {enabled:boolean;restart:LineNumberRestart|null;countBy:number;startNumber:number;distanceMm:number;editable:boolean};
export type AgentPageBackground = {kind:'both'|'even'|'odd';fillType:string;color:string|null;applyPage:string;hideFill?:boolean;firstPageFill?:boolean;editable:boolean;reason?:string};
export type AgentPageBackgroundOp = {kind:'set_page_background';section:number;pageKind:'both'|'even'|'odd';fillType:'none'|'solid';color:string};
export type AgentMasterPage = {kind:'both'|'even'|'odd';text:string;textTruncated:boolean;xMm:number;yMm:number;fontSizePt:number;color:string;bold:boolean;italic:boolean;underline:string|null;editable:boolean;paragraphCount:number;controlCount:number};
export type AgentMasterPages = {editable:boolean;pages:AgentMasterPage[];hiddenOnFirstPage?:boolean;reason?:string};
export type AgentMasterPageOp = {kind:'set_master_page_text';section:number;pageKind:'both'|'even'|'odd';text:string;xMm:number;yMm:number;fontSizePt:number;color:string;bold:boolean} | {kind:'delete_master_page';section:number;pageKind:'both'|'even'|'odd'};
export type AgentSectionOp = {kind:'set_section_tabs';section:number;spacingPt:number} | {kind:'set_line_numbers';section:number;enabled:boolean;restart:LineNumberRestart;countBy:number;startNumber:number;distanceMm:number};
export type AgentEmptySectionEligibility = {supported:boolean;reason?:string};
export type AgentEmptySectionOp = {kind:'remove_empty_section';section:number};
export type AgentBookmark = {name:string;target:string|null;offset:number|null;editable:boolean};
export type AgentBookmarks = {editable:boolean;items:AgentBookmark[];reason?:string};
export type AgentBookmarkOp = {kind:'add_bookmark';target:string;offset:number;name:string}|{kind:'rename_bookmark';name:string;newName:string}|{kind:'delete_bookmark';name:string};
export type AgentHeaderFooterCreateOp = {kind:'create_header_footer';section:number;story:'header'|'footer';pageKind:'both'|'odd'|'even';text:string};
export type AgentHeaderFooterDeleteOp = {kind:'delete_header_footer';section:number;story:'header'|'footer';pageKind:'both'|'odd'|'even';originalText:string};
export type AgentHeaderFooterCharacters = {bold:boolean;italic:boolean;underline:boolean;fontSizePt:number;color:string};
export type AgentHeaderFooterParagraph = {alignment:string;lineSpacing:number;lineSpacingType:string};
export type AgentHeaderFooterParagraphOp = {kind:'format_header_footer_paragraph';section:number;story:'header'|'footer';pageKind:'both'|'odd'|'even';originalText:string;properties:{alignment?:'left'|'right'|'center'|'justify'|'distribute';lineSpacingPercent?:number}};
export type AgentHeaderFooterFormatOp = {kind:'format_header_footer';section:number;story:'header'|'footer';pageKind:'both'|'odd'|'even';originalText:string;properties:Partial<AgentHeaderFooterCharacters>};
export type AgentHeaderFooter = {story:'header'|'footer';pageKind:'both'|'odd'|'even';exists:boolean|null;editable:boolean;deletable?:boolean;creatable?:boolean;paragraphCount:number;text:string;textTruncated:boolean;hiddenOnFirstPage?:boolean;characters?:AgentHeaderFooterCharacters;paragraph?:AgentHeaderFooterParagraph;reason?:string};
export type AgentHeaderFooterOp = {kind:'set_header_footer_text';section:number;story:'header'|'footer';pageKind:'both'|'odd'|'even';originalText:string;text:string};
export type AgentSectionMergeOp = {kind:'merge_sections';rightSection:number};
export type AgentSectionSplitOp = {kind:'split_section';target:string;offset:number};
export type AgentParagraphTabStop={positionMm:number;alignment:'left'|'right'|'center'|'decimal';leader:'none'|'solid'|'dash'|'dot'};
export type AgentParagraphTabsOp={kind:'set_paragraph_tabs';target:string;stops:AgentParagraphTabStop[];autoLeft:boolean;autoRight:boolean};
export type AgentParagraphDecorationOp={kind:'format_paragraph_decoration';target:string;properties:Record<string,unknown>};
export type AgentParagraphDecorationSource=AgentParagraphTabSource;
export type AgentParagraphTabSource={editable:boolean;reason?:string};
export type AgentCreateParagraphStyleOp={kind:"create_paragraph_style";sourceStyleId:number;name:string};
export type AgentParagraphOutlineOp={kind:"set_paragraph_outline";target:string;enabled:boolean;level:number};
export type AgentParagraphOutlineSource={editable:boolean;definitionId?:number;reason?:string};
export type AgentBasicNumberingOp={kind:"set_basic_numbering";target:string;pattern:string;level:number;startNumber:number};
export type AgentNumberingCloneOp={kind:"clone_paragraph_numbering";target:string;sourceDefinitionId:number;level:number;startNumber:number};
export type AgentNumberingDefinitionSource={id:number;editable:boolean;startNumbers?:number[];reason?:string};
export type AgentBasicBulletOp={kind:"set_basic_bullet";target:string;character:string};
export type AgentParagraphListOp={kind:"set_paragraph_list";target:string;listKind:"none"|"number"|"bullet";definitionId:number;level:number};
export type AgentListCatalog={numberings:{id:number;levelFormats:string[];startNumber:number}[];bullets:{id:number;char:string;rawCode:number}[]};
export type Structure = { bookmarks?:AgentBookmarks; sectionMergeAvailable?:boolean; sectionSplitAvailable?:boolean; sections: { index: number; page: DocumentProperties; emptySectionRemoval?:AgentEmptySectionEligibility; headerFooters?:AgentHeaderFooter[]; columns?:DocumentProperties;defaultTabSpacingPt?:number;lineNumbers?:AgentLineNumbers;pageBackgrounds?:AgentPageBackground[];masterPages?:AgentMasterPages }[]; styles?:{id:number;name:string;type:JsonValue}[]; tables: Table[]; paragraphs: { id: string; characters: DocumentProperties; paragraph: DocumentProperties; style?:DocumentProperties;pageHide?:DocumentProperties;controls?:string[];pageIndex?:number }[]; unsupportedControls: string[] };
export type BodyNode = { id: string; section: number; paragraph: number; text: string; editable: boolean; reason?: string };
export type Snapshot = { revision: string; name: string; plainText?: string; styleCreationSources?:Record<string,{editable:boolean;fingerprint?:string;reason?:string}>; paragraphOutlineSources?:Record<string,AgentParagraphOutlineSource>; numberingDefinitionSources?:AgentNumberingDefinitionSource[]; paragraphTabSources?:Record<string,AgentParagraphTabSource>; basicNumberingSources?:Record<string,AgentParagraphTabSource>; basicBulletSources?:Record<string,AgentParagraphTabSource>; paragraphListSources?:Record<string,AgentParagraphTabSource>; listCatalog?:AgentListCatalog; paragraphDecorationSources?:Record<string,AgentParagraphDecorationSource>; nodes: BodyNode[]; limitations: string[]; structure?: Structure };
export type BodyOp =
 | { kind: 'create_document'; paragraphs: string[] }
 | { kind: 'insert_body_paragraphs'; after: string; paragraphs: string[] }
 | { kind: 'replace_body_text'; target: string; start: number; count: number; text: string }
 | { kind: 'delete_body_text'; target: string; start: number; count: number };
export type ControlOp =
  | AgentCreateParagraphStyleOp
  | AgentParagraphOutlineOp
  | AgentBasicNumberingOp
  | AgentNumberingCloneOp
  | AgentBasicBulletOp
  | AgentParagraphListOp
  | AgentParagraphDecorationOp
  | AgentParagraphTabsOp
  | AgentBookmarkOp
  | AgentHeaderFooterCreateOp
  | AgentHeaderFooterDeleteOp
  | AgentHeaderFooterParagraphOp
  | AgentHeaderFooterFormatOp
  | AgentHeaderFooterOp
  | AgentEmptySectionOp
  | AgentSectionMergeOp
  | AgentSectionSplitOp
  | AgentSectionOp
  | AgentPageBackgroundOp
  | AgentMasterPageOp
  | { kind:'apply_paragraph_style';target:string;styleId:number }
  | { kind:'set_columns';section:number;count:number;spacingMm:number }
  | { kind:'set_page_hide';target:string;properties:Record<string,unknown> }
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
