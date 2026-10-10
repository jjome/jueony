import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LocalLLMPort } from '../src/mvp/llm.ts';
test('구버전 서버에는 새 문서 명령이나 인증 설정을 보내지 않는다', async () => {
 const original = globalThis.fetch, calls: string[] = [];
 try {
   globalThis.fetch = (async (url: any) => { calls.push(String(url)); return new Response(JSON.stringify({ token: 'test-only' }), { status: 200 }); }) as typeof fetch;
   await assert.rejects(new LocalLLMPort().connections(), /이전 AI 서버/);
   assert.deepEqual(calls, ['/api/session']);
 } finally { globalThis.fetch = original; }
});
test('문서 제어가 있어도 새 제공자를 지원하지 않는 서버에는 요청하지 않는다',async()=>{
 const original=globalThis.fetch,calls:string[]=[];
 try{
  globalThis.fetch=(async(url:any)=>{calls.push(String(url));return new Response(JSON.stringify({token:'test-only',documentControlVersion:1}),{status:200});}) as typeof fetch;
  await assert.rejects(new LocalLLMPort().connections(),/이전 AI 서버/);assert.deepEqual(calls,['/api/session']);
 }finally{globalThis.fetch=original;}
});
