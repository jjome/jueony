import {sha256} from '@noble/hashes/sha2.js';

function canonical(value:unknown):unknown{
  if(Array.isArray(value))return value.map(canonical);
  if(!value||typeof value!=='object')return value;
  const fields=value as Record<string,unknown>;
  return Object.fromEntries(Object.keys(fields).sort().map(key=>[key,canonical(fields[key])]));
}

export function rootObjectSelectionDigest(value:unknown):string{
  const bytes=value instanceof Uint8Array?value:new TextEncoder().encode(JSON.stringify(canonical(value)));
  return Array.from(sha256(bytes),byte=>byte.toString(16).padStart(2,'0')).join('');
}

export function hasRootObjectSelectionIntegrity(bookmark:{integrity:string}):boolean{
  const {integrity,...envelope}=bookmark;
  return rootObjectSelectionDigest(envelope)===integrity;
}
