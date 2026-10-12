export function parseToolbarSize(value:unknown):number {
 const text=String(value).trim().replace(/\s*pt$/i,'');
 if(!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(text))throw new Error('글자 크기는 1~4096pt의 숫자로 입력하세요.');
 const number=Number(text);if(!Number.isFinite(number)||number<1||number>4096)throw new Error('글자 크기는 1~4096pt로 입력하세요.');
 return Math.round(number*100);
}
export function validateToolbarFont(value:unknown):string {
 if(typeof value!=='string'||!value.trim()||value.length>240||/[\x00-\x1f\x7f]/.test(value)||value.startsWith('__fontset__'))throw new Error('글꼴 이름을 확인하세요.');
 return value.trim();
}
export function validateToolbarLanguage(value:unknown):'all'|number {
 if(value==='all')return value;
 if(typeof value!=='string'&&typeof value!=='number')throw new Error('글꼴 언어를 확인하세요.');
 if(typeof value==='string'&&!/^[0-6]$/.test(value))throw new Error('글꼴 언어를 확인하세요.');
 const number=Number(value);if(!Number.isInteger(number)||number<0||number>6)throw new Error('글꼴 언어를 확인하세요.');return number;
}
