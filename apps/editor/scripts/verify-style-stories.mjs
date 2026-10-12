import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
const repo=resolve(dirname(fileURLToPath(import.meta.url)),'../../..'),pkg=resolve(repo,process.env.JUEONY_ENGINE_PACKAGE),out=resolve(repo,process.env.JUEONY_TEST_OUTPUT??'docs/evidence/pre-agent-2026-10-13/style-stories');
const {default:init,HwpDocument}=await import(pathToFileURL(resolve(pkg,'rhwp.js')).href);await init({module_or_path:await readFile(resolve(pkg,'rhwp_bg.wasm'))});await mkdir(out,{recursive:true});
const parse=v=>typeof v==='string'?JSON.parse(v):v,results=[],failures=[],python=process.env.JUEONY_TEST_PYTHON??'C:/Python314/python.exe',fixture=resolve(repo,'apps/editor/scripts/style-stories-fixture.py');
for(const format of ['hwp','hwpx']){
 const name=`${format}: nested cells/header/footer/footnote inherit style changes without replacing direct formatting`;let source,doc,reopened;
 try{
  source=HwpDocument.createEmpty();source.createBlankDocument();source.insertText(0,0,0,'본문 스타일');
  const sid=source.createStyle(JSON.stringify({name:'특수 영역 스타일'}));source.updateStyleShapes(sid,JSON.stringify({fontSize:1100}),'{}');
  const cid=parse(source.getStyleList()).find(s=>s.id===sid).charShapeId;
  source.applyCharFormat(0,0,0,2,JSON.stringify({italic:true}));const override=parse(source.getCharPropertiesAt(0,0,0)).charShapeId;
  const table=parse(source.createTable(0,0,7,2,2));source.insertTextInCell(0,table.paraIdx,table.controlIdx,0,0,0,'중첩 셀');source.insertTextInCell(0,table.paraIdx,table.controlIdx,1,0,0,'직접 서식');
  for(const header of [true,false]){source.createHeaderFooter(0,header,0);source.insertTextInHeaderFooter(0,header,0,0,0,header?'머리말 스타일':'꼬리말 스타일');}
  const note=parse(source.insertFootnote(0,0,1));source.insertTextInFootnote(0,note.paraIdx,note.controlIdx,0,2,'각주 스타일');
  const base=resolve(out,'base.hwpx'),prepared=resolve(out,'stories.hwpx');await writeFile(base,source.exportHwpx());execFileSync(python,[fixture,'prepare',base,prepared,String(sid),String(cid),String(override)],{windowsHide:true});
  doc=new HwpDocument(await readFile(prepared));const before=doc.getTextFileUnicode(),snapshot=doc.saveSnapshot();
  assert.equal(doc.styleShapeStoriesEnabled(),true);assert.equal(doc.updateStyleShapes(sid,JSON.stringify({fontSize:1700}),'{}'),true);assert.equal(doc.getTextFileUnicode(),before);
  const changed=doc[format==='hwp'?'exportHwp':'exportHwpx']();await writeFile(resolve(out,'style-stories.'+format),changed);reopened=new HwpDocument(changed);
  const inspect=resolve(out,'inspection-'+format+'.hwpx');await writeFile(inspect,reopened.exportHwpx());
  const rows=JSON.parse(execFileSync(python,[fixture,'inspect',inspect],{encoding:'utf8',windowsHide:true}));
  for(const text of ['본문','중첩 셀','머리말','꼬리말','각주'])assert.ok(rows.some(r=>r.text.includes(text)),text);
  for(const row of rows){assert.equal(row.style,sid);assert.equal(row.size,row.text.includes('직접 서식')?1000:1700,JSON.stringify(row));}
  doc.restoreSnapshot(snapshot);const restored=resolve(out,'restored-'+format+'.hwpx');await writeFile(restored,doc.exportHwpx());
  const old=JSON.parse(execFileSync(python,[fixture,'inspect',restored],{encoding:'utf8',windowsHide:true}));for(const row of old)assert.equal(row.size,row.text.includes('직접 서식')?1000:1100);
  results.push(name);console.log('PASS',name);
 }catch(error){failures.push({name,error:String(error),stack:error.stack});console.error('FAIL',name,error);}finally{reopened?.free();doc?.free();source?.free();}
}
for(const endnote of [false,true]){
 const name=`${endnote?'endnote':'footnote'} query JSON escapes literal tab, quotes, backslash and Unicode`;let doc;
 try{
  doc=HwpDocument.createEmpty();doc.createBlankDocument();doc.insertText(0,0,0,'본문');
  const ref=parse(doc[endnote?'insertEndnote':'insertFootnote'](0,0,1)),text='한😀글\t"인용"\\';
  doc.insertTextInFootnote(0,ref.paraIdx,ref.controlIdx,0,2,text);
  assert.ok(parse(doc.getFootnoteInfo(0,ref.paraIdx,ref.controlIdx)).texts[0].includes(text));results.push(name);console.log('PASS',name);
 }catch(error){failures.push({name,error:String(error),stack:error.stack});console.error('FAIL',name,error);}finally{doc?.free();}
}
await writeFile(resolve(out,'result.json'),JSON.stringify({results,failures,engine:JSON.parse(await readFile(resolve(pkg,'jueony-engine-build.json'),'utf8')),scope:'Synthetic native-WASM edits, independent serialized XML and snapshot restoration; not Hancom visual parity.'},null,2));if(failures.length)process.exitCode=1;
