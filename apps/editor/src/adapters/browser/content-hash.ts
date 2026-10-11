import type {ContentHashPort} from '../../modules/references/public/index.ts';
export const browserContentHash:ContentHashPort={async digest(text){
 const value=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));
 return [...new Uint8Array(value)].map(byte=>byte.toString(16).padStart(2,'0')).join('');
}};
