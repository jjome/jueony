import {test} from 'node:test';
import assert from 'node:assert/strict';
import {TemporaryReferences} from '../src/mvp/temporary-references.ts';
import {readReferences} from '../src/mvp/references.ts';

const signal=()=>new AbortController().signal;
test('temporary attachments isolate chats/workspaces, deduplicate, remove and do not survive a new store',()=>{
 const store=new TemporaryReferences(),file=new File(['업무 A'],'자료.txt',{lastModified:1});
 store.add('w','c',[file,file]);store.add('w','d',[file]);store.add('other','c',[file]);
 assert.equal(store.list('w','c').length,1);assert.equal(store.list('other','c').length,1);
 store.remove('other','c',store.list('w','c')[0].id);assert.equal(store.list('w','c').length,1);
 store.remove('w','c',store.list('w','c')[0].id);assert.equal(store.list('w','c').length,0);assert.equal(store.list('w','d').length,1);
 assert.equal(new TemporaryReferences().list('w','d').length,0);
});
test('attachment validation rejects the entire batch for invalid format, oversize or too many files',()=>{
 const store=new TemporaryReferences(),file=new File(['a'],'a.txt');
 assert.throws(()=>store.add('w','c',[file,new File(['binary'],'b.pdf')]),/HWP/);
 assert.equal(store.list('w','c').length,0);
 assert.throws(()=>store.add('w','c',[new File([new Uint8Array(16*1024*1024+1)],'large.hwpx')]),/16MB/);
 assert.throws(()=>store.add('w','c',Array.from({length:21},(_,i)=>new File(['a'],i+'.txt'))),/20개/);
});
test('folderless HWP extraction, hash and explicit limits accompany the transmitted text',async()=>{
 const store=new TemporaryReferences();store.add('w','c',[new File(['utf8 한글'],'a.md'),new File(['hwp bytes'],'b.hwpx')]);
 let parsed=0;const parse=async(bytes:Uint8Array)=>{parsed++;assert.equal(new TextDecoder().decode(bytes),'hwp bytes');return '추출문';};
 const result=await readReferences([],[],'w',parse,signal(),undefined,{chatId:'c',items:store.list('w','c')});
 assert.deepEqual(result.map(s=>s.text),['utf8 한글','추출문']);assert.equal(parsed,1);
 assert.match(result[1].limitation!,/OCR 제외/);assert.equal(result[0].sha256.length,64);
 await assert.rejects(readReferences([],[],'w',parse,signal(),undefined,{chatId:'other',items:store.list('w','c')}),/다른 업무 또는 채팅/);
 await assert.rejects(readReferences([],[],'other',parse,signal(),undefined,{chatId:'c',items:store.list('w','c')}),/다른 업무 또는 채팅/);
});
test('linked and temporary sources share count/text budgets; invalid encoding and cancellation fail before generation',async()=>{
 const store=new TemporaryReferences();store.add('w','c',[new File(['a'.repeat(120001)],'huge.txt')]);
 await assert.rejects(readReferences([],[],'w',async()=>'',signal(),undefined,{chatId:'c',items:store.list('w','c')}),/120,000/);
 const tooMany=Array.from({length:21},(_,i)=>({id:String(i),workspaceId:'w',chatId:'c',file:new File(['a'],i+'.txt')}));
 await assert.rejects(readReferences([],[],'w',async()=>'',signal(),undefined,{chatId:'c',items:tooMany}),/20개/);
 const invalid=[{...tooMany[0],file:new File([new Uint8Array([0xff])],'bad.txt')}];
 await assert.rejects(readReferences([],[],'w',async()=>'',signal(),undefined,{chatId:'c',items:invalid}));
 const controller=new AbortController();controller.abort();
 await assert.rejects(readReferences([],[],'w',async()=>'',controller.signal,undefined,{chatId:'c',items:invalid}),{name:'AbortError'});
});
