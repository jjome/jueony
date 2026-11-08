import test from 'node:test';
import assert from 'node:assert/strict';
import {createStyleShortcutProfileStore,STYLE_SHORTCUT_PROFILE_KEY} from '../src/adapters/browser/style-shortcut-profile.ts';

const hash=(value:string)=>value.repeat(64).slice(0,64);
const evidence=()=>({version:1 as const,profileId:'ministry.report',profileName:'기관 보고서',entryId:'annual',profileSha256:hash('a'),documentSha256:hash('b'),expectedStyleIds:[11],slots:[{slot:0,styleId:11,styleName:'기관 제목',source:'package' as const},{slot:9,styleId:2,styleName:'본문',source:'document' as const}]});
function memory(){const values=new Map<string,string>();return{values,storage:{getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{values.set(key,value);},removeItem:(key:string)=>{values.delete(key);}}};}

test('verified preview saves atomically and survives restart without private preview fields',()=>{
  const state=memory(),store=createStyleShortcutProfileStore(state.storage),source=evidence(),saved=store.save(source,()=>structuredClone(source));
  assert.equal(saved.format,'jueony-style-shortcut-profile');assert.equal(JSON.parse(state.values.get(STYLE_SHORTCUT_PROFILE_KEY)!).expectedStyleIds,undefined);assert.deepEqual(createStyleShortcutProfileStore(state.storage).read(),saved);
});

test('profile, document, slot and style-ID stale plans fail before storage mutation',()=>{
  for(const change of [(v:any)=>v.profileSha256=hash('c'),(v:any)=>v.documentSha256=hash('d'),(v:any)=>v.slots[0].slot=1,(v:any)=>{v.slots[0].styleId=12;v.expectedStyleIds=[12];}]){const state=memory(),store=createStyleShortcutProfileStore(state.storage),first=evidence();store.save(first,()=>first);const before=state.values.get(STYLE_SHORTCUT_PROFILE_KEY),current=structuredClone(first);change(current);assert.throws(()=>store.save(first,()=>current),/바뀌었습니다/);assert.equal(state.values.get(STYLE_SHORTCUT_PROFILE_KEY),before);}
  const state=memory(),store=createStyleShortcutProfileStore(state.storage),before=state.values.get(STYLE_SHORTCUT_PROFILE_KEY);assert.throws(()=>store.save(evidence(),()=>{throw new Error('unavailable');}),/다시 검증/);assert.equal(state.values.get(STYLE_SHORTCUT_PROFILE_KEY),before);
});

test('corrupt and future settings refuse overwrite and preserve exact raw value',()=>{
  for(const raw of ['{broken',JSON.stringify({...evidence(),format:'jueony-style-shortcut-profile',version:2})]){const state=memory();state.values.set(STYLE_SHORTCUT_PROFILE_KEY,raw);const store=createStyleShortcutProfileStore(state.storage);assert.throws(()=>store.save(evidence(),()=>evidence()),/손상|버전/);assert.equal(state.values.get(STYLE_SHORTCUT_PROFILE_KEY),raw);}
});

test('write or readback failure restores the previous raw settings',()=>{
  const state=memory(),base=createStyleShortcutProfileStore(state.storage),first=evidence();base.save(first,()=>first);const before=state.values.get(STYLE_SHORTCUT_PROFILE_KEY)!;let fail=true;
  const storage={getItem:state.storage.getItem,removeItem:state.storage.removeItem,setItem:(key:string,value:string)=>{state.values.set(key,value);if(fail){fail=false;throw new Error('quota after write');}}},store=createStyleShortcutProfileStore(storage),next={...first,profileName:'변경 기관 보고서'};
  assert.throws(()=>store.save(next,()=>next),/기존 설정을 유지/);assert.equal(state.values.get(STYLE_SHORTCUT_PROFILE_KEY),before);assert.deepEqual(store.read(),base.read());
});

test('invalid and conflicting slot evidence never writes',()=>{
  for(const mutate of [(v:any)=>v.slots.push({...v.slots[0]}),(v:any)=>v.slots[0].slot=10,(v:any)=>v.slots[0].styleId=256,(v:any)=>v.expectedStyleIds=[]]){const state=memory(),value=evidence();mutate(value);assert.throws(()=>createStyleShortcutProfileStore(state.storage).save(value,()=>value));assert.equal(state.values.size,0);}
});
