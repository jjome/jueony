// Actual current-layout preservation for the fixed unequal three-column input.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,access} from 'node:fs/promises';
import {resolve,join,isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
import {pathToFileURL} from 'node:url';
const clean=resolve(fileURLToPath(new URL('../../..',import.meta.url)));
const {loadReviewEngine,snapshot,compareSnapshots,hash}=await import(pathToFileURL(resolve(clean,'apps/editor/scripts/lib/hancom-review.mjs')).href);
const {verifyPreservedExport}=await import(pathToFileURL(resolve(clean,'apps/editor/src/adapters/rhwp/preservation.ts')).href);

for(const key of ['JUEONY_ENGINE_PACKAGE','JUEONY_TEST_OUTPUT'])assert.ok(isAbsolute(process.env[key]??''),key+' must be absolute');
const root=resolve(clean),out=resolve(process.env.JUEONY_TEST_OUTPUT),verifierPath=fileURLToPath(import.meta.url),verifierSha256=hash(await readFile(verifierPath));
try{await access(join(out,'result.json'));throw Error('A fresh output directory is required');}catch(e){if(e.code!=='ENOENT')throw e;}
await mkdir(out,{recursive:true});
const engine=await loadReviewEngine(process.env.JUEONY_ENGINE_PACKAGE),{HwpDocument}=engine;
const manifestPath=resolve(root,'apps/editor/tests/fixtures/n001-absolute168-own/manifest.json'),manifestBytes=await readFile(manifestPath),manifest=JSON.parse(manifestBytes);
const windowsPath=p=>p.startsWith('/mnt/c/')?'C:/'+p.slice(7):resolve(root,p);
const sourceHashes=await Promise.all(['preservation.ts','document-stored-information.ts','document-save-layout.ts','overlap-save-layout.ts'].map(async file=>({path:file,sha256:hash(await readFile(join(root,'apps/editor/src/adapters/rhwp',file)))})));
const results=[],failures=[],observations=[];let wrongPasswordRefusals=0,historyPairs=0;
const points=s=>Array.from(s),json=x=>typeof x==='string'?JSON.parse(x):x;
function artifact(d,format,pwd=''){
 const a=format==='hwp'?(pwd?d.exportHwpWithPasswordAndReport(pwd):d.exportHwpWithReport()):(pwd?d.exportHwpxWithPasswordAndReport(pwd):d.exportHwpxWithReport());
 try{return{bytes:Buffer.from(a.takeBytes()),loss:json(a.contentLoss())};}finally{a.free();}
}
const open=(bytes,pwd)=>pwd?HwpDocument.openWithPassword(bytes,pwd):new HwpDocument(bytes);
function bodyCoverage(d){
 const runs=Array.from({length:d.pageCount()},(_,p)=>json(d.getPageTextLayout(p)).runs).flat(),stories=[];
 const check=(expected,owned,address)=>{let seen='',at=0;for(const r of runs.filter(owned)){assert.equal(r.charStart,at,'scalar source start');assert.equal(r.charX.length,points(r.text).length+1,'scalar boundaries plus end');assert.ok(r.charX.every(Number.isFinite));seen+=r.text;at+=points(r.text).length;}assert.equal(seen,expected,'all story text exactly once');stories.push({...address,scalars:at,utf16:seen.length});};
 for(let s=0;s<d.getSectionCount();s++)for(let p=0;p<d.getParagraphCount(s);p++){const n=d.getParagraphLength(s,p);check(d.getTextRange(s,p,0,n),r=>r.secIdx===s&&r.paraIdx===p&&!Object.hasOwn(r,'parentParaIdx'),{section:s,paragraph:p});}
 const lists=json(d.getCursorModel()).lists;for(const l of lists){assert.ok(l.isCell,'own fixtures contain only body/cell stories');assert.equal(l.hostListId,0,'own fixtures have no nested table');for(let cp=0;cp<l.paraCount;cp++){const s=l.sectionIndex,p=l.hostPara,c=l.controlIndex,cell=l.cellIndex,n=d.getCellParagraphLength(s,p,c,cell,cp);check(d.getTextInCell(s,p,c,cell,cp,0,n),r=>r.secIdx===s&&r.parentParaIdx===p&&r.controlIdx===c&&r.cellIdx===cell&&r.cellParaIdx===cp,{section:s,paragraph:p,control:c,cell,cellParagraph:cp});}}
 return stories;
}
async function save(d,format,pwd,label){
 const before=snapshot(d),events=d.getEventLog(),source=artifact(d,'hwp').bytes,coverage=bodyCoverage(d),a=artifact(d,format,pwd);
 assert.equal(a.loss.count,0,JSON.stringify(a.loss));const guard=verifyPreservedExport(d,a.bytes,format,a.loss,b=>open(b,pwd));assert.equal(guard.status,'checked');
 const file=join(out,label+'.'+format);await writeFile(file,a.bytes);const disk=await readFile(file);assert.deepEqual(disk,a.bytes);
 if(pwd){assert.throws(()=>HwpDocument.openWithPassword(disk,'incorrect-own154-password'));wrongPasswordRefusals++;}
 const next=open(disk,pwd);
 try{
  assert.equal(compareSnapshots(before,snapshot(next)).status,'SAME_WITHIN_PUBLISHED_CONTRACT');assert.deepEqual(bodyCoverage(next),coverage);
  assert.deepEqual(snapshot(d),before);assert.equal(d.getEventLog(),events);assert.deepEqual(artifact(d,'hwp').bytes,source);
  observations.push({label,format,encrypted:!!pwd,guard:guard.status,sha256:hash(disk),coverage});return next;
 }catch(e){next.free();throw e;}
}
const payload='현재😀 𠮷 known absolute origin prefix reflows across columns. '.repeat(15);
for(const fixture of manifest.fixtures)for(const origin of ['native','xml'])for(const encrypted of [false,true]){
 const name=`${fixture.name}-${origin}-${encrypted?'password':'plain'}`,pwd=encrypted?'OwnAbsolute159-password':'',path=windowsPath(fixture[origin]),input=await readFile(path);
 const expected=fixture[origin+'Sha256'];assert.equal(hash(input),expected);
 let d=new HwpDocument(input),phase='public-edit';
 try{
  const initial=snapshot(d),undo=d.saveSnapshot(),original=d.getTextRange(0,0,0,d.getParagraphLength(0,0));if(payload)d.insertText(0,0,d.getParagraphLength(0,0),payload);
  assert.equal(d.getTextRange(0,0,0,d.getParagraphLength(0,0)),original+payload,'the requested public edit must actually change the source text');
  const edited=snapshot(d),redo=d.saveSnapshot();d.restoreSnapshot(undo);assert.deepEqual(snapshot(d),initial);d.restoreSnapshot(redo);assert.deepEqual(snapshot(d),edited);historyPairs++;
  for(const [cycle,format]of ['hwpx','hwpx','hwpx','hwp','hwpx'].entries()){
   phase='disk-cycle-'+cycle;const next=await save(d,format,pwd,`${name}-${cycle}`);d.free();d=next;
  }
  phase='retained-tail-edit';const paragraph=d.getParagraphCount(0)-1,before=snapshot(d),u=d.saveSnapshot(),tail=d.getTextRange(0,paragraph,0,d.getParagraphLength(0,paragraph));d.insertText(0,paragraph,0,'후속 😀 tail154 ');
  assert.equal(d.getTextRange(0,paragraph,0,d.getParagraphLength(0,paragraph)),'후속 😀 tail154 '+tail,'the retained tail edit must actually change the source text');const after=snapshot(d),r=d.saveSnapshot();
  for(const format of ['hwp','hwpx']){const next=await save(d,format,pwd,name+'-tail');next.free();}
  d.restoreSnapshot(u);assert.deepEqual(snapshot(d),before);d.restoreSnapshot(r);assert.deepEqual(snapshot(d),after);historyPairs++;results.push({name,status:'PASS'});console.log('PASS',name);
 }catch(e){const row={name,status:'FAIL',phase,error:String(e),stack:e.stack,report:e.report};results.push(row);failures.push(row);console.log('FAIL',name,phase,String(e).slice(0,300));}finally{d.free();}
}
assert.equal(results.length,manifest.fixtures.length*4);assert.equal(hash(await readFile(manifestPath)),hash(manifestBytes));
for(const fixture of manifest.fixtures)for(const origin of ['native','xml'])assert.equal(hash(await readFile(windowsPath(fixture[origin]))),fixture[origin+'Sha256']);
for(const source of sourceHashes)assert.equal(hash(await readFile(join(root,'apps/editor/src/adapters/rhwp',source.path))),source.sha256);
assert.equal(hash(await readFile(verifierPath)),verifierSha256,'verifier bytes must stay unchanged during execution');
const fixtureHashes=await Promise.all([...manifest.fixtures.flatMap(f=>[windowsPath(f.native),windowsPath(f.xml)]),manifestPath,join(root,'apps/editor/tests/fixtures/n001-absolute168-own/generate.rs')].map(async path=>({path,sha256:hash(await readFile(path))})));
const report={fixtureHashes,engine:engine.metadata,results,failures,observations,historyPairs,wrongPasswordRefusals,sourceHashes,manifestSha256:hash(manifestBytes),verifierSha256,scope:'Own known Page/Paper absolute origins: Native/XML × signed scalar+UTF16 public prefix edit × plain/password, equal/unequal2/3 columns. No fixed44 fixture regenerated. Actual public edits with exact insertion assertions, all-body scalar/UTF16 coverage, five retained mixed-format disk cycles and two tail exports, exact Undo/Redo, unchanged production whole semantic/geometry guard0.2, source/events immutability. All shallow table-cell stories also have exact scalar/UTF16 coverage. Existing absolute overlap/body overflow is preserved, not repaired or certified. No private model, source-row/lease repair, GUI/Hancom, provider or credential access.'};
await writeFile(join(out,'result.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:results.length-failures.length,total:results.length,exports:observations.length,historyPairs,wrongPasswordRefusals}));if(failures.length)process.exitCode=1;
