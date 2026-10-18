import test from 'node:test';
import assert from 'node:assert/strict';
import {validateStoryInformation,readStoryInformation} from '../src/adapters/rhwp/document-story-information.ts';
const counts={paragraphs:1,unicodeScalars:9,utf16Units:10,textScalars:6,nonWhitespaceTextScalars:3};
const fixture=()=>({schemaVersion:1,basis:'canonical-model-paragraphs',counts:{...counts},stories:[{kind:'header',counts:{...counts}}],paragraphs:[{section:0,story:'header',path:'section/0/body/p/0/control/0/header/p/0',text:'가A😀 \t\n\u0000\ufffc\u0085'}],objects:{tables:0,pictures:0,shapes:0,groups:0,charts:0,ole:0,equations:0,fields:0,unknownControls:0},limitations:['Own model, not Hancom statistics']});
test('whole-story census independently checks Unicode scalars, UTF16 and Rust Unicode whitespace',()=>{const value=fixture();assert.deepEqual(validateStoryInformation(value),value);});
test('wrong totals, duplicated ownership, missing groups and injected unsupported stories are refused',()=>{
 for(const change of [(v:any)=>v.counts.textScalars++,(v:any)=>v.paragraphs.push(v.paragraphs[0]),(v:any)=>v.stories=[],(v:any)=>v.stories.push(v.stories[0]),(v:any)=>v.paragraphs[0].story='invented',(v:any)=>v.paragraphs[0].section=1,(v:any)=>v.paragraphs[0].text+='\ud800']){const v=fixture();change(v);assert.throws(()=>validateStoryInformation(v));}
});
test('getter is read-only, returns a copy and distinguishes unsupported/unreadable without partial success',()=>{const raw=fixture(),wasm={getDocumentStoryInformation:()=>JSON.stringify(raw)};assert.deepEqual(readStoryInformation(wasm).value,raw);assert.match(readStoryInformation({}).reason!,/지원하지/);assert.match(readStoryInformation({getDocumentStoryInformation:()=>'{bad'}).reason!,/일부 결과를 전체/);});
