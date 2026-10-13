/** Explicit, app-local clipboard. Never persisted or automatically added to Agent context. */
export interface PageBodyClipboard {version:1;bytes:Uint8Array;texts:string[]}
export function validatePageBodyClipboard(value:unknown):PageBodyClipboard {
 const c=value as PageBodyClipboard;
 if(!c||c.version!==1||!ArrayBuffer.isView(c.bytes)||Object.prototype.toString.call(c.bytes)!=='[object Uint8Array]'||c.bytes.length===0||c.bytes.length>32*1024*1024||!Array.isArray(c.texts)||c.texts.length<1||c.texts.length>1000||c.texts.some(t=>typeof t!=='string')||c.texts.reduce((n,t)=>n+[...t].length,0)>100000)throw new Error('쪽 복사 자료의 형식이나 크기가 유효하지 않습니다.');
 return {version:1,bytes:new Uint8Array(c.bytes),texts:[...c.texts]};
}
