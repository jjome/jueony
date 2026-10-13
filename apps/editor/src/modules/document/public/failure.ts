export type DocumentFailure={name:string;message:string};
/** Embedded editors have a different Error constructor. Read only known error tags. */
export function readDocumentFailure(value:unknown):DocumentFailure {
 if(typeof value==='string')return {name:'Error',message:value};
 if(value&&typeof value==='object')try{
  const tag=Object.prototype.toString.call(value),error=value as {name?:unknown;message?:unknown};
  if(['[object Error]','[object DOMException]'].includes(tag)&&typeof error.message==='string')return {name:typeof error.name==='string'?error.name:'Error',message:error.message};
 }catch{/* A throwing property/tag is not a portable editor failure. */}
 return {name:'Error',message:'실행 오류'};
}
