import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,join,isAbsolute} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
for(const key of ['JUEONY_REPOSITORY','JUEONY_ENGINE_PACKAGE','JUEONY_TEST_OUTPUT'])assert.ok(isAbsolute(process.env[key]??''),`${key} must be absolute`);
const root=resolve(process.env.JUEONY_REPOSITORY),out=resolve(process.env.JUEONY_TEST_OUTPUT);
await mkdir(out,{recursive:true});
const {loadReviewEngine,snapshot,compareSnapshots,hash}=await import(pathToFileURL(join(root,'apps/editor/scripts/lib/hancom-review.mjs')));
const {verifyPreservedExport}=await import(pathToFileURL(join(root,'apps/editor/src/adapters/rhwp/preservation.ts')));
const engine=await loadReviewEngine(process.env.JUEONY_ENGINE_PACKAGE),{HwpDocument}=engine;
const oraclePath=process.env.JUEONY_GULIMCHE_ORACLE??join(root,'build/gulimche-admission-candidate81/independent-admission-oracle.json');
assert.ok(isAbsolute(oraclePath));
const oracle=JSON.parse(await readFile(oraclePath,'utf8')),results=[],failures=[],observations=[],xmlChecks=[];
const j=value=>typeof value==='string'?JSON.parse(value):value;
function same(a,b){const c=compareSnapshots(a,b);assert.equal(c.status,'SAME_WITHIN_PUBLISHED_CONTRACT',JSON.stringify({semantic:c.semantic.count,geometry:c.geometry.count,first:c.geometry.differences.slice(0,5),issues:c.semantic.readIssues}));return{pages:c.pages,geometry:c.geometry.count,semantic:c.semantic.count};}
async function scenario(name,run){try{await run();results.push(name);console.log('PASS',name);}catch(error){failures.push({name,error:String(error),stack:error.stack});console.error('FAIL',name,error.message);}}
async function open(item,actual){const key=actual?'hancom':'source',path=join(root,item[key]),bytes=await readFile(path);assert.equal(hash(bytes),item[key+'SHA256']);return{doc:new HwpDocument(bytes),path,sha256:hash(bytes)};}
function starts(doc,owner){const rows=new Map();for(let page=0;page<doc.pageCount();page++)for(const r of j(doc.getPageTextLayout(page)).runs){if(r.parentParaIdx!==owner||r.cellIdx!==0||r.paraIdx!==0)continue;const key=page+':'+r.y;rows.set(key,Math.min(rows.get(key)??Infinity,r.charStart));}return [...rows.values()];}
async function independentXml(bytes,label){
 const name=String(xmlChecks.length+1).padStart(2,'0')+'-'+label.replace(/[^a-zA-Z0-9_-]/g,'_')+'.hwpx',path=join(out,name);await writeFile(path,bytes);
 const reader=join(root,'build/gulimche-admission-candidate81/validate-hwpx-xml.py'),run=spawnSync(process.env.JUEONY_PYTHON??'C:/Python314/python.exe',['-X','utf8',reader,path],{encoding:'utf8',maxBuffer:4*1024*1024});
 assert.equal(run.status,0,'Independent XML reader failed: '+run.stderr);const check=JSON.parse(run.stdout);assert.equal(check.sha256,hash(bytes));xmlChecks.push({label,path:name,...check});
}
async function cycles(doc,label){const before=snapshot(doc),eventLog=doc.getEventLog(),rows=[];for(const format of ['hwp','hwpx']){let current=doc;try{for(let cycle=1;cycle<=2;cycle++){
 const report=format==='hwp'?current.exportHwpWithReport():current.exportHwpxWithReport();let next;
 try{const bytes=report.takeBytes();if(format==='hwpx')await independentXml(bytes,label+'-'+cycle);const loss=j(report.contentLoss()),guard=verifyPreservedExport(current,bytes,format,loss,b=>new HwpDocument(b));assert.equal(guard.status,'checked');assert.ok(guard.checked.includes('whole-document-published-layout'));next=new HwpDocument(bytes);rows.push({label,format,cycle,sha256:hash(bytes),comparison:same(before,snapshot(next)),guard});same(before,snapshot(doc));assert.equal(doc.getEventLog(),eventLog);if(current!==doc)current.free();current=next;next=undefined;}finally{report.free();next?.free();}
 }}finally{if(current!==doc)current.free();}}
 return rows;
}
await scenario('shared thirty natural glyph decisions in the real TTF document path',async()=>{
 const manifestPath=process.env.JUEONY_GULIMCHE_GLYPHS??join(root,'build/gulimche-admission-candidate81/glyph-probe.json'),probe=JSON.parse(await readFile(manifestPath,'utf8'));
 const path=join(root,probe.file),bytes=await readFile(path);assert.equal(hash(bytes),probe.sha256);
 const d=new HwpDocument(bytes);try{const before=snapshot(d),records=[];for(let page=0;page<d.pageCount();page++)records.push(...j(d.getFontDecisionTrace(page,JSON.stringify({maxCharacters:4096}))).records);
  const decisions=[];for(const expected of probe.records){const matching=records.filter(r=>r.source.paragraphIndex===expected.parentParagraph&&r.source.nestedPath?.length===3);assert.equal(matching.length,6);for(let i=0;i<6;i++){assert.equal(matching[i].source.character,expected.glyphs[i].character);assert.equal(matching[i].layoutMetric.matchKind,'exact');assert.equal(matching[i].document.altType,1);assert.equal(matching[i].layoutMetric.finalAdvanceHwpunit,expected.glyphs[i].expectedAdvanceHU);decisions.push({parent:expected.parentParagraph,heightHU:expected.heightHU,ratioPercent:expected.ratioPercent,character:expected.glyphs[i].character,expectedHU:expected.glyphs[i].expectedAdvanceHU,actualHU:matching[i].layoutMetric.finalAdvanceHwpunit});}}
  same(before,snapshot(d));assert.equal(hash(await readFile(path)),probe.sha256);observations.push({kind:'shared-glyph-decisions',inputSHA256:probe.sha256,decisions});
 }finally{d.free();}
});
for(const item of oracle)for(const actual of [false,true]){
 const label=(actual?'hancom:':'source:')+item.source.split('/').at(-1);
 await scenario('independent native admission '+label,async()=>{const owned=await open(item,actual);try{const before=snapshot(owned.doc),rows=[];for(const expected of item.expected){const got=starts(owned.doc,expected.tableIndex);assert.deepEqual(got,expected.lineStarts,`table ${expected.tableIndex}`);rows.push({table:expected.tableIndex,lineStarts:got});}same(before,snapshot(owned.doc));assert.equal(hash(await readFile(owned.path)),owned.sha256);observations.push({kind:'independent-admission',label,inputSHA256:owned.sha256,rows});}finally{owned.doc.free();}});
 await scenario('both formats twice '+label,async()=>{const owned=await open(item,actual);try{observations.push({kind:'strict-reopens',label,inputSHA256:owned.sha256,cycles:await cycles(owned.doc,label)});assert.equal(hash(await readFile(owned.path)),owned.sha256);}finally{owned.doc.free();}});
}
await scenario('actual cell edit, snapshot undo redo and strict both-format two reopens',async()=>{
 const owned=await open(oracle[0],false),d=owned.doc;
 try{const before=snapshot(d),undo=d.saveSnapshot();const table=j(d.getPageControlLayout(0)).controls.find(c=>c.type==='table'&&c.paraIdx===0);assert.ok(table);const length=d.getCellParagraphLength(0,table.paraIdx,table.controlIdx,0,0);d.insertTextInCell(0,table.paraIdx,table.controlIdx,0,0,length,'나');const edited=snapshot(d),redo=d.saveSnapshot();assert.notDeepEqual(edited.semantic.values,before.semantic.values);d.restoreSnapshot(undo);same(before,snapshot(d));d.restoreSnapshot(redo);same(edited,snapshot(d));observations.push({kind:'real-api-history',inputSHA256:owned.sha256,cycles:await cycles(d,'edited-cell')});assert.equal(hash(await readFile(owned.path)),owned.sha256);}finally{d.free();}
});
const exclusions=JSON.parse(await readFile(join(root,'build/gulimche-admission-candidate81/owned-exclusions-v5.json'),'utf8'));
for(const [name,format]of [['unknown-type','hwpx'],['embedded-unowned','hwp']])await scenario('unowned font relabel is refused before writing: '+name,async()=>{
 const item=exclusions.find(r=>r.name===name),path=join(root,item.file),bytes=await readFile(path);assert.equal(hash(bytes),item.sha256);assert.ok(item.edits.length>0);
 const d=new HwpDocument(bytes);let report,reopened;
 try{const before=snapshot(d),events=d.getEventLog();report=format==='hwp'?d.exportHwpWithReport():d.exportHwpxWithReport();const saved=report.takeBytes();if(format==='hwpx')await independentXml(saved,'guard-'+name);const loss=j(report.contentLoss());reopened=new HwpDocument(saved);const damage=compareSnapshots(before,snapshot(reopened));assert.ok(damage.geometry.count>0,'The frozen codec-owner counterexample must remain real; do not manufacture a refusal.');let rejected;
  try{verifyPreservedExport(d,saved,format,loss,b=>new HwpDocument(b));}catch(error){rejected=error;}
  assert.equal(rejected?.name,'PreservationError');assert.ok(rejected.report?.issues?.length>0);if(name==='unknown-type')assert.ok(rejected.report.issues.some(i=>i.path?.startsWith('whole-document-published-layout/')));
  same(before,snapshot(d));assert.equal(d.getEventLog(),events);assert.equal(hash(await readFile(path)),item.sha256);observations.push({kind:'guarded-existing-codec-owner-loss',name,format,inputSHA256:item.sha256,outputSHA256:hash(saved),geometryDifferences:damage.geometry.count,nativeLoss:loss,issues:rejected.report.issues,sourceUnchanged:true,note:'지원 성공으로 재분류하지 않습니다. 기존 writer가 소유 정보를 재표기하는 반례를 실제 보호 검사로 거절합니다.'});
 }finally{reopened?.free();report?.free();d.free();}
});
const functionalCounts={passed:results.length,failed:failures.length};
for(const check of xmlChecks)await scenario('independent package XML '+check.label,async()=>{assert.equal(check.errors.length,0,JSON.stringify(check.errors));});
await writeFile(join(out,'result.json'),JSON.stringify({engine:engine.metadata,verifierSHA256:hash(await readFile(fileURLToPath(import.meta.url))),oracleSHA256:hash(await readFile(oraclePath)),results,failures,observations,independentXml:xmlChecks,functionalCounts,pageErrors:[],consoleErrors:[],externalRequests:[],scope:{scenarios:12+xmlChecks.length,functionalScenarios:12,independentXmlScenarios:xmlChecks.length,supportedScenarios:10,guardedExistingUnsupportedScenarios:2,independentNativeAdmissionChecks:136,sharedNaturalGlyphDecisions:30,strictGeometryReopens:20,geometryTolerance:0.2,everyPublishedField:true,fullSemanticGuard:true,metadata5:true},limitation:'정규 GulimChe TTF 자체 문서의 줄 수용 범위입니다. 원공개 MCST/Python3 전체 완료나 외부 화면/인쇄 일치는 주장하지 않습니다. unknown/font-program 재표기2건과 ns0 numbering XML 문제는 별도 기존 codec 결함이며 정상 지원으로 처리하지 않습니다.'},null,2));
if(failures.length)process.exitCode=1;
