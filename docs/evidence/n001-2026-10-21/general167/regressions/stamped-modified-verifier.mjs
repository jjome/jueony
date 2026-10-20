import assert from 'node:assert/strict';
import{readFile,writeFile,mkdir}from'node:fs/promises';
import{resolve}from'node:path';
import{loadReviewEngine,snapshot,compareSnapshots,hash}from'../../apps/editor/scripts/lib/hancom-review.mjs';
import{verifyPreservedExport}from'../../apps/editor/src/adapters/rhwp/preservation.ts';
const out=resolve(process.env.JUEONY_TEST_OUTPUT);await mkdir(out,{recursive:true});
const engine=await loadReviewEngine(process.env.JUEONY_ENGINE_PACKAGE),{HwpDocument}=engine;
const manifest=await readFile(process.env.JUEONY_STAMP_MATRIX);assert.equal(hash(manifest),'ef71e2f9f039ed9c5425c41015f2d760788db83bfc8edb1b119744eb878f66b9');const matrix=JSON.parse(manifest);assert.equal(matrix.fixtures.length,19);
function edit(d,fixture){
 if(fixture.kind==='signed')d.insertText(0,0,d.getParagraphLength(0,0),'Signed negative current prefix reflows across columns. '.repeat(8));
 else if(fixture.kind==='caption'){d.insertText(0,0,0,'Public prefix wrap 🪶. '.repeat(12));d.insertTextInCell(0,1,0,65534,0,0,'Edited caption 🪶. ');}
 else {const l=JSON.parse(d.getCursorModel()).lists.find(l=>l.isCell);assert.ok(l);d.insertTextInCell(l.sectionIndex,l.hostPara,l.controlIndex,l.cellIndex,0,3,'실제😀𠮷편집 ');}
}
const results=[],observations=[];let d,expected;
for(const fixture of matrix.fixtures)for(const origin of ['hwp','hwpx'])for(const format of ['hwp','hwpx'])for(const encrypted of [false,true])for(const mode of ['noop','modified']){
 const row={name:`${fixture.id}-${origin}-${format}-${encrypted?'password':'plain'}-${mode}`};let phase='setup';
 try{const input=await readFile(fixture[origin]);assert.equal(hash(input),fixture[origin==='hwp'?'nativeSha256':'xmlSha256']);d=new HwpDocument(input);
 const original=snapshot(d),undo=d.saveSnapshot();
 edit(d,fixture);
 const edited=snapshot(d),redo=d.saveSnapshot();d.restoreSnapshot(undo);assert.deepEqual(snapshot(d),original);d.restoreSnapshot(redo);assert.deepEqual(snapshot(d),edited);

 const state=JSON.parse(d.getDocumentStoredInformationEditState());assert.equal(state.editable,true);assert.equal(state.information.modified.state,'value');
 const tick=(BigInt(state.information.modified.fileTime100ns)+(mode==='modified'?100n:0n)).toString(),request=JSON.stringify({schemaVersion:1,values:{modified:tick}});assert.equal(JSON.parse(d.previewDocumentStoredInformation(state.fingerprint,request)).changed,mode==='modified');
 expected=d;
 if(mode==='modified'){expected=new HwpDocument(input);edit(expected,fixture);assert.deepEqual(snapshot(expected),snapshot(d));const es=JSON.parse(expected.getDocumentStoredInformationEditState());assert.equal(es.fingerprint,state.fingerprint);const res=JSON.parse(expected.setDocumentStoredInformation(es.fingerprint,request));assert.equal(res.changed,true);assert.equal(res.information.modified.fileTime100ns,tick);assert.deepEqual(snapshot(expected).layout,snapshot(d).layout);}
 const wanted=snapshot(expected);
 const before=snapshot(d),events=d.getEventLog(),pw=encrypted?'NoopStamp167':'';phase='stamped-export';
 const a=pw?d.exportStampedDocumentWithPasswordAndReport(format,state.fingerprint,request,new TextEncoder().encode(pw)):d.exportStampedDocumentWithReport(format,state.fingerprint,request);let bytes,loss,receipt;try{bytes=Buffer.from(a.takeBytes());loss=JSON.parse(a.contentLoss());receipt=JSON.parse(a.metadataIntent());}finally{a.free();}assert.equal(loss.count,0);assert.equal(receipt.changed,mode==='modified');assert.equal(receipt.originalFingerprint,state.fingerprint);assert.equal(receipt.stampedFingerprint,JSON.parse(expected.getDocumentStoredInformationEditState()).fingerprint);assert.equal(receipt.requestedValues.modified,tick);
 phase='strict-production-guard';const open=b=>pw?HwpDocument.openWithPassword(b,pw):new HwpDocument(b);const guard=verifyPreservedExport(expected,bytes,format,loss,open);assert.equal(guard.status,'checked');
 phase='disk-reopen';const path=resolve(out,row.name+'.'+format);await writeFile(path,bytes);const disk=await readFile(path);assert.deepEqual(disk,bytes);const n=open(disk);try{assert.equal(compareSnapshots(wanted,snapshot(n)).status,'SAME_WITHIN_PUBLISHED_CONTRACT');}finally{n.free();}
 assert.deepEqual(snapshot(d),before);assert.equal(d.getEventLog(),events);assert.equal(d.getDocumentStoredInformationEditState(),JSON.stringify(state));observations.push({name:row.name,file:path,sha256:hash(disk),sourceAndEventsUnchanged:true});row.status='PASS';
 }catch(e){row.status='FAIL';row.phase=phase;row.error=String(e?.stack??e);}finally{if(expected&&expected!==d)expected.free();d?.free();d=null;expected=null;}results.push(row);await writeFile(resolve(out,'result.json'),JSON.stringify({engine:engine.metadata,verifierSha256:hash(await readFile(import.meta.filename)),fixtureManifestSha256:hash(manifest),results,observations,pass:results.filter(x=>x.status==='PASS').length,fail:results.filter(x=>x.status==='FAIL').length,scope:'No-op plus explicit modified timestamp: independent original input replay + public setDocumentStoredInformation creates expected document; unchanged full production preservation +0.2 geometry guard receives that independent expected instance. No expected metadata exclusion, no source mutation, Native/XML and both password formats. Baseline evidence may contain failures; success requires every304 positive.'},null,2));
}
console.log(JSON.stringify({total:results.length,passed:results.filter(x=>x.status==='PASS').length,failed:results.filter(x=>x.status==='FAIL').length}));
