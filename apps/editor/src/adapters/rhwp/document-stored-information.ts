/** Persisted timestamps, never a wall-clock estimate or a save-success stamp. */
export type StoredTime = {state:'absent'} | {state:'value';fileTime100ns:string;utc:string}
  | {state:'invalid';fileTime100ns?:string;rawBlake3?:string};
export type StoredDuration = {state:'absent'} | {state:'value';ticks100ns:string} | {state:'invalid';rawBlake3:string};
export type StoredDocumentInformation = {schemaVersion:1;sourceFormat:'hwp'|'hwpx';created:StoredTime;modified:StoredTime;
  lastPrinted:StoredTime;editingDuration:StoredDuration;issues:string[]};
const exact=(v:object,keys:string[])=>Object.keys(v).sort().join(',')===keys.sort().join(',');
const ticks=(v:unknown):v is string=>typeof v==='string' && /^(0|[1-9]\d{0,19})$/.test(v) && BigInt(v)<=18446744073709551615n;
const hash=(v:unknown)=>typeof v==='string' && /^[0-9a-f]{64}$/.test(v);
const fail=()=>Error('문서에 저장된 날짜·시간 정보의 형식을 확인하지 못했습니다.');
function time(v:any):void {
  if(!v||typeof v!=='object'||Array.isArray(v))throw fail();
  if(v.state==='absent'&&exact(v,['state']))return;
  if(v.state==='invalid' && ((exact(v,['state','rawBlake3'])&&hash(v.rawBlake3))
    ||(exact(v,['state','fileTime100ns'])&&ticks(v.fileTime100ns))))return;
  if(v.state!=='value'||!exact(v,['state','fileTime100ns','utc'])||!ticks(v.fileTime100ns)
      ||typeof v.utc!=='string'||!/^(?:[1-9]\d{3})-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{7}Z$/.test(v.utc))throw fail();
  const milliseconds=Date.parse(v.utc.slice(0,23)+'Z');
  if(!Number.isFinite(milliseconds)||new Date(milliseconds).toISOString()!==v.utc.slice(0,23)+'Z'
      ||BigInt(milliseconds+11644473600000)*10000n+BigInt(v.utc.slice(23,27))!==BigInt(v.fileTime100ns))throw fail();
}
export function validateStoredDocumentInformation(value:unknown):StoredDocumentInformation {
  const v=value as any;
  if(!v||typeof v!=='object'||Array.isArray(v)||!exact(v,['schemaVersion','sourceFormat','created','modified','lastPrinted','editingDuration','issues'])
      ||v.schemaVersion!==1||!['hwp','hwpx'].includes(v.sourceFormat)||!Array.isArray(v.issues)||v.issues.length>100
      ||v.issues.some((s:unknown)=>typeof s!=='string'||s.length>4096))throw fail();
  [v.created,v.modified,v.lastPrinted].forEach(time);const d=v.editingDuration;
  if(!d||typeof d!=='object'||Array.isArray(d)||!((d.state==='absent'&&exact(d,['state']))
      ||(d.state==='value'&&exact(d,['state','ticks100ns'])&&ticks(d.ticks100ns))
      ||(d.state==='invalid'&&exact(d,['state','rawBlake3'])&&hash(d.rawBlake3))))throw fail();
  return structuredClone(v);
}
export function readStoredDocumentInformation(wasm:any):{value?:StoredDocumentInformation;reason?:string} {
  const doc=wasm.borrowDocumentHandle?.()??wasm;
  if(typeof doc.getDocumentStoredInformation!=='function')return{reason:'현재 엔진은 저장된 날짜·시간 정보 조회를 지원하지 않습니다.'};
  try {const raw=doc.getDocumentStoredInformation();return{value:validateStoredDocumentInformation(typeof raw==='string'?JSON.parse(raw):raw)};}
  catch{return{reason:'문서의 날짜·시간 정보를 읽지 못했습니다. 빈 값으로 대체하지 않았습니다.'};}
}
/** Source format changes on conversion. The actual persisted values must not change. */
export function storedInformationForPreservation(value:unknown):Record<string,unknown> {
  const {created,modified,lastPrinted,editingDuration}=validateStoredDocumentInformation(value);
  return{created,modified,lastPrinted,editingDuration};
}
