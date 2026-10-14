// Canonical provider-neutral wire shape; semantic validation remains in this module's domain.
export const controlKinds = ['set_basic_numbering','clone_paragraph_numbering','set_basic_bullet','set_paragraph_list','format_paragraph_decoration','set_paragraph_tabs','add_bookmark','rename_bookmark','delete_bookmark','create_header_footer','delete_header_footer','format_header_footer_paragraph','format_header_footer','set_header_footer_text','merge_sections','remove_empty_section','split_section','format_characters', 'format_paragraph', 'create_table', 'set_table_cell', 'format_table_cells', 'set_page_setup', 'insert_table_row','insert_table_column','delete_table_row','delete_table_column','apply_paragraph_style','set_columns','set_page_hide','set_section_tabs','set_line_numbers','set_page_background','set_master_page_text','delete_master_page'];
const text = { type: 'string' }, number = { type: 'number' }, bool = { type: 'boolean' }, integer = { type: 'integer', minimum: 0 };
const object = properties => ({ type: 'object', properties, required: Object.keys(properties) });
const properties = values => ({ type: 'object', properties: values });
const characters = {bold:bool,italic:bool,underline:bool,strikethrough:bool,fontSizePt:number,color:text,fontFamily:text,ratioPercent:integer,spacingPercent:{type:'integer'},superscript:bool,subscript:bool};
const operation = (kind, fields) => object({ kind: { type: 'string', enum: [kind] }, ...fields });
export function controlSchemas() {
 return [
  operation('set_basic_numbering',{target:text,pattern:{type:'string',enum:['decimal','parenthesized','closing_parenthesis']},level:{type:'integer',minimum:0,maximum:6},startNumber:{type:'integer',minimum:1,maximum:65535}}),
  operation('clone_paragraph_numbering',{target:text,sourceDefinitionId:{type:'integer',minimum:1,maximum:200},level:{type:'integer',minimum:0,maximum:6},startNumber:{type:'integer',minimum:1,maximum:65535}}),
  operation('set_basic_bullet',{target:text,character:{type:'string',enum:['●','○','■','□','◆','◇','▶','▷']}}),
  operation('set_paragraph_list',{target:text,listKind:{type:'string',enum:['none','number','bullet']},definitionId:integer,level:{type:'integer',minimum:0,maximum:6}}),
  operation('format_paragraph_decoration',{target:text,properties:properties({borderLeft:object({style:{type:'string',enum:['none','solid']},widthMm:number,color:text}),borderRight:object({style:{type:'string',enum:['none','solid']},widthMm:number,color:text}),borderTop:object({style:{type:'string',enum:['none','solid']},widthMm:number,color:text}),borderBottom:object({style:{type:'string',enum:['none','solid']},widthMm:number,color:text}),fillType:{type:'string',enum:['none','solid']},fillColor:text,spacingLeftMm:number,spacingRightMm:number,spacingTopMm:number,spacingBottomMm:number,connect:bool,ignoreMargin:bool})}),
  operation('set_paragraph_tabs',{target:text,stops:{type:'array',maxItems:32,items:object({positionMm:number,alignment:{type:'string',enum:['left','right','center','decimal']},leader:{type:'string',enum:['none','solid','dash','dot']}})},autoLeft:bool,autoRight:bool}),
  operation('add_bookmark',{target:text,offset:integer,name:text}),
  operation('rename_bookmark',{name:text,newName:text}),
  operation('delete_bookmark',{name:text}),
  operation('create_header_footer',{section:integer,story:{type:'string',enum:['header','footer']},pageKind:{type:'string',enum:['both','odd','even']},text}),
  operation('delete_header_footer',{section:integer,story:{type:'string',enum:['header','footer']},pageKind:{type:'string',enum:['both','odd','even']},originalText:text}),
  operation('format_header_footer_paragraph',{section:integer,story:{type:'string',enum:['header','footer']},pageKind:{type:'string',enum:['both','odd','even']},originalText:text,properties:properties({alignment:{type:'string',enum:['left','right','center','justify','distribute']},lineSpacingPercent:{type:'integer',minimum:50,maximum:500}})}),
  operation('format_header_footer',{section:integer,story:{type:'string',enum:['header','footer']},pageKind:{type:'string',enum:['both','odd','even']},originalText:text,properties:properties({bold:bool,italic:bool,underline:bool,fontSizePt:number,color:text})}),
  operation('set_header_footer_text',{section:integer,story:{type:'string',enum:['header','footer']},pageKind:{type:'string',enum:['both','odd','even']},originalText:text,text}),
  operation('merge_sections',{rightSection:{type:'integer',minimum:1}}),
  operation('remove_empty_section',{section:integer}),
  operation('split_section',{target:text,offset:integer}),
  operation('set_master_page_text',{section:integer,pageKind:{type:'string',enum:['both','even','odd']},text,xMm:number,yMm:number,fontSizePt:number,color:text,bold:bool}),
  operation('delete_master_page',{section:integer,pageKind:{type:'string',enum:['both','even','odd']}}),
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
