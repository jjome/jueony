import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {resolve,join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {capturePreservationEvidence,verifyPreservedExport} from '../src/adapters/rhwp/preservation.ts';
import {conversionRecordFixture} from './verify-format-conversion-fixture.mjs';

const root=fileURLToPath(new URL('../../../',import.meta.url));
const pkg=resolve(process.env.JUEONY_ENGINE_PACKAGE),out=resolve(process.env.JUEONY_TEST_OUTPUT??'build/format-conversion-native');
await mkdir(out,{recursive:true});
const {default:init,HwpDocument}=await import(pathToFileURL(join(pkg,'rhwp.js')).href);
await init({module_or_path:await readFile(join(pkg,'rhwp_bg.wasm'))});
const results=[],failures=[],publicReports=[];
async function scenario(name,run){try{await run();results.push(name);console.log('PASS',name);}catch(error){failures.push({name,error:String(error),stack:error.stack});console.error('FAIL',name,error.message);}}
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
function exportArtifact(doc,format){const a=format==='hwp'?doc.exportHwpWithReport():doc.exportHwpxWithReport();try{const loss=JSON.parse(a.contentLoss());return {bytes:a.takeBytes(),loss};}finally{a.free();}}
function queryTable(doc){const ctrl=JSON.parse(doc.getControls()).find(c=>c.ctrlId==='tbl'&&c.list===0);assert.ok(ctrl);return {ctrl,properties:JSON.parse(doc.getTableProperties(0,ctrl.para,ctrl.controlIndex))};}
const sources=JSON.parse(await readFile(join(root,'.tools/public-documents/manifest.json'),'utf8')).filter(v=>v.status==='downloaded');
for(const source of sources)for(const format of ['hwp','hwpx'])await scenario(`${source.id} -> ${format}: unchanged strict export evidence and live state`,async()=>{
 const input=await readFile(join(root,'.tools/public-documents',source.file));assert.equal(hash(input),source.sha256);
 const doc=new HwpDocument(input);try{
  const before=capturePreservationEvidence(doc),originalBytes=doc.exportHwpx(),{bytes,loss}=exportArtifact(doc,format);
  const validation=verifyPreservedExport(doc,bytes,format,loss,b=>new HwpDocument(b));assert.equal(validation.status,'checked');
  assert.deepEqual(capturePreservationEvidence(doc),before);assert.deepEqual(doc.exportHwpx(),originalBytes);
  const reopened=new HwpDocument(bytes);try{const repeated=exportArtifact(reopened,format);assert.equal(verifyPreservedExport(reopened,repeated.bytes,format,repeated.loss,b=>new HwpDocument(b)).status,'checked');
   // Do not redistribute original or converted public files. Memo XML comparison
   // is performed in the ignored output folder and recorded only as booleans.
   if(source.id==='python-hwpx-1'&&format==='hwp'){
    const beforeFile=join(out,'private-notes-before.hwpx'),afterFile=join(out,'private-notes-after.hwpx');await writeFile(beforeFile,originalBytes);await writeFile(afterFile,reopened.exportHwpx());
    const inspected=spawnSync('C:/Python314/python.exe',['-c',`import sys,zipfile,xml.etree.ElementTree as E,json\nns='{http://www.hancom.co.kr/hwpml/2011/paragraph}'\ndef memos(p):\n r=E.fromstring(zipfile.ZipFile(p).read('Contents/section0.xml'));return [(e.get('type'),[t.text or '' for t in e.findall('.//'+ns+'subList/'+ns+'p/'+ns+'run/'+ns+'t')]) for e in r.iter(ns+'fieldBegin') if e.get('type')=='MEMO']\na,b=memos(sys.argv[1]),memos(sys.argv[2]);assert a==b,(a,b);assert len(a)==5,len(a);print(json.dumps({'memoCount':len(a),'allParagraphTextsEqual':True,'independentXmlInspection':True}))`,beforeFile,afterFile],{encoding:'utf8',windowsHide:true});assert.equal(inspected.status,0,inspected.stderr);await writeFile(join(out,'memo-body-xml.json'),inspected.stdout);
   }
  }finally{reopened.free();}
  publicReports.push({id:source.id,inputSha256:source.sha256,format,bytes:bytes.length,status:validation.status,liveUnchanged:true,repeatedExportChecked:true,issues:validation.issues});
 }finally{doc.free();}
});

const blank=HwpDocument.createEmpty();blank.createBlankDocument();await writeFile(join(out,'self-authored-blank.hwpx'),blank.exportHwpx());blank.free();
const latinMade=spawnSync('C:/Python314/python.exe',['-c',`import sys,zipfile,re\nfrom pathlib import Path\np=Path(sys.argv[1]);files={n:zipfile.ZipFile(p/'self-authored-blank.hwpx').read(n) for n in zipfile.ZipFile(p/'self-authored-blank.hwpx').namelist()}\nfor token in ['KEEP_WORD','HYPHENATION','BREAK_WORD']:\n h=files['Contents/header.xml'].decode();assert 'breakLatinWord=' in h;h=re.sub(r'breakLatinWord="[^"]*"','breakLatinWord="'+token+'"',h)\n with zipfile.ZipFile(p/('latin-'+token+'.hwpx'),'w',compression=zipfile.ZIP_DEFLATED) as z:\n  for n,b in files.items():z.writestr(n,h.encode() if n=='Contents/header.xml' else b)`,out],{encoding:'utf8',windowsHide:true});assert.equal(latinMade.status,0,latinMade.stderr);
for(const [unit,token] of ['KEEP_WORD','HYPHENATION','BREAK_WORD'].entries())await scenario(`self-authored Latin ${token}: effective unit and strict evidence both formats`,async()=>{
 const d=new HwpDocument(await readFile(join(out,'latin-'+token+'.hwpx')));try{assert.equal(JSON.parse(d.getParaPropertiesAt(0,0)).englishBreakUnit,unit);for(const format of ['hwp','hwpx']){const {bytes,loss}=exportArtifact(d,format);assert.equal(verifyPreservedExport(d,bytes,format,loss,b=>new HwpDocument(b)).status,'checked');const r=new HwpDocument(bytes);try{assert.equal(JSON.parse(r.getParaPropertiesAt(0,0)).englishBreakUnit,unit);}finally{r.free();}}}finally{d.free();}
});

const tableBlank=HwpDocument.createEmpty();tableBlank.createBlankDocument();tableBlank.createTable(0,0,0,2,2);await writeFile(join(out,'self-authored-table.hwpx'),tableBlank.exportHwpx());tableBlank.free();
const nestedMade=spawnSync('C:/Python314/python.exe',['-c',`import sys,zipfile,xml.etree.ElementTree as E\nfrom pathlib import Path\nE.register_namespace('hp','http://www.hancom.co.kr/hwpml/2011/paragraph');E.register_namespace('hs','http://www.hancom.co.kr/hwpml/2011/section');\np=Path(sys.argv[1]);z=zipfile.ZipFile(p/'self-authored-table.hwpx');files={n:z.read(n) for n in z.namelist()};ns='{http://www.hancom.co.kr/hwpml/2011/paragraph}'\ndef memo(i,label):\n return E.fromstring('<hp:ctrl xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph"><hp:fieldBegin id="'+str(100+i)+'" type="MEMO" name="" editable="1" dirty="1" fieldid="'+str(200+i)+'"><hp:parameters cnt="2" name=""><hp:stringParam name="Command">MEMO/65535/'+str(i)+'/0/0/reviewer/\\\\;;</hp:stringParam><hp:integerParam name="Number">'+str(i)+'</hp:integerParam></hp:parameters><hp:subList id="" textDirection="HORIZONTAL" lineWrap="BREAK" vertAlign="TOP" linkListIDRef="0" linkListNextIDRef="0" textWidth="0" textHeight="0" hasTextRef="0" hasNumRef="0"><hp:p id="0" paraPrIDRef="0" styleIDRef="0"><hp:run charPrIDRef="0"><hp:t>'+label+'</hp:t></hp:run></hp:p></hp:subList></hp:fieldBegin></hp:ctrl>')\nfor mode in ['unique','duplicate']:\n r=E.fromstring(files['Contents/section0.xml']);host=r.find(ns+'p/'+ns+'run');host.append(memo(1,'Root memo'));E.SubElement(host,ns+'t').text='root target';ending=E.SubElement(host,ns+'ctrl');E.SubElement(ending,ns+'fieldEnd',{'beginIDRef':'101','fieldid':'201'});cell=r.find('.//'+ns+'tc/'+ns+'subList/'+ns+'p/'+ns+'run');assert cell is not None;ci=1 if mode=='duplicate' else 2;cell.append(memo(ci,'Cell memo'));E.SubElement(cell,ns+'t').text='cell target';ending=E.SubElement(cell,ns+'ctrl');E.SubElement(ending,ns+'fieldEnd',{'beginIDRef':str(100+ci),'fieldid':str(200+ci)})\n with zipfile.ZipFile(p/('nested-memo-'+mode+'.hwpx'),'w',compression=zipfile.ZIP_DEFLATED) as z:\n  for n,b in files.items():z.writestr(n,E.tostring(r,encoding='utf-8') if n=='Contents/section0.xml' else b)`,out],{encoding:'utf8',windowsHide:true});assert.equal(nestedMade.status,0,nestedMade.stderr);
await scenario('self-authored root plus cell memos: owned lists keep field identity and text',async()=>{
 const d=new HwpDocument(await readFile(join(out,'nested-memo-unique.hwpx')));try{const count=d.getParagraphCount(0);const {bytes,loss}=exportArtifact(d,'hwp');assert.equal(verifyPreservedExport(d,bytes,'hwp',loss,b=>new HwpDocument(b)).status,'checked');const r=new HwpDocument(bytes);try{assert.equal(r.getParagraphCount(0),count);assert.equal(JSON.parse(r.getFieldList()).filter(v=>v.fieldType==='memo').length,2);await writeFile(join(out,'nested-memo-reopened.hwpx'),r.exportHwpx());}finally{r.free();}
  const inspected=spawnSync('C:/Python314/python.exe',['-c',`import sys,zipfile,xml.etree.ElementTree as E,json\nns='{http://www.hancom.co.kr/hwpml/2011/paragraph}';r=E.fromstring(zipfile.ZipFile(sys.argv[1]).read('Contents/section0.xml'));m=[e for e in r.iter(ns+'fieldBegin') if e.get('type')=='MEMO'];texts=[[v.text for v in e.findall('.//'+ns+'subList/'+ns+'p/'+ns+'run/'+ns+'t')] for e in m];assert texts==[['Root memo'],['Cell memo']],texts;print(json.dumps({'memoCount':2,'rootAndCellTextEqual':True}))`,join(out,'nested-memo-reopened.hwpx')],{encoding:'utf8',windowsHide:true});assert.equal(inspected.status,0,inspected.stderr);await writeFile(join(out,'nested-memo-xml.json'),inspected.stdout);
 }finally{d.free();}
});
await scenario('duplicate root and cell memo index: ambiguous carrier is retained and strict save blocked',async()=>{
 const d=new HwpDocument(await readFile(join(out,'nested-memo-duplicate.hwpx')));try{const {bytes,loss}=exportArtifact(d,'hwp'),r=new HwpDocument(bytes);try{assert.equal(r.getParagraphCount(0),d.getParagraphCount(0)+1);assert.throws(()=>verifyPreservedExport(d,bytes,'hwp',loss,b=>new HwpDocument(b)),/보존 검사/);}finally{r.free();}}finally{d.free();}
});
for(const mode of ['orphan-index','empty-carrier'])await scenario(`self-authored ${mode}: whole ownership resolution refuses partial attachment`,async()=>{
 const d=new HwpDocument(await readFile(join(out,'nested-memo-unique.hwpx')));try{let changed=false,pending=false;const original=exportArtifact(d,'hwp');
  const bytes=conversionRecordFixture(original.bytes,({tag,level,data})=>{
   if(changed)return false;
   if(tag===93&&level===1){if(mode==='orphan-index'){assert.equal(data.length,4);data.writeUInt32LE(99,0);changed=true;return true;}pending=true;}
   if(mode==='empty-carrier'&&pending&&tag===72&&level===1){data.writeUInt32LE(0,0);changed=true;return true;}
   return false;
  });assert.equal(changed,true);const r=new HwpDocument(bytes);try{assert.equal(r.getParagraphCount(0),d.getParagraphCount(0)+1);assert.equal(JSON.parse(r.getFieldList()).filter(v=>v.fieldType==='memo').length,0);assert.throws(()=>verifyPreservedExport(d,bytes,'hwp',original.loss,b=>new HwpDocument(b)),error=>error.report?.issues.some(i=>i.code==='changed')&&!error.report.issues.some(i=>i.path==='serializer-report'));}finally{r.free();}
 }finally{d.free();}
});

for(const flow of [false,true])for(const overlap of [false,true])await scenario(`self-authored flow=${flow} overlap=${overlap}: getter is resolved common state`,()=>{
 const doc=HwpDocument.createEmpty();doc.createBlankDocument();try{
  doc.createTable(0,0,0,2,2);let {ctrl}=queryTable(doc);doc.setTableProperties(0,ctrl.para,ctrl.controlIndex,JSON.stringify({restrictInPage:flow,allowOverlap:overlap}));
  const before=queryTable(doc);assert.equal(before.properties.restrictInPage,flow);assert.equal(before.properties.allowOverlap,overlap);
  for(const format of ['hwp','hwpx']){const {bytes,loss}=exportArtifact(doc,format);assert.equal(verifyPreservedExport(doc,bytes,format,loss,b=>new HwpDocument(b)).status,'checked');const r=new HwpDocument(bytes);try{assert.equal(queryTable(r).properties.restrictInPage,flow);assert.equal(queryTable(r).properties.allowOverlap,overlap);}finally{r.free();}}
 }finally{doc.free();}
});
await scenario('self-authored locked and unlocked table: lock survives HWP then HWPX',()=>{
 for(const locked of [false,true]){const d=HwpDocument.createEmpty();d.createBlankDocument();try{d.createTable(0,0,0,2,2);const {ctrl}=queryTable(d);d.setControlLock(ctrl.para,ctrl.controlIndex,locked);for(const format of ['hwp','hwpx']){const {bytes,loss}=exportArtifact(d,format);assert.equal(verifyPreservedExport(d,bytes,format,loss,b=>new HwpDocument(b)).status,'checked');const r=new HwpDocument(bytes);try{assert.equal(Number(queryTable(r).ctrl.props.Lock),Number(locked));}finally{r.free();}}}finally{d.free();}}
});
await scenario('reopened table lock changes preserve both raw-cache and sealed source paths',()=>{
 const blank=HwpDocument.createEmpty();blank.createBlankDocument();blank.createTable(0,0,0,2,2);
 try{for(const sourceFormat of ['hwp','hwpx']){const source=sourceFormat==='hwp'?blank.exportHwp():blank.exportHwpx(),d=new HwpDocument(source);try{for(const locked of [true,false]){const {ctrl}=queryTable(d);d.setControlLock(ctrl.para,ctrl.controlIndex,locked);for(const format of ['hwp','hwpx']){const {bytes,loss}=exportArtifact(d,format);assert.equal(verifyPreservedExport(d,bytes,format,loss,b=>new HwpDocument(b)).status,'checked');const r=new HwpDocument(bytes);try{assert.equal(Number(queryTable(r).ctrl.props.Lock),Number(locked));}finally{r.free();}}}}finally{d.free();}}}finally{blank.free();}
});
await scenario('preservation still rejects real flow, overlap and lock corruption',()=>{
 const d=HwpDocument.createEmpty();d.createBlankDocument();try{d.createTable(0,0,0,2,2);const baseline=d.exportHwpx();for(const name of ['restrictInPage','allowOverlap','Lock']){const changed=new HwpDocument(baseline);try{const {ctrl}=queryTable(changed);if(name==='Lock')changed.setControlLock(ctrl.para,ctrl.controlIndex,true);else changed.setTableProperties(0,ctrl.para,ctrl.controlIndex,JSON.stringify({[name]:!queryTable(d).properties[name]}));const corrupted=exportArtifact(changed,'hwpx');assert.throws(()=>verifyPreservedExport(d,corrupted.bytes,'hwpx',corrupted.loss,b=>new HwpDocument(b)),error=>error.report?.issues.some(i=>i.code==='changed')&&!error.report.issues.some(i=>i.path==='serializer-report'));}finally{changed.free();}}}finally{d.free();}
});
await writeFile(join(out,'result.json'),JSON.stringify({results,failures,publicReports,engine:JSON.parse(await readFile(join(pkg,'jueony-engine-build.json'),'utf8')),note:'Native WASM and repeated same-engine export; Hancom comparison NOT_RUN. Public source and converted bytes remain ignored and are not distribution inputs.'},null,2));
if(failures.length)process.exitCode=1;
