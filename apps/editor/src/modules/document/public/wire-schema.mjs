// Canonical provider-neutral wire shape; semantic validation remains in this module's domain.
export const controlKinds = ['format_characters', 'format_paragraph', 'create_table', 'set_table_cell', 'format_table_cells', 'set_page_setup', 'insert_table_row','insert_table_column','delete_table_row','delete_table_column','apply_paragraph_style','set_columns','set_page_hide','set_section_tabs','set_line_numbers','set_page_background'];
const text = { type: 'string' }, number = { type: 'number' }, bool = { type: 'boolean' }, integer = { type: 'integer', minimum: 0 };
const object = properties => ({ type: 'object', properties, required: Object.keys(properties) });
const properties = values => ({ type: 'object', properties: values });
const characters = {bold:bool,italic:bool,underline:bool,strikethrough:bool,fontSizePt:number,color:text,fontFamily:text,ratioPercent:integer,spacingPercent:{type:'integer'},superscript:bool,subscript:bool};
const operation = (kind, fields) => object({ kind: { type: 'string', enum: [kind] }, ...fields });
export function controlSchemas() {
 return [
  operation('set_page_background',{section:integer,pageKind:{type:'string',enum:['both','even','odd']},fillType:{type:'string',enum:['none','solid']},color:text}),
  operation('set_section_tabs',{section:integer,spacingPt:{type:'number',minimum:0.1,maximum:9999}}),
  operation('set_line_numbers',{section:integer,enabled:bool,restart:{type:'string',enum:['page','section','continuous']},countBy:{type:'integer',minimum:1,maximum:65535},startNumber:{type:'integer',minimum:1,maximum:65535},distanceMm:{type:'number',minimum:0,maximum:50}}),
  operation('apply_paragraph_style',{target:text,styleId:integer}),
  operation('set_columns',{section:integer,count:{type:'integer',minimum:1,maximum:6},spacingMm:number}),
  operation('set_page_hide',{target:text,properties:properties({hideHeader:bool,hideFooter:bool,hideMasterPage:bool,hideBorder:bool,hideFill:bool,hidePageNum:bool})}),
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
export function generationSchema(referenceIds=[]){
 const text={type:'string'},integer={type:'integer',minimum:0};
 const paragraphs={type:'array',minItems:1,maxItems:100,items:text};
 const object=(properties)=>({type:'object',properties,required:Object.keys(properties)});
 const kind=(value)=>({type:'string',enum:[value]});
 return object({
  message:text,sourceIds:{type:'array',maxItems:referenceIds.length,items:referenceIds.length?{type:'string',enum:[...new Set(referenceIds)]}:text},
  operations:{type:'array',maxItems:30,items:{anyOf:[
   object({kind:kind('create_document'),paragraphs}),
   object({kind:kind('insert_body_paragraphs'),after:text,paragraphs}),
   object({kind:kind('replace_body_text'),target:text,start:integer,count:integer,text}),
   object({kind:kind('delete_body_text'),target:text,start:integer,count:integer}),
   ...controlSchemas(),
  ]}},
 });
}


export const bodyKinds = ['create_document','insert_body_paragraphs','replace_body_text','delete_body_text'];
export const editKinds = [...bodyKinds, ...controlKinds];
export const tableAxisKinds = ['insert_table_row','insert_table_column','delete_table_row','delete_table_column'];
