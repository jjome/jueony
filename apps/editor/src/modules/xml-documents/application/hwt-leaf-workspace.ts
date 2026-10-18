import type {HwtLeafEnginePort,HwtLeafInspection,HwtLeafRequest,HwtLeafRecoveryState} from '../public/hwt-leaf.ts';
const MAX_FILE=32*1024*1024,MAX_HISTORY=32,MAX_TOTAL=64*1024*1024;
const fail=(text:string):never=>{throw Error(text);};
const digest=(x:unknown):x is string=>typeof x==='string'&&/^[0-9a-f]{64}$/.test(x);
const bytes=(x:unknown):x is Uint8Array=>x instanceof Uint8Array&&x.length>0&&x.length<=MAX_FILE&&x.byteOffset===0&&x.buffer.byteLength===x.byteLength;
const dense=(x:unknown):x is Uint8Array[]=>Array.isArray(x)&&x.length<=MAX_HISTORY&&Reflect.ownKeys(x).length===x.length+1&&Reflect.ownKeys(x).every(k=>typeof k==='string'&&(k==='length'||/^(0|[1-9][0-9]*)$/.test(k)&&Number(k)<x.length));
export function assertHwtLeafRecovery(value:unknown):asserts value is HwtLeafRecoveryState {
 if(!value||typeof value!=='object')fail('HWT 복구본이 올바르지 않습니다.');
 const v=value as HwtLeafRecoveryState;
 if(Object.keys(v).sort().join(',')!=='current,future,past,revision,savedSha256,source,version'||v.version!==1||!bytes(v.source)||!bytes(v.current)||!dense(v.past)||!dense(v.future)||v.past.length+v.future.length>MAX_HISTORY||!Number.isSafeInteger(v.revision)||v.revision<0||!digest(v.savedSha256))fail('HWT 복구본의 버전·기록·원문 계약이 올바르지 않습니다.');
 const all=[v.source,v.current,...v.past,...v.future];if(all.some(b=>!bytes(b))||all.reduce((n,b)=>n+b.length,0)>MAX_TOTAL)fail('HWT 복구본 크기 제한을 초과했습니다.');
}
export async function createHwtLeafWorkspace(engine:HwtLeafEnginePort,input:Uint8Array,instance:string){return workspace(engine,input,instance);}
export async function restoreHwtLeafWorkspace(engine:HwtLeafEnginePort,value:unknown,instance:string){assertHwtLeafRecovery(value);return workspace(engine,value.source,instance,value);}
async function workspace(engine:HwtLeafEnginePort,input:Uint8Array,instance:string,recovery?:HwtLeafRecoveryState){
 if(!bytes(input)||typeof instance!=='string'||!instance||instance.length>200)fail('HWT 원본·작업 식별자가 올바르지 않습니다.');
 const source=input.slice();let current=source.slice(),past:Uint8Array[]=[],future:Uint8Array[]=[],revision=0,busy=false;
 let evidence:HwtLeafInspection=await engine.inspect(current.slice()),savedSha256=evidence.sourceSha256;
 if(recovery){
  // Re-run the actual native profile for every restored history state before exposure.
  for(const b of[recovery.source,recovery.current,...recovery.past,...recovery.future])await engine.inspect(b.slice());
  current=recovery.current.slice();past=recovery.past.map(b=>b.slice());future=recovery.future.map(b=>b.slice());revision=recovery.revision;savedSha256=recovery.savedSha256;evidence=await engine.inspect(current.slice());
 }
 function snapshot(){return{instance,revision,sourceSha256:evidence.sourceSha256,dirty:evidence.sourceSha256!==savedSha256,canUndo:past.length>0,canRedo:future.length>0,busy,fields:evidence.fields.map(f=>({...f})),profile:evidence.profile};}
 async function exclusive<T>(run:()=>Promise<T>){if(busy)fail('HWT 작업이 진행 중입니다.');busy=true;try{return await run();}finally{busy=false;}}
 function budget(next:Uint8Array,old:Uint8Array[]){if(old.length>MAX_HISTORY||source.length+next.length+old.reduce((n,b)=>n+b.length,0)>MAX_TOTAL)fail('HWT 되돌리기·복구 기록 한도에 도달했습니다. 사본을 저장한 뒤 다시 여세요.');}
 async function edit(request:HwtLeafRequest){return exclusive(async()=>{
  if(!request||request.instance!==instance||request.revision!==revision||request.sourceSha256!==evidence.sourceSha256)fail('HWT 문서 버전이 바뀌었습니다. 다시 조회해 주세요.');
  const field=evidence.fields.find(f=>f.fieldId===request.fieldId);
  if(!field||field.value!==request.originalText||typeof request.text!=='string'||request.text===field.value)fail('HWT 필드 원문이 바뀌었거나 변경할 내용이 없습니다.');
  const next=await engine.edit(current.slice(),{sourceSha256:request.sourceSha256,fieldId:request.fieldId,originalText:request.originalText,text:request.text});
  if(!bytes(next))fail('HWT 편집 결과가 올바르지 않습니다.');budget(next,[...past,current]);
  const checked=await engine.inspect(next.slice()),expected=evidence.fields.map(f=>f.fieldId===request.fieldId?{...f,value:request.text}:f);
  if(JSON.stringify(checked.fields)!==JSON.stringify(expected))fail('요청하지 않은 HWT 필드·소유 정보가 바뀌어 편집을 반영하지 않았습니다.');
  past.push(current);current=next.slice();future=[];evidence=checked;revision++;return snapshot();
 });}
 async function move(undo:boolean){return exclusive(async()=>{const from=undo?past:future,to=undo?future:past;if(!from.length)fail('실행할 HWT 작업 기록이 없습니다.');const next=from[from.length-1],checked=await engine.inspect(next.slice());from.pop();to.push(current);current=next.slice();evidence=checked;revision++;return snapshot();});}
 function captureRecovery():HwtLeafRecoveryState {const state:HwtLeafRecoveryState={version:1,source:source.slice(),current:current.slice(),past:past.map(b=>b.slice()),future:future.map(b=>b.slice()),revision,savedSha256};assertHwtLeafRecovery(state);return state;}
 return{snapshot,edit,undo:()=>move(true),redo:()=>move(false),captureRecovery,
  async exportArtifact(){return exclusive(async()=>{const checked=await engine.inspect(current.slice());if(JSON.stringify(checked)!==JSON.stringify(evidence))fail('HWT 내보내기 전 검증 결과가 바뀌었습니다.');return{bytes:current.slice(),revision,sourceSha256:evidence.sourceSha256};});},
  markSaved(expectedRevision:number,expectedSha256:string){if(busy||revision!==expectedRevision||evidence.sourceSha256!==expectedSha256)fail('저장 중 HWT 문서가 바뀌었습니다. 저장 완료로 표시하지 않았습니다.');savedSha256=expectedSha256;return snapshot();},
 };
}
export type HwtLeafWorkspace=Awaited<ReturnType<typeof createHwtLeafWorkspace>>;
