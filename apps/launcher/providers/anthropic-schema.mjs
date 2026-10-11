import {nativeSchema,parseGeneration,fail} from './native-common.mjs';

// Claude caps optional fields across the entire schema at 24. Formatting alone
// has 44. Send sparse typed entries, then restore the provider-neutral object.
// Do not make every formatting field required: that could overwrite untouched styles.
export function anthropicSchema(referenceIds=[]) {
 const schema=nativeSchema(referenceIds);
 for(const operation of schema.properties.operations.items.anyOf) {
  const fields=operation.properties.properties;
  if(!fields)continue;
  const groups=new Map();
  for(const [name,definition] of Object.entries(fields.properties)) {
   const names=groups.get(definition.type)??[];names.push(name);groups.set(definition.type,names);
  }
  operation.properties.properties={type:'array',description:'Only formatting properties explicitly requested. Omit unchanged properties. Each name must be unique.',items:{anyOf:[...groups].map(([type,names])=>({
   type:'object',additionalProperties:false,required:['name','value'],
   properties:{name:{type:'string',enum:names},value:{type}},
  }))}};
 }
 return schema;
}

export const ANTHROPIC_FORMAT_INSTRUCTION='\nClaude output encoding: in format_characters, format_paragraph, format_table_cells and set_page_setup, encode properties as an array of {name,value} entries, NOT an object. For example properties:[{"name":"bold","value":true},{"name":"fontSizePt","value":16}]. Include only requested changes; do not invent defaults or repeat names. All other operation fields remain as documented.';

export function parseAnthropicGeneration(text) {
 const result=parseGeneration(text),variants=nativeSchema([]).properties.operations.items.anyOf;
 for(const op of result.operations) {
  const fields=variants.find(v=>v.properties.kind.enum[0]===op?.kind)?.properties.properties?.properties;
  if(!fields)continue;
  if(!Array.isArray(op.properties)||!op.properties.length||op.properties.length>Object.keys(fields).length)fail('invalid_response','Claude 서식 변경 응답이 올바르지 않습니다. 문서를 변경하지 않았습니다.');
  const properties={};
  for(const entry of op.properties) {
   const definition=entry&&typeof entry.name==='string'&&Object.hasOwn(fields,entry.name)?fields[entry.name]:undefined;
   if(!definition||Object.keys(entry).length!==2||!Object.hasOwn(entry,'value')||Object.hasOwn(properties,entry.name))fail('invalid_response','Claude 서식 변경에 알 수 없거나 중복된 속성이 있습니다. 문서를 변경하지 않았습니다.');
   const value=entry.value;
   if(definition.type==='integer'?!Number.isInteger(value):typeof value!==definition.type||(definition.type==='number'&&!Number.isFinite(value)))fail('invalid_response','Claude 서식 값의 형식이 올바르지 않습니다. 문서를 변경하지 않았습니다.');
   properties[entry.name]=value;
  }
  op.properties=properties;
 }
 return result;
}
