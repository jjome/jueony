/** Agent names are stricter than legacy interactive style-dialog input. */
export function normalizedAgentStyleName(value:unknown):string {
 if(typeof value!=='string')throw new Error('스타일 이름을 입력하세요.');const name=value.normalize('NFC');
 if(!name.length||name.length>80||name.trim()!==name||/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/u.test(name))throw new Error('스타일 이름은 앞뒤 공백·제어문자 없이 1~80자로 입력하세요.');
 return name;
}
