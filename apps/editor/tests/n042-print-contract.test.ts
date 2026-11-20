import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateN042PrintManifest,captureN042PrintLayout,compareN042PrintCaptures,classifyN042Failure} from '../scripts/lib/n042-print-contract.mjs';

const manifest=()=>JSON.parse(readFileSync(new URL('./fixtures/n042-print-layout-own/manifest.json',import.meta.url),'utf8'));
const environment=(fingerprint:string|null=null)=>({...manifest().environment,fontFingerprint:fingerprint});
const snapshot=(textX=10,controlX=20,pages=1)=>({pages,semantic:{values:{'section/0/page':{width:59528,height:84188,landscape:false}}},layout:Array.from({length:pages},(_,page)=>({page,text:[{x:textX,text:'본문'}],controls:[{x:controlX,kind:'table'}]}))});

test('N042 manifest fixes paper, DPI and font comparison inputs',()=>{
 const value=validateN042PrintManifest(manifest());
 assert.equal(value.environment.dpi,96);assert.equal(value.environment.paperWidthHwpUnit,59528);assert.deepEqual(value.formats,['hwp','hwpx']);
 for(const mutate of [(v:any)=>v.environment.dpi=0,(v:any)=>v.environment.fontFingerprint='unknown',(v:any)=>v.formats.reverse(),(v:any)=>v.extra=true]){
  const value=manifest();mutate(value);assert.throws(()=>validateN042PrintManifest(value));
 }
});

test('baseline layout comparison separates text reflow, object geometry and page count',()=>{
 const left=captureN042PrintLayout(snapshot(),environment(),'jueony-engine');
 assert.equal(compareN042PrintCaptures(left,structuredClone(left),{mode:'baseline'}).status,'MATCH_WITHIN_CONTRACT');
 const changed=captureN042PrintLayout(snapshot(11,21,2),environment(),'jueony-engine');
 const result=compareN042PrintCaptures(left,changed,{mode:'baseline',tolerance:0.2});
 assert.equal(result.status,'DIFFERENT');
 assert.deepEqual(result.defects.map((item:any)=>item.kind),['PAGE_COUNT_MISMATCH','TEXT_REFLOW','OBJECT_GEOMETRY','PUBLISHED_LAYOUT_DIFFERENCE']);
});

test('cross-producer comparison fails closed without identical environment and font bytes',()=>{
 const left=captureN042PrintLayout(snapshot(),environment(),'jueony-engine');
 const right=captureN042PrintLayout(snapshot(),{...environment(),dpi:120},'hancom-2024');
 const blocked=compareN042PrintCaptures(left,right);
 assert.equal(blocked.status,'BLOCKED');assert.ok(blocked.defects.some((item:any)=>item.kind==='ENVIRONMENT_MISMATCH'));assert.ok(blocked.defects.some((item:any)=>item.kind==='FONT_BINARY_UNVERIFIED'));
 const fingerprint='a'.repeat(64),verifiedLeft=captureN042PrintLayout(snapshot(),environment(fingerprint),'jueony-engine'),verifiedRight=captureN042PrintLayout(snapshot(),environment(fingerprint),'hancom-2024');
 assert.equal(compareN042PrintCaptures(verifiedLeft,verifiedRight).status,'MATCH_WITHIN_CONTRACT');
});

test('capture and failure contracts reject malformed or unbounded evidence',()=>{
 assert.throws(()=>captureN042PrintLayout({pages:2,semantic:{values:{'section/0/page':{width:59528,height:84188,landscape:false}}},layout:[{page:0,text:[],controls:[]}]},environment(),'jueony-engine'));
 const wrongPaper=snapshot();wrongPaper.semantic.values['section/0/page'].width=1;assert.throws(()=>captureN042PrintLayout(wrongPaper,environment(),'jueony-engine'),/paper definition/);
 assert.deepEqual(classifyN042Failure('capture',new Error('broken')),{stage:'capture',code:'LAYOUT_CAPTURE_FAILED',message:'broken'});
 assert.equal(classifyN042Failure('other','x'.repeat(3000)).message.length,2048);
});
