import {generationSchema} from './generation-contract.mjs';
import {parseGeneration,fail} from './native-common.mjs';

const kinds=generationSchema().properties.operations.items.anyOf.map(v=>v.properties.kind.enum[0]);

// Even a schema below Claude's optional/union limits can exceed its compiled
// grammar limit. Keep the wire envelope small and validate decoded arguments
// with the application's existing document-aware command validators.
export function anthropicSchema(referenceIds=[]) {
 return {
  type:'object',additionalProperties:false,required:['message','sourceIds','operations'],
  properties:{
   message:{type:'string'},
   sourceIds:{type:'array',items:referenceIds.length?{type:'string',enum:[...new Set(referenceIds)]}:{type:'string'}},
   operations:{type:'array',items:{
    type:'object',additionalProperties:false,required:['kind','arguments'],
    properties:{kind:{type:'string',enum:kinds},arguments:{type:'string',description:'JSON object containing the documented fields for this operation, excluding kind. Keep properties as a sparse object; omit unchanged fields.'}},
   }},
  },
 };
}

export const ANTHROPIC_FORMAT_INSTRUCTION='\nClaude wire encoding: each operations entry has exactly two fields: kind (the documented operation name) and arguments (a JSON-encoded STRING containing all other documented operation fields, excluding kind). For example '+JSON.stringify({kind:'format_characters',arguments:JSON.stringify({target:'s0p0',properties:{bold:true,fontSizePt:16}})})+'. Inside arguments keep properties as the documented sparse object; include only requested changes. create_document arguments contain paragraphs. Do not place operation fields outside arguments. The app parses arguments and validates targets, types, allowed fields, ranges, source IDs, and document revision before any edit. Unsupported operations must not be returned.';

export function parseAnthropicGeneration(text) {
 const result=parseGeneration(text);
 if(result.operations.length>30)fail('invalid_response','Claude 편집 명령은 최대 30개입니다. 문서를 변경하지 않았습니다.');
 result.operations=result.operations.map(op=>{
  if(!op||typeof op!=='object'||Array.isArray(op)||Object.keys(op).length!==2||!kinds.includes(op.kind)||typeof op.arguments!=='string')fail('invalid_response','Claude 편집 명령 형식이 올바르지 않습니다. 문서를 변경하지 않았습니다.');
  let args;try{args=JSON.parse(op.arguments);}catch{fail('invalid_response','Claude 편집 인자가 올바른 JSON이 아닙니다. 문서를 변경하지 않았습니다.');}
  if(!args||typeof args!=='object'||Array.isArray(args)||Object.hasOwn(args,'kind'))fail('invalid_response','Claude 편집 인자는 명령 종류를 제외한 객체여야 합니다. 문서를 변경하지 않았습니다.');
  // Preserve all fields for semantic rejection; never hide unknown fields or coerce values.
  return {kind:op.kind,...args};
 });
 return result;
}
